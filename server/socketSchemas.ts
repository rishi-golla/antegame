/**
 * Zod schemas for socket event payload validation (M5)
 */

import { z } from 'zod';

export const roomCreateSchema = z.object({
  name: z.string().min(1).max(20),
  color: z.string().min(1).max(20),
  maxPlayers: z.number().int().min(2).max(6),
  walletAddress: z.string().optional(),
  buyInEth: z.string().optional(),
  onChainTxHash: z.string().optional(),
  characterId: z.string().optional(),
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
  tile: z.number().int().optional(),
  number: z.number().int().optional(),
  combo: z.array(z.number().int()).optional(),
}).passthrough();

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

export const quickPlayBaseSchema = z.object({
  name: z.string().min(1).max(20),
  color: z.string().min(1).max(20),
  buyInEth: z.string().min(1).max(20),
  walletAddress: z.string().max(100),
});

export const validateJoinSchema = z.object({
  code: z.string().min(1).max(10),
  color: z.string().min(1).max(20),
});

export const quickPlaySchema = z.object({
  name: z.string().min(1).max(20),
  color: z.string().min(1).max(20),
  entryFeeLamports: z.number().int().min(0),
  walletAddress: z.string().max(100),
});
