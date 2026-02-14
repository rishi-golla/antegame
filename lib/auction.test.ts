import { describe, it, expect } from 'vitest';
import { createGame } from './gameEngine';
import { startAuction, placeBid, passAuction } from './auction';
import type { GameState } from '@/types/game';

function threePlayerGame(): GameState {
  const state = createGame(['Alice', 'Bob', 'Carol']);
  return state;
}

describe('startAuction', () => {
  it('sets phase to auction and initializes auction state', () => {
    const state = threePlayerGame();
    const next = startAuction(state, 1); // auction tile 1 (Coral Street)
    expect(next.phase).toBe('auction');
    expect(next.auctionState).toBeDefined();
    expect(next.auctionState!.tileIndex).toBe(1);
    expect(next.auctionState!.currentBid).toBe(0);
    expect(next.auctionState!.currentBidder).toBeNull();
    expect(next.auctionState!.passedPlayers).toEqual([]);
  });

  it('excludes bankrupt players from bidding order', () => {
    const state = threePlayerGame();
    state.players[2].bankrupt = true;
    const next = startAuction(state, 1);
    expect(next.auctionState!.biddingOrder).toEqual([0, 1]);
  });
});

describe('placeBid', () => {
  it('accepts a valid bid higher than current', () => {
    let state = startAuction(threePlayerGame(), 1);
    state = placeBid(state, 0, 50);
    expect(state.auctionState!.currentBid).toBe(50);
    expect(state.auctionState!.currentBidder).toBe(0);
  });

  it('rejects bid not higher than current', () => {
    let state = startAuction(threePlayerGame(), 1);
    state = placeBid(state, 0, 50);
    expect(() => placeBid(state, 1, 50)).toThrow();
    expect(() => placeBid(state, 1, 30)).toThrow();
  });

  it('rejects bid exceeding player money', () => {
    let state = startAuction(threePlayerGame(), 1);
    expect(() => placeBid(state, 0, 9999)).toThrow();
  });

  it('advances active bidder index', () => {
    let state = startAuction(threePlayerGame(), 1);
    expect(state.auctionState!.activeIndex).toBe(0);
    state = placeBid(state, 0, 50);
    expect(state.auctionState!.activeIndex).toBe(1);
  });
});

describe('passAuction', () => {
  it('marks player as passed and advances', () => {
    let state = startAuction(threePlayerGame(), 1);
    state = passAuction(state, 0);
    expect(state.auctionState!.passedPlayers).toContain(0);
    expect(state.auctionState!.activeIndex).toBe(1);
  });

  it('awards property to last remaining bidder', () => {
    let state = startAuction(threePlayerGame(), 1);
    state = placeBid(state, 0, 50); // Alice bids 50
    state = passAuction(state, 1); // Bob passes
    state = passAuction(state, 2); // Carol passes -- Alice wins
    expect(state.phase).not.toBe('auction');
    expect(state.auctionState).toBeNull();
    expect(state.players[0].properties).toContain(1);
    expect(state.players[0].money).toBe(1500 - 50);
  });

  it('returns unowned if all pass with no bids', () => {
    let state = startAuction(threePlayerGame(), 1);
    state = passAuction(state, 0);
    state = passAuction(state, 1);
    state = passAuction(state, 2);
    expect(state.phase).not.toBe('auction');
    expect(state.auctionState).toBeNull();
    // No one owns it
    expect(state.players.every((p) => !p.properties.includes(1))).toBe(true);
  });
});
