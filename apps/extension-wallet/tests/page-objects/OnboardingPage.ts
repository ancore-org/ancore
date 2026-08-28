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

  async confirmMnemonicChallenge(words: string[]) {
    const labels = await this.page.locator('label:has-text("Word #")').all();
    for (const label of labels) {
      const text = await label.innerText();
      const match = text.match(/Word #(\d+)/);
      if (match) {
        const index = parseInt(match[1], 10) - 1;
        const correctWord = words[index];
        const container = label.locator('..');
        await container.getByRole('button', { name: correctWord, exact: true }).click();
      }
    }
  }

  async failMnemonicChallenge() {
    // Just click the first option for all challenges, which is statistically likely to fail at least one
    const labels = await this.page.locator('label:has-text("Word #")').all();
    for (const label of labels) {
      const container = label.locator('..');
      await container.getByRole('button').first().click();
    }
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
