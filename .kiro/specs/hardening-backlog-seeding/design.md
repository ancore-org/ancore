# Design Document: Hardening Backlog Seeding from Audit Findings

## Overview

The Hardening Backlog Seeding system provides a structured, file-based approach to capturing, organizing, and tracking deferred security and quality findings discovered during the MVP push. The system operates as a build-time validation and organization layer that ensures all backlog entries maintain data integrity, proper classification, and clear follow-up criteria.

The design emphasizes:

- **File-based storage** using markdown templates for human readability and version control
- **Build-time validation** to catch errors early and ensure consistency
- **Automatic index/summary generation** to maintain up-to-date overviews
- **Clear separation of concerns** between backlog entries and audit findings
- **Structured metadata** enabling programmatic querying and reporting

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Hardening System                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  Entry Creator   │         │  Audit Findings  │         │
│  │   (CLI/API)      │         │   Collector      │         │
│  └────────┬─────────┘         └────────┬─────────┘         │
│           │                            │                   │
│           └────────────┬───────────────┘                   │
│                        │                                   │
│           ┌────────────▼──────────────┐                   │
│           │   Validation Engine       │                   │
│           │  - Field validation       │                   │
│           │  - Module verification   │                   │
│           │  - Duplicate detection   │                   │
│           │  - Risk/severity rules   │                   │
│           └────────────┬──────────────┘                   │
│                        │                                   │
│           ┌────────────▼──────────────┐                   │
│           │   Storage Layer           │                   │
│           │  - Markdown templates     │                   │
│           │  - File organization      │                   │
│           │  - Metadata extraction    │                   │
│           └────────────┬──────────────┘                   │
│                        │                                   │
│        ┌───────────────┼───────────────┐                  │
│        │               │               │                  │
│   ┌────▼────┐   ┌─────▼─────┐   ┌────▼────┐             │
│   │ Backlog  │   │   Audit   │   │  Index/ │             │
│   │ Entries  │   │ Findings  │   │ Summary │             │
│   │Repository│   │Repository │   │Generator│             │
│   └──────────┘   └───────────┘   └────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Entry Creation**: User creates backlog entry via CLI or API
2. **Validation**: System validates all fields, references, and rules
3. **Storage**: Entry stored as markdown file in appropriate directory
4. **Indexing**: Index and summary files automatically regenerated
5. **Retrieval**: Entries queryable by ID, module, owner, risk level, status

## Components and Interfaces

### 1. Backlog Entry Manager

**Responsibility**: Create, update, retrieve, and delete backlog entries

**Interface**:

```typescript
interface BacklogEntryManager {
  create(entry: BacklogEntryInput): Promise<BacklogEntry>;
  update(entryId: string, updates: Partial<BacklogEntryInput>): Promise<BacklogEntry>;
  getById(entryId: string): Promise<BacklogEntry | null>;
  getByModule(modulePath: string): Promise<BacklogEntry[]>;
  getByOwner(owner: string): Promise<BacklogEntry[]>;
  getByRiskLevel(riskLevel: RiskLevel): Promise<BacklogEntry[]>;
  getByStatus(status: Status): Promise<BacklogEntry[]>;
  delete(entryId: string): Promise<void>;
  list(filters?: QueryFilters): Promise<BacklogEntry[]>;
}
```

### 2. Validation Engine

**Responsibility**: Validate all backlog entry fields and business rules

**Validation Rules**:

- Entry ID format: `HB-{YYYY}-{sequence_number}` (e.g., HB-2026-001)
- Risk level: one of Critical, High, Medium, Low
- Severity: one of Immediate, Soon, Eventually
- Risk/severity combinations: Critical→Immediate/Soon, High→Soon/Eventually, Medium/Low→any
- Module path: must reference existing codebase location
- Owner: must be valid team member identifier
- Follow-up criteria: at least one, all well-formed
- Rationale: minimum 20 characters, valid category
- No duplicate entries for same module + similar description

**Interface**:

