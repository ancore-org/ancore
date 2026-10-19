# Contributor Issue Assignment Guide

This guide details the requirements and procedures for assigning GitHub issues to contributors in the Ancore project and related Stellar Wave repositories.

---

## 1. Overview & GitHub Permission Requirements

GitHub enforces strict permission boundaries for issue assignment on public and organization repositories:

- **Repository Permissions**: By default, GitHub **only** allows users with `triage`, `write`, or `admin` permissions to be assigned to issues.
- **External Contributors**: Uninvited external users **cannot** be assigned directly via the GitHub UI or API. An attempt to assign a non-collaborator will result in an HTTP `422 Unprocessable Entity` or a silent failure.
- **Maintainer Token Requirement**: Commands to assign contributors must be executed by a repository maintainer or administrator with write access (e.g. using `~/.gh-tokens/wheval`). Contributor personal access tokens (PATs) cannot assign themselves or others unless they possess write privileges.

---

## 2. Working Assignment Workflows

### Method A: Outside Collaborator Invitation (Recommended for Frequent Contributors)

1. **Invite the contributor** to the repository with `triage` or `write` access:
   ```bash
   GH_TOKEN=$(cat ~/.gh-tokens/wheval) gh api \
     -X PUT repos/ancore-org/ancore/collaborators/<GITHUB_USERNAME> \
     -f permission=push
   ```
2. **Acceptance**: The contributor accepts the invitation link received via email or GitHub notification (`https://github.com/ancore-org/ancore/invitations`).
3. **Assign the issue**:
   ```bash
   GH_TOKEN=$(cat ~/.gh-tokens/wheval) gh issue edit <ISSUE_NUMBER> \
     --repo ancore-org/ancore \
     --add-assignee <GITHUB_USERNAME>
   ```

---

### Method B: Contributor Issue Interaction (Comment / Claim)

1. The contributor comments on the issue expressing interest (e.g., `"I would like to work on this issue"`).
2. Once the contributor has an interaction record on the issue or repository, a maintainer assigns them using the GitHub CLI:
   ```bash
   GH_TOKEN=$(cat ~/.gh-tokens/wheval) gh issue edit <ISSUE_NUMBER> \
     --repo ancore-org/ancore \
     --add-assignee <GITHUB_USERNAME>
   ```

---

### Method C: Organization Team Membership

For contributors participating across multiple repositories in the organization:
1. Add the contributor to an Ancore Contributors team under `ancore-org`.
2. Grant the team `triage` access to the repositories.
3. Maintainers can then assign any team member to any open issue without per-issue invitation checks.

---

## 3. Automation & CLI Scripts

### Batch Assigning Issues to a Contributor

To assign a batch of issues to a contributor in one command:

```bash
MAINTAINER_TOKEN=$(cat ~/.gh-tokens/wheval)
CONTRIBUTOR="davidugorji"
ISSUES=(1536 1538 1539 1541)

for issue in "${ISSUES[@]}"; do
  echo "Assigning issue #${issue} to ${CONTRIBUTOR}..."
  GH_TOKEN="$MAINTAINER_TOKEN" gh issue edit "$issue" \
    --repo ancore-org/ancore \
    --add-assignee "$CONTRIBUTOR"
done
```

### Verifying Issue Assignment

To verify that the contributor is successfully listed in the issue assignees:

```bash
GH_TOKEN=$(cat ~/.gh-tokens/wheval) gh issue view <ISSUE_NUMBER> \
  --repo ancore-org/ancore \
  --json number,title,assignees \
  --jq '{number: .number, title: .title, assignees: [.assignees[].login]}'
```

---

## 4. Troubleshooting Common Errors

| Error | Root Cause | Resolution |
|-------|------------|------------|
| `HTTP 403: Must have admin rights to Repository` | Attempted assignment using a non-maintainer token. | Ensure `GH_TOKEN` is loaded from a maintainer token (`~/.gh-tokens/wheval`). |
| `HTTP 422: Could not resolve to a User` / Assignee omitted | Contributor has not accepted collaborator invite or never interacted with the repo. | Send collaborator invite or ask contributor to comment on the issue first. |
| `net/http: TLS handshake timeout` | Network latency or transient GitHub API timeout. | Retry the command with exponential backoff or check network connectivity. |
