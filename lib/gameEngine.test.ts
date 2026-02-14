import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createGame,
  rollDice,
  movePlayer,
  buyProperty,
  declinePurchase,
  payRent,
  goToJail,
  attemptJailEscape,
  endTurn,
  drawCard,
  checkBankruptcy,
  getNetWorth,
  declareBankruptcy,
} from './gameEngine';
import type { GameState } from '@/types/game';

function freshGame(names = ['Ava', 'Kai', 'Maya']): GameState {
  return createGame(names);
}

describe('createGame', () => {
  it('creates a game with the right number of players', () => {
    const state = createGame(['A', 'B', 'C']);
    expect(state.players).toHaveLength(3);
  });

  it('throws for fewer than 2 players', () => {
    expect(() => createGame(['A'])).toThrow();
  });

  it('throws for more than 6 players', () => {
    expect(() => createGame(['A', 'B', 'C', 'D', 'E', 'F', 'G'])).toThrow();
  });

  it('gives each player $1500', () => {
    const state = createGame(['A', 'B']);
    for (const p of state.players) {
      expect(p.money).toBe(1500);
    }
  });

  it('all players start at position 0', () => {
    const state = createGame(['A', 'B']);
    for (const p of state.players) {
      expect(p.position).toBe(0);
    }
  });

  it('starts with player 0 and rolling phase', () => {
    const state = createGame(['A', 'B']);
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.phase).toBe('rolling');
  });

  it('has shuffled decks', () => {
    const state = createGame(['A', 'B']);
    expect(state.chanceDeck).toHaveLength(16);
    expect(state.communityChestDeck).toHaveLength(16);
  });
});

describe('movePlayer', () => {
  it('moves player forward', () => {
    const state = freshGame();
    const result = movePlayer(state, 5);
    expect(result.players[0].position).toBe(5);
  });

  it('wraps around board and collects $200 for passing GO', () => {
    let state = freshGame();
    // Put player at position 38
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, position: 38 } : p
      ),
    };
    const result = movePlayer(state, 5);
    expect(result.players[0].position).toBe(3);
    expect(result.players[0].money).toBe(1700); // 1500 + 200
  });

  it('landing on Go To Jail sends player to jail', () => {
    let state = freshGame();
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, position: 25 } : p
      ),
    };
    const result = movePlayer(state, 5); // land on 30 (Go To Jail)
    expect(result.players[0].position).toBe(10);
    expect(result.players[0].inJail).toBe(true);
  });

  it('landing on tax deducts money', () => {
    let state = freshGame();
    // tile 4 is Income Tax ($200)
    const result = movePlayer(state, 4);
    expect(result.players[0].position).toBe(4);
    expect(result.players[0].money).toBe(1300); // 1500 - 200
  });
});

describe('buyProperty', () => {
  it('lets player buy an unowned property', () => {
    let state = freshGame();
    // Move to tile 1 (Coral Street, $60)
    state = movePlayer(state, 1);
    expect(state.phase).toBe('buying');

    const result = buyProperty(state);
    expect(result.players[0].money).toBe(1440); // 1500 - 60
    expect(result.players[0].properties).toContain(1);
    expect(result.phase).toBe('turn-end');
  });

  it('cannot buy if not enough money', () => {
    let state = freshGame();
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, money: 10, position: 1 } : p
      ),
      phase: 'buying' as const,
    };
    const result = buyProperty(state);
    // Should not own the property
    expect(result.players[0].properties).not.toContain(1);
  });
});

describe('payRent', () => {
  it('charges base rent for a property', () => {
    let state = freshGame();
    // Player 1 owns tile 1 (Coral Street, base rent $2)
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 1 ? { ...p, properties: [1] } : p
      ),
    };
    // Player 0 lands on tile 1
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, position: 1 } : p
      ),
    };
    const result = payRent(state, 1);
    expect(result.players[0].money).toBe(1498); // 1500 - 2
    expect(result.players[1].money).toBe(1502); // 1500 + 2
  });

  it('charges double rent for color set', () => {
    let state = freshGame();
    // Player 1 owns both brown properties (1, 3)
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 1 ? { ...p, properties: [1, 3] } : p
      ),
    };
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, position: 1 } : p
      ),
    };
    const result = payRent(state, 1);
    expect(result.players[0].money).toBe(1496); // 1500 - 4 (color set rent)
    expect(result.players[1].money).toBe(1504);
  });

  it('charges railroad rent based on count owned', () => {
    let state = freshGame();
    // Player 1 owns 2 railroads
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 1 ? { ...p, properties: [5, 15] } : p
      ),
    };
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, position: 5 } : p
      ),
    };
    const result = payRent(state, 1);
    expect(result.players[0].money).toBe(1450); // 1500 - 50
  });

  it('charges utility rent as dice multiplier', () => {
    let state = freshGame();
    // Player 1 owns 1 utility
    state = {
      ...state,
      dice: [3, 4] as [number, number],
      players: state.players.map((p, i) =>
        i === 1 ? { ...p, properties: [12] } : p
      ),
    };
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, position: 12 } : p
      ),
    };
    const result = payRent(state, 1);
    // 4x dice total (3+4=7), so 28
    expect(result.players[0].money).toBe(1472); // 1500 - 28
  });
});

