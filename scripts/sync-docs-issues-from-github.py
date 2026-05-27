#!/usr/bin/env python3
"""
Rebuild docs/issues/open and docs/issues/completed from GitHub API state.

Usage (from repo root):
  python3 scripts/sync-docs-issues-from-github.py

Requires: gh CLI authenticated (gh auth status).

Pull requests returned by the issues endpoint are skipped (they are not tracked
in docs/issues/).
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
OPEN_DIR = REPO_ROOT / "docs/issues/open"
COMPLETED_DIR = REPO_ROOT / "docs/issues/completed"
SECURITY_TELEGRAM = "https://t.me/+OqlAx-gQx3M4YzJk"


def slugify(title: str, max_len: int = 72) -> str:
    s = title.strip().lower()
    s = re.sub(r"^\[[^\]]+\]\s*", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-") or "issue"
    return s[:max_len].rstrip("-")


def gh_api_issues_page(page: int) -> list[dict]:
    cmd = [
        "gh",
        "api",
        "-H",
        "Accept: application/vnd.github+json",
        f"repos/ancore-org/ancore/issues?state=all&per_page=100&page={page}",
    ]
    out = subprocess.check_output(cmd, cwd=REPO_ROOT, text=True)
    return json.loads(out)


def fetch_all_issues() -> list[dict]:
    all_rows: list[dict] = []
    page = 1
    while True:
        batch = gh_api_issues_page(page)
        if not batch:
            break
        all_rows.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return all_rows


def is_pull_request(issue: dict) -> bool:
    return issue.get("pull_request") is not None


def label_names(issue: dict) -> list[str]:
    return [lb["name"] for lb in issue.get("labels", [])]


def default_body_feature(title: str) -> str:
    return f"""## Feature Description

{title}

## Problem Statement

<!-- What problem does this solve? -->

## Proposed Solution

<!-- How should this work? -->

## Alternatives Considered

-

## Use Case

As a [user], I want [goal] so that [benefit].

## Impact Area

- [ ] Smart Contracts
- [ ] SDK
- [ ] Extension Wallet
- [ ] Mobile Wallet
- [ ] Web Dashboard
- [ ] Documentation
- [ ] Infrastructure

## Priority

- [ ] Critical - Core functionality
- [ ] High - Important enhancement
- [ ] Medium - Nice to have
- [ ] Low - Minor improvement

## Implementation Complexity

- [ ] Simple
- [ ] Medium
- [ ] Complex

## Related Issues/RFCs

"""


def default_body_bug(title: str) -> str:
    return f"""## Bug Description

{title}

## To Reproduce

1.
2.
3.

## Expected Behavior


## Actual Behavior


## Environment

**Ancore Version:**

**Platform:**

- [ ] Extension Wallet
- [ ] Mobile Wallet
- [ ] Web Dashboard
- [ ] SDK Integration
- [ ] Smart Contracts

## Severity

- [ ] Critical / security-related
- [ ] High
- [ ] Medium
- [ ] Low

---

⚠️ **SECURITY:** If this is a vulnerability, **do not** discuss details publicly. Report privately via Telegram: {SECURITY_TELEGRAM} — see [SECURITY.md](../../../SECURITY.md).


"""


def render_issue_doc(issue: dict, synced_iso: str) -> str:
    num = issue["number"]
    title = issue["title"] or f"Issue #{num}"
    state = issue["state"]
    html_url = issue["html_url"]
    labels = label_names(issue)
    body = (issue.get("body") or "").strip()
    is_bug = "bug" in [x.lower() for x in labels]

    if not body:
        body = default_body_bug(title) if is_bug else default_body_feature(title)
    else:
        body = f"""## GitHub issue body (synced)

{body}
"""

    labels_line = ", ".join(labels) if labels else "(none)"
    labels_yaml = "\n".join(f"  - {lb}" for lb in labels) if labels else "  - (none)"

    header = f"""---
github_issue: {num}
github_state: {state}
synced_at: {synced_iso}
labels:
{labels_yaml}
---

