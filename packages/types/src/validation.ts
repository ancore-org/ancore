export type ValidationResult = {
  valid: boolean;
  requiresStepUp?: never;
};

export type TransferValidationResult = {
  action: 'allow' | 'step_up' | 'block';
  // ... other fields ...
};
