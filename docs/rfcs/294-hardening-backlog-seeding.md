# RFC 294: Post-MVP Hardening Backlog Seeding from Audit Findings

## Overview

Establish a structured process for collecting, organizing, and tracking non-blocking hardening work discovered during the MVP push. The system captures deferred findings from code reviews, audit preparation, and CI stabilization efforts, organizing them by risk/severity/owner with clear follow-up criteria.

## Motivation

During MVP development, security and quality findings are often deferred to maintain velocity. Without a structured system, these findings can be lost or forgotten, accumulating as silent technical debt. This RFC proposes a systematic approach to capture, organize, and track these deferred findings.

## Key Features

- Structured backlog entry format with metadata, rationale, and follow-up criteria
- Risk/severity classification with validation rules (Critical, High, Medium, Low)
- Module linking with clear rationale for deferral
- Follow-up criteria definition for objective completion determination
- Backlog entry status tracking with transitions
- Repository organization with automatic index/summary generation
- Build-time validation to catch errors early
- Comprehensive test coverage including property-based tests
- CLI and programmatic API interfaces

## Requirements Summary

### 13 Core Requirements

1. **Backlog Entry Structure**: Store entry_id, title, description, module, risk_level, severity, owner, date_identified, rationale_for_deferral, follow_up_criteria, and status with unique identifiers (HB-{YYYY}-{sequence})

2. **Audit Finding Collection**: Provide mechanism to defer findings with original context (reviewer, review_date, original_location) and explicit rationale (min 20 chars)

3. **Risk/Severity Classification**: 
   - Risk levels: Critical (loss of funds, unauthorized access), High (DoS, authorization flaws), Medium (info disclosure), Low (best practices)
   - Severity: Immediate (1 week), Soon (1 month), Eventually (3 months)
   - Validation: Critical→Immediate/Soon, High→Soon/Eventually, Medium/Low→any

4. **Module Linking and Rationale**: Link to specific codebase locations with deferral categories (MVP_blocking, dependency_pending, requires_design, requires_audit, low_impact_high_effort, other)

5. **Follow-Up Criteria Definition**: Support criterion types (dependency_resolved, design_complete, audit_complete, risk_reassessment, performance_baseline, test_coverage_threshold, custom) with type-specific fields

6. **Status Tracking**: Support statuses (pending_review, approved, in_progress, blocked, completed, cancelled) with transition metadata

7. **Repository Organization**: Store in `docs/issues/hardening-backlog/` organized by risk_level with automatic index/summary generation

8. **Audit Findings Repository**: Store in `docs/security/audit-findings/` organized by audit_phase (code-review, audit-prep, ci-stabilization)

9. **Backlog Entry Template**: Provide template with sections (Metadata, Description, Module Information, Risk Assessment, Rationale for Deferral, Follow-Up Criteria, Implementation Notes)

10. **Validation and Compilation**: Validate entries during build with error reporting and build failure on validation errors

11. **No Overlap with Prerequisite Tasks**: Check for duplicates, existing issues/PRs, completed entries, and prerequisite task blocking

12. **Test Coverage**: Unit tests for all components, integration tests for workflows, property-based tests for correctness properties

13. **Definition of Done**: Compilation without errors, 100% test pass rate, no overlap with existing work, complete documentation

## Design

### Architecture

File-based storage with markdown templates for human readability and version control integration.

**5 Core Components:**
- **Backlog Entry Manager**: Create, update, retrieve, delete backlog entries
- **Validation Engine**: Validate all fields and business rules
- **Storage Layer**: Persist entries as markdown files with proper organization
- **Index and Summary Generator**: Automatically maintain index and summary files
- **Audit Finding Manager**: Manage audit findings and link to backlog entries

### Data Models

**BacklogEntry:**
- Metadata: entry_id, title, date_identified, owner, status
- Description: summary, detailed_description, affected_functionality
- Module Information: module_path, line_range (optional), related_modules
- Risk Assessment: risk_level, severity, risk_justification
- Rationale for Deferral: category, explanation, impact_of_deferral
- Follow-Up Criteria: list of measurable conditions
- Implementation Notes: estimated_effort, dependencies, suggested_approach
- Status Tracking: status_history with transitions

**AuditFinding:**
- finding_id, title, description, audit_phase
- Original Context: reviewer, review_date, original_location
- Classification: risk_level, severity
- Linking: backlog_entry_id (if deferred), status

### Validation Rules

- Entry ID format: `HB-{YYYY}-{sequence_number}`
- Risk/Severity combinations: Critical→Immediate/Soon, High→Soon/Eventually, Medium/Low→any
- Module path: must reference existing codebase location
- Owner: must be valid team member identifier
- Follow-Up Criteria: at least one, all well-formed
- Rationale: minimum 20 characters, valid category
- No duplicate entries for same module + similar description

## Correctness Properties

16 properties for property-based testing:

1. **Entry Creation and Storage Round-Trip**: Creating and retrieving an entry returns all fields unchanged
2. **Entry ID Format and Uniqueness**: Each entry_id follows format and is unique
3. **Risk Level and Severity Validation**: Risk/severity combinations satisfy defined rules
4. **Module Path Validation**: Module paths reference existing codebase components
5. **Owner Validation**: Owner identifiers correspond to valid team members
6. **Follow-Up Criteria Validation**: Criteria are well-formed and measurable
7. **Rationale Validation**: Rationale meets length and category requirements
8. **Audit Finding Context Capture**: Deferred findings capture all original context
9. **Default Status Initialization**: New entries initialize with "pending_review" status
10. **Status Transition Metadata**: Transitions record required metadata
11. **File Organization and Naming**: Entries stored in correct directories with correct filenames
12. **Index and Summary Generation**: Index and summary files contain accurate data
13. **Validation Error Reporting**: Validation errors are reported with specific details
14. **Duplicate Detection**: System detects and alerts on duplicate entries
15. **Optional Line Range Storage**: Line ranges are preserved when provided
16. **Audit Finding to Backlog Linking**: Links are maintained bidirectionally

## Implementation Plan

### 8 Phases with 60+ Tasks

**Phase 1: Core Data Models and Validation**
- Define TypeScript/Rust types for BacklogEntry and AuditFinding
- Implement validation engine with all validation rules
- Implement duplicate detection

**Phase 2: Storage Layer and File Operations**
- Implement storage layer with markdown serialization
- Create backlog entry template
- Implement entry manager with CRUD operations

**Phase 3: Index and Summary Generation**
- Implement index generator
- Implement summary generator
- Add automatic regeneration on entry changes

**Phase 4: Build System Integration**
- Implement build-time validation
- Create GitHub Actions workflow
- Implement error reporting

**Phase 5: API and CLI Interfaces**
- Implement CLI interface
- Implement programmatic API
- Implement interactive entry creation

**Phase 6: Testing**
- Unit tests for all components
- Integration tests for workflows
- Property-based tests for correctness properties

**Phase 7: Documentation**
- API documentation with examples
- CLI usage guide
- Backlog entry template guide
- Validation rules documentation

**Phase 8: Definition of Done**
- Code quality verification
- Test coverage verification
- Documentation completeness
- Build integration verification

**Estimated Effort:** 2-3 weeks for full implementation

## Related Issue

Closes #294
