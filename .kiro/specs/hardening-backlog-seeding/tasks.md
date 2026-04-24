# Tasks: Hardening Backlog Seeding from Audit Findings

## Phase 1: Core Data Models and Validation

### 1.1 Define Data Models

- [ ] Create TypeScript/Rust types for BacklogEntry with all required fields
- [ ] Create types for AuditFinding with all required fields
- [ ] Define enums for RiskLevel, Severity, Status, DeferralCategory, CriterionType, AuditPhase
- [ ] Create types for FollowUpCriterion with type-specific fields
- [ ] Create types for StatusTransition with timestamp and actor tracking
- [ ] Add serialization/deserialization support for markdown format

### 1.2 Implement Validation Engine

- [ ] Implement entry ID format validation (HB-{YYYY}-{sequence})
- [ ] Implement risk level validation (Critical, High, Medium, Low)
- [ ] Implement severity validation (Immediate, Soon, Eventually)
- [ ] Implement risk/severity combination validation rules
- [ ] Implement module path validation against codebase
- [ ] Implement owner validation against team member list
- [ ] Implement follow-up criteria validation (at least one, all well-formed)
- [ ] Implement rationale validation (min 20 chars, valid category)
- [ ] Implement conditional field validation (e.g., "other" rationale requires explanation)
- [ ] Create ValidationResult type with detailed error reporting

### 1.3 Implement Duplicate Detection

- [ ] Implement module + description similarity check
- [ ] Implement check for completed entries addressing same concern
- [ ] Implement prerequisite task validation
- [ ] Create DuplicateCheckResult type with existing entry references
- [ ] Add GitHub issue/PR integration (optional, can defer)

## Phase 2: Storage Layer and File Operations

### 2.1 Implement Storage Layer

- [ ] Create directory structure: docs/issues/hardening-backlog/{risk_level}/
- [ ] Create directory structure: docs/security/audit-findings/{audit_phase}/
- [ ] Implement file naming: {entry_id}-{title_slug}.md
- [ ] Implement title slug generation (lowercase, hyphens, max 50 chars)
- [ ] Implement entry serialization to markdown format
- [ ] Implement entry deserialization from markdown format
- [ ] Implement file save operation with error handling
- [ ] Implement file load operation with error handling
- [ ] Implement file delete operation with error handling

### 2.2 Implement Markdown Template

- [ ] Create backlog entry template with all required sections
- [ ] Create audit finding template with all required sections
- [ ] Implement template rendering with entry data
- [ ] Implement template parsing to extract metadata
- [ ] Add YAML frontmatter support for metadata extraction
- [ ] Document template format in docs/issues/hardening-backlog/README.md

### 2.3 Implement Entry Manager

- [ ] Implement create(entry: BacklogEntryInput) method
- [ ] Implement update(entryId: string, updates: Partial<BacklogEntryInput>) method
- [ ] Implement getById(entryId: string) method
- [ ] Implement getByModule(modulePath: string) method
- [ ] Implement getByOwner(owner: string) method
- [ ] Implement getByRiskLevel(riskLevel: RiskLevel) method
- [ ] Implement getByStatus(status: Status) method
- [ ] Implement delete(entryId: string) method
- [ ] Implement list(filters?: QueryFilters) method
- [ ] Implement entry ID generation with sequence tracking

## Phase 3: Index and Summary Generation

### 3.1 Implement Index Generator

- [ ] Implement generateIndex(entries: BacklogEntry[]) method
- [ ] Create markdown table format with all entry metadata
- [ ] Implement sorting by entry_id
- [ ] Implement statistics calculation (total, by risk level, by status, by owner)
- [ ] Implement updateIndexFile(entries: BacklogEntry[]) method
- [ ] Add automatic index regeneration on entry changes

### 3.2 Implement Summary Generator

- [ ] Implement generateSummary(entries: BacklogEntry[]) method
- [ ] Create statistics tables (by risk level, by status, by owner, by severity)
- [ ] Implement percentage calculations
- [ ] Implement recent changes tracking
- [ ] Implement updateSummaryFile(entries: BacklogEntry[]) method
- [ ] Add automatic summary regeneration on entry changes

