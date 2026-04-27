# Permissions Justification (Chrome Web Store)

## Requested Permissions

From `apps/extension-wallet/manifest.json`:

- `storage`
- `activeTab`

## Why We Need Each Permission

### `storage`

Used to store wallet-related application state on-device, including:

- onboarding completion state
- lock/unlock session state
- account preferences and settings

This enables the extension to persist user context across browser restarts.

### `activeTab`

Used when users interact with web pages that need wallet connectivity flows.  
This permission is only leveraged in direct user-initiated contexts and is not used for background browsing surveillance.

## What We Do Not Request

- No broad host permissions (`<all_urls>`)
- No history permission
- No bookmarks permission
- No downloads permission
- No clipboard read permission

## User Transparency

Permission usage is disclosed in:

- `docs/PRIVACY_POLICY.md`
- Chrome Web Store listing copy (`store/description.md`)
