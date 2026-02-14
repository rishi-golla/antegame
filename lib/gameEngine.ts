import type {
  GameState,
  Player,
  Card,
  Tile,
  PropertyTile,
  GameLog,
  ColorGroup,
  GamePhase,
} from '@/types/game';
import {
  TILES,
  CHANCE_CARDS,
  COMMUNITY_CHEST_CARDS,
  COLOR_GROUPS,
  RAILROAD_INDICES,
  UTILITY_INDICES,
  RAILROAD_RENTS,
  STARTING_MONEY,
  GO_SALARY,
  JAIL_BAIL,
  MAX_JAIL_TURNS,
} from './gameData';

// --- Helpers ---

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function addLog(state: GameState, message: string, playerIndex?: number): GameState {
  const entry: GameLog = { message, playerIndex, timestamp: Date.now() };
  return { ...state, log: [...state.log, entry] };
}

function currentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex];
}

function updatePlayer(state: GameState, playerIndex: number, updates: Partial<Player>): GameState {
  const players = state.players.map((p, i) =>
    i === playerIndex ? { ...p, ...updates } : p
  );
  return { ...state, players };
}

function updateCurrentPlayer(state: GameState, updates: Partial<Player>): GameState {
  return updatePlayer(state, state.currentPlayerIndex, updates);
}

function tileOwner(state: GameState, tileIndex: number): number | null {
  for (let i = 0; i < state.players.length; i++) {
    if (state.players[i].properties.includes(tileIndex)) return i;
  }
  return null;
}

function countOwnedInGroup(state: GameState, playerIndex: number, colorGroup: ColorGroup): number {
  const groupTiles = COLOR_GROUPS[colorGroup];
  return groupTiles.filter((ti) => state.players[playerIndex].properties.includes(ti)).length;
}

function ownsFullGroup(state: GameState, playerIndex: number, colorGroup: ColorGroup): boolean {
  return countOwnedInGroup(state, playerIndex, colorGroup) === COLOR_GROUPS[colorGroup].length;
}

function countOwnedRailroads(state: GameState, playerIndex: number): number {
  return RAILROAD_INDICES.filter((ti) => state.players[playerIndex].properties.includes(ti)).length;
}

function countOwnedUtilities(state: GameState, playerIndex: number): number {
  return UTILITY_INDICES.filter((ti) => state.players[playerIndex].properties.includes(ti)).length;
}

function nearestOf(position: number, indices: number[]): number {
  for (const idx of indices) {
    if (idx > position) return idx;
  }
  return indices[0]; // wrap around
}

// --- Public API ---

const DEFAULT_COLORS = ['#ff6b6b', '#5cd6c0', '#ffd166', '#8fb8ff', '#c084fc', '#fb923c'];

export function createGame(playerNames: string[]): GameState {
  if (playerNames.length < 2 || playerNames.length > 6) {
    throw new Error('Game requires 2-6 players');
  }

  const players: Player[] = playerNames.map((name, i) => ({
    id: i,
    name,
    color: DEFAULT_COLORS[i],
    money: STARTING_MONEY,
    position: 0,
    properties: [],
    houses: {},
    inJail: false,
    jailTurns: 0,
    getOutOfJailCards: 0,
    bankrupt: false,
  }));

  return {
    players,
    currentPlayerIndex: 0,
    tiles: TILES,
    chanceDeck: shuffle(CHANCE_CARDS),
    communityChestDeck: shuffle(COMMUNITY_CHEST_CARDS),
    chanceDiscard: [],
    communityChestDiscard: [],
    dice: [1, 1],
    doublesCount: 0,
    phase: 'rolling',
    log: [{ message: 'Game started!', timestamp: Date.now() }],
    winner: null,
  };
}

export function rollDice(state: GameState): GameState {
  const d1 = Math.ceil(Math.random() * 6);
  const d2 = Math.ceil(Math.random() * 6);
  const isDoubles = d1 === d2;
  const player = currentPlayer(state);

  let s: GameState = { ...state, dice: [d1, d2] };
  s = addLog(s, `${player.name} rolled ${d1} + ${d2} = ${d1 + d2}${isDoubles ? ' (doubles!)' : ''}`, state.currentPlayerIndex);

  if (isDoubles) {
    const newDoublesCount = state.doublesCount + 1;
    if (newDoublesCount >= 3) {
      s = addLog(s, `${player.name} rolled doubles 3 times — go to jail!`, state.currentPlayerIndex);
      return goToJail({ ...s, doublesCount: 0 });
    }
    s = { ...s, doublesCount: newDoublesCount };
  } else {
    s = { ...s, doublesCount: 0 };
  }

  return movePlayer(s, d1 + d2);
}

