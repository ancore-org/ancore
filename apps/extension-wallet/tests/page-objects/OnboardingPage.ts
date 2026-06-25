import type { Page } from '@playwright/test';

export class OnboardingPage {
  constructor(private readonly page: Page) {}

  async selectCreateWallet() {
    await this.page.getByRole('button', { name: /create.*wallet/i }).click();
  }

  async selectImportWallet() {
    await this.page.getByRole('button', { name: /import.*wallet/i }).click();
  }

  async enterMnemonic(mnemonic: string) {
    const words = mnemonic.split(' ');
    for (let i = 0; i < words.length; i++) {
      await this.page.getByTestId(`mnemonic-word-${i}`).fill(words[i]);
    }
  }

  async confirmMnemonicWord(index: number, word: string) {
    await this.page.getByTestId(`confirm-word-${index}`).fill(word);
  }

  async enterPassword(password: string) {
    await this.page
      .getByLabel(/password/i)
      .first()
      .fill(password);
  }

  async confirmPassword(password: string) {
    await this.page.getByLabel(/confirm.*password/i).fill(password);
  }

  async submitPassword() {
    await this.page.getByRole('button', { name: /create|finish|done/i }).click();
  }

  async waitForHome() {
    await this.page.waitForSelector('[data-testid="home-screen"]', { timeout: 15_000 });
  }

  getMnemonicWords() {
    return this.page.getByTestId(/^revealed-word-/);
  }
}
