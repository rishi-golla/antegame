import type { GameState, TradeOffer } from '@/types/game';

export function proposeTrade(state: GameState, offer: TradeOffer): GameState {
  const from = state.players[offer.fromPlayer];
  const to = state.players[offer.toPlayer];

  // Validate offered properties
  for (const idx of offer.offerProperties) {
    if (!from.properties.includes(idx)) {
      throw new Error('Proposer does not own offered property');
    }
  }

  // Validate requested properties
  for (const idx of offer.requestProperties) {
    if (!to.properties.includes(idx)) {
      throw new Error('Recipient does not own requested property');
    }
  }

  // Validate money
  if (offer.offerMoney > from.money) {
    throw new Error('Proposer cannot afford offered money');
  }
  if (offer.requestMoney > to.money) {
    throw new Error('Recipient cannot afford requested money');
  }

  return {
    ...state,
    previousPhase: state.phase,
    phase: 'trading',
    activeTradeOffer: offer,
  };
}

export function acceptTrade(state: GameState): GameState {
  const offer = state.activeTradeOffer;
  if (!offer) throw new Error('No active trade offer');

  const fromIdx = offer.fromPlayer;
  const toIdx = offer.toPlayer;

  const newPlayers = state.players.map((p, i) => {
    if (i === fromIdx) {
      return {
        ...p,
        money: p.money - offer.offerMoney + offer.requestMoney,
        properties: [
          ...p.properties.filter((idx) => !offer.offerProperties.includes(idx)),
          ...offer.requestProperties,
        ],
      };
    }
    if (i === toIdx) {
      return {
        ...p,
        money: p.money + offer.offerMoney - offer.requestMoney,
        properties: [
          ...p.properties.filter((idx) => !offer.requestProperties.includes(idx)),
          ...offer.offerProperties,
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

  return {
    ...state,
    players: newPlayers,
    tiles: newTiles,
    phase: state.previousPhase ?? 'turn-end',
    activeTradeOffer: null,
    previousPhase: null,
  };
}

export function rejectTrade(state: GameState): GameState {
  return {
    ...state,
    phase: state.previousPhase ?? 'turn-end',
    activeTradeOffer: null,
    previousPhase: null,
  };
}