export function movePlayer(state: GameState, steps: number): GameState {
  const player = currentPlayer(state);
  const oldPosition = player.position;
  let newPosition = oldPosition + steps;
  let s = state;

  // Handle negative movement (e.g., "go back 3 spaces")
  if (newPosition < 0) {
    newPosition = 40 + newPosition;
  }

  // Passing GO
  if (steps > 0 && newPosition >= 40) {
    newPosition = newPosition % 40;
    s = updateCurrentPlayer(s, { money: player.money + GO_SALARY });
    s = addLog(s, `${player.name} passed GO and collected $${GO_SALARY}.`, state.currentPlayerIndex);
  }

  s = updateCurrentPlayer(s, { position: newPosition });
  const tile = s.tiles[newPosition];
  s = addLog(s, `${player.name} landed on ${tile.name}.`, state.currentPlayerIndex);

  return resolveLanding(s);
}

export function resolveLanding(state: GameState): GameState {
  const player = currentPlayer(state);
  const tile = state.tiles[player.position];

  switch (tile.type) {
    case 'corner': {
      if (tile.cornerKind === 'go-to-jail') {
        return goToJail(state);
      }
      // GO, Jail (visiting), Free Parking — nothing happens
      return { ...state, phase: 'turn-end' };
    }
    case 'tax': {
      const updated = updateCurrentPlayer(state, {
        money: player.money - tile.amount,
      });
      const s = addLog(updated, `${player.name} paid $${tile.amount} in tax.`, state.currentPlayerIndex);
      return { ...s, phase: 'turn-end' };
    }
    case 'chance':
      return { ...state, phase: 'drawing-card' };
    case 'community-chest':
      return { ...state, phase: 'drawing-card' };
    case 'property':
    case 'railroad':
    case 'utility': {
      const owner = tileOwner(state, player.position);
      if (owner === null) {
        return { ...state, phase: 'buying' };
      }
      if (owner === state.currentPlayerIndex) {
        return { ...state, phase: 'turn-end' };
      }
      if (state.players[owner].bankrupt) {
        return { ...state, phase: 'turn-end' };
      }
      // Owned by someone else — pay rent
      return payRent(state, owner);
    }
    default:
      return { ...state, phase: 'turn-end' };
  }
}

export function payRent(state: GameState, ownerIndex: number): GameState {
  const player = currentPlayer(state);
  const tile = state.tiles[player.position];
  let rent = 0;

  if (tile.type === 'property') {
    const houseCount = state.players[ownerIndex].houses[tile.index] || 0;
    if (houseCount > 0) {
      // rent[2] = 1 house, rent[3] = 2 houses, etc. rent[5] doesn't exist, hotel is index 5
      // Actually: rent array is [base, set, 1h, 2h, 3h, 4h/hotel]
      rent = tile.rent[Math.min(houseCount + 1, 5)];
    } else if (ownsFullGroup(state, ownerIndex, tile.colorGroup)) {
      rent = tile.rent[1]; // double rent for color set
    } else {
      rent = tile.rent[0]; // base rent
    }
  } else if (tile.type === 'railroad') {
    const count = countOwnedRailroads(state, ownerIndex);
    rent = RAILROAD_RENTS[count - 1];
  } else if (tile.type === 'utility') {
    const count = countOwnedUtilities(state, ownerIndex);
    const diceTotal = state.dice[0] + state.dice[1];
    rent = count === 1 ? diceTotal * 4 : diceTotal * 10;
  }

  let s = updateCurrentPlayer(state, { money: player.money - rent });
  s = updatePlayer(s, ownerIndex, {
    money: s.players[ownerIndex].money + rent,
  });
  s = addLog(
    s,
    `${player.name} paid $${rent} rent to ${s.players[ownerIndex].name}.`,
    state.currentPlayerIndex
  );

  return { ...s, phase: 'turn-end' };
}

export function buyProperty(state: GameState): GameState {
  const player = currentPlayer(state);
  const tile = state.tiles[player.position];

  if (tile.type !== 'property' && tile.type !== 'railroad' && tile.type !== 'utility') {
    return state;
  }

  const price = tile.price;
  if (player.money < price) {
    return addLog(state, `${player.name} cannot afford ${tile.name} ($${price}).`, state.currentPlayerIndex);
  }

  let s = updateCurrentPlayer(state, {
    money: player.money - price,
    properties: [...player.properties, tile.index],
  });
  s = addLog(s, `${player.name} bought ${tile.name} for $${price}.`, state.currentPlayerIndex);

  return { ...s, phase: 'turn-end' };
}

