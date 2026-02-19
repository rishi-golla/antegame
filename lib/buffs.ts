import { CHARACTERS, type BuffType, type CharacterBuff } from './assetMap';
import type { Player } from '@/types/game';

/** Get the buff for a player based on their characterId */
export function getPlayerBuff(player: Player): CharacterBuff | null {
  if (!player.characterId) return null;
  const char = CHARACTERS.find((c) => c.id === player.characterId);
  return char?.buff ?? null;
}

/** Check if a player has a specific buff type */
export function hasBuff(player: Player, type: BuffType): boolean {
  const buff = getPlayerBuff(player);
  return buff?.type === type;
}

/** Get the modifier value for a specific buff type, or 0 if player doesn't have it */
export function getBuffModifier(player: Player, type: BuffType): number {
  const buff = getPlayerBuff(player);
  if (!buff || buff.type !== type) return 0;
  return buff.modifier;
}

/** Apply a discount: returns the discounted price (floors the result) */
export function applyDiscount(amount: number, discountRate: number): number {
  return Math.floor(amount * (1 - discountRate));
}

/** Apply a boost: returns the boosted amount (floors the result) */
export function applyBoost(amount: number, boostRate: number): number {
  return Math.floor(amount * (1 + boostRate));
}