```typescript
interface ValidationEngine {
  validateEntry(entry: BacklogEntryInput): ValidationResult;
  validateField(field: string, value: unknown): FieldValidationResult;
  validateModuleExists(modulePath: string): Promise<boolean>;
  validateOwnerExists(owner: string): Promise<boolean>;
  checkDuplicates(entry: BacklogEntryInput): Promise<DuplicateCheckResult>;
  validateRiskSeverityCombination(risk: RiskLevel, severity: Severity): boolean;
}
```

### 3. Storage Layer

**Responsibility**: Persist entries as markdown files with proper organization

**Directory Structure**:

```
docs/issues/hardening-backlog/
├── INDEX.md                    # Master index of all entries
├── SUMMARY.md                  # Statistics and overview
├── README.md                   # Template and guidelines
├── critical/
│   ├── HB-2026-001-*.md
│   └── HB-2026-002-*.md
├── high/
│   ├── HB-2026-003-*.md
│   └── ...
├── medium/
│   └── ...
└── low/
    └── ...

docs/security/audit-findings/
├── INDEX.md                    # Master index of all findings
├── SUMMARY.md                  # Statistics and overview
├── code-review/
│   ├── AF-2026-001-*.md
│   └── ...
├── audit-prep/
│   └── ...
└── ci-stabilization/
    └── ...
```

**File Naming**: `{entry_id}-{title_slug}.md`

- Example: `HB-2026-001-pbkdf2-iteration-validation.md`
- Title slug: lowercase, hyphens, max 50 chars

**Interface**:

```typescript
interface StorageLayer {
  saveEntry(entry: BacklogEntry): Promise<string>; // returns file path
  loadEntry(filePath: string): Promise<BacklogEntry>;
  deleteEntry(filePath: string): Promise<void>;
  listEntriesByRiskLevel(riskLevel: RiskLevel): Promise<BacklogEntry[]>;
  listEntriesByPhase(phase: AuditPhase): Promise<AuditFinding[]>;
  getStoragePath(entry: BacklogEntry): string;
}
```

### 4. Index and Summary Generator

**Responsibility**: Automatically maintain index and summary files

**Index File Format** (`INDEX.md`):

```markdown
# Hardening Backlog Index

| Entry ID    | Title                       | Module          | Risk     | Severity  | Owner | Status         | Date       |
| ----------- | --------------------------- | --------------- | -------- | --------- | ----- | -------------- | ---------- |
| HB-2026-001 | PBKDF2 Iteration Validation | packages/crypto | Critical | Immediate | alice | pending_review | 2026-01-15 |
| ...         | ...                         | ...             | ...      | ...       | ...   | ...            | ...        |

**Total Entries**: 42
**By Risk Level**: Critical: 3, High: 8, Medium: 15, Low: 16
**By Status**: pending_review: 10, approved: 15, in_progress: 8, blocked: 2, completed: 5, cancelled: 2
**By Owner**: alice: 12, bob: 10, charlie: 8, ...
```

**Summary File Format** (`SUMMARY.md`):

```markdown
# Hardening Backlog Summary

## Statistics

- **Total Entries**: 42
- **Last Updated**: 2026-01-20 14:30:00 UTC

## By Risk Level

| Risk Level | Count | Percentage |
| ---------- | ----- | ---------- |
| Critical   | 3     | 7.1%       |
| High       | 8     | 19.0%      |
| Medium     | 15    | 35.7%      |
| Low        | 16    | 38.1%      |

## By Status

| Status         | Count | Percentage |
| -------------- | ----- | ---------- |
| pending_review | 10    | 23.8%      |
| approved       | 15    | 35.7%      |
| in_progress    | 8     | 19.0%      |
| blocked        | 2     | 4.8%       |
| completed      | 5     | 11.9%      |
| cancelled      | 2     | 4.8%       |

## By Owner

| Owner   | Count |
| ------- | ----- |
| alice   | 12    |
| bob     | 10    |
| charlie | 8     |

| ...

## By Severity

| Severity   | Count |
| ---------- | ----- |
| Immediate  | 5     |
| Soon       | 18    |
| Eventually | 19    |

## Recent Changes

- HB-2026-042: Created on 2026-01-20
- HB-2026-041: Status changed to completed on 2026-01-19
- ...
```

