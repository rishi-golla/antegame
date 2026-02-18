import type { GameState, PropertyTile } from '@/types/game';
import { COLOR_GROUPS } from './gameData';

function getPropertyTile(state: GameState, tileIndex: number): PropertyTile {
  const tile = state.tiles[tileIndex];
  if (tile.type !== 'property') {
    throw new Error('Not a property tile');
  }
  return tile;
}

function ownsFullColorGroup(state: GameState, playerIndex: number, colorGroup: string): boolean {
  const group = COLOR_GROUPS[colorGroup as keyof typeof COLOR_GROUPS];
  if (!group) return false;
  return group.every((idx) => state.players[playerIndex].properties.includes(idx));
}

function groupHasHouses(state: GameState, playerIndex: number, colorGroup: string): boolean {
  const group = COLOR_GROUPS[colorGroup as keyof typeof COLOR_GROUPS];
  if (!group) return false;
  return group.some((idx) => (state.players[playerIndex].houses[idx] || 0) > 0);
}

export function buildHouse(state: GameState, playerIndex: number, tileIndex: number): GameState {
  const tile = getPropertyTile(state, tileIndex);
  const player = state.players[playerIndex];

  if (!player.properties.includes(tileIndex)) {
    throw new Error('Player does not own this property');
  }
  if (!ownsFullColorGroup(state, playerIndex, tile.colorGroup)) {
    throw new Error('Player does not own the full color group');
  }
  if (player.mortgaged.some((idx) => {
    const t = state.tiles[idx];
    return t.type === 'property' && t.colorGroup === tile.colorGroup;
  })) {
    throw new Error('Cannot build while a property in the group is mortgaged');
  }

  const currentHouses = player.houses[tileIndex] || 0;
  if (currentHouses >= 5) {
    throw new Error('Maximum houses (hotel) already built');
  }

  // Cannot build during final rounds
  if (state.finalRounds) {
    throw new Error('No building allowed during final rounds');
  }

  // Housing scarcity check
  if (currentHouses < 4) {
    // Building a house (need houses available)
    if (state.globalHouses <= 0) {
      throw new Error('No houses available — housing shortage!');
    }
  } else {
    // Upgrading to hotel (need hotel available, returns 4 houses)
    if (state.globalHotels <= 0) {
      throw new Error('No hotels available!');
    }
  }

  // Even building: cannot build if this property already has more than the minimum in the group
  const group = COLOR_GROUPS[tile.colorGroup as keyof typeof COLOR_GROUPS];
  const minInGroup = Math.min(...group.map((idx) => player.houses[idx] || 0));
  if (currentHouses > minInGroup) {
    throw new Error('Must build evenly across color group');
  }

  if (player.money < tile.houseCost) {
    throw new Error('Not enough money');
  }

  // Update housing supply
  let globalHouses = state.globalHouses;
  let globalHotels = state.globalHotels;

  if (currentHouses < 4) {
    // Building a house
    globalHouses--;
  } else {
    // Upgrading to hotel: return 4 houses, take 1 hotel
    globalHouses += 4;
    globalHotels--;
  }

  const newPlayers = state.players.map((p, i) => {
    if (i !== playerIndex) return p;
    return {
      ...p,
      money: p.money - tile.houseCost,
      houses: { ...p.houses, [tileIndex]: currentHouses + 1 },
    };
  });

  return { ...state, players: newPlayers, globalHouses, globalHotels };
}

export function sellHouse(state: GameState, playerIndex: number, tileIndex: number): GameState {
  const tile = getPropertyTile(state, tileIndex);
  const player = state.players[playerIndex];

  const currentHouses = player.houses[tileIndex] || 0;
  if (currentHouses <= 0) {
    throw new Error('No houses to sell');
  }

  // Even selling: cannot sell if this property has fewer than the max in the group
  const group = COLOR_GROUPS[tile.colorGroup as keyof typeof COLOR_GROUPS];
  const maxInGroup = Math.max(...group.map((idx) => player.houses[idx] || 0));
  if (currentHouses < maxInGroup) {
    throw new Error('Must sell evenly across color group');
  }

  const refund = Math.floor(tile.houseCost / 2);

  // Update housing supply
  let globalHouses = state.globalHouses;
  let globalHotels = state.globalHotels;

  if (currentHouses === 5) {
    // Downgrading from hotel: return hotel, need 4 houses
    if (globalHouses < 4) {
      throw new Error('Not enough houses to downgrade hotel — sell entire hotel instead');
    }
    globalHotels++;
    globalHouses -= 4;
  } else {
    // Selling a house
    globalHouses++;
  }

  const newPlayers = state.players.map((p, i) => {
    if (i !== playerIndex) return p;
    return {
      ...p,
      money: p.money + refund,
      houses: { ...p.houses, [tileIndex]: currentHouses - 1 },
    };
  });

  return { ...state, players: newPlayers, globalHouses, globalHotels };
}

export function mortgageProperty(state: GameState, playerIndex: number, tileIndex: number): GameState {
  const tile = state.tiles[tileIndex];
  const player = state.players[playerIndex];

  if (!player.properties.includes(tileIndex)) {
    throw new Error('Player does not own this property');
  }
  if (player.mortgaged.includes(tileIndex)) {
    throw new Error('Property is already mortgaged');
  }

  // If it's a property tile, check no houses in color group
  if (tile.type === 'property' && groupHasHouses(state, playerIndex, tile.colorGroup)) {
    throw new Error('Must sell all houses in color group before mortgaging');
  }

  const mortgageValue = 'mortgageValue' in tile ? (tile as any).mortgageValue : 0;

  const newPlayers = state.players.map((p, i) => {
    if (i !== playerIndex) return p;
    return {
      ...p,
      money: p.money + mortgageValue,
      mortgaged: [...p.mortgaged, tileIndex],
    };
  });

  return { ...state, players: newPlayers };
}

export function unmortgageProperty(state: GameState, playerIndex: number, tileIndex: number): GameState {
  const player = state.players[playerIndex];

  if (!player.mortgaged.includes(tileIndex)) {
    throw new Error('Property is not mortgaged');
  }

  const tile = state.tiles[tileIndex];
  const mortgageValue = 'mortgageValue' in tile ? (tile as any).mortgageValue : 0;
  const cost = Math.ceil(mortgageValue * 1.1);

  if (player.money < cost) {
    throw new Error('Not enough money to unmortgage');
  }

  const newPlayers = state.players.map((p, i) => {
    if (i !== playerIndex) return p;
    return {
      ...p,
      money: p.money - cost,
      mortgaged: p.mortgaged.filter((idx) => idx !== tileIndex),
    };
  });

  return { ...state, players: newPlayers };
}
