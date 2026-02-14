import { describe, it, expect } from 'vitest';
import { createGame } from './gameEngine';
import { buildHouse, sellHouse, mortgageProperty, unmortgageProperty } from './propertyActions';
import { COLOR_GROUPS } from './gameData';
import type { GameState } from '@/types/game';

function stateWithFullSet(playerIndex = 0): GameState {
  const state = createGame(['Alice', 'Bob']);
  // Give player 0 the brown set (tiles 1, 3)
  state.players[0].properties = [1, 3];
  state.players[0].money = 1500;
  state.tiles[1] = { ...state.tiles[1], owner: 0 } as any;
  state.tiles[3] = { ...state.tiles[3], owner: 0 } as any;
  return state;
}

describe('buildHouse', () => {
  it('builds a house on a property in a complete color group', () => {
    const state = stateWithFullSet();
    const next = buildHouse(state, 0, 1);
    expect(next.players[0].houses[1]).toBe(1);
    // Brown houseCost is 50
    expect(next.players[0].money).toBe(1500 - 50);
  });

  it('enforces even building rule', () => {
    const state = stateWithFullSet();
    // Build one house on tile 1
    const s1 = buildHouse(state, 0, 1);
    // Cannot build second on tile 1 before tile 3 has one
    expect(() => buildHouse(s1, 0, 1)).toThrow();
  });

  it('allows building after evening out', () => {
    const state = stateWithFullSet();
    const s1 = buildHouse(state, 0, 1);
    const s2 = buildHouse(s1, 0, 3);
    // Now both have 1, can build on either
    const s3 = buildHouse(s2, 0, 1);
    expect(s3.players[0].houses[1]).toBe(2);
    expect(s3.players[0].houses[3]).toBe(1);
  });

  it('caps at 5 houses (hotel)', () => {
    let state = stateWithFullSet();
    // Build 5 on each alternating evenly
    for (let i = 0; i < 5; i++) {
      state = buildHouse(state, 0, 1);
      state = buildHouse(state, 0, 3);
    }
    expect(state.players[0].houses[1]).toBe(5);
    expect(() => buildHouse(state, 0, 1)).toThrow();
  });

  it('rejects if player does not own full color group', () => {
    const state = createGame(['Alice', 'Bob']);
    state.players[0].properties = [1]; // only one of brown set
    state.tiles[1] = { ...state.tiles[1], owner: 0 } as any;
    expect(() => buildHouse(state, 0, 1)).toThrow();
  });

  it('rejects if not enough money', () => {
    const state = stateWithFullSet();
    state.players[0].money = 10;
    expect(() => buildHouse(state, 0, 1)).toThrow();
  });

  it('rejects if any property in group is mortgaged', () => {
    const state = stateWithFullSet();
    state.players[0].mortgaged = [3];
    expect(() => buildHouse(state, 0, 1)).toThrow();
  });

  it('rejects for non-property tiles', () => {
    const state = stateWithFullSet();
    expect(() => buildHouse(state, 0, 5)).toThrow(); // railroad
  });
});

describe('sellHouse', () => {
  it('sells a house and refunds half cost', () => {
    let state = stateWithFullSet();
    state = buildHouse(state, 0, 1);
    state = buildHouse(state, 0, 3);
    const moneyBefore = state.players[0].money;
    const next = sellHouse(state, 0, 1);
    expect(next.players[0].houses[1]).toBe(0);
    expect(next.players[0].money).toBe(moneyBefore + 25); // half of 50
  });

  it('enforces even selling rule', () => {
    let state = stateWithFullSet();
    state = buildHouse(state, 0, 1);
    state = buildHouse(state, 0, 3);
    state = buildHouse(state, 0, 1);
    // tile 1 has 2, tile 3 has 1 -- can't sell from tile 3
    expect(() => sellHouse(state, 0, 3)).toThrow();
  });

  it('rejects selling from property with no houses', () => {
    const state = stateWithFullSet();
    expect(() => sellHouse(state, 0, 1)).toThrow();
  });
});

describe('mortgageProperty', () => {
  it('mortgages a property and credits mortgage value', () => {
    const state = stateWithFullSet();
    const next = mortgageProperty(state, 0, 1);
    expect(next.players[0].mortgaged).toContain(1);
    // Brown mortgage value is 30
    expect(next.players[0].money).toBe(1500 + 30);
  });

  it('rejects if property has houses in its color group', () => {
    let state = stateWithFullSet();
    state = buildHouse(state, 0, 1);
    state = buildHouse(state, 0, 3);
    expect(() => mortgageProperty(state, 0, 1)).toThrow();
  });

  it('rejects if already mortgaged', () => {
    const state = stateWithFullSet();
    const next = mortgageProperty(state, 0, 1);
    expect(() => mortgageProperty(next, 0, 1)).toThrow();
  });

  it('rejects if player does not own the property', () => {
    const state = createGame(['Alice', 'Bob']);
    expect(() => mortgageProperty(state, 0, 1)).toThrow();
  });

  it('works on railroads and utilities', () => {
    const state = createGame(['Alice', 'Bob']);
    state.players[0].properties = [5]; // railroad
    state.tiles[5] = { ...state.tiles[5], owner: 0 } as any;
    const next = mortgageProperty(state, 0, 5);
    expect(next.players[0].mortgaged).toContain(5);
  });
});

describe('unmortgageProperty', () => {
  it('unmortgages for 110% of mortgage value', () => {
    const state = stateWithFullSet();
    const mortgaged = mortgageProperty(state, 0, 1);
    const moneyAfterMortgage = mortgaged.players[0].money; // 1500 + 30 = 1530
    const next = unmortgageProperty(mortgaged, 0, 1);
    expect(next.players[0].mortgaged).not.toContain(1);
    // Cost: 30 * 1.1 = 33
    expect(next.players[0].money).toBe(moneyAfterMortgage - 33);
  });

  it('rejects if not mortgaged', () => {
    const state = stateWithFullSet();
    expect(() => unmortgageProperty(state, 0, 1)).toThrow();
  });

  it('rejects if not enough money', () => {
    const state = stateWithFullSet();
    const mortgaged = mortgageProperty(state, 0, 1);
    mortgaged.players[0].money = 0;
    expect(() => unmortgageProperty(mortgaged, 0, 1)).toThrow();
  });
});