**Interface**:

```typescript
interface IndexGenerator {
  generateIndex(entries: BacklogEntry[]): string;
  generateSummary(entries: BacklogEntry[]): string;
  updateIndexFile(entries: BacklogEntry[]): Promise<void>;
  updateSummaryFile(entries: BacklogEntry[]): Promise<void>;
}
```

### 5. Audit Finding Manager

**Responsibility**: Manage audit findings and link to backlog entries

**Interface**:

```typescript
interface AuditFindingManager {
  create(finding: AuditFindingInput): Promise<AuditFinding>;
  linkToBacklogEntry(findingId: string, entryId: string): Promise<void>;
  getByPhase(phase: AuditPhase): Promise<AuditFinding[]>;
  getByStatus(status: FindingStatus): Promise<AuditFinding[]>;
  list(filters?: QueryFilters): Promise<AuditFinding[]>;
}
```

## Data Models

### BacklogEntry

```typescript
interface BacklogEntry {
  // Metadata
  entry_id: string; // HB-{YYYY}-{sequence}
  title: string;
  date_identified: Date;
  owner: string; // Team member identifier
  status: Status; // pending_review, approved, in_progress, blocked, completed, cancelled

  // Description
  summary: string;
  detailed_description: string;
  affected_functionality: string;

  // Module Information
  module_path: string; // e.g., packages/crypto/src/encryption.ts
  line_range?: {
    start_line: number;
    end_line: number;
  };
  related_modules?: string[];

  // Risk Assessment
  risk_level: RiskLevel; // Critical, High, Medium, Low
  severity: Severity; // Immediate, Soon, Eventually
  risk_justification: string;

  // Rationale for Deferral
  rationale_for_deferral: {
    category: DeferralCategory; // MVP_blocking, dependency_pending, requires_design, etc.
    explanation: string; // min 20 chars
    impact_of_deferral: string;
  };

  // Follow-Up Criteria
  follow_up_criteria: FollowUpCriterion[];

  // Implementation Notes
  estimated_effort?: string; // e.g., "2-3 days"
  dependencies?: string[];
  suggested_approach?: string;

  // Status Tracking
  status_history: StatusTransition[];
  transition_date?: Date;
  assigned_developer?: string;
  blocking_reason?: string;
  completion_summary?: string;
  implementation_link?: string; // PR, commit, or issue URL
  cancellation_reason?: string;

  // Metadata
  created_at: Date;
  updated_at: Date;
  created_by: string;
}

type RiskLevel = 'Critical' | 'High' | 'Medium' | 'Low';
type Severity = 'Immediate' | 'Soon' | 'Eventually';
type Status = 'pending_review' | 'approved' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
type DeferralCategory =
  | 'MVP_blocking'
  | 'dependency_pending'
  | 'requires_design'
  | 'requires_audit'
  | 'low_impact_high_effort'
  | 'other';

interface FollowUpCriterion {
  type: CriterionType;
  description: string;
  dependency_name?: string; // for dependency_resolved
  dependency_version?: string;
  design_document_ref?: string; // for design_complete
  audit_scope?: string; // for audit_complete
  coverage_percentage?: number; // for test_coverage_threshold
}

type CriterionType =
  | 'dependency_resolved'
  | 'design_complete'
  | 'audit_complete'
  | 'risk_reassessment'
  | 'performance_baseline'
  | 'test_coverage_threshold'
  | 'custom';

interface StatusTransition {
  from_status: Status;
  to_status: Status;
  timestamp: Date;
  actor: string;
  reason?: string;
}
```

### AuditFinding

```typescript
interface AuditFinding {
  finding_id: string; // AF-{YYYY}-{sequence}
  title: string;
  description: string;
  audit_phase: AuditPhase; // code-review, audit-prep, ci-stabilization

  // Original Context
  reviewer: string;
  review_date: Date;
  original_location: string; // file path and line range

  // Classification
  risk_level: RiskLevel;
  severity: Severity;

  // Linking
  backlog_entry_id?: string; // Link to backlog entry if deferred
  status: FindingStatus; // open, deferred, resolved, duplicate

  // Metadata
  created_at: Date;
  updated_at: Date;
}

type AuditPhase = 'code-review' | 'audit-prep' | 'ci-stabilization';
type FindingStatus = 'open' | 'deferred' | 'resolved' | 'duplicate';
```

