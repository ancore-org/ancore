# Ancore Documentation

## Getting started

| Document | Purpose |
|----------|---------|
| [Local services](development/local-services.md) | Run indexer, relayer, and postgres locally |
| [Integration guide](integration-guide.md) | Build on the Ancore SDK |
| [SDK wrappers](sdk-wrappers.md) | High-level SDK usage patterns |
| [Contract methods](contract-methods.md) | Soroban account contract API |
| [API reference](api-reference.yaml) | OpenAPI spec for services |

## Architecture

| Document | Purpose |
|----------|---------|
| [System overview](architecture/OVERVIEW.md) | High-level architecture |

## Examples

| Document | Purpose |
|----------|---------|
| [Send payment](examples/send-payment.md) | Payment flow with the SDK |
| [Session key lifecycle](examples/session-key-lifecycle.md) | Create, use, and revoke session keys |
| [Session key execute](examples/session-key-execute.md) | Execute with a session key |
| [Event decoder usage](examples/event-decoder-usage.md) | Decode contract events |

## User guide

| Document | Purpose |
|----------|---------|
| [Getting started](user-guide/GETTING_STARTED.md) | Onboarding guide |
| [Features](user-guide/FEATURES.md) | Feature overview |
| [FAQ](user-guide/FAQ.md) | Frequently asked questions |
| [Troubleshooting](user-guide/TROUBLESHOOTING.md) | Common issues and fixes |

## Security

| Document | Purpose |
|----------|---------|
| [Threat model](security/THREAT_MODEL.md) | Attack surface and mitigations |
| [Cryptography](security/CRYPTOGRAPHY.md) | Cryptographic primitives and usage |
| [Extension wallet](security/extension-wallet.md) | CSP and wallet security |
| [Audit checklist](security/AUDIT_CHECKLIST.md) | Pre-audit preparation checklist |
| [Incident response](security/INCIDENT_RESPONSE.md) | Security and production incident playbook |

## Operations

| Document | Purpose |
|----------|---------|
| [Ops overview](ops/README.md) | Prometheus alerts, dashboards, and SLOs |
| [SLO definitions](ops/slo-definitions.md) | SLI/SLO targets and error budget policy |

## Release

| Document | Purpose |
|----------|---------|
| [Release checklist](release/checklist.md) | CI-parsed gate checklist for releases |
| [Release runbook](release/runbook.md) | Step-by-step release procedure |

## Other

| Document | Purpose |
|----------|---------|
| [Extension target architecture](architecture/WALLET_EXTENSION.md) | Freighter-informed extension design |
| [Freighter comparison (extension + mobile)](wallets/FREIGHTER_COMPARISON.md) | Production wallet patterns — adoption checklist |
| [AGENTS.md](../AGENTS.md) | Monorepo agent guide |
| [AI intents](ai/intents.md) | Draft intent types for the AI agent MVP |
| [Indexer events](indexer/contract-events.md) | Contract events indexed by the indexer service |
| [Extension E2E smoke](testing/extension-e2e-smoke.md) | Browser extension smoke test guide |
| [Extension build troubleshooting](troubleshooting/extension-build.md) | Build failures and fixes |
| [Privacy policy](PRIVACY_POLICY.md) | Privacy policy draft |
| [Terms of service](TERMS_OF_SERVICE.md) | Terms of service draft |
| [RFCs](rfcs/) | Major change proposals |