### 3.3 Implement Audit Finding Index and Summary

- [ ] Implement index generation for audit findings
- [ ] Implement summary generation for audit findings
- [ ] Track findings by phase (code-review, audit-prep, ci-stabilization)
- [ ] Track findings by status (open, deferred, resolved, duplicate)
- [ ] Link findings to backlog entries in index

## Phase 4: Build System Integration

### 4.1 Implement Build-Time Validation

- [ ] Create validation binary/command
- [ ] Scan docs/issues/hardening-backlog/ for all .md files
- [ ] Parse each file to extract metadata
- [ ] Validate each entry against all validation rules
- [ ] Report validation errors with file path and line number
- [ ] Fail build if validation errors found
- [ ] Integrate with cargo build or equivalent

### 4.2 Implement CI Integration

- [ ] Create GitHub Actions workflow for backlog validation
- [ ] Add duplicate detection check to CI
- [ ] Add index/summary regeneration to CI
- [ ] Create validation report artifact
- [ ] Add status checks for validation failures

### 4.3 Implement Error Reporting

- [ ] Create detailed error messages for each validation rule
- [ ] Include suggestions for fixing common errors
- [ ] Report errors with file path and line number
- [ ] Create error summary for build output
- [ ] Add error recovery suggestions

## Phase 5: API and CLI Interfaces

### 5.1 Implement CLI Interface

- [ ] Create `backlog create` command (interactive)
- [ ] Create `backlog create --template` command
- [ ] Create `backlog update` command for status changes
- [ ] Create `backlog list` command with filtering
- [ ] Create `backlog show` command for entry details
- [ ] Create `backlog validate` command
- [ ] Create `backlog generate-index` command
- [ ] Create `backlog check-duplicates` command
- [ ] Add help documentation for all commands

### 5.2 Implement Programmatic API

- [ ] Export BacklogManager class/module
- [ ] Export AuditFindingManager class/module
- [ ] Export ValidationEngine class/module
- [ ] Export StorageLayer class/module
- [ ] Export IndexGenerator class/module
- [ ] Create usage examples in documentation
- [ ] Add TypeScript/Rust type definitions

### 5.3 Implement Interactive Entry Creation

- [ ] Create interactive prompt for entry creation
- [ ] Validate input as user enters data
- [ ] Provide suggestions for module paths
- [ ] Provide suggestions for owners
- [ ] Provide suggestions for risk levels and severity
- [ ] Show validation errors immediately
- [ ] Allow user to review before saving

## Phase 6: Testing

### 6.1 Unit Tests - Data Models

- [ ] Test BacklogEntry creation with all fields
- [ ] Test AuditFinding creation with all fields
- [ ] Test enum values and constraints
- [ ] Test serialization/deserialization round-trip

### 6.2 Unit Tests - Validation Engine

- [ ] Test entry ID format validation (valid and invalid)
- [ ] Test risk level validation
- [ ] Test severity validation
- [ ] Test risk/severity combination validation
- [ ] Test module path validation
- [ ] Test owner validation
- [ ] Test follow-up criteria validation
- [ ] Test rationale validation (length and category)
- [ ] Test conditional field validation
- [ ] Test error message generation

### 6.3 Unit Tests - Storage Layer

- [ ] Test file save operation
- [ ] Test file load operation
- [ ] Test file delete operation
- [ ] Test directory structure creation
- [ ] Test filename generation
- [ ] Test markdown serialization
- [ ] Test markdown deserialization
- [ ] Test error handling for file operations

### 6.4 Unit Tests - Entry Manager

- [ ] Test create() with valid entry
- [ ] Test create() with invalid entry
- [ ] Test update() preserving entry_id and creation_date
- [ ] Test getById() retrieval
- [ ] Test getByModule() filtering
- [ ] Test getByOwner() filtering
- [ ] Test getByRiskLevel() filtering
- [ ] Test getByStatus() filtering
- [ ] Test delete() operation
- [ ] Test list() with various filters

### 6.5 Unit Tests - Index and Summary Generation

