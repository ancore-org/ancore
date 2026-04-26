# Load / Performance Test Results — Evidence Template

---

## Test Metadata

| Field | Value |
|-------|-------|
| Tool | (k6 / Locust / other) |
| Target environment | staging |
| Test date | |
| Conducted by | |
| Commit SHA | |

---

## Scenarios

| Scenario | RPS | Duration | VUs |
|----------|-----|----------|-----|
| Baseline | 100 | 10 min | 50 |
| Peak (2× expected) | 200 | 5 min | 100 |

---

## Results

| Endpoint | P50 | P95 | P99 | Error rate | Pass? |
|----------|-----|-----|-----|------------|-------|
| `POST /relay/execute` | | | | | |
| `POST /relay/validate` | | | | | |
| `GET /relay/status` | | | | | |

**MVP gate pass conditions:**
- P95 < 200 ms ✓/✗
- P99 < 500 ms ✓/✗
- Error rate < 0.1% ✓/✗
- 2× peak: no degradation ✓/✗

---

## Raw Output

Attach or link the raw JSON/CSV output from the load test tool.

Path: `<!-- path/to/results.json -->`

---

## Sign-off

| Role | Name | Date |
|------|------|------|
| Engineering Lead | | |
