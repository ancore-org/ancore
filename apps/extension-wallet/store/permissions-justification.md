# Permissions Justification (Chrome Web Store)

## Requested Permissions

From `apps/extension-wallet/manifest.json`:

- `storage`

## Why We Need Each Permission

### `storage`

Used to store wallet-related application state on-device, including:

- onboarding completion state
- lock/unlock session state
- account preferences and settings

This enables the extension to persist user context across browser restarts.

## What We Do Not Request

- No broad host permissions (`<all_urls>`)
- No activeTab permission (not currently implemented)
- No history permission
- No bookmarks permission
- No downloads permission
- No clipboard read permission

## User Transparency

Permission usage is disclosed in:

- `docs/PRIVACY_POLICY.md`
- Chrome Web Store listing copy (`store/description.md`)