- [ ] Test index generation with multiple entries
- [ ] Test index sorting by entry_id
- [ ] Test index statistics calculation
- [ ] Test summary generation with statistics
- [ ] Test percentage calculations
- [ ] Test recent changes tracking
- [ ] Test automatic regeneration on changes

### 6.6 Unit Tests - Duplicate Detection

- [ ] Test module + description similarity detection
- [ ] Test completed entry detection
- [ ] Test prerequisite validation
- [ ] Test duplicate alert generation

### 6.7 Unit Tests - Audit Finding Manager

- [ ] Test audit finding creation
- [ ] Test linking to backlog entry
- [ ] Test retrieval by phase
- [ ] Test retrieval by status
- [ ] Test index generation for findings
- [ ] Test summary generation for findings

### 6.8 Integration Tests

- [ ] Test end-to-end workflow: create → validate → store → retrieve
- [ ] Test status transition workflow
- [ ] Test index regeneration on multiple changes
- [ ] Test build-time validation
- [ ] Test CLI commands
- [ ] Test duplicate detection across multiple entries
- [ ] Test audit finding to backlog entry linking

### 6.9 Property-Based Tests

- [ ] Property 1: Entry creation and storage round-trip
- [ ] Property 2: Entry ID format and uniqueness
- [ ] Property 3: Risk level and severity validation
- [ ] Property 4: Module path validation
- [ ] Property 5: Owner validation
- [ ] Property 6: Follow-up criteria validation
- [ ] Property 7: Rationale validation
- [ ] Property 8: Audit finding context capture
- [ ] Property 9: Default status initialization
- [ ] Property 10: Status transition metadata
- [ ] Property 11: File organization and naming
- [ ] Property 12: Index and summary generation
- [ ] Property 13: Validation error reporting
- [ ] Property 14: Duplicate detection
- [ ] Property 15: Optional line range storage
- [ ] Property 16: Audit finding to backlog linking

## Phase 7: Documentation

### 7.1 Create Documentation

- [ ] Write API documentation with examples
- [ ] Write CLI usage guide
- [ ] Write backlog entry template guide
- [ ] Write validation rules documentation
- [ ] Write troubleshooting guide
- [ ] Create example backlog entries
- [ ] Document team member identifier format
- [ ] Document module path format

### 7.2 Create README Files

- [ ] Create docs/issues/hardening-backlog/README.md
- [ ] Create docs/security/audit-findings/README.md
- [ ] Document directory structure
- [ ] Document file naming conventions
- [ ] Document template format
- [ ] Document validation rules

### 7.3 Create Examples

- [ ] Create example Critical/Immediate entry
- [ ] Create example High/Soon entry
- [ ] Create example Medium/Eventually entry
- [ ] Create example Low entry
- [ ] Create example with all optional fields
- [ ] Create example audit finding

## Phase 8: Definition of Done

### 8.1 Code Quality

- [ ] All code compiles without errors or warnings
- [ ] Code follows project style guidelines
- [ ] Code has appropriate comments for complex logic
- [ ] No security vulnerabilities in implementation

### 8.2 Testing

- [ ] Unit test suite passes with 100% success rate
- [ ] Integration test suite passes with 100% success rate
- [ ] Property-based tests pass with 100+ iterations each
- [ ] Test coverage meets project requirements
- [ ] All critical failure paths tested

### 8.3 Documentation

- [ ] API documentation complete with examples
- [ ] CLI documentation complete with examples
- [ ] Template documentation complete
- [ ] Validation rules documented
- [ ] Troubleshooting guide complete
- [ ] README files complete

### 8.4 Build Integration

- [ ] Build-time validation integrated
- [ ] CI workflow configured
- [ ] Validation errors reported clearly
- [ ] Build fails appropriately on validation errors

### 8.5 Verification

- [ ] No overlap with prerequisite tasks
- [ ] No duplicate backlog entries
- [ ] All requirements addressed
- [ ] All acceptance criteria met
- [ ] All correctness properties verified

---

**Total Tasks**: 8 phases, 60+ individual tasks
**Estimated Effort**: 2-3 weeks for full implementation
**Priority**: High (MVP blocking)
