/**
 * Onboarding Screen Components
 *
 * Complete onboarding flow for new users:
 * - Welcome: Introduction to Ancore wallet
 * - Mnemonic: Display and backup recovery phrase
 * - Verify: Confirm recovery phrase was saved
 * - Password: Create wallet password
 * - Deploy: Deploy account contract to Stellar
 * - Success: Account creation complete
 */

export { WelcomeScreen } from './WelcomeScreen';
export type { WelcomeScreenProps } from './WelcomeScreen';

export { MnemonicScreen } from './MnemonicScreen';
export type { MnemonicScreenProps } from './MnemonicScreen';

export { VerifyMnemonicScreen } from './VerifyMnemonicScreen';
export type { VerifyMnemonicScreenProps } from './VerifyMnemonicScreen';

export { PasswordScreen } from './PasswordScreen';
export type { PasswordScreenProps } from './PasswordScreen';

export { DeployScreen } from './DeployScreen';
export type { DeployScreenProps } from './DeployScreen';

export { SuccessScreen } from './SuccessScreen';
export type { SuccessScreenProps } from './SuccessScreen';