## Backlog Entry Template

**File**: `docs/issues/hardening-backlog/README.md`

```markdown
# Backlog Entry Template

Use this template when creating a new hardening backlog entry.

## Metadata

- **Entry ID**: HB-2026-XXX (auto-generated)
- **Title**: [Brief title of the issue]
- **Date Identified**: [YYYY-MM-DD]
- **Owner**: [Team member identifier]
- **Status**: pending_review

## Description

### Summary

[One-sentence summary of the issue]

### Detailed Description

[Comprehensive description of the issue, including context and implications]

### Affected Functionality

[List of features or components affected by this issue]

## Module Information

### Primary Module

- **Path**: [e.g., packages/crypto/src/encryption.ts]
- **Line Range**: [start_line - end_line] (optional)

### Related Modules

- [Module path 1]
- [Module path 2]

## Risk Assessment

### Risk Level

[Critical | High | Medium | Low]

### Severity

[Immediate | Soon | Eventually]

### Risk Justification

[Detailed explanation of why this risk level and severity were assigned]

## Rationale for Deferral

### Category

[MVP_blocking | dependency_pending | requires_design | requires_audit | low_impact_high_effort | other]

### Explanation

[Minimum 20 characters. Explain why this finding is deferred rather than addressed immediately]

### Impact of Deferral

[Describe the potential impact of deferring this work]

## Follow-Up Criteria

### Criterion 1

- **Type**: [dependency_resolved | design_complete | audit_complete | risk_reassessment | performance_baseline | test_coverage_threshold | custom]
- **Description**: [Specific, measurable condition]
- **Details**: [Additional details specific to criterion type]

### Criterion 2

- **Type**: [...]
- **Description**: [...]

## Implementation Notes

### Estimated Effort

[e.g., 2-3 days, 1 week, etc.]

### Dependencies

- [Dependency 1]
- [Dependency 2]

### Suggested Approach

[High-level approach for addressing this issue]

---

**Created by**: [Team member]
**Created at**: [YYYY-MM-DD HH:MM:SS UTC]
```

## Validation Logic and Error Handling

### Validation Rules

1. **Entry ID Format**
   - Pattern: `HB-{YYYY}-{sequence_number}`
   - Sequence number: 3 digits, zero-padded
   - Example: `HB-2026-001`

2. **Risk/Severity Combinations**

   ```
   Critical → Immediate or Soon (required)
   High → Soon or Eventually (required)
   Medium → Any severity (allowed)
   Low → Any severity (allowed)
   ```

3. **Module Path Validation**
   - Must reference existing file or directory
   - Valid prefixes: `contracts/`, `packages/`, `apps/`, `services/`
   - Must exist in codebase at validation time

4. **Owner Validation**
   - Must match team member identifier
   - Identifiers stored in `.kiro/team.json` or similar config

5. **Follow-Up Criteria**
   - At least one criterion required
   - Each criterion must be well-formed
   - Type-specific fields required based on criterion type

6. **Duplicate Detection**
   - Check existing entries for same module + similar description
   - Check GitHub issues/PRs for related work
   - Alert user if potential duplicate found

### Error Handling

**Validation Errors**:

```typescript
interface ValidationError {
  field: string;
  message: string;
  value: unknown;
  suggestion?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
```

**Error Messages**:

- Missing required field: "Field '{field}' is required"
- Invalid format: "Field '{field}' has invalid format. Expected: {pattern}"
- Invalid reference: "Module '{module}' does not exist in codebase"
- Invalid combination: "Risk level '{risk}' requires severity to be one of: {allowed}"
- Duplicate detected: "Similar entry already exists: {entry_id}. Please review before creating new entry"

## Index and Summary Generation

### Generation Triggers

