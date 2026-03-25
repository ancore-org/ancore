Create Home Dashboard Screen
Description:
Build the main dashboard screen showing account balance and quick actions for sending and receiving.

Context:
The home screen is the wallet's main interface. It shows essential information at a glance.

Requirements:

Display account address with copy button
Show XLM balance
Display network indicator (testnet/mainnet)
Add quick action buttons (Send, Receive)
Implement pull-to-refresh for balance
Add settings menu access
Create empty state for new accounts
Unit tests for interactions
Screen Layout:

┌─────────────────────────────────┐
│ Ancore ⚙️ Settings │
├─────────────────────────────────┤
│ │
│ GABC...123 📋 │
│ Testnet │
│ │
│ 100.5 XLM │
│ │
│ [Send] [Receive] │
│ │
└─────────────────────────────────┘
Files to Create:

apps/extension-wallet/src/screens/HomeScreen.tsx
apps/extension-wallet/src/components/AccountHeader.tsx
apps/extension-wallet/src/components/BalanceCard.tsx
apps/extension-wallet/src/components/QuickActions.tsx
apps/extension-wallet/src/hooks/useAccountBalance.ts
Dependencies:

@ancore/core-sdk
@ancore/stellar
@ancore/ui-kit
Success Criteria:

Balance updates automatically
Quick actions navigate correctly
Pull-to-refresh works
Empty states are helpful
Definition of Done:

All components created
Balance fetching working
Quick actions functional
Refresh working
Mobile responsive
Labels: feature, ui, screen, high-priority
Complexity: 200 points (High)
Estimated Effort: 3-4 days
Priority: Critical
