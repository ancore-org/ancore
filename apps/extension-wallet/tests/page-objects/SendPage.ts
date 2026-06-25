import type { Page } from '@playwright/test';

export class SendPage {
  constructor(private readonly page: Page) {}

  async navigate() {
    await this.page.getByRole('button', { name: /send/i }).click();
  }

  async fillDestination(address: string) {
    await this.page.getByLabel(/destination|recipient|to/i).fill(address);
  }

  async fillAmount(amount: string) {
    await this.page.getByLabel(/amount/i).fill(amount);
  }

  async selectAsset(asset: string) {
    await this.page.getByRole('combobox', { name: /asset/i }).selectOption(asset);
  }

  async fillMemo(memo: string) {
    await this.page.getByLabel(/memo/i).fill(memo);
  }

  async submit() {
    await this.page.getByRole('button', { name: /review|next/i }).click();
  }

  async confirm() {
    await this.page.getByRole('button', { name: /confirm|send/i }).click();
  }

  async waitForSuccess() {
    await this.page.waitForSelector('[data-testid="tx-success"]', { timeout: 20_000 });
  }

  getTxHashLocator() {
    return this.page.getByTestId('tx-hash');
  }
}