1. **On Entry Creation**: Regenerate index and summary
2. **On Entry Update**: Regenerate index and summary
3. **On Entry Deletion**: Regenerate index and summary
4. **On Build**: Validate all entries and regenerate index/summary
5. **Manual Trigger**: CLI command to regenerate

### Generation Algorithm

```typescript
async function generateIndex(entries: BacklogEntry[]): Promise<string> {
  // Sort entries by entry_id
  const sorted = entries.sort((a, b) => a.entry_id.localeCompare(b.entry_id));

  // Build markdown table
  const rows = sorted.map((entry) => [
    entry.entry_id,
    entry.title,
    entry.module_path,
    entry.risk_level,
    entry.severity,
    entry.owner,
    entry.status,
    entry.date_identified.toISOString().split('T')[0],
  ]);

  // Generate statistics
  const stats = {
    total: entries.length,
    byRiskLevel: groupBy(entries, 'risk_level'),
    byStatus: groupBy(entries, 'status'),
    byOwner: groupBy(entries, 'owner'),
  };

  // Format as markdown
  return formatAsMarkdown(rows, stats);
}
```

## Integration Points with Build System

### Build-Time Validation

**Trigger**: During `cargo build` or equivalent

**Process**:

1. Scan `docs/issues/hardening-backlog/` for all `.md` files
2. Parse each file to extract metadata
3. Validate each entry against validation rules
4. Report errors with file path and line number
5. Fail build if validation errors found

**Implementation**:

```rust
// In build.rs or similar
fn validate_backlog_entries() -> Result<()> {
    let entries = load_backlog_entries("docs/issues/hardening-backlog")?;

    for entry in entries {
        validate_entry(&entry)?;
    }

    Ok(())
}
```

### CI Integration

**GitHub Actions Workflow**:

```yaml
name: Validate Hardening Backlog

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Validate backlog entries
        run: cargo run --bin validate-backlog
      - name: Check for duplicates
        run: cargo run --bin check-duplicates
      - name: Generate index and summary
        run: cargo run --bin generate-backlog-index
```

## API/Interface Design

### CLI Interface

```bash
# Create new backlog entry (interactive)
cargo run --bin backlog -- create

# Create from template
cargo run --bin backlog -- create --template

# Update entry status
cargo run --bin backlog -- update HB-2026-001 --status approved

# List entries
cargo run --bin backlog -- list
cargo run --bin backlog -- list --risk Critical
cargo run --bin backlog -- list --owner alice
cargo run --bin backlog -- list --status in_progress

# View entry details
cargo run --bin backlog -- show HB-2026-001

# Validate all entries
cargo run --bin backlog -- validate

# Generate index and summary
cargo run --bin backlog -- generate-index

# Check for duplicates
cargo run --bin backlog -- check-duplicates
```

### Programmatic API

```typescript
// Import and use in code
import { BacklogManager } from './backlog-manager';

const manager = new BacklogManager('docs/issues/hardening-backlog');

// Create entry
const entry = await manager.create({
  title: 'PBKDF2 Iteration Validation',
  module_path: 'packages/crypto/src/encryption.ts',
  risk_level: 'Critical',
  severity: 'Immediate',
  owner: 'alice',
  // ... other fields
});

// Query entries
const criticalEntries = await manager.getByRiskLevel('Critical');
const aliceEntries = await manager.getByOwner('alice');

// Update status
await manager.updateStatus(entry.entry_id, 'approved');

// Generate reports
const index = await manager.generateIndex();
const summary = await manager.generateSummary();
```

## Testing Strategy

### Unit Tests

**Test Coverage Areas**:

1. **Entry Creation**
   - Valid entry creation with all fields
   - Entry ID generation and uniqueness
   - Default status initialization

2. **Validation**
   - Entry ID format validation
   - Risk/severity combination validation
   - Module path validation
   - Owner validation
   - Follow-up criteria validation
   - Rationale validation (min 20 chars)
   - Duplicate detection

3. **Status Transitions**
   - Valid transitions allowed
   - Invalid transitions rejected
   - Status history recorded
   - Transition metadata captured

