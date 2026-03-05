import { test, expect } from './fixtures';

/**
 * Bridge page E2E tests.
 *
 * Note: Real wallet adapters (Solana wallet-adapter, wagmi) don't pick up
 * injected window.solana/ethereum mocks, so the CTA button stays disabled
 * when no real wallet extension is present. These tests verify UI rendering,
 * direction toggling, and form state -- not the full bridge submission flow
 * which requires a real wallet extension.
 */

test.describe('Bridge Page', () => {
  test.describe('SOL → Base direction (default)', () => {
    test('renders SOL → Base UI with correct labels', async ({ page }) => {
      await page.goto('/bridge');
      await expect(page.locator('.bridgeHeaderTitle')).toContainText('SOL → Base');
      await expect(page.locator('.bridgeTokenPill')).toContainText('SOL');
      await expect(page.locator('.bridgeMeta').first()).toContainText('Network fee (Solana)');
    });

    test('shows Connect Solana button when no wallet', async ({ page }) => {
      await page.goto('/bridge');
      await expect(page.locator('.bridgeConnect')).toContainText('Connect Solana');
    });

    test('CTA is disabled without connected wallet', async ({ page }) => {
      await page.goto('/bridge');
      await expect(page.locator('.bridgeCta')).toBeDisabled();
      await expect(page.locator('.bridgeCta')).toContainText('Create SOL → Base Order');
    });

    test('amount input accepts numeric values', async ({ page }) => {
      await page.goto('/bridge');
      const amountInput = page.locator('.bridgeMainInput').first();
      await amountInput.fill('0.05');
      await expect(amountInput).toHaveValue('0.05');
    });

    test('recipient input accepts EVM address', async ({ page }) => {
      await page.goto('/bridge');
      const recipientInput = page.locator('.bridgeMainInput').nth(1);
      await recipientInput.fill('0x1234567890abcdef1234567890abcdef12345678');
      await expect(recipientInput).toHaveValue('0x1234567890abcdef1234567890abcdef12345678');
    });

    test('shows minimum amount info', async ({ page }) => {
      await page.goto('/bridge');
      // The second meta line shows the minimum for the destination
      await expect(page.locator('.bridgeMeta').nth(1)).toContainText('Minimum for SOL → Base: 0.012 SOL');
    });
  });

  test.describe('Base → SOL direction', () => {
    test('swaps to Base → SOL direction', async ({ page }) => {
      await page.goto('/bridge');
      await page.locator('.bridgeDivider').click();
      await expect(page.locator('.bridgeHeaderTitle')).toContainText('Base → SOL');
      await expect(page.locator('.bridgeTokenPill')).toContainText('ETH');
    });

    test('shows Connect Base button when no wallet', async ({ page }) => {
      await page.goto('/bridge');
      await page.locator('.bridgeDivider').click();
      await expect(page.locator('.bridgeConnect')).toContainText('Connect Base');
    });

    test('CTA is disabled without connected wallet', async ({ page }) => {
      await page.goto('/bridge');
      await page.locator('.bridgeDivider').click();
      await expect(page.locator('.bridgeCta')).toBeDisabled();
      await expect(page.locator('.bridgeCta')).toContainText('Create Base → SOL Order');
    });

    test('shows minimum ETH info', async ({ page }) => {
      await page.goto('/bridge');
      await page.locator('.bridgeDivider').click();
      await expect(page.locator('.bridgeMeta').first()).toContainText('Minimum for Base → SOL: 0.002 ETH');
    });

    test('recipient input accepts Solana address', async ({ page }) => {
      await page.goto('/bridge');
      await page.locator('.bridgeDivider').click();
      const recipientInput = page.locator('.bridgeMainInput').nth(1);
      await recipientInput.fill('7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV');
      await expect(recipientInput).toHaveValue('7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV');
    });
  });

  test.describe('Direction swap', () => {
    test('swap button toggles direction back and forth', async ({ page }) => {
      await page.goto('/bridge');
      await expect(page.locator('.bridgeHeaderTitle')).toContainText('SOL → Base');

      await page.locator('.bridgeDivider').click();
      await expect(page.locator('.bridgeHeaderTitle')).toContainText('Base → SOL');

      await page.locator('.bridgeDivider').click();
      await expect(page.locator('.bridgeHeaderTitle')).toContainText('SOL → Base');
    });

    test('swap changes token pill label', async ({ page }) => {
      await page.goto('/bridge');
      await expect(page.locator('.bridgeTokenPill')).toContainText('SOL');
      await page.locator('.bridgeDivider').click();
      await expect(page.locator('.bridgeTokenPill')).toContainText('ETH');
    });
  });

  test('back home link navigates to homepage', async ({ page }) => {
    await page.goto('/bridge');
    const backLink = page.locator('.bridgeGhostBtn');
    await expect(backLink).toContainText('Back Home');
    await expect(backLink).toHaveAttribute('href', '/');
  });
});
