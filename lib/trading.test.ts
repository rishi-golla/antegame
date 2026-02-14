import { describe, it, expect } from 'vitest';
import { createGame } from './gameEngine';
import { proposeTrade, acceptTrade, rejectTrade } from './trading';
import type { GameState, TradeOffer } from '@/types/game';

function gameWithProperties(): GameState {
  const state = createGame(['Alice', 'Bob']);
  state.players[0].properties = [1, 3];
  state.players[1].properties = [6, 8];
  state.tiles[1] = { ...state.tiles[1], owner: 0 } as any;
  state.tiles[3] = { ...state.tiles[3], owner: 0 } as any;
  state.tiles[6] = { ...state.tiles[6], owner: 1 } as any;
  state.tiles[8] = { ...state.tiles[8], owner: 1 } as any;
  state.phase = 'turn-end';
  return state;
}

const validOffer: TradeOffer = {
  fromPlayer: 0,
  toPlayer: 1,
  offerMoney: 100,
  requestMoney: 0,
  offerProperties: [1],
  requestProperties: [6],
};

describe('proposeTrade', () => {
  it('sets phase to trading and stores offer', () => {
    const state = gameWithProperties();
    const next = proposeTrade(state, validOffer);
    expect(next.phase).toBe('trading');
    expect(next.activeTradeOffer).toEqual(validOffer);
  });

  it('stores previous phase for restoration', () => {
    const state = gameWithProperties();
    const next = proposeTrade(state, validOffer);
    expect(next.previousPhase).toBe('turn-end');
  });

  it('rejects if offered properties not owned by proposer', () => {
    const state = gameWithProperties();
    const bad = { ...validOffer, offerProperties: [6] }; // player 0 doesn't own tile 6
    expect(() => proposeTrade(state, bad)).toThrow();
  });

  it('rejects if requested properties not owned by recipient', () => {
    const state = gameWithProperties();
    const bad = { ...validOffer, requestProperties: [3] }; // player 1 doesn't own tile 3
    expect(() => proposeTrade(state, bad)).toThrow();
  });

  it('rejects if proposer cannot afford offered money', () => {
    const state = gameWithProperties();
    const bad = { ...validOffer, offerMoney: 99999 };
    expect(() => proposeTrade(state, bad)).toThrow();
  });

  it('rejects if recipient cannot afford requested money', () => {
    const state = gameWithProperties();
    const bad = { ...validOffer, requestMoney: 99999 };
    expect(() => proposeTrade(state, bad)).toThrow();
  });
});

describe('acceptTrade', () => {
  it('transfers properties and money between players', () => {
    const state = gameWithProperties();
    const proposed = proposeTrade(state, validOffer);
    const next = acceptTrade(proposed);

    // Alice gave tile 1 + $100, got tile 6
    expect(next.players[0].properties).not.toContain(1);
    expect(next.players[0].properties).toContain(6);
    expect(next.players[0].money).toBe(1500 - 100);

    // Bob gave tile 6, got tile 1 + $100
    expect(next.players[1].properties).not.toContain(6);
    expect(next.players[1].properties).toContain(1);
    expect(next.players[1].money).toBe(1500 + 100);
  });

  it('updates tile ownership', () => {
    const state = gameWithProperties();
    const proposed = proposeTrade(state, validOffer);
    const next = acceptTrade(proposed);
    expect((next.tiles[1] as any).owner).toBe(1);
    expect((next.tiles[6] as any).owner).toBe(0);
  });

  it('restores previous phase and clears offer', () => {
    const state = gameWithProperties();
    const proposed = proposeTrade(state, validOffer);
    const next = acceptTrade(proposed);
    expect(next.phase).toBe('turn-end');
    expect(next.activeTradeOffer).toBeNull();
  });
});

describe('rejectTrade', () => {
  it('clears offer and restores previous phase', () => {
    const state = gameWithProperties();
    const proposed = proposeTrade(state, validOffer);
    const next = rejectTrade(proposed);
    expect(next.activeTradeOffer).toBeNull();
    expect(next.phase).toBe('turn-end');
  });
});