## Issue #{num}: {title}

**Remote:** {html_url}
**State:** `{state}`
**Labels:** {labels_line}

"""

    footer = f"""
---

### Private disclosure (bugs & security)

If this issue involves a **security vulnerability**, do **not** use the public thread for sensitive details. Report privately:

- **Telegram:** {SECURITY_TELEGRAM}
- **Details:** [.github/ISSUE_TEMPLATE/config.yml](../../../.github/ISSUE_TEMPLATE/config.yml) (Security Vulnerability contact) and [SECURITY.md](../../../SECURITY.md)

For **feature work**, see RFC guidance in [RFC.md](../../../RFC.md) when appropriate.
"""

    return header + body + footer


def clear_md(dir_path: Path) -> None:
    if not dir_path.is_dir():
        dir_path.mkdir(parents=True, exist_ok=True)
        return
    for p in dir_path.glob("*.md"):
        p.unlink()


def main() -> int:
    synced_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        rows = fetch_all_issues()
    except subprocess.CalledProcessError as e:
        print(e, file=sys.stderr)
        return 1

    issues_only = [r for r in rows if not is_pull_request(r)]

    clear_md(OPEN_DIR)
    clear_md(COMPLETED_DIR)

    open_count = 0
    closed_count = 0

    for issue in sorted(issues_only, key=lambda x: x["number"]):
        num = issue["number"]
        title = issue["title"] or f"issue-{num}"
        slug = slugify(title)
        name = f"{num:03d}-{slug}.md"
        # Use zero-padded number for stable sort (matches older repo style where applicable)
        if len(str(num)) > 3:
            name = f"{num}-{slug}.md"

        content = render_issue_doc(issue, synced_iso)
        target = OPEN_DIR if issue["state"] == "open" else COMPLETED_DIR
        if issue["state"] == "open":
            open_count += 1
        else:
            closed_count += 1

        out_path = target / name
        out_path.write_text(content, encoding="utf-8")

    readme = REPO_ROOT / "docs/issues/README.md"
    readme_text = readme.read_text(encoding="utf-8")

    # Update counts block if present
    import re as _re

    readme_text = _re.sub(
        r"- Open templates:.*",
        f"- Open templates: {open_count}",
        readme_text,
        count=1,
    )
    readme_text = _re.sub(
        r"- Completed templates:.*",
        f"- Completed templates: {closed_count}",
        readme_text,
        count=1,
    )
    readme_text = _re.sub(
        r"\| GitHub open issues \|[^\n]+\|",
        f"| GitHub open issues | {open_count} (must match row above after sync) |",
        readme_text,
        count=1,
    )
    # Generic closed row
    readme_text = _re.sub(
        r"\| GitHub closed issues \|[^\n]+\|",
        f"| GitHub closed issues | {closed_count} (tracked in completed/) |",
        readme_text,
        count=1,
    )
    readme_text = _re.sub(
        r"\| Local `docs/issues/open/\*\.md` \|[^\n]+\|",
        f"| Local `docs/issues/open/*.md` | {open_count} |",
        readme_text,
        count=1,
    )
    readme_text = _re.sub(
        r"\| Local `docs/issues/completed/\*\.md` \|[^\n]+\|",
        f"| Local `docs/issues/completed/*.md` | {closed_count} |",
        readme_text,
        count=1,
    )

    readme_text = _re.sub(
        r"\*\*Interpretation:\*\*[\s\S]*?(?=## Latest issue wave)",
        "**Interpretation:** These folders are regenerated by `scripts/sync-docs-issues-from-github.py`. GitHub remains canonical for assignment/milestones; local files are offline mirrors plus the Telegram/security footer on each file.\n\n",
        readme_text,
        count=1,
    )

    readme.write_text(readme_text, encoding="utf-8")

    print(
        f"Synced {len(issues_only)} GitHub issues (skipped PRs). "
        f"open/: {open_count}, completed/: {closed_count}. "
        f"Updated docs/issues/README.md counts."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