export function declinePurchase(state: GameState): GameState {
  const player = currentPlayer(state);
  const tile = state.tiles[player.position];
  let s = addLog(state, `${player.name} declined to buy ${tile.name}.`, state.currentPlayerIndex);
  // TODO: auction system in Batch 3
  return { ...s, phase: 'turn-end' };
}

export function drawCard(state: GameState): GameState {
  const tile = state.tiles[currentPlayer(state).position];
  const isChance = tile.type === 'chance';

  let deck = isChance ? [...state.chanceDeck] : [...state.communityChestDeck];
  let discard = isChance ? [...state.chanceDiscard] : [...state.communityChestDiscard];

  // Reshuffle if empty
  if (deck.length === 0) {
    deck = shuffle(discard);
    discard = [];
  }

  const card = deck.shift()!;
  discard.push(card);

  let s: GameState = isChance
    ? { ...state, chanceDeck: deck, chanceDiscard: discard }
    : { ...state, communityChestDeck: deck, communityChestDiscard: discard };

  s = addLog(s, `${currentPlayer(s).name} drew: "${card.text}"`, state.currentPlayerIndex);

  return applyCardEffect(s, card);
}

export function applyCardEffect(state: GameState, card: Card): GameState {
  const player = currentPlayer(state);
  const effect = card.effect;

  switch (effect.kind) {
    case 'move-to': {
      const target = effect.tileIndex!;
      const steps = target > player.position
        ? target - player.position
        : 40 - player.position + target;
      return movePlayer(state, steps);
    }
    case 'move-relative': {
      return movePlayer(state, effect.steps!);
    }
    case 'collect': {
      let s = updateCurrentPlayer(state, { money: player.money + effect.amount! });
      return { ...s, phase: 'turn-end' };
    }
    case 'pay': {
      let s = updateCurrentPlayer(state, { money: player.money - effect.amount! });
      return { ...s, phase: 'turn-end' };
    }
    case 'pay-each-player': {
      const amount = effect.amount!;
      const activePlayers = state.players.filter((p) => !p.bankrupt && p.id !== player.id);
      const totalPay = amount * activePlayers.length;
      let s = updateCurrentPlayer(state, { money: player.money - totalPay });
      for (const other of activePlayers) {
        s = updatePlayer(s, other.id, { money: s.players[other.id].money + amount });
      }
      return { ...s, phase: 'turn-end' };
    }
    case 'collect-from-each': {
      const amount = effect.amount!;
      const activePlayers = state.players.filter((p) => !p.bankrupt && p.id !== player.id);
      let s = state;
      for (const other of activePlayers) {
        s = updatePlayer(s, other.id, { money: s.players[other.id].money - amount });
      }
      const totalCollect = amount * activePlayers.length;
      s = updateCurrentPlayer(s, { money: s.players[state.currentPlayerIndex].money + totalCollect });
      return { ...s, phase: 'turn-end' };
    }
    case 'get-out-of-jail': {
      let s = updateCurrentPlayer(state, {
        getOutOfJailCards: player.getOutOfJailCards + 1,
      });
      return { ...s, phase: 'turn-end' };
    }
    case 'go-to-jail': {
      return goToJail(state);
    }
    case 'nearest-railroad': {
      const target = nearestOf(player.position, RAILROAD_INDICES);
      const steps = target > player.position
        ? target - player.position
        : 40 - player.position + target;
      return movePlayer(state, steps);
    }
    case 'nearest-utility': {
      const target = nearestOf(player.position, UTILITY_INDICES);
      const steps = target > player.position
        ? target - player.position
        : 40 - player.position + target;
      return movePlayer(state, steps);
    }
    case 'repairs': {
      let totalCost = 0;
      for (const [tileIdx, count] of Object.entries(player.houses)) {
        if (count === 5) {
          totalCost += effect.perHotel!;
        } else {
          totalCost += count * effect.perHouse!;
        }
      }
      let s = updateCurrentPlayer(state, { money: player.money - totalCost });
      s = addLog(s, `${player.name} paid $${totalCost} for repairs.`, state.currentPlayerIndex);
      return { ...s, phase: 'turn-end' };
    }
    default:
      return { ...state, phase: 'turn-end' };
  }
}

