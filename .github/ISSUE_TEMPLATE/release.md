---
name: Release Tracking
about: Checklist for cutting a new release candidate or final release.
title: 'Release [vX.Y.Z]'
labels: 'type: release'
assignees: ''
---

## Release Overview

- **Version**: vX.Y.Z
- **Release Branch**: `release/vX.Y.Z`
- **Target Date**: YYYY-MM-DD

## 1. Preparation

- [ ] Feature freeze declared on `main`
- [ ] Release branch `release/vX.Y.Z` created from `main`
- [ ] Version bumped to `vX.Y.Z-rc.1` (or final `vX.Y.Z`)
- [ ] `docs/release/checklist.md` reset and committed to release branch

## 2. Release Gate Checklist

> Refer to [docs/release/checklist.md](../../docs/release/checklist.md) for detailed requirements.

### Code & Tests

- [ ] [Gate 1] TS Build & Tests passed
- [ ] [Gate 2] Contracts Build & Tests passed
- [ ] [Gate 6] Version Consistency passed

### Security & Compliance

- [ ] [Gate 3] Security Audit (npm + cargo) passed
- [ ] [Gate 5] Release Docs completeness verified

### Infrastructure & Ops

- [ ] [Gate 4] Observability Configs validated
- [ ] Rollback drill performed (if required for this release)

## 3. Tagging & Release

- [ ] Release Candidate tag pushed (e.g., `vX.Y.Z-rc.1`)
- [ ] `Release` workflow monitored (Artifacts, npm publish)
- [ ] Release notes generated and reviewed

## 4. Finalization

- [ ] Final `vX.Y.Z` tag pushed
- [ ] Release branch merged back to `main`
- [ ] Release announced in communication channels
