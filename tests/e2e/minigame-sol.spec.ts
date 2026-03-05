import { test, expect } from './fixtures';

/**
 * Solana chain-scoped profile, stats, and leaderboard E2E tests.
 *
 * Uses the solanaPage fixture which mocks auth as a Solana user,
 * so the app shows MainMenu with Solana as activeChain.
 * Currency labels should show "SOL" everywhere.
 */

test.describe('Solana Chain Scoping', () => {
  test.describe('Profile', () => {
    test('shows SOL currency labels in stats grid', async ({ solanaPage: page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const profileBtn = page.locator('.menuGhostBtn', { hasText: 'Profile' });
      await profileBtn.click();
      await expect(page.locator('.statsGrid')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('SOL Won')).toBeVisible();
      await expect(page.getByText('SOL Lost')).toBeVisible();
    });

    test('history entries show SOL amounts', async ({ solanaPage: page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const profileBtn = page.locator('.menuGhostBtn', { hasText: 'Profile' });
      await profileBtn.click();

      const historyRow = page.locator('.profileHistoryRow').first();
      await expect(historyRow).toBeVisible({ timeout: 5000 });
      await expect(historyRow).toContainText('SOL');
    });
  });

  test.describe('API scoping', () => {
    test('stats/me is called with chain=solana', async ({ solanaPage: page }) => {
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
      expect(requests.some(u => u.includes('chain=solana'))).toBe(true);
    });

    test('campaign leaderboard is called with chain=solana', async ({ solanaPage: page }) => {
      const requests: string[] = [];
      page.on('request', (req) => {
        if (req.url().includes('/api/auth/referrals/campaign')) {
          requests.push(req.url());
        }
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Menu "Leaderboard" navigates to CampaignLeaderboardScreen
      const leaderboardBtn = page.locator('.menuGhostBtn', { hasText: 'Leaderboard' });
      await leaderboardBtn.click();
      await page.waitForTimeout(1500);
      expect(requests.some(u => u.includes('chain=solana'))).toBe(true);
    });
  });

  test.describe('Campaign Leaderboard', () => {
    test('campaign leaderboard renders with SOL volume labels', async ({ solanaPage: page }) => {
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
              referrer_wallet: '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
              display_name: 'SolTestUser',
              referral_count: 5,
              total_volume: 2000000000,
            }],
          }),
        });
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const leaderboardBtn = page.locator('.menuGhostBtn', { hasText: 'Leaderboard' });
      await leaderboardBtn.click();

      // Wait for the campaign leaderboard rows to appear
      const volumeCell = page.locator('.campaignLbRow .campaignLbVol').first();
      await expect(volumeCell).toBeVisible({ timeout: 5000 });
      await expect(volumeCell).toContainText('SOL');
    });
  });

  test.describe('Free Play', () => {
    test('can navigate to free play setup from menu', async ({ solanaPage: page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const freePlayBtn = page.locator('.menuGhostBtn', { hasText: 'Free Play' });
      await freePlayBtn.click();
      await expect(page.locator('.setupCard')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('Choose your characters')).toBeVisible();
    });
  });
});
