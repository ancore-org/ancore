import type { Page } from '@playwright/test';

export class HistoryPage {
  constructor(private readonly page: Page) {}

  async navigate() {
    await this.page.getByRole('tab', { name: /history|activity/i }).click();
  }

  getTransactionRows() {
    return this.page.getByTestId(/^tx-row-/);
  }

  async getFirstTxHash(): Promise<string> {
    const row = this.page.getByTestId(/^tx-row-/).first();
    return (await row.getAttribute('data-tx-hash')) ?? '';
  }

  async waitForAtLeastOne() {
    await this.page.waitForSelector('[data-testid^="tx-row-"]', { timeout: 15_000 });
  }
}