4. **File Operations**
   - Entry saved to correct directory
   - Filename format correct
   - Markdown parsing and serialization
   - File deletion

5. **Index/Summary Generation**
   - Index contains all entries
   - Summary statistics accurate
   - Sorting and grouping correct
   - Markdown formatting valid

### Integration Tests

1. **End-to-End Workflow**
   - Create entry → validate → store → retrieve → update status → complete

2. **Build Integration**
   - Validation runs during build
   - Build fails on validation errors
   - Build succeeds with valid entries

3. **Duplicate Detection**
   - Detects similar entries
   - Alerts user appropriately
   - Allows override with justification

4. **Index Regeneration**
   - Index updates on entry creation
   - Index updates on entry deletion
   - Index updates on status change

### Test Cases

**Success Path**:

- Create valid Critical/Immediate entry
- Create valid High/Soon entry
- Create valid Medium/Eventually entry
- Create valid Low/Any entry
- Update entry status through all valid transitions
- Retrieve entries by various filters
- Generate index and summary

**Failure Paths**:

- Missing required fields
- Invalid entry ID format
- Invalid risk/severity combination
- Non-existent module path
- Invalid owner
- Empty rationale
- Duplicate entry detection
- Invalid follow-up criteria

## Error Handling

### Validation Errors

- **Missing Fields**: Report which fields are required
- **Invalid Format**: Show expected format and example
- **Invalid Reference**: Suggest valid alternatives
- **Invalid Combination**: Explain constraints
- **Duplicate**: Show existing entry ID and title

### File System Errors

- **File Not Found**: Clear message with expected path
- **Permission Denied**: Suggest permission fix
- **Disk Full**: Suggest cleanup
- **Invalid Markdown**: Report parsing error with line number

### Build Errors

- **Validation Failed**: List all validation errors
- **Build Fails**: Clear message indicating backlog validation issue
- **Recovery**: Suggest fixes for common issues

---

**Design Status**: Ready for requirements review and prework analysis
**Next Phase**: Acceptance criteria analysis and correctness properties definition

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property Reflection

After analyzing the acceptance criteria, I identified several redundancies that can be consolidated:

- **Validation Properties (1.3-1.7, 3.3-3.5, 4.1-4.7, 5.1-5.7, 10.2-10.6)**: These test individual field validation rules. They can be consolidated into comprehensive validation properties that test multiple rules together.
- **Storage Properties (7.1-7.3, 8.1-8.3)**: These test file organization and naming. They can be consolidated into a single storage property.
- **Index/Summary Properties (7.4-7.6, 8.4, 8.6)**: These test index and summary generation. They can be consolidated into a single generation property.
- **Status Transition Properties (6.3-6.6)**: These test conditional requirements for different status transitions. They can be consolidated into a single transition property.

### Property 1: Entry Creation and Storage Round-Trip

_For any_ valid backlog entry with all required fields (entry_id, title, description, module, risk_level, severity, owner, date_identified, rationale_for_deferral, follow_up_criteria, status), creating and then retrieving the entry should return an entry with all fields preserved and unchanged.

**Validates: Requirements 1.1, 1.8**

### Property 2: Entry ID Format and Uniqueness

_For any_ sequence of backlog entry creations, each generated entry_id SHALL follow the format `HB-{YYYY}-{sequence_number}` and be unique across all entries in the system.

**Validates: Requirements 1.2**

### Property 3: Risk Level and Severity Validation

_For any_ risk_level and severity combination, the system SHALL accept the combination if and only if it satisfies the following rules:

- Critical risk requires Immediate or Soon severity
- High risk requires Soon or Eventually severity
- Medium and Low risk allow any severity

**Validates: Requirements 1.3, 1.4, 3.3, 3.4, 3.5, 3.6**

### Property 4: Module Path Validation

_For any_ module_path string, the system SHALL accept it if and only if it references an existing codebase component (contracts/_, packages/_, apps/_, or services/_) and reject it otherwise.

**Validates: Requirements 1.5, 4.1, 4.2**

### Property 5: Owner Validation

