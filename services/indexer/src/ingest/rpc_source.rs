//! Production [`EventSource`] backed by Soroban RPC's `getEvents` JSON-RPC
//! method.
//!
//! This is the piece the rest of the ingestion pipeline (worker,
//! checkpointing, backfill command, sink) was already built and tested
//! around but never had: every other [`EventSource`] impl in this crate
//! (`VecSource`) is test-only. Before this, there was no way to actually
//! run this indexer against a live network.
//!
//! Soroban RPC reference: <https://developers.stellar.org/docs/data/rpc/api-reference/methods/getEvents>

use std::time::Duration;

use anyhow::Context;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tracing::warn;

use super::source::EventSource;
use crate::schema::canonical::RawEvent;

const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);

/// Configuration for [`RpcEventSource`].
#[derive(Debug, Clone)]
pub struct RpcSourceConfig {
    /// Base URL of the Soroban RPC endpoint, e.g.
    /// `https://soroban-testnet.stellar.org`.
    pub rpc_url: String,
    /// Restrict `getEvents` to these contract IDs. Empty means "all
    /// contracts" — Soroban RPC accepts a filter with no `contractIds` to
    /// mean unfiltered, but most deployments will want to scope this to
    /// the account-contract WASM hash / known contract addresses to keep
    /// response volume manageable.
    pub contract_ids: Vec<String>,
}

/// Fetches contract events from a live Soroban RPC node via `getEvents`.
pub struct RpcEventSource {
    client: Client,
    config: RpcSourceConfig,
}

impl RpcEventSource {
    pub fn new(config: RpcSourceConfig) -> Self {
        let client = Client::builder()
            .timeout(DEFAULT_TIMEOUT)
            .build()
            .expect("reqwest client with default TLS backend should always build");
        Self { client, config }
    }

    /// Build a client against an already-configured `reqwest::Client` —
    /// used by tests to point at a mock server with test-friendly timeouts.
    #[cfg(test)]
    fn with_client(config: RpcSourceConfig, client: Client) -> Self {
        Self { client, config }
    }
}

#[async_trait::async_trait]
impl EventSource for RpcEventSource {
    /// Fetch up to `limit` events with `ledger_seq > after_ledger`.
    ///
    /// Soroban RPC's `getEvents` is ledger-range-based, not strictly
    /// "greater than a cursor" — it takes a `startLedger`, so this issues
    /// `startLedger = after_ledger + 1` and relies on the RPC's own
    /// `limit`. The caller (`IngestWorker`/`BackfillCommand`) already
    /// treats an empty response as "source exhausted for this call" and
    /// re-polls on the next tick, which is the right behavior here too:
    /// `startLedger` may be ahead of the chain tip (nothing to return yet)
    /// without that being an error.
    async fn fetch(&mut self, after_ledger: u32, limit: usize) -> anyhow::Result<Vec<RawEvent>> {
        let start_ledger = after_ledger.saturating_add(1);
        let response = self
            .call_get_events(start_ledger, limit)
            .await
            .context("getEvents RPC call")?;

        let mut out = Vec::with_capacity(response.events.len());
        for event in response.events {
            match convert_event(event) {
                Ok(raw) => out.push(raw),
                Err(err) => {
                    // Matches this crate's existing "never stall the
                    // pipeline on one bad record" posture (see
                    // `normalise`'s doc comment) — a single malformed
                    // event from the RPC shouldn't take down the whole
                    // fetch when the rest of the batch is fine.
                    warn!(error = %err, "skipping unparseable event from getEvents response");
                }
            }
        }
        Ok(out)
    }
}

impl RpcEventSource {
    async fn call_get_events(
        &self,
        start_ledger: u32,
        limit: usize,
    ) -> anyhow::Result<GetEventsResult> {
        let mut filter = json!({ "type": "contract" });
        if !self.config.contract_ids.is_empty() {
            filter["contractIds"] = json!(self.config.contract_ids);
        }

        let request_body = JsonRpcRequest {
            jsonrpc: "2.0",
            id: 1,
            method: "getEvents",
            params: json!({
                "startLedger": start_ledger,
                "filters": [filter],
                "pagination": { "limit": limit },
            }),
        };

        let response = self
            .client
            .post(&self.config.rpc_url)
            .json(&request_body)
            .send()
            .await
            .context("send getEvents request")?;

        let status = response.status();
        let body_text = response
            .text()
            .await
            .context("read getEvents response body")?;

        if !status.is_success() {
            anyhow::bail!("getEvents returned HTTP {status}: {body_text}");
        }

        let parsed: JsonRpcResponse<GetEventsResult> = serde_json::from_str(&body_text)
            .with_context(|| format!("parse getEvents response: {body_text}"))?;

        if let Some(error) = parsed.error {
            anyhow::bail!("getEvents RPC error {}: {}", error.code, error.message);
        }

        parsed
            .result
            .context("getEvents response had neither `result` nor `error`")
    }
}

