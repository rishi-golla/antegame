import type { GameState, AuctionState } from '@/types/game';

export function startAuction(state: GameState, tileIndex: number): GameState {
  const biddingOrder = state.players
    .filter((p) => !p.bankrupt)
    .map((p) => p.id);

  const auctionState: AuctionState = {
    tileIndex,
    currentBid: 0,
    currentBidder: null,
    biddingOrder,
    activeIndex: 0,
    passedPlayers: [],
  };

  return { ...state, phase: 'auction', auctionState };
}

export function placeBid(state: GameState, playerIndex: number, amount: number): GameState {
  const auction = state.auctionState;
  if (!auction) throw new Error('No auction in progress');

  if (amount <= auction.currentBid) {
    throw new Error('Bid must be higher than current bid');
  }

  if (state.players[playerIndex].money < amount) {
    throw new Error('Not enough money to bid');
  }

  const newAuction: AuctionState = {
    ...auction,
    currentBid: amount,
    currentBidder: playerIndex,
    activeIndex: nextActiveIndex(auction, auction.activeIndex),
  };

  return { ...state, auctionState: newAuction };
}

export function passAuction(state: GameState, playerIndex: number): GameState {
  const auction = state.auctionState;
  if (!auction) throw new Error('No auction in progress');

  const newPassed = [...auction.passedPlayers, playerIndex];
  const remaining = auction.biddingOrder.filter((id) => !newPassed.includes(id));

  // Everyone passed with no bids -- property stays unowned
  if (remaining.length === 0 && auction.currentBidder === null) {
    return { ...state, phase: 'turn-end', auctionState: null };
  }

  // One or fewer players remain and someone has bid -- they win
  if (remaining.length <= 1 && auction.currentBidder !== null) {
    return resolveAuction(state, auction.currentBidder, auction.currentBid, auction.tileIndex);
  }

  const updatedAuction: AuctionState = {
    ...auction,
    passedPlayers: newPassed,
  };
  // Find next non-passed bidder
  updatedAuction.activeIndex = nextActiveIndex(updatedAuction, auction.activeIndex);

  return { ...state, auctionState: updatedAuction };
}

function nextActiveIndex(auction: AuctionState, currentIndex: number): number {
  const order = auction.biddingOrder;
  let next = (currentIndex + 1) % order.length;
  let attempts = 0;
  while (auction.passedPlayers.includes(order[next]) && attempts < order.length) {
    next = (next + 1) % order.length;
    attempts++;
  }
  return next;
}

function resolveAuction(
  state: GameState,
  winnerIndex: number,
  price: number,
  tileIndex: number
): GameState {
  const newPlayers = state.players.map((p, i) => {
    if (i !== winnerIndex) return p;
    return {
      ...p,
      money: p.money - price,
      properties: [...p.properties, tileIndex],
    };
  });

  const newTiles = state.tiles.map((t, i) => {
    if (i !== tileIndex) return t;
    return { ...t, owner: winnerIndex };
  });

  return {
    ...state,
    players: newPlayers,
    tiles: newTiles,
    phase: 'turn-end',
    auctionState: null,
  };
}
