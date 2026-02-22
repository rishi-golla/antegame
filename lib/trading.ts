import type { GameState, TradeOffer } from '@/types/game';
import { COLOR_GROUPS } from './gameData';

export function proposeTrade(state: GameState, offer: TradeOffer): GameState {
  if (offer.fromPlayer === offer.toPlayer) {
    throw new Error('Cannot trade with yourself');
  }

  const from = state.players[offer.fromPlayer];
  const to = state.players[offer.toPlayer];

  if (from.bankrupt) throw new Error('Proposer is bankrupt');
  if (to.bankrupt) throw new Error('Recipient is bankrupt');

  // Validate offered properties
  for (const idx of offer.offerProperties) {
    if (!from.properties.includes(idx)) {
      throw new Error('Proposer does not own offered property');
    }
    // Cannot trade properties that have houses in their color group
    if (hasHousesInGroup(state, offer.fromPlayer, idx)) {
      throw new Error('Must sell all houses in color group before trading');
    }
  }

  // Validate requested properties
  for (const idx of offer.requestProperties) {
    if (!to.properties.includes(idx)) {
      throw new Error('Recipient does not own requested property');
    }
    if (hasHousesInGroup(state, offer.toPlayer, idx)) {
      throw new Error('Recipient must sell all houses in color group before trading');
    }
  }

  // Validate money
  if (offer.offerMoney > from.money) {
    throw new Error('Proposer cannot afford offered money');
  }
  if (offer.requestMoney > to.money) {
    throw new Error('Recipient cannot afford requested money');
  }

  // Non-blocking: don't change phase, just store the offer
  return {
    ...state,
    activeTradeOffer: offer,
  };
}

export function acceptTrade(state: GameState): GameState {
  const offer = state.activeTradeOffer;
  if (!offer) throw new Error('No active trade offer');

  const fromIdx = offer.fromPlayer;
  const toIdx = offer.toPlayer;

  // Calculate 10% mortgage transfer interest for each side
  let fromInterest = 0; // interest fromPlayer pays on mortgaged properties received from toPlayer
  for (const idx of offer.requestProperties) {
    if (state.players[toIdx].mortgaged.includes(idx)) {
      const tile = state.tiles[idx];
      const mv = 'mortgageValue' in tile ? (tile as any).mortgageValue : 0;
      fromInterest += Math.ceil(mv * 0.1);
    }
  }
  let toInterest = 0; // interest toPlayer pays on mortgaged properties received from fromPlayer
  for (const idx of offer.offerProperties) {
    if (state.players[fromIdx].mortgaged.includes(idx)) {
      const tile = state.tiles[idx];
      const mv = 'mortgageValue' in tile ? (tile as any).mortgageValue : 0;
      toInterest += Math.ceil(mv * 0.1);
    }
  }

  const newPlayers = state.players.map((p, i) => {
    if (i === fromIdx) {
      return {
        ...p,
        money: p.money - offer.offerMoney + offer.requestMoney - fromInterest,
        properties: [
          ...p.properties.filter((idx) => !offer.offerProperties.includes(idx)),
          ...offer.requestProperties,
        ],
        // Transfer mortgage status: remove mortgages on properties given away, add mortgages from received properties
        mortgaged: [
          ...p.mortgaged.filter((idx) => !offer.offerProperties.includes(idx)),
          ...offer.requestProperties.filter((idx) => state.players[toIdx].mortgaged.includes(idx)),
        ],
      };
    }
    if (i === toIdx) {
      return {
        ...p,
        money: p.money + offer.offerMoney - offer.requestMoney - toInterest,
        properties: [
          ...p.properties.filter((idx) => !offer.requestProperties.includes(idx)),
          ...offer.offerProperties,
        ],
        mortgaged: [
          ...p.mortgaged.filter((idx) => !offer.requestProperties.includes(idx)),
          ...offer.offerProperties.filter((idx) => state.players[fromIdx].mortgaged.includes(idx)),
        ],
      };
    }
    return p;
  });

  // Update tile ownership
  const newTiles = state.tiles.map((t, i) => {
    if (offer.offerProperties.includes(i)) {
      return { ...t, owner: toIdx };
    }
    if (offer.requestProperties.includes(i)) {
      return { ...t, owner: fromIdx };
    }
    return t;
  });

  let s: GameState = {
    ...state,
    players: newPlayers,
    tiles: newTiles,
    activeTradeOffer: null,
  };

  // Check if either player went negative from mortgage interest or bankrupt from trade
  for (const idx of [fromIdx, toIdx]) {
    const p = s.players[idx];
    if (p.money < 0 && !p.bankrupt) {
      // Negative money from mortgage interest — clamp to 0, enter debt if current player
      // or go bankrupt if no assets to cover it
      const deficit = Math.abs(p.money);
      s = {
        ...s,
        players: s.players.map((pl, i) =>
          i === idx ? { ...pl, money: 0 } : pl
        ),
      };
      // If they have properties they can liquidate, and it's the current player, enter debt
      // Otherwise mark bankrupt
      const hasAssets = s.players[idx].properties.length > 0;
      if (!hasAssets) {
        s = {
          ...s,
          players: s.players.map((pl, i) =>
            i === idx
              ? { ...pl, bankrupt: true, money: 0, properties: [], houses: {}, mortgaged: [], getOutOfJailCards: 0, inJail: false }
              : pl
          ),
        };
        const activePlayers = s.players.filter(pl => !pl.bankrupt);
        if (activePlayers.length <= 1) {
          const winner = activePlayers[0]?.id ?? null;
          s = { ...s, phase: 'game-over' as const, winner };
        } else if (idx === s.currentPlayerIndex) {
          s = { ...s, phase: 'turn-end' as const, activeMinigame: null, pendingRent: null };
        }
      }
      // If they have assets but negative, they'll need to sell on their turn
      // Money is clamped to 0 — not ideal but prevents negative money state
    } else if (p.money === 0 && p.properties.length === 0 && !p.bankrupt) {
      // Zero money and no properties — bankrupt
      s = {
        ...s,
        players: s.players.map((pl, i) =>
          i === idx
            ? { ...pl, bankrupt: true, money: 0, properties: [], houses: {}, mortgaged: [], getOutOfJailCards: 0, inJail: false }
            : pl
        ),
      };
      const activePlayers = s.players.filter(pl => !pl.bankrupt);
      if (activePlayers.length <= 1) {
        const winner = activePlayers[0]?.id ?? null;
        s = { ...s, phase: 'game-over' as const, winner };
      } else if (idx === s.currentPlayerIndex) {
        s = { ...s, phase: 'turn-end' as const, activeMinigame: null, pendingRent: null };
      }
    }
  }

  return s;
}