describe('goToJail', () => {
  it('sends player to jail tile and sets inJail', () => {
    const state = freshGame();
    const result = goToJail(state);
    expect(result.players[0].position).toBe(10);
    expect(result.players[0].inJail).toBe(true);
    expect(result.players[0].jailTurns).toBe(0);
  });
});

describe('attemptJailEscape', () => {
  it('bail costs $50 and frees player', () => {
    let state = freshGame();
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, position: 10, inJail: true } : p
      ),
      phase: 'in-jail' as const,
    };
    const result = attemptJailEscape(state, 'bail');
    expect(result.players[0].money).toBe(1450);
    expect(result.players[0].inJail).toBe(false);
    expect(result.phase).toBe('rolling');
  });

  it('card frees player if they have one', () => {
    let state = freshGame();
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, position: 10, inJail: true, getOutOfJailCards: 1 } : p
      ),
    };
    const result = attemptJailEscape(state, 'card');
    expect(result.players[0].inJail).toBe(false);
    expect(result.players[0].getOutOfJailCards).toBe(0);
  });

  it('forced bail after 3 failed roll attempts', () => {
    let state = freshGame();
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, position: 10, inJail: true, jailTurns: 2 } : p
      ),
    };
    // Mock Math.random to give non-doubles
    const orig = Math.random;
    Math.random = vi.fn()
      .mockReturnValueOnce(0.1) // d1 = 1
      .mockReturnValueOnce(0.5); // d2 = 3
    const result = attemptJailEscape(state, 'roll');
    Math.random = orig;

    expect(result.players[0].inJail).toBe(false);
    expect(result.players[0].money).toBeLessThan(1500); // paid bail
  });
});

describe('endTurn', () => {
  it('advances to next player', () => {
    let state = freshGame();
    state = { ...state, phase: 'turn-end' as const };
    const result = endTurn(state);
    expect(result.currentPlayerIndex).toBe(1);
  });

  it('skips bankrupt players', () => {
    let state = freshGame();
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 1 ? { ...p, bankrupt: true } : p
      ),
      phase: 'turn-end' as const,
    };
    const result = endTurn(state);
    expect(result.currentPlayerIndex).toBe(2);
  });

  it('wraps around to player 0', () => {
    let state = freshGame();
    state = { ...state, currentPlayerIndex: 2, phase: 'turn-end' as const };
    const result = endTurn(state);
    expect(result.currentPlayerIndex).toBe(0);
  });

  it('detects winner when one player remains', () => {
    let state = createGame(['A', 'B']);
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 1 ? { ...p, bankrupt: true } : p
      ),
      phase: 'turn-end' as const,
    };
    const result = endTurn(state);
    expect(result.phase).toBe('game-over');
    expect(result.winner).toBe(0);
  });

  it('allows same player to roll again on doubles', () => {
    let state = freshGame();
    state = { ...state, doublesCount: 1, phase: 'turn-end' as const };
    const result = endTurn(state);
    expect(result.currentPlayerIndex).toBe(0); // same player
    expect(result.phase).toBe('rolling');
  });
});

describe('getNetWorth', () => {
  it('includes cash and property values', () => {
    let state = freshGame();
    // Player 0 owns tile 1 (mortgage value 30)
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, properties: [1] } : p
      ),
    };
    expect(getNetWorth(state, 0)).toBe(1530); // 1500 + 30 (mortgage value of Coral Street)
  });
});

describe('checkBankruptcy', () => {
  it('returns true when money is negative', () => {
    let state = freshGame();
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, money: -1 } : p
      ),
    };
    expect(checkBankruptcy(state, 0)).toBe(true);
  });

  it('returns false when money is zero or positive', () => {
    const state = freshGame();
    expect(checkBankruptcy(state, 0)).toBe(false);
  });
});

describe('declareBankruptcy', () => {
  it('marks player as bankrupt', () => {
    let state = freshGame();
    const result = declareBankruptcy(state, 0);
    expect(result.players[0].bankrupt).toBe(true);
  });

  it('releases all properties back to unowned', () => {
    let state = freshGame();
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, properties: [1, 3], houses: { 1: 2 } } : p
      ),
    };
    const result = declareBankruptcy(state, 0);
    expect(result.players[0].properties).toEqual([]);
    expect(result.players[0].houses).toEqual({});
    expect(result.players[0].mortgaged).toEqual([]);
  });

  it('transfers properties to creditor if specified', () => {
    let state = freshGame();
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, properties: [1, 3], money: -100 } : p
      ),
    };
    const result = declareBankruptcy(state, 0, 1);
    expect(result.players[0].properties).toEqual([]);
    expect(result.players[1].properties).toContain(1);
    expect(result.players[1].properties).toContain(3);
  });

  it('sets money to 0', () => {
    let state = freshGame();
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, money: -50 } : p
      ),
    };
    const result = declareBankruptcy(state, 0);
    expect(result.players[0].money).toBe(0);
  });

  it('detects winner when only one player remains', () => {
    let state = createGame(['A', 'B']);
    const result = declareBankruptcy(state, 0);
    expect(result.phase).toBe('game-over');
    expect(result.winner).toBe(1);
  });

  it('does not end game if 2+ players remain', () => {
    let state = freshGame(); // 3 players
    const result = declareBankruptcy(state, 0);
    expect(result.phase).not.toBe('game-over');
  });
});
