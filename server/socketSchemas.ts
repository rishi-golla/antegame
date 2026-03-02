/**
 * Zod schemas for socket event payload validation (M5)
 */

import { z } from 'zod';

/** Allowed buy-in tiers (ETH). Any other value is rejected server-side. */
export const ALLOWED_BUY_INS = ['0.001', '0.01', '0.05', '0.25', '0.5'] as const;

/** Allowed SOL buy-in tiers (in lamports). Approx USD-matched to ETH tiers. */
export const ALLOWED_SOL_BUY_INS = [
  10_000_000,   // 0.01 SOL  (~$2, matches 0.001 ETH)
  100_000_000,  // 0.1  SOL  (~$20, matches 0.01 ETH)
  500_000_000,  // 0.5  SOL  (~$100, matches 0.05 ETH)
  2_500_000_000, // 2.5 SOL  (~$500, matches 0.25 ETH)
  5_000_000_000, // 5.0 SOL  (~$1000, matches 0.5 ETH)
] as const;

export const roomCreateSchema = z.object({
  name: z.string().min(1).max(20),
  color: z.string().min(1).max(20),
  maxPlayers: z.number().int().min(2).max(6),
  walletAddress: z.string().optional(),
  buyInEth: z.string().optional().refine(
    (v) => !v || (ALLOWED_BUY_INS as readonly string[]).includes(v),
    { message: 'Invalid buy-in amount' }
  ),
  onChainTxHash: z.string().optional(),
  characterId: z.string().optional(),
  chain: z.enum(['base', 'solana']).optional(),
  entryFeeLamports: z.number().int().optional().refine(
    (v) => !v || (ALLOWED_SOL_BUY_INS as readonly number[]).includes(v),
    { message: 'Invalid SOL entry fee' }
  ),
});

export const roomJoinSchema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1).max(20),
  color: z.string().min(1).max(20),
  walletAddress: z.string().optional(),
  onChainTxHash: z.string().optional(),
  characterId: z.string().optional(),
});

export const chatSendSchema = z.object({
  text: z.string().min(1).max(500),
});

export const roomReconnectSchema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1).max(20),
});

export const gambleSchema = z.object({
  context: z.enum(['buying', 'rent']),
});

export const minigameActionSchema = z.object({
  type: z.string().optional(),
  choice: z.union([z.string(), z.number()]).optional(),
  tile: z.number().int().min(0).max(15).optional(),
  number: z.number().int().min(1).max(10).optional(),
  combo: z.array(z.number().int().min(0).max(9)).max(3).optional(),
});

export const minigameResultSchema = z.object({
  tier: z.enum(['win', 'close-win', 'close-loss', 'loss', 'catastrophic']),
});

export const jailEscapeSchema = z.object({
  method: z.enum(['bail', 'card', 'roll']),
});

export const tileIndexSchema = z.object({
  tileIndex: z.number().int().min(0).max(39),
});

export const tradeOfferSchema = z.object({
  offer: z.object({
    fromPlayer: z.number().int().min(0).max(5),
    toPlayer: z.number().int().min(0).max(5),
    offerMoney: z.number().int().min(0).max(100000),
    requestMoney: z.number().int().min(0).max(100000),
    offerProperties: z.array(z.number().int().min(0).max(39)).max(28),
    requestProperties: z.array(z.number().int().min(0).max(39)).max(28),
  }),
});

/** Validates 0x-prefixed EVM address (42 hex characters). */
const evmAddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid EVM address');

export const quickPlayBaseSchema = z.object({
  name: z.string().min(1).max(20),
  color: z.string().min(1).max(20),
  buyInEth: z.string().refine(
    (v) => (ALLOWED_BUY_INS as readonly string[]).includes(v),
    { message: 'Invalid buy-in amount' }
  ),
  walletAddress: evmAddressSchema,
  characterId: z.string().optional(),
});

export const validateJoinSchema = z.object({
  code: z.string().min(1).max(10),
  color: z.string().min(1).max(20),
  characterId: z.string().optional(),
});

export const quickPlaySolanaSchema = z.object({
  name: z.string().min(1).max(20),
  color: z.string().min(1).max(20),
  entryFeeLamports: z.number().int().refine(
    (v) => (ALLOWED_SOL_BUY_INS as readonly number[]).includes(v),
    { message: 'Invalid SOL buy-in amount' }
  ),
  walletAddress: z.string().min(32).max(44),
  characterId: z.string().optional(),
});

/** @deprecated Use quickPlaySolanaSchema */
export const quickPlaySchema = quickPlaySolanaSchema;