export function goToJail(state: GameState): GameState {
  const player = currentPlayer(state);
  let s = updateCurrentPlayer(state, {
    position: 10,
    inJail: true,
    jailTurns: 0,
  });
  s = addLog(s, `${player.name} was sent to Jail!`, state.currentPlayerIndex);
  return { ...s, doublesCount: 0, phase: 'turn-end' };
}

export function attemptJailEscape(
  state: GameState,
  method: 'bail' | 'card' | 'roll'
): GameState {
  const player = currentPlayer(state);

  if (method === 'bail') {
    if (player.money < JAIL_BAIL) {
      return addLog(state, `${player.name} cannot afford bail ($${JAIL_BAIL}).`, state.currentPlayerIndex);
    }
    let s = updateCurrentPlayer(state, {
      money: player.money - JAIL_BAIL,
      inJail: false,
      jailTurns: 0,
    });
    s = addLog(s, `${player.name} paid $${JAIL_BAIL} bail.`, state.currentPlayerIndex);
    return { ...s, phase: 'rolling' };
  }

  if (method === 'card') {
    if (player.getOutOfJailCards <= 0) {
      return addLog(state, `${player.name} has no Get Out of Jail Free cards.`, state.currentPlayerIndex);
    }
    let s = updateCurrentPlayer(state, {
      getOutOfJailCards: player.getOutOfJailCards - 1,
      inJail: false,
      jailTurns: 0,
    });
    s = addLog(s, `${player.name} used a Get Out of Jail Free card.`, state.currentPlayerIndex);
    return { ...s, phase: 'rolling' };
  }

  // Roll for doubles
  const d1 = Math.ceil(Math.random() * 6);
  const d2 = Math.ceil(Math.random() * 6);
  let s: GameState = { ...state, dice: [d1, d2] };
  s = addLog(s, `${player.name} rolled ${d1} + ${d2} in jail.`, state.currentPlayerIndex);

  if (d1 === d2) {
    s = updateCurrentPlayer(s, { inJail: false, jailTurns: 0 });
    s = addLog(s, `${player.name} rolled doubles and escaped jail!`, state.currentPlayerIndex);
    return movePlayer(s, d1 + d2);
  }

  const newJailTurns = player.jailTurns + 1;
  if (newJailTurns >= MAX_JAIL_TURNS) {
    // Forced to pay bail after 3 failed attempts
    s = updateCurrentPlayer(s, {
      money: currentPlayer(s).money - JAIL_BAIL,
      inJail: false,
      jailTurns: 0,
    });
    s = addLog(s, `${player.name} spent 3 turns in jail, forced to pay $${JAIL_BAIL} bail.`, state.currentPlayerIndex);
    return movePlayer(s, d1 + d2);
  }

  s = updateCurrentPlayer(s, { jailTurns: newJailTurns });
  return { ...s, phase: 'turn-end' };
}

export function endTurn(state: GameState): GameState {
  const player = currentPlayer(state);

  // If rolled doubles and not in jail, same player goes again
  if (state.doublesCount > 0 && !player.inJail) {
    return { ...state, phase: player.inJail ? 'in-jail' : 'rolling' };
  }

  // Find next non-bankrupt player
  let next = (state.currentPlayerIndex + 1) % state.players.length;
  let loops = 0;
  while (state.players[next].bankrupt && loops < state.players.length) {
    next = (next + 1) % state.players.length;
    loops++;
  }

  // Check for winner
  const activePlayers = state.players.filter((p) => !p.bankrupt);
  if (activePlayers.length <= 1) {
    const winner = activePlayers[0]?.id ?? null;
    let s = addLog(state, winner !== null ? `${state.players[winner].name} wins the game!` : 'Game over!');
    return { ...s, phase: 'game-over', winner };
  }

  const nextPlayer = state.players[next];
  const nextPhase: GamePhase = nextPlayer.inJail ? 'in-jail' : 'rolling';

  return {
    ...state,
    currentPlayerIndex: next,
    doublesCount: 0,
    phase: nextPhase,
  };
}

export function checkBankruptcy(state: GameState, playerIndex: number): boolean {
  return state.players[playerIndex].money < 0;
}

export function getNetWorth(state: GameState, playerIndex: number): number {
  const player = state.players[playerIndex];
  let worth = player.money;

  for (const tileIdx of player.properties) {
    const tile = state.tiles[tileIdx];
    if (tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') {
      worth += tile.mortgageValue;
    }
    const houses = player.houses[tileIdx] || 0;
    if (tile.type === 'property' && houses > 0) {
      worth += houses * tile.houseCost;
    }
  }

  return worth;
}