// ── Wire types ──────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct JsonRpcRequest<'a> {
    jsonrpc: &'a str,
    id: u32,
    method: &'a str,
    params: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct JsonRpcResponse<T> {
    #[serde(default)]
    result: Option<T>,
    #[serde(default)]
    error: Option<JsonRpcError>,
}

#[derive(Debug, Deserialize)]
struct JsonRpcError {
    code: i64,
    message: String,
}

#[derive(Debug, Default, Deserialize)]
struct GetEventsResult {
    events: Vec<RpcEvent>,
    #[allow(dead_code)] // not yet consumed — see the module doc's out-of-scope note on reorg handling
    #[serde(rename = "latestLedger")]
    latest_ledger: Option<u64>,
}

/// A single event entry as returned by Soroban RPC's `getEvents`. Field
/// names mirror the RPC response's camelCase JSON keys exactly.
#[derive(Debug, Deserialize)]
struct RpcEvent {
    ledger: StringOrNumber,
    #[serde(rename = "ledgerClosedAt")]
    ledger_closed_at: String,
    #[serde(rename = "contractId")]
    contract_id: String,
    #[serde(rename = "txHash")]
    tx_hash: String,
    topic: Vec<String>,
    /// Present on value-carrying events; absent on some diagnostic events.
    /// Kept as-is (base64 XDR) — decoding happens in `normalise()`, not here.
    #[serde(default)]
    value: String,
}

/// Soroban RPC has historically returned `ledger` as either a JSON number
/// or a numeric string across versions/endpoints — accept both rather than
/// erroring on a node that formats it differently than expected.
#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum StringOrNumber {
    String(String),
    Number(u64),
}

impl StringOrNumber {
    fn as_u32(&self) -> anyhow::Result<u32> {
        let parsed: u64 = match self {
            StringOrNumber::String(s) => s
                .parse()
                .with_context(|| format!("ledger sequence {s:?} is not a valid number"))?,
            StringOrNumber::Number(n) => *n,
        };
        u32::try_from(parsed).context("ledger sequence exceeds u32::MAX")
    }
}

