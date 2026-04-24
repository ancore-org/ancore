#268 Home dashboard live data and empty-state resilience
Repo Avatar
ancore-org/ancore
Home dashboard live data and empty-state resilience
Description:
Wire dashboard balances/activity to real account data and implement resilient empty/error states.

Context:
Home dashboard currently mixes placeholder and static values in places; MVP needs trustworthy state.

Requirements:

Connect dashboard widgets to account store + balance hook outputs
Implement loading/empty/error states with clear recovery actions
Add tests for locked/offline/no-account scenarios
Files to Create/Update:

apps/extension-wallet/src/screens/HomeScreen.tsx
apps/extension-wallet/src/hooks/useAccountBalance.ts
Dependencies: None

Definition of Done:

Implementation compiles and integrates without breaking dependent modules
Unit/integration tests cover success and critical failure paths
No overlap/redundancy with prerequisite tasks; dependency notes updated where needed
Labels: extension,ui,enhancement,Stellar Wave
Estimated Effort: 2-3 days
Priority: High

#266 Send flow transaction simulation and failure UX
Repo Avatar
ancore-org/ancore
Send flow transaction simulation and failure UX
Description:
Complete send flow by wiring simulation, signing, submission and robust failure presentation.

Context:
Send flow is core MVP path and must gracefully handle network and simulation failures.

Requirements:

Wire send flow to core-sdk payment APIs with typed errors
Render specific user-facing actions for simulation-expired/simulation-failed/network errors
Add integration tests for retry/cancel/review transitions
Files to Create/Update:

apps/extension-wallet/src/screens/Send/
packages/core-sdk/src/send-payment.ts
Dependencies: None

Definition of Done:

Implementation compiles and integrates without breaking dependent modules
Unit/integration tests cover success and critical failure paths
No overlap/redundancy with prerequisite tasks; dependency notes updated where needed
Labels: extension,transaction,critical,Stellar Wave
Estimated Effort: 3-4 days
Priority: Critical

#264 Extension auth/session consistency contract tests
Repo Avatar
ancore-org/ancore
Extension auth/session consistency contract tests
Description:
Add end-to-end auth/session tests proving route guards, lock manager, and storage session stay consistent.

Context:
MVP requires confidence that auth state cannot desync between route/store/background layers.

Requirements:

Add tests for startup states: fresh user, onboarded locked, onboarded unlocked
Add tests for auto-lock transitions and route redirection correctness
Add tests for recovery/reset paths without stale authenticated state leakage
Files to Create/Update:

apps/extension-wallet/src/router/**tests**/router.test.tsx
apps/extension-wallet/src/security/**tests**/lock-manager.test.ts
Dependencies: None

Definition of Done:

Implementation compiles and integrates without breaking dependent modules
Unit/integration tests cover success and critical failure paths
No overlap/redundancy with prerequisite tasks; dependency notes updated where needed
Labels: extension,security,critical,Stellar Wave
Estimated Effort: 3-4 days
Priority: High

#263 Extension background service-worker wallet state implementation
Repo Avatar
ancore-org/ancore
Extension background service-worker wallet state implementation
Description:
Implement real wallet state, lock, and unlock handlers in background messaging layer.

Context:
Background stubs cause state divergence and hidden runtime bugs in extension behavior.

Requirements:

Implement GET_WALLET_STATE using authoritative storage/session state
Implement LOCK_WALLET and UNLOCK_WALLET with error/result contracts
Add messaging integration tests validating popup/background synchronization
Files to Create/Update:

apps/extension-wallet/src/background/service-worker.ts
apps/extension-wallet/src/messaging/
Dependencies: None

Definition of Done:

Implementation compiles and integrates without breaking dependent modules
Unit/integration tests cover success and critical failure paths
No overlap/redundancy with prerequisite tasks; dependency notes updated where needed
Labels: extension,security,enhancement,Stellar Wave
Estimated Effort: 2-3 days
Priority: High
