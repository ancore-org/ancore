# Pull request workflow

Use a **feature branch** so you can open a PR instead of pushing straight to `main`.

## Steps

**1. Create a branch (from latest main)**

```bash
git checkout main
git pull origin main
git checkout -b feat/your-feature-name
```

**2. Make your changes, then commit**

```bash
git add -A
git status
git commit -m "feat(scope): short description"
```

**3. Push the branch**

```bash
git push -u origin feat/your-feature-name
```

**4. Open a PR on GitHub**

- Go to the repo → **Pull requests** → **New pull request**
- Base: `main` ← Compare: `feat/your-feature-name`
- Add title and description, then create the PR.

**5. After merge (on GitHub or locally)**

```bash
git checkout main
git pull origin main
git branch -d feat/your-feature-name   # optional: delete local branch
```

## Branch naming

- `feat/thing` — new feature
- `fix/thing` — bugfix
- `chore/thing` — config, deps, tooling

Example: `feat/contract-execute-nonce`, `fix/account-abstraction-types`.