export function rejectTrade(state: GameState): GameState {
  return {
    ...state,
    activeTradeOffer: null,
  };
}

export function cancelTrade(state: GameState): GameState {
  return {
    ...state,
    activeTradeOffer: null,
  };
}

const MAX_COUNTERS = 5;

export function counterTrade(state: GameState, newOffer: TradeOffer): GameState {
  const existing = state.activeTradeOffer;
  if (!existing) throw new Error('No active trade to counter');

  const count = (existing.counterCount ?? 0) + 1;
  if (count > MAX_COUNTERS) throw new Error('Maximum counter-offers reached');

  // Validate the new offer (same as proposeTrade validation)
  const from = state.players[newOffer.fromPlayer];
  const to = state.players[newOffer.toPlayer];

  for (const idx of newOffer.offerProperties) {
    if (!from.properties.includes(idx)) throw new Error('Proposer does not own offered property');
    if (hasHousesInGroup(state, newOffer.fromPlayer, idx)) throw new Error('Must sell all houses in color group before trading');
  }
  for (const idx of newOffer.requestProperties) {
    if (!to.properties.includes(idx)) throw new Error('Recipient does not own requested property');
    if (hasHousesInGroup(state, newOffer.toPlayer, idx)) throw new Error('Recipient must sell all houses in color group before trading');
  }
  if (newOffer.offerMoney > from.money) throw new Error('Cannot afford offered money');
  if (newOffer.requestMoney > to.money) throw new Error('Recipient cannot afford requested money');

  return {
    ...state,
    activeTradeOffer: { ...newOffer, counterCount: count },
  };
}

function hasHousesInGroup(state: GameState, playerIndex: number, tileIndex: number): boolean {
  const tile = state.tiles[tileIndex];
  if (tile.type !== 'property') return false;
  const group = COLOR_GROUPS[tile.colorGroup as keyof typeof COLOR_GROUPS];
  if (!group) return false;
  return group.some((idx) => (state.players[playerIndex].houses[idx] || 0) > 0);
}
