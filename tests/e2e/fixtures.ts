import { test as base, type Page } from '@playwright/test';

/**
 * Shared fixtures for E2E tests.
 *
 * Since real wallet extensions (Phantom, MetaMask) aren't available in headless
 * Playwright, we inject mock wallet objects and mock the auth API so the app
 * behaves as if a wallet is connected and authenticated.
 */

// Fake wallet addresses
export const SOLANA_WALLET = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';
export const EVM_WALLET = '0x1234567890abcdef1234567890abcdef12345678';

/** Inject mock Solana (Phantom) wallet into the page */
export async function mockSolanaWallet(page: Page) {
  await page.addInitScript(() => {
    const mockPublicKey = {
      toBase58: () => '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
      toBytes: () => new Uint8Array(32),
      toString: () => '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
    };

    (window as any).solana = {
      isPhantom: true,
      isConnected: true,
      publicKey: mockPublicKey,
      connect: async () => ({ publicKey: mockPublicKey }),
      disconnect: async () => {},
      signMessage: async () => new Uint8Array(64),
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any) => txs,
      sendTransaction: async () => 'mockTxSignature123',
      on: () => {},
      off: () => {},
      removeListener: () => {},
    };

    (window as any).phantom = { solana: (window as any).solana };
  });
}

/** Inject mock EVM (MetaMask) wallet into the page */
export async function mockEVMWallet(page: Page) {
  await page.addInitScript(() => {
    const address = '0x1234567890abcdef1234567890abcdef12345678';
    (window as any).ethereum = {
      isMetaMask: true,
      selectedAddress: address,
      chainId: '0x2105', // Base mainnet
      request: async ({ method }: { method: string; params?: any[] }) => {
        switch (method) {
          case 'eth_chainId': return '0x2105';
          case 'eth_accounts': return [address];
          case 'eth_requestAccounts': return [address];
          case 'personal_sign': return '0x' + '00'.repeat(65);
          case 'eth_sendTransaction': return '0x' + 'ab'.repeat(32);
          case 'wallet_switchEthereumChain': return null;
          default: return null;
        }
      },
      on: () => {},
      removeListener: () => {},
      removeAllListeners: () => {},
    };
  });
}

/**
 * Mock the auth session cookie so the app treats the user as logged in.
 * Also intercept the /api/auth/me endpoint to return mock user data.
 */
export async function mockAuthSession(page: Page, chain: 'solana' | 'base') {
  const wallet = chain === 'solana' ? SOLANA_WALLET : EVM_WALLET;
  const displayName = chain === 'solana' ? 'SolTestUser' : 'BaseTestUser';

  // Set a fake session cookie
  await page.context().addCookies([{
    name: 'session',
    value: 'mock-session-token',
    domain: 'localhost',
    path: '/',
  }]);

  // Intercept auth/me to return mock user
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          walletAddress: wallet,
          displayName,
          characterId: 'high-roller',
          chain,
        },
        stats: {
          wallet_address: wallet,
          games_played: 5,
          games_won: 2,
          total_earned_lamports: 500000000,
          total_lost_lamports: 300000000,
          minigames_played: 10,
          minigames_won: 6,
        },
      }),
    });
  });

  // Intercept stats/me
  await page.route('**/api/stats/me*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        stats: {
          wallet_address: wallet,
          games_played: 5,
          games_won: 2,
          total_earned_lamports: 500000000,
          total_lost_lamports: 300000000,
          minigames_played: 10,
          minigames_won: 6,
        },
        history: [{
          id: 1,
          finished_at: Math.floor(Date.now() / 1000) - 3600,
          duration_ms: 120000,
          player_count: 3,
          winner_name: displayName,
          winner_wallet: wallet,
          entry_fee_lamports: 10000000,
          winner_payout_lamports: 25000000,
          room_code: 'TEST1',
          players: JSON.stringify([
            { walletAddress: wallet, name: displayName, placing: 1 },
          ]),
          chain,
        }],
      }),
    });
  });

  // Intercept referrals
  await page.route('**/api/auth/referrals', async (route) => {
    if (route.request().url().includes('/campaign')) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        referralCode: wallet,
        referredBy: null,
        count: 0,
        referrals: [],
        earnings: { totalWei: '0', unpaidWei: '0', paidWei: '0' },
      }),
    });
  });

  // Intercept campaign
  await page.route('**/api/auth/referrals/campaign*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ active: false, phase: 'none', leaderboard: [] }),
    });
  });

  // Intercept leaderboard
  await page.route('**/api/stats/leaderboard*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        leaderboard: [{
          wallet_address: wallet,
          display_name: displayName,
          character_id: 'high-roller',
          games_played: 5,
          games_won: 2,
          total_earned_lamports: 500000000,
        }],
      }),
    });
  });
}

/** Extended test fixture with wallet mocking helpers */
export const test = base.extend<{
  solanaPage: Page;
  basePage: Page;
}>({
  solanaPage: async ({ page }, use) => {
    await mockSolanaWallet(page);
    await mockAuthSession(page, 'solana');
    await use(page);
  },
  basePage: async ({ page }, use) => {
    await mockEVMWallet(page);
    await mockAuthSession(page, 'base');
    await use(page);
  },
});

export { expect } from '@playwright/test';
