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
  it('stores offer without changing phase (non-blocking)', () => {
    const state = gameWithProperties();
    const next = proposeTrade(state, validOffer);
    expect(next.phase).toBe('turn-end'); // phase unchanged
    expect(next.activeTradeOffer).toEqual(validOffer);
  });

  it('rejects if offered properties not owned by proposer', () => {
    const state = gameWithProperties();
    const bad = { ...validOffer, offerProperties: [6] };
    expect(() => proposeTrade(state, bad)).toThrow();
  });

  it('rejects if requested properties not owned by recipient', () => {
    const state = gameWithProperties();
    const bad = { ...validOffer, requestProperties: [3] };
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

  it('rejects trading properties with houses in color group', () => {
    const state = gameWithProperties();
    // Build houses on brown set (tiles 1, 3)
    state.players[0].houses[1] = 1;
    state.players[0].houses[3] = 1;
    expect(() => proposeTrade(state, validOffer)).toThrow(/houses/i);
  });
});

describe('acceptTrade', () => {
  it('transfers properties and money between players', () => {
    const state = gameWithProperties();
    const proposed = proposeTrade(state, validOffer);
    const next = acceptTrade(proposed);

    expect(next.players[0].properties).not.toContain(1);
    expect(next.players[0].properties).toContain(6);
    expect(next.players[0].money).toBe(1500 - 100);

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

  it('clears offer without changing phase', () => {
    const state = gameWithProperties();
    const proposed = proposeTrade(state, validOffer);
    const next = acceptTrade(proposed);
    expect(next.phase).toBe('turn-end');
    expect(next.activeTradeOffer).toBeNull();
  });

  it('transfers mortgage status to new owner', () => {
    const state = gameWithProperties();
    state.players[0].mortgaged = [1]; // tile 1 is mortgaged
    // Remove houses check -- mortgaged props have no houses
    const offer: TradeOffer = {
      fromPlayer: 0,
      toPlayer: 1,
      offerMoney: 0,
      requestMoney: 0,
      offerProperties: [1],
      requestProperties: [],
    };
    const proposed = proposeTrade(state, offer);
    const next = acceptTrade(proposed);

    // Mortgage moved from player 0 to player 1
    expect(next.players[0].mortgaged).not.toContain(1);
    expect(next.players[1].mortgaged).toContain(1);
  });
});

describe('rejectTrade', () => {
  it('clears offer without changing phase', () => {
    const state = gameWithProperties();
    const proposed = proposeTrade(state, validOffer);
    const next = rejectTrade(proposed);
    expect(next.activeTradeOffer).toBeNull();
    expect(next.phase).toBe('turn-end');
  });
});