_For any_ owner identifier, the system SHALL accept it if and only if it corresponds to a valid team member in the system.

**Validates: Requirements 1.6**

### Property 6: Follow-Up Criteria Validation

_For any_ follow_up_criteria list, the system SHALL accept it if and only if:

- The list contains at least one criterion
- Each criterion has a valid type (dependency_resolved, design_complete, audit_complete, risk_reassessment, performance_baseline, test_coverage_threshold, or custom)
- Each criterion has all required fields for its type (e.g., dependency_resolved requires dependency_name and dependency_version)

**Validates: Requirements 1.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8**

### Property 7: Rationale Validation

_For any_ rationale_for_deferral object, the system SHALL accept it if and only if:

- The category is one of: MVP_blocking, dependency_pending, requires_design, requires_audit, low_impact_high_effort, or other
- The explanation is at least 20 characters long
- If category is "other", additional explanation text is provided

**Validates: Requirements 2.3, 2.4, 4.4, 4.5, 4.6, 4.7**

### Property 8: Audit Finding Context Capture

_For any_ audit finding deferred to backlog, the system SHALL capture and store all original context (reviewer, review_date, original_location) and create a corresponding backlog entry with status "pending_review".

**Validates: Requirements 2.2, 2.5, 2.6**

### Property 9: Default Status Initialization

_For any_ newly created backlog entry, the status field SHALL be initialized to "pending_review" unless explicitly set otherwise.

**Validates: Requirements 6.1**

### Property 10: Status Transition Metadata

_For any_ status transition, the system SHALL:

- Record the transition_date and actor
- For "in_progress" transitions, record assigned_developer
- For "blocked" transitions, require and record blocking_reason
- For "completed" transitions, require and record completion_summary and implementation_link
- For "cancelled" transitions, require and record cancellation_reason
- Maintain a complete status_history with all transitions

**Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**

### Property 11: File Organization and Naming

_For any_ backlog entry, the system SHALL:

- Store it in `docs/issues/hardening-backlog/{risk_level}/` directory
- Use filename format `{entry_id}-{title_slug}.md`
- For audit findings, store in `docs/security/audit-findings/{audit_phase}/` with filename `{finding_id}-{title_slug}.md`

**Validates: Requirements 7.1, 7.2, 7.3, 8.1, 8.2, 8.3**

### Property 12: Index and Summary Generation

_For any_ set of backlog entries, the system SHALL:

- Generate an INDEX.md file containing all entries with correct metadata
- Generate a SUMMARY.md file with accurate statistics (total count, counts by risk level, by status, by owner, by severity)
- Automatically regenerate both files when entries are added, modified, or deleted
- Maintain similar index and summary files for audit findings

**Validates: Requirements 7.4, 7.5, 7.6, 8.4, 8.5, 8.6**

### Property 13: Validation Error Reporting

_For any_ invalid backlog entry, the system SHALL:

- Identify all validation errors
- Report each error with specific field name, error message, and suggested fix
- Fail the build process with a clear error message indicating validation issues

**Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8**

### Property 14: Duplicate Detection

_For any_ new backlog entry, the system SHALL:

- Check for existing entries with the same module and similar description
- Check for completed entries that already address the same concern
- Alert the creator with entry_id and title of existing entries
- Prevent creation of entries blocked by incomplete prerequisite tasks

**Validates: Requirements 11.1, 11.2, 11.5, 11.6, 11.7**

### Property 15: Optional Line Range Storage

_For any_ backlog entry with an optional line_range field, the system SHALL:

- Store the line_range when provided (start_line and end_line)
- Omit the line_range when not provided
- Preserve the line_range unchanged through storage and retrieval

**Validates: Requirements 4.3**

### Property 16: Audit Finding to Backlog Linking

_For any_ audit finding linked to a backlog entry, the system SHALL:

- Store the backlog_entry_id in the finding record
- Maintain the link bidirectionally (finding references entry, entry references finding)
- Preserve the link through updates and deletions

**Validates: Requirements 8.5**

---

**Design Status**: Complete with correctness properties
**Ready for**: User review and feedback
