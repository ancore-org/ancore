Run pnpm run lint

> chioma@0.1.0 lint /home/runner/work/chioma/chioma/frontend
> eslint .

/home/runner/work/chioma/chioma/frontend/components/i18n/LanguageSwitcher.tsx
34:7 error Error: This value cannot be modified

Modifying a variable defined outside a component or hook is not allowed. Consider using an effect.

/home/runner/work/chioma/chioma/frontend/components/i18n/LanguageSwitcher.tsx:34:7
32 | // Update html lang attribute
33 | if (typeof document !== 'undefined') {

> 34 | document.documentElement.lang = code;

     |       ^^^^^^^^^^^^^^^^^^^^^^^^ value cannot be modified

35 | }
36 | }
37 | react-hooks/immutability

/home/runner/work/chioma/chioma/frontend/components/messaging/MessagingHub.tsx
Warning: 30:5 warning 'createRoom' is assigned a value but never used. Allowed unused vars must match /^\_/u @typescript-eslint/no-unused-vars

/home/runner/work/chioma/chioma/frontend/components/stellar/StellarAccountDetail.tsx
Warning: 10:3 warning 'XCircle' is defined but never used. Allowed unused vars must match /^_/u @typescript-eslint/no-unused-vars
Warning: 13:3 warning 'Database' is defined but never used. Allowed unused vars must match /^_/u @typescript-eslint/no-unused-vars

/home/runner/work/chioma/chioma/frontend/components/stellar/StellarAccountList.tsx
Warning: 4:18 warning 'RefreshCw' is defined but never used. Allowed unused vars must match /^\_/u @typescript-eslint/no-unused-vars

/home/runner/work/chioma/chioma/frontend/components/stellar/StellarAccountsView.tsx
Warning: 5:18 warning 'Plus' is defined but never used. Allowed unused vars must match /^\_/u @typescript-eslint/no-unused-vars

✖ 6 problems (1 error, 5 warnings)

 ELIFECYCLE  Command failed with exit code 1.
Error: Process completed with exit code 1.
