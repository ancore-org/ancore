# Ancore Documentation

## Getting started

| Document | Purpose |
|----------|---------|
| [Local services](development/local-services.md) | Run indexer, relayer, and postgres locally |
| [Integration guide](integration-guide.md) | Build on the Ancore SDK |
| [SDK wrappers](sdk-wrappers.md) | High-level SDK usage patterns |
| [Contract methods](contract-methods.md) | Soroban account contract API |
| [dApp API reference](api-reference.md) | Complete dApp message protocol and response formats |
| [API reference (OpenAPI)](api-reference.yaml) | OpenAPI spec for services |
| [Roadmap](ROADMAP.md) | Delivery status and open successor trackers |

## Architecture

| Document | Purpose |
|----------|---------|
| [System overview](architecture/OVERVIEW.md) | High-level architecture |
| [Transaction flow](architecture/TRANSACTION_FLOW.md) | dApp, extension, vault, session key, relayer, and blockchain flow |
| [Architecture flow diagram](architecture/flow.md) | Component diagram with the session-key vs vault signing decision |
| [WASM validation](architecture/WASM_VALIDATION.md) | Off-chain attestation and on-chain enforcement of contract WASM policy |

## Examples

| Document | Purpose |
|----------|---------|
| [Send payment](examples/send-payment.md) | Payment flow with the SDK |
| [Session key lifecycle](examples/session-key-lifecycle.md) | Create, use, and revoke session keys |
| [Batch session keys](examples/batch-session-keys.md) | Batch multiple session key requests with AncoreClient |
| [Session key execute](examples/session-key-execute.md) | Execute with a session key |
| [Event decoder usage](examples/event-decoder-usage.md) | Decode contract events |
| [Invoice lifecycle](invoice-lifecycle.md) | Issue, pay, cancel, and expire on-chain payment requests |

## User guide

| Document | Purpose |
|----------|---------|
| [Getting started](user-guide/GETTING_STARTED.md) | Onboarding guide |
| [Features](user-guide/FEATURES.md) | Feature overview |
| [FAQ](user-guide/FAQ.md) | Frequently asked questions |
| [Troubleshooting](user-guide/TROUBLESHOOTING.md) | Common issues and fixes |
| [Error-code troubleshooting](troubleshooting.md) | Recovery steps for common wallet and transaction errors |
| [Simulation errors](troubleshooting/simulation-errors.md) | Common Soroban RPC simulation errors and fixes |

## Security

| Document | Purpose |
|----------|---------|
| [Threat model](security/THREAT_MODEL.md) | Attack surface and mitigations |
| [Cryptography](security/CRYPTOGRAPHY.md) | Cryptographic primitives and usage |
| [Extension wallet](security/extension-wallet.md) | CSP and wallet security |
| [Audit checklist](security/AUDIT_CHECKLIST.md) | Pre-audit preparation checklist |
| [Incident response](security/INCIDENT_RESPONSE.md) | Security and production incident playbook |
| [Extension wallet privacy](privacy/extension-wallet.md) | Opt-in usage analytics and privacy controls |
| [Dependency audit gate](security/dependency-audit.md) | CI audit gate and local triage steps |
| [Internal audit: account contract v0](security/INTERNAL_AUDIT_v0.md) | Findings and fixes from the internal account contract review |

## Operations

| Document | Purpose |
|----------|---------|
| [Ops overview](ops/README.md) | Prometheus alerts, dashboards, and SLOs |
| [SLO definitions](ops/slo-definitions.md) | SLI/SLO targets and error budget policy |
| [Indexer metrics](ops/indexer-metrics.md) | Prometheus metrics exposed by the indexer service |
| [Triage failed relay by trace](ops/runbooks/triage-failed-relay-by-trace.md) | Locate a failed relay request using its trace ID |
| [Indexer backfill and dead-letter reprocessing](ops/runbooks/indexer-backfill-and-dead-letter-reprocessing.md) | Recover missed or failed indexed events |

## Release

| Document | Purpose |
|----------|---------|
| [Release checklist](release/checklist.md) | CI-parsed gate checklist for releases |
| [Release runbook](release/runbook.md) | Step-by-step release procedure |
| [Mobile release](release/mobile.md) | TestFlight / Play internal pipeline |
| [Upgrade and migration runbook](release/upgrade-migration.md) | Execute smart account contract upgrades on testnet and mainnet |

## Testing

| Document | Purpose |
|----------|---------|
| [Extension e2e setup](testing/extension-e2e-setup.md) | Playwright setup for the real built extension artifact |
| [Mobile e2e setup](testing/mobile-e2e-setup.md) | Maestro setup for device-level wallet validation |
| [Background handlers coverage](testing/extension-handlers-coverage.md) | Vitest coverage thresholds for background handlers |
| [Dashboard test boundaries](dashboard-test-boundaries.md) | Storage, download, and validation coverage boundaries |
| [Mobile validation boundaries](mobile-validation-boundaries.md) | Relayer validation, release gating, and storage failure coverage |
| [Agent and UI boundaries](agent-ui-boundaries.md) | AI auth, shared UI timers, native onboarding, and contacts coverage |

## Product

| Document | Purpose |
|----------|---------|
| [Product requirements](product/PRD.md) | MVP product vision, audience, and requirements |
| [Financial OS roadmap](product/FINANCIAL_OS_ROADMAP.md) | Product phases for the Stellar financial operating system |

## Guides

| Document | Purpose |
|----------|---------|
| [Session keys](guides/session-keys.md) | Scoped, time-bound session key lifecycle |
| [Contributor assignment](guides/contributor-assignment.md) | GitHub issue assignment rules and procedures |

## RFCs

| Document | Purpose |
|----------|---------|
| [RFC template](rfcs/0000-template.md) | Template for new change proposals |
| [RFC 0001: WebAuthn passkey onboarding](rfcs/0001-webauthn-passkey-onboarding.md) | Passkey-based P-256 session key onboarding |
| [RFC 294: hardening backlog seeding](rfcs/294-hardening-backlog-seeding.md) | Track deferred audit and review findings |

## Other

| Document | Purpose |
|----------|---------|
| [Extension target architecture](architecture/WALLET_EXTENSION.md) | Freighter-informed extension design |
| [Freighter comparison (extension + mobile)](wallets/FREIGHTER_COMPARISON.md) | Production wallet patterns — adoption checklist |
| [Ledger WebHID signing](wallets/LEDGER.md) | Hardware owner-key signing, limits vs session keys |
| [AGENTS.md](../AGENTS.md) | Monorepo agent guide |
| [AI intents](ai/intents.md) | Draft intent types for the AI agent MVP |
| [Indexer events](indexer/contract-events.md) | Contract events indexed by the indexer service |
| [Indexer schema and migrations](../services/indexer/SCHEMA_MIGRATION.md) | Indexer tables, indexes, and the migration process |
| [Extension E2E smoke](testing/extension-e2e-smoke.md) | Browser extension smoke test guide |
| [Common error codes troubleshooting](troubleshooting/error-codes.md) | Common error codes, root causes, and recovery steps |
| [Extension build troubleshooting](troubleshooting/extension-build.md) | Build failures and fixes |
| [Privacy policy](PRIVACY_POLICY.md) | Privacy policy draft |
| [Terms of service](TERMS_OF_SERVICE.md) | Terms of service draft |
| [RFCs](rfcs/) | Major change proposals |