fn convert_event(event: RpcEvent) -> anyhow::Result<RawEvent> {
    let ledger_seq = event.ledger.as_u32()?;
    let ledger_close_time = chrono::DateTime::parse_from_rfc3339(&event.ledger_closed_at)
        .with_context(|| format!("parse ledgerClosedAt {:?}", event.ledger_closed_at))?
        .with_timezone(&chrono::Utc);

    Ok(RawEvent {
        ledger_seq,
        ledger_close_time,
        tx_hash: event.tx_hash,
        contract_id: event.contract_id,
        topics: event.topic,
        data: event.value,
    })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::matchers::{method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn make_source(config: RpcSourceConfig) -> RpcEventSource {
        let client = Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap();
        RpcEventSource::with_client(config, client)
    }

    fn sample_event(ledger: &str, topic: Vec<&str>) -> serde_json::Value {
        json!({
            "type": "contract",
            "ledger": ledger,
            "ledgerClosedAt": "2024-06-01T12:00:00Z",
            "contractId": "CTEST0000000000000000000000000000000000000000000000000",
            "id": format!("{ledger}-0000000001"),
            "pagingToken": format!("{ledger}-0000000001"),
            "topic": topic,
            "value": "AAAAAA==",
            "inSuccessfulContractCall": true,
            "txHash": format!("{:0>64}", ledger),
        })
    }

    #[tokio::test]
    async fn fetch_converts_events_into_raw_events() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "jsonrpc": "2.0",
                "id": 1,
                "result": {
                    "events": [sample_event("100", vec!["transfer"])],
                    "latestLedger": 200,
                    "cursor": "100-1"
                }
            })))
            .mount(&server)
            .await;

        let mut source = make_source(RpcSourceConfig {
            rpc_url: server.uri(),
            contract_ids: vec![],
        });

        let events = source.fetch(99, 50).await.unwrap();

        assert_eq!(events.len(), 1);
        assert_eq!(events[0].ledger_seq, 100);
        assert_eq!(events[0].topics, vec!["transfer".to_string()]);
        assert_eq!(events[0].tx_hash.len(), 64);
    }

    #[tokio::test]
    async fn fetch_requests_start_ledger_one_past_after_ledger() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "jsonrpc": "2.0",
                "id": 1,
                "result": { "events": [], "latestLedger": 200 }
            })))
            .mount(&server)
            .await;

        let mut source = make_source(RpcSourceConfig {
            rpc_url: server.uri(),
            contract_ids: vec![],
        });
        source.fetch(99, 50).await.unwrap();

        let requests = server.received_requests().await.unwrap();
        assert_eq!(requests.len(), 1);
        let body: serde_json::Value = requests[0].body_json().unwrap();
        assert_eq!(body["params"]["startLedger"], 100);
    }

    #[tokio::test]
    async fn fetch_returns_empty_vec_when_no_events() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "jsonrpc": "2.0",
                "id": 1,
                "result": { "events": [], "latestLedger": 200 }
            })))
            .mount(&server)
            .await;

        let mut source = make_source(RpcSourceConfig {
            rpc_url: server.uri(),
            contract_ids: vec![],
        });

        let events = source.fetch(199, 50).await.unwrap();
        assert!(events.is_empty());
    }

    #[tokio::test]
    async fn fetch_propagates_json_rpc_error() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "jsonrpc": "2.0",
                "id": 1,
                "error": { "code": -32600, "message": "start ledger before oldest ledger" }
            })))
            .mount(&server)
            .await;

        let mut source = make_source(RpcSourceConfig {
            rpc_url: server.uri(),
            contract_ids: vec![],
        });

        let result = source.fetch(1, 50).await;
        let err = result.unwrap_err();
        // `to_string()` on an anyhow::Error only shows the outermost
        // `.context(...)` layer — check the full chain for the underlying
        // JSON-RPC error message.
        let full_chain = err
            .chain()
            .map(|e| e.to_string())
            .collect::<Vec<_>>()
            .join(": ");
        assert!(
            full_chain.contains("oldest ledger"),
            "chain was: {full_chain}"
        );
    }

    #[tokio::test]
    async fn fetch_errors_on_http_failure_status() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/"))
            .respond_with(ResponseTemplate::new(503).set_body_string("service unavailable"))
            .mount(&server)
            .await;

        let mut source = make_source(RpcSourceConfig {
            rpc_url: server.uri(),
            contract_ids: vec![],
        });

        let result = source.fetch(1, 50).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn fetch_skips_single_malformed_event_without_failing_the_whole_batch() {
        let server = MockServer::start().await;
        let mut bad_event = sample_event("101", vec!["transfer"]);
        bad_event["ledgerClosedAt"] = json!("not-a-valid-timestamp");

        Mock::given(method("POST"))
            .and(path("/"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "jsonrpc": "2.0",
                "id": 1,
                "result": {
                    "events": [sample_event("100", vec!["transfer"]), bad_event],
                    "latestLedger": 200
                }
            })))
            .mount(&server)
            .await;

        let mut source = make_source(RpcSourceConfig {
            rpc_url: server.uri(),
            contract_ids: vec![],
        });

        let events = source.fetch(99, 50).await.unwrap();
        assert_eq!(
            events.len(),
            1,
            "the one well-formed event must still come through"
        );
        assert_eq!(events[0].ledger_seq, 100);
    }

    #[tokio::test]
    async fn fetch_sends_configured_contract_id_filter() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "jsonrpc": "2.0",
                "id": 1,
                "result": { "events": [], "latestLedger": 200 }
            })))
            .mount(&server)
            .await;

        let mut source = make_source(RpcSourceConfig {
            rpc_url: server.uri(),
            contract_ids: vec!["CAAA...".to_string(), "CBBB...".to_string()],
        });
        source.fetch(1, 50).await.unwrap();

        let requests = server.received_requests().await.unwrap();
        let body: serde_json::Value = requests[0].body_json().unwrap();
        assert_eq!(
            body["params"]["filters"][0]["contractIds"],
            json!(["CAAA...", "CBBB..."])
        );
    }

    #[tokio::test]
    async fn fetch_omits_contract_id_filter_when_unconfigured() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "jsonrpc": "2.0",
                "id": 1,
                "result": { "events": [], "latestLedger": 200 }
            })))
            .mount(&server)
            .await;

        let mut source = make_source(RpcSourceConfig {
            rpc_url: server.uri(),
            contract_ids: vec![],
        });
        source.fetch(1, 50).await.unwrap();

        let requests = server.received_requests().await.unwrap();
        let body: serde_json::Value = requests[0].body_json().unwrap();
        assert!(body["params"]["filters"][0].get("contractIds").is_none());
    }

    #[tokio::test]
    async fn fetch_accepts_numeric_ledger_field_as_well_as_string() {
        let server = MockServer::start().await;
        let mut event = sample_event("0", vec!["transfer"]);
        event["ledger"] = json!(105); // numeric, not string
        Mock::given(method("POST"))
            .and(path("/"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "jsonrpc": "2.0",
                "id": 1,
                "result": { "events": [event], "latestLedger": 200 }
            })))
            .mount(&server)
            .await;

        let mut source = make_source(RpcSourceConfig {
            rpc_url: server.uri(),
            contract_ids: vec![],
        });

        let events = source.fetch(99, 50).await.unwrap();
        assert_eq!(events[0].ledger_seq, 105);
    }
}
