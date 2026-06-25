# Canonical Payload Fixtures

This directory contains golden test fixtures for canonical payload construction.

## Purpose

These fixtures ensure that the canonical payload builder produces consistent output across versions. Any unintended changes to the payload format will cause test failures, preventing silent breakage of signature verification between clients and servers.

## Structure

Each fixture file contains:
- `description`: Human-readable description of the test case
- `input`: The relay request fields (sessionKey, operation, nonce)
- `expectedPayload`: The hex-encoded canonical payload
- `expectedHash`: SHA-256 hash of the expectedPayload for version pinning
- `version`: Format version identifier (currently `v1`)

## Fixtures

| File | Description |
|------|-------------|
| `canonical-payload-execute.json` | Standard relay_execute operation |
| `canonical-payload-add-session-key.json` | Add session key operation |
| `canonical-payload-revoke-session-key.json` | Revoke session key operation |
| `canonical-payload-high-nonce.json` | Maximum safe integer nonce value |
| `canonical-payload-zero-nonce.json` | Zero nonce edge case |

## Versioning

The canonical payload format is currently at version `v1`:

```typescript
{
  "sessionKey": "<64-char-hex>",
  "operation": "<operation-name>",
  "nonce": <integer>
}
```

Serialized as compact JSON, UTF-8 encoded, then hex-encoded.

### Adding Fields (Version Bump Required)

When adding new fields to the canonical payload:

1. Create new fixtures with version `v2`
2. Update the builder to support both versions
3. Add migration path documentation
4. Update OpenAPI schema references

### Accepting Intentional Changes

If a test fails due to an intentional format change:

1. Verify the change is necessary and documented
2. Update the `expectedPayload` and `expectedHash` in the fixture
3. Increment the `version` field
4. Document the change in this README
5. Update the OpenAPI schema to reflect the new format

**Do not blindly update fixtures.** Each change must be reviewed for backward compatibility implications.

## Usage in Tests

```typescript
import executeFixture from '../../../fixtures/canonical-payload-execute.json';
import { buildCanonicalPayload, hashPayload } from '../builder';

it('matches golden fixture', () => {
  const payload = buildCanonicalPayload(executeFixture.input);
  expect(payload).toBe(executeFixture.expectedPayload);
  expect(hashPayload(payload)).toBe(executeFixture.expectedHash);
});
```

## CI Integration

The test suite runs these fixtures in CI. Any failure indicates:
- Unintended change to payload construction
- Breaking change requiring version bump
- Need to update client SDK implementations

## OpenAPI Schema Reference

The canonical payload structure is defined in `services/relayer/openapi.yaml`:

```yaml
components:
  schemas:
    RelayExecuteRequest:
      properties:
        sessionKey:
          type: string
          pattern: '^[0-9a-fA-F]{64}$'
        operation:
          type: string
          enum: [relay_execute, add_session_key, revoke_session_key]
        nonce:
          type: integer
          minimum: 0
```

Any changes to these schema fields must be reflected in new fixture versions.
