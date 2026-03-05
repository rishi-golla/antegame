import { test, expect } from './fixtures';

/**
 * Base (EVM) chain-scoped profile, stats, and leaderboard E2E tests.
 *
 * Uses the basePage fixture which mocks auth as a Base user,
 * so the app shows MainMenu with Base as activeChain.
 * Currency labels should show "ETH" everywhere.
 */

test.describe('Base Chain Scoping', () => {
  test.describe('Profile', () => {
    test('shows ETH currency labels in stats grid', async ({ basePage: page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const profileBtn = page.locator('.menuGhostBtn', { hasText: 'Profile' });
      await profileBtn.click();
      await expect(page.locator('.statsGrid')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('ETH Won')).toBeVisible();
      await expect(page.getByText('ETH Lost')).toBeVisible();
    });

    test('history entries show ETH amounts', async ({ basePage: page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const profileBtn = page.locator('.menuGhostBtn', { hasText: 'Profile' });
      await profileBtn.click();

      const historyRow = page.locator('.profileHistoryRow').first();
      await expect(historyRow).toBeVisible({ timeout: 5000 });
      await expect(historyRow).toContainText('ETH');
    });
  });

  test.describe('API scoping', () => {
    test('stats/me is called with chain=base', async ({ basePage: page }) => {
      const requests: string[] = [];
      page.on('request', (req) => {
        if (req.url().includes('/api/stats/me')) {
          requests.push(req.url());
        }
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const profileBtn = page.locator('.menuGhostBtn', { hasText: 'Profile' });
      await profileBtn.click();
      await page.waitForTimeout(1500);
      expect(requests.some(u => u.includes('chain=base'))).toBe(true);
    });

    test('campaign leaderboard is called with chain=base', async ({ basePage: page }) => {
      const requests: string[] = [];
      page.on('request', (req) => {
        if (req.url().includes('/api/auth/referrals/campaign')) {
          requests.push(req.url());
        }
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const leaderboardBtn = page.locator('.menuGhostBtn', { hasText: 'Leaderboard' });
      await leaderboardBtn.click();
      await page.waitForTimeout(1500);
      expect(requests.some(u => u.includes('chain=base'))).toBe(true);
    });
  });

  test.describe('Campaign Leaderboard', () => {
    test('campaign leaderboard renders with ETH volume labels', async ({ basePage: page }) => {
      // Override campaign route with leaderboard data
      await page.route('**/api/auth/referrals/campaign*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            active: true,
            phase: 'normal',
            campaignStartUtc: new Date(Date.now() - 86400000).toISOString(),
            campaignEndUtc: new Date(Date.now() + 86400000 * 6).toISOString(),
            boostEndsUtc: new Date(Date.now() - 3600000).toISOString(),
            timeRemainingMs: 86400000 * 6,
            boostTimeRemainingMs: 0,
            referralRatePercent: 10,
            leaderboard: [{
              referrer_wallet: '0x1234567890abcdef1234567890abcdef12345678',
              display_name: 'BaseTestUser',
              referral_count: 3,
              total_volume: 1500000000,
            }],
          }),
        });
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const leaderboardBtn = page.locator('.menuGhostBtn', { hasText: 'Leaderboard' });
      await leaderboardBtn.click();

      // Wait for campaign leaderboard data rows
      const volumeCell = page.locator('.campaignLbRow .campaignLbVol').first();
      await expect(volumeCell).toBeVisible({ timeout: 5000 });
      await expect(volumeCell).toContainText('ETH');
    });
  });

  test.describe('Free Play', () => {
    test('can navigate to free play setup from menu', async ({ basePage: page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const freePlayBtn = page.locator('.menuGhostBtn', { hasText: 'Free Play' });
      await freePlayBtn.click();
      await expect(page.locator('.setupCard')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('Choose your characters')).toBeVisible();
    });
  });
});
