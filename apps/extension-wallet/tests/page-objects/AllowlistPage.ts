import type { Page } from '@playwright/test';

export class AllowlistPage {
  constructor(private readonly page: Page) {}

  async navigate() {
    await this.page.getByRole('link', { name: /settings/i }).click();
    await this.page.getByRole('button', { name: /allowlist|connected sites/i }).click();
  }

  getGrantedOrigins() {
    return this.page.getByTestId(/^allowlist-origin-/);
  }

  async approveAccessRequest() {
    await this.page.getByRole('button', { name: /approve|allow/i }).click();
  }

  async denyAccessRequest() {
    await this.page.getByRole('button', { name: /deny|reject/i }).click();
  }

  async revokeOrigin(origin: string) {
    await this.page
      .getByTestId(`allowlist-origin-${origin}`)
      .getByRole('button', { name: /revoke|remove/i })
      .click();
  }

  async waitForApprovalPrompt() {
    await this.page.waitForSelector('[data-testid="access-request-prompt"]', { timeout: 10_000 });
  }
}
