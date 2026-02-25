import type {
  GameState,
  Player,
  Card,
  GameLog,
  ColorGroup,
  GamePhase,
  MinigameId,
  MinigameTier,
  MinigameContext,
  MinigameState,
} from '@/types/game';
import { getBuffModifier, applyDiscount, applyBoost } from './buffs';
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
  MAX_GLOBAL_HOUSES,
  MAX_GLOBAL_HOTELS,
  FINAL_ROUNDS_START,
  FINAL_ROUNDS_END,
  getRentMultiplier,
  getGoSalary,
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
    mortgaged: [],
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
    drawnCard: null,
    log: [{ message: 'Game started!', timestamp: Date.now() }],
    winner: null,
    activeTradeOffer: null,
    previousPhase: null,
    activeMinigame: null,
    minigamesEnabled: true,
    pendingRent: null,
    recentMinigames: [],
    debt: null,
    roundNumber: 1,
    globalHouses: MAX_GLOBAL_HOUSES,
    globalHotels: MAX_GLOBAL_HOTELS,
    finalRounds: false,
  };
}

function cryptoRoll(): number {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    globalThis.crypto.getRandomValues(arr);
    return (arr[0] % 6) + 1;
  }
  return Math.ceil(Math.random() * 6);
}

export function rollDice(state: GameState): GameState {
  const d1 = cryptoRoll();
  const d2 = cryptoRoll();
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
    let salary = getGoSalary(s.roundNumber, s.finalRounds);
    // Singer buff: Crowd Favorite — collect more when passing GO
    const salaryBoost = getBuffModifier(player, 'salary-boost');
    if (salaryBoost > 0 && salary > 0) {
      salary = applyBoost(salary, salaryBoost);
    }
    if (salary > 0) {
      s = updateCurrentPlayer(s, { money: player.money + salary });
      s = addLog(s, `${player.name} passed GO and collected $${salary}.`, state.currentPlayerIndex);
    } else {
      s = addLog(s, `${player.name} passed GO (no salary, final rounds!).`, state.currentPlayerIndex);
    }
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
      // Bartender buff: On the House — reduced tax
      let taxAmount = tile.amount;
      const taxDiscount = getBuffModifier(player, 'tax-discount');
      if (taxDiscount > 0) {
        taxAmount = applyDiscount(taxAmount, taxDiscount);
      }
      if (player.money < taxAmount) {
        const s = addLog(state, `${player.name} owes $${taxAmount} in tax.`, state.currentPlayerIndex);
        return enterDebtOrBankrupt(s, taxAmount, null);
      }
      const updated = updateCurrentPlayer(state, {
        money: player.money - taxAmount,
      });
      const s = addLog(updated, `${player.name} paid $${taxAmount} in tax.`, state.currentPlayerIndex);
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
      // No rent on mortgaged properties
      if (state.players[owner].mortgaged.includes(player.position)) {
        return { ...state, phase: 'turn-end' };
      }
      // Owned by someone else — pay rent
      return payRent(state, owner);
    }
    default:
      return { ...state, phase: 'turn-end' };
  }
}

export function calculateRent(state: GameState, ownerIndex: number): number {
  const player = currentPlayer(state);
  const tile = state.tiles[player.position];
  let rent = 0;

  if (tile.type === 'property') {
    const houseCount = state.players[ownerIndex].houses[tile.index] || 0;
    if (houseCount > 0) {
      // rent: [0:base, 1:set, 2:1house, 3:2houses, 4:3houses, 5:4houses, 6:hotel]
      rent = tile.rent[Math.min(houseCount + 1, 6)];
    } else if (ownsFullGroup(state, ownerIndex, tile.colorGroup)) {
      rent = tile.rent[1]; // double rent for color set
    } else {
      rent = tile.rent[0]; // base rent
    }
  } else if (tile.type === 'railroad') {
    let count = countOwnedRailroads(state, ownerIndex);
    // Tourist buff: Lucky Traveler — +1 railroad rent tier
    if (getBuffModifier(state.players[ownerIndex], 'railroad-bonus') > 0) {
      count = Math.min(count + 1, 4);
    }
    rent = RAILROAD_RENTS[count - 1];
  } else if (tile.type === 'utility') {
    const count = countOwnedUtilities(state, ownerIndex);
    const diceTotal = state.dice[0] + state.dice[1];
    rent = count === 1 ? diceTotal * 4 : diceTotal * 10;
  }

  // Apply round-based rent multiplier
  const multiplier = getRentMultiplier(state.roundNumber, state.finalRounds);
  rent = Math.floor(rent * multiplier);

  // Dealer buff: House Advantage — owner collects more rent
  const owner = state.players[ownerIndex];
  const rentBoost = getBuffModifier(owner, 'rent-collect-boost');
  if (rentBoost > 0) {
    rent = applyBoost(rent, rentBoost);
  }

  // Mobster buff: Protection Racket — payer pays less rent
  const rentDiscount = getBuffModifier(player, 'rent-pay-discount');
  if (rentDiscount > 0) {
    rent = applyDiscount(rent, rentDiscount);
  }

  return rent;
}

export function payRent(state: GameState, ownerIndex: number): GameState {
  const rent = calculateRent(state, ownerIndex);
  
  if (state.minigamesEnabled && rent > 0) {
    // Set pending rent and transition to paying-rent phase for gamble option
    let s = { ...state, pendingRent: { amount: rent, toPlayer: ownerIndex } };
    return { ...s, phase: 'paying-rent' };
  }

  // Minigames disabled or no rent - proceed normally
  return payRentNormally(state, rent, ownerIndex);
}

export function payRentNormally(state: GameState, rent?: number, ownerIndex?: number): GameState {
  const player = currentPlayer(state);
  
  // Use pending rent if available
  const actualRent = rent ?? state.pendingRent?.amount ?? 0;
  const actualOwner = ownerIndex ?? state.pendingRent?.toPlayer ?? -1;

  // Check if player can afford it — if not, enter debt phase
  if (player.money < actualRent) {
    return enterDebtOrBankrupt(state, actualRent, actualOwner >= 0 ? actualOwner : null);
  }
  
  let s = updateCurrentPlayer(state, { money: player.money - actualRent });
  if (actualOwner >= 0) {
    s = updatePlayer(s, actualOwner, {
      money: s.players[actualOwner].money + actualRent,
    });
    s = addLog(
      s,
      `${player.name} paid $${actualRent} rent to ${s.players[actualOwner].name}.`,
      state.currentPlayerIndex
    );
  }

  // Clear pending rent
  return { ...s, pendingRent: null, phase: 'turn-end' };
}

export function buyProperty(state: GameState): GameState {
  const player = currentPlayer(state);
  const tile = state.tiles[player.position];

  if (tile.type !== 'property' && tile.type !== 'railroad' && tile.type !== 'utility') {
    return state;
  }

  let price = tile.price;

  // Tourist buff: Lucky Traveler — railroads are free
  if (tile.type === 'railroad' && getBuffModifier(player, 'railroad-bonus') > 0) {
    price = 0;
  }

  // High Roller buff: Big Spender — properties cost less
  const buyDiscount = getBuffModifier(player, 'buy-discount');
  if (buyDiscount > 0 && price > 0) {
    price = applyDiscount(price, buyDiscount);
  }

  if (player.money < price) {
    let s = addLog(state, `${player.name} cannot afford ${tile.name} ($${price}).`, state.currentPlayerIndex);
    return { ...s, phase: 'turn-end' };
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

  // Get Out of Jail Free cards are held by the player, NOT discarded.
  // They return to the discard pile only when used or on bankruptcy.
  if (card.effect.kind !== 'get-out-of-jail') {
    discard.push(card);
  }

  let s: GameState = isChance
    ? { ...state, chanceDeck: deck, chanceDiscard: discard }
    : { ...state, communityChestDeck: deck, communityChestDiscard: discard };

  s = addLog(s, `${currentPlayer(s).name} drew: "${card.text}"`, state.currentPlayerIndex);

  // Store card for UI display, wait for player to acknowledge
  return { ...s, drawnCard: card, phase: 'drawing-card' };
}

export function applyDrawnCard(state: GameState): GameState {
  if (!state.drawnCard) return state;
  // Keep the card in pendingCard for resolveCard to use, clear drawnCard (hides overlay)
  return { ...state, drawnCard: null, phase: 'applying-card' };
}

export function resolveCard(state: GameState): GameState {
  // Find the last drawn card from the discard pile
  const lastChance = state.chanceDiscard[state.chanceDiscard.length - 1];
  const lastChest = state.communityChestDiscard[state.communityChestDiscard.length - 1];
  // Determine which was most recently drawn by checking the log
  const tile = state.tiles[currentPlayer(state).position];
  const card = tile.type === 'chance' ? lastChance : lastChest;
  if (!card) return { ...state, phase: 'turn-end' };
  return applyCardEffect(state, card);
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
      const amt = effect.amount!;
      if (player.money < amt) {
        return enterDebtOrBankrupt(state, amt, null);
      }
      let s = updateCurrentPlayer(state, { money: player.money - amt });
      return { ...s, phase: 'turn-end' };
    }
    case 'pay-each-player': {
      const amount = effect.amount!;
      const activePlayers = state.players.filter((p) => !p.bankrupt && p.id !== player.id);
      const totalPay = amount * activePlayers.length;
      if (player.money < totalPay) {
        return enterDebtOrBankrupt(state, totalPay, null);
      }
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
      let totalCollected = 0;
      for (const other of activePlayers) {
        // Each player pays what they can (minimum $0)
        const payment = Math.min(amount, Math.max(0, s.players[other.id].money));
        s = updatePlayer(s, other.id, { money: s.players[other.id].money - payment });
        totalCollected += payment;
      }
      s = updateCurrentPlayer(s, { money: s.players[state.currentPlayerIndex].money + totalCollected });
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
      if (player.money < totalCost) {
        let s = addLog(state, `${player.name} owes $${totalCost} for repairs.`, state.currentPlayerIndex);
        return enterDebtOrBankrupt(s, totalCost, null);
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

  // Guard: ignore if player isn't actually in jail (prevents double-dispatch issues)
  if (!player.inJail) return state;

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

    // Return the GOOJF card to the correct discard pile.
    // Check which deck is missing its card (not in deck or discard).
    const chanceHasIt = s.chanceDeck.some(c => c.effect.kind === 'get-out-of-jail')
      || s.chanceDiscard.some(c => c.effect.kind === 'get-out-of-jail');
    if (!chanceHasIt) {
      const chCard = { id: 'ch-9', deckType: 'chance' as const, text: 'Get Out of Jail Free.', effect: { kind: 'get-out-of-jail' as const } };
      s = { ...s, chanceDiscard: [...s.chanceDiscard, chCard] };
    } else {
      const ccCard = { id: 'cc-5', deckType: 'community-chest' as const, text: 'Get Out of Jail Free.', effect: { kind: 'get-out-of-jail' as const } };
      s = { ...s, communityChestDiscard: [...s.communityChestDiscard, ccCard] };
    }

    s = addLog(s, `${player.name} used a Get Out of Jail Free card.`, state.currentPlayerIndex);
    return { ...s, phase: 'rolling' };
  }

  // Roll for doubles
  const d1 = cryptoRoll();
  const d2 = cryptoRoll();
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
    const currentMoney = currentPlayer(s).money;
    if (currentMoney < JAIL_BAIL) {
      s = addLog(s, `${player.name} spent 3 turns in jail but can't afford $${JAIL_BAIL} bail!`, state.currentPlayerIndex);
      return enterDebtOrBankrupt(s, JAIL_BAIL, null);
    }
    s = updateCurrentPlayer(s, {
      money: currentMoney - JAIL_BAIL,
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

  // Clear transient fields that must not leak across turns/phases
  const cleanState: GameState = {
    ...state,
    pendingRent: null,
    activeMinigame: null,
    drawnCard: null,
    debt: null,
  };

  // If rolled doubles and not in jail, same player goes again
  if (cleanState.doublesCount > 0 && !player.inJail) {
    return { ...cleanState, phase: 'rolling' };
  }

  // Find next non-bankrupt player (guard: cap iterations to prevent infinite loop)
  let next = (cleanState.currentPlayerIndex + 1) % cleanState.players.length;
  let loops = 0;
  while (cleanState.players[next].bankrupt && loops < cleanState.players.length) {
    next = (next + 1) % cleanState.players.length;
    loops++;
  }

  // Safety: if loop exhausted without finding a non-bankrupt player, end game
  // Pick highest net worth player as winner (reuses round-limit logic)
  if (loops >= cleanState.players.length && cleanState.players[next].bankrupt) {
    const activePlayers = cleanState.players.filter((p) => !p.bankrupt);
    if (activePlayers.length === 0) {
      // All bankrupt — pick highest net worth among all players
      let bestIdx: number | null = null;
      let bestWorth = -Infinity;
      for (const p of cleanState.players) {
        const nw = getNetWorth(cleanState, p.id);
        if (nw > bestWorth) { bestWorth = nw; bestIdx = p.id; }
      }
      let s = addLog(cleanState, 'All players bankrupt — game over!');
      s = addLog(s, bestIdx !== null ? `${s.players[bestIdx].name} wins by net worth ($${bestWorth})!` : 'Game over!');
      return { ...s, phase: 'game-over', winner: bestIdx };
    }
  }

  // Check for winner
  const activePlayers = cleanState.players.filter((p) => !p.bankrupt);
  if (activePlayers.length <= 1) {
    const winner = activePlayers[0]?.id ?? null;
    let s = addLog(cleanState, winner !== null ? `${cleanState.players[winner].name} wins the game!` : 'Game over!');
    return { ...s, phase: 'game-over', winner };
  }

  const nextPlayer = cleanState.players[next];

  // Check if next player has $0 — force liquidation or bankruptcy
  if (nextPlayer.money <= 0) {
    const nextState = {
      ...cleanState,
      currentPlayerIndex: next,
      doublesCount: 0,
      phase: 'rolling' as GamePhase,
    };
    const netWorth = getNetWorth(nextState, next);
    if (netWorth <= 0) {
      // No money, no assets — instant bankruptcy (owed to bank)
      return declareBankruptcy(nextState, next);
    } else {
      // Has assets but no cash — must sell/mortgage before they can play
      const s = addLog(nextState, `${nextPlayer.name} is broke! Must sell or mortgage assets to continue.`, next);
      return {
        ...s,
        phase: 'in-debt',
        debt: { amount: 1, creditor: null }, // owes bank — must get above $0
      };
    }
  }

  const nextPhase: GamePhase = nextPlayer.inJail ? 'in-jail' : 'rolling';

  // Track rounds: increment when turn wraps past player 0
  let roundNumber = cleanState.roundNumber;
  let finalRounds = cleanState.finalRounds;
  let s = cleanState;

  if (next <= cleanState.currentPlayerIndex) {
    roundNumber++;

    // Log multiplier changes at thresholds
    if (roundNumber === 16) {
      s = addLog(s, `📈 Round 16: Rents increased to 1.25x! GO salary reduced to $150.`);
    } else if (roundNumber === 26) {
      s = addLog(s, `📈 Round 26: Rents increased to 1.5x! GO salary reduced to $100.`);
    } else if (roundNumber === 36) {
      s = addLog(s, `📈 Round 36: Rents increased to 2x! GO salary reduced to $50.`);
    } else if (roundNumber === 46) {
      s = addLog(s, `📈 Round 46: Rents increased to 3x!`);
    }

    // Activate final rounds endgame mode
    if (roundNumber >= FINAL_ROUNDS_START && !finalRounds) {
      finalRounds = true;
      s = addLog(s, `🔥 FINAL ROUNDS! No building, no GO salary, 4x rent!`);
    }

    // Force game-over at FINAL_ROUNDS_END — highest net worth wins
    if (roundNumber >= FINAL_ROUNDS_END) {
      s = addLog(s, `⏰ Round ${FINAL_ROUNDS_END} reached — game over!`);
      const activePlayers = s.players.filter((p) => !p.bankrupt);
      let bestIdx = activePlayers[0]?.id ?? null;
      let bestWorth = -Infinity;
      for (const p of activePlayers) {
        const nw = getNetWorth({ ...s, roundNumber, finalRounds }, p.id);
        if (nw > bestWorth) { bestWorth = nw; bestIdx = p.id; }
      }
      s = addLog(s, bestIdx !== null ? `${s.players[bestIdx].name} wins by net worth ($${bestWorth})!` : 'Game over!');
      return { ...s, phase: 'game-over', winner: bestIdx, roundNumber, finalRounds };
    }
  }

  return {
    ...s,
    currentPlayerIndex: next,
    doublesCount: 0,
    phase: nextPhase,
    roundNumber,
    finalRounds,
  };
}

export function checkBankruptcy(state: GameState, playerIndex: number): boolean {
  return state.players[playerIndex].money < 0;
}

/**
 * Instead of going negative, enter 'in-debt' phase where the player must
 * sell houses / mortgage properties to raise funds. If their net worth
 * can't cover the debt, they must declare bankruptcy.
 */
export function enterDebtOrBankrupt(
  state: GameState,
  amountOwed: number,
  creditor: number | null,
): GameState {
  const player = currentPlayer(state);
  
  // Can afford it outright — no debt needed
  if (player.money >= amountOwed) {
    return state;
  }

  // Check if player has any assets they can liquidate
  const netWorth = getNetWorth(state, state.currentPlayerIndex);
  
  if (netWorth < amountOwed) {
    // Can't possibly pay even by selling everything — bankrupt immediately
    // declareBankruptcy handles all asset/cash transfers to creditor
    return declareBankruptcy(state, state.currentPlayerIndex, creditor ?? undefined);
  }

  // Player has enough assets — enter debt phase to let them sell/mortgage
  let s = addLog(state, `${player.name} needs to raise $${amountOwed - player.money} — sell houses or mortgage properties!`, state.currentPlayerIndex);
  return {
    ...s,
    phase: 'in-debt',
    debt: { amount: amountOwed, creditor },
  };
}

/**
 * Called when a player in debt has raised enough money (or wants to confirm payment).
 * If they have enough money, pay the debt and continue. Otherwise stay in debt.
 */
export function resolveDebt(state: GameState): GameState {
  if (state.phase !== 'in-debt' || !state.debt) return state;
  
  const player = currentPlayer(state);
  const { amount, creditor } = state.debt;

  // Special case: broke at turn start (amount=1, creditor=null)
  // Player just needs money > 0 to continue, no payment required
  if (amount === 1 && creditor === null) {
    if (player.money <= 0) {
      return addLog(state, `${player.name} still has no money — keep selling or mortgage!`, state.currentPlayerIndex);
    }
    let s = addLog(state, `${player.name} raised $${player.money} and can continue.`, state.currentPlayerIndex);
    const nextPhase: GamePhase = player.inJail ? 'in-jail' : 'rolling';
    return { ...s, phase: nextPhase, debt: null, pendingRent: null };
  }

  if (player.money < amount) {
    // Still can't afford it
    return addLog(state, `${player.name} still needs $${amount - player.money} more.`, state.currentPlayerIndex);
  }

  // Pay the debt
  let s = updateCurrentPlayer(state, { money: player.money - amount });
  if (creditor !== null && creditor >= 0) {
    s = updatePlayer(s, creditor, {
      money: s.players[creditor].money + amount,
    });
    s = addLog(s, `${player.name} paid $${amount} to ${s.players[creditor].name}.`, state.currentPlayerIndex);
  } else {
    s = addLog(s, `${player.name} paid $${amount}.`, state.currentPlayerIndex);
  }

  return { ...s, phase: 'turn-end', debt: null, pendingRent: null };
}

export function declareBankruptcy(
  state: GameState,
  playerIndex: number,
  creditorIndex?: number
): GameState {
  const player = state.players[playerIndex];
  let s = addLog(state, `${player.name} has gone bankrupt!`, playerIndex);

  // Step 1: Sell all houses/hotels back to the bank at half price & return to supply
  let houseSaleProceeds = 0;
  let returnedHouses = s.globalHouses;
  let returnedHotels = s.globalHotels;
  for (const tileIdx of player.properties) {
    const tile = s.tiles[tileIdx];
    const houseCount = player.houses[tileIdx] || 0;
    if (tile.type === 'property' && houseCount > 0) {
      const refund = houseCount * Math.floor(tile.houseCost / 2);
      houseSaleProceeds += refund;
      // Return buildings to global supply
      if (houseCount === 5) {
        returnedHotels++;
      } else {
        returnedHouses += houseCount;
      }
      s = addLog(s, `${player.name}'s ${houseCount === 5 ? 'hotel' : `${houseCount} house(s)`} on ${tile.name} sold to bank for $${refund}.`, playerIndex);
    }
  }
  s = { ...s, globalHouses: returnedHouses, globalHotels: returnedHotels };

  if (creditorIndex !== undefined && creditorIndex >= 0) {
    // --- BANKRUPT TO ANOTHER PLAYER ---
    // House sale proceeds go to the creditor
    const creditor = s.players[creditorIndex];
    let creditorMoney = creditor.money + houseSaleProceeds;
    // Bankrupt player's remaining cash also goes to creditor
    creditorMoney += Math.max(0, player.money);

    // Transfer all properties (bare, no houses) to creditor
    const transferredProps = [...creditor.properties, ...player.properties];

    // Creditor must pay 10% interest on any mortgaged properties received
    // If they can't afford it, the property stays mortgaged (they can unmortgage later)
    let interestTotal = 0;
    for (const tileIdx of player.mortgaged) {
      const tile = s.tiles[tileIdx];
      if ('mortgageValue' in tile) {
        const interest = Math.ceil((tile as any).mortgageValue * 0.1);
        interestTotal += interest;
      }
    }
    if (interestTotal > 0) {
      if (creditorMoney >= interestTotal) {
        creditorMoney -= interestTotal;
        s = addLog(s, `${creditor.name} paid $${interestTotal} interest on received mortgaged properties.`, creditorIndex);
      } else {
        s = addLog(s, `${creditor.name} cannot afford $${interestTotal} mortgage interest — properties remain mortgaged.`, creditorIndex);
      }
    }

    // Transfer mortgaged status to creditor
    const creditorMortgaged = [...creditor.mortgaged, ...player.mortgaged];

    // Transfer Get Out of Jail Free cards
    const creditorJailCards = creditor.getOutOfJailCards + player.getOutOfJailCards;
    if (player.getOutOfJailCards > 0) {
      s = addLog(s, `${creditor.name} received ${player.getOutOfJailCards} Get Out of Jail Free card(s).`, creditorIndex);
    }

    s = updatePlayer(s, creditorIndex, {
      money: creditorMoney,
      properties: transferredProps,
      mortgaged: creditorMortgaged,
      getOutOfJailCards: creditorJailCards,
    });

    s = addLog(s, `All of ${player.name}'s assets transferred to ${s.players[creditorIndex].name}.`, playerIndex);
  } else {
    // --- BANKRUPT TO THE BANK ---
    // Return Get Out of Jail Free cards to their respective discard piles
    let cardsReturned = player.getOutOfJailCards;
    while (cardsReturned > 0) {
      const chanceHasIt = s.chanceDeck.some(c => c.effect.kind === 'get-out-of-jail')
        || s.chanceDiscard.some(c => c.effect.kind === 'get-out-of-jail');
      if (!chanceHasIt) {
        const chCard = { id: 'ch-9', deckType: 'chance' as const, text: 'Get Out of Jail Free.', effect: { kind: 'get-out-of-jail' as const } };
        s = { ...s, chanceDiscard: [...s.chanceDiscard, chCard] };
      } else {
        const ccCard = { id: 'cc-5', deckType: 'community-chest' as const, text: 'Get Out of Jail Free.', effect: { kind: 'get-out-of-jail' as const } };
        s = { ...s, communityChestDiscard: [...s.communityChestDiscard, ccCard] };
      }
      cardsReturned--;
    }
    if (player.getOutOfJailCards > 0) {
      s = addLog(s, `${player.name}'s Get Out of Jail Free card(s) returned to their decks.`, playerIndex);
    }

    // All properties released back to the bank (unowned) — no auction in digital version
    s = addLog(s, `${player.name}'s properties returned to the bank.`, playerIndex);
  }

  // Step 2: Mark bankrupt — clear all assets
  s = updatePlayer(s, playerIndex, {
    bankrupt: true,
    money: 0,
    properties: [],
    houses: {},
    mortgaged: [],
    getOutOfJailCards: 0,
    inJail: false,
  });

  // Step 3: Check if game is over
  const activePlayers = s.players.filter((p) => !p.bankrupt);
  if (activePlayers.length <= 1) {
    const winner = activePlayers[0]?.id ?? null;
    s = addLog(s, winner !== null ? `${s.players[winner].name} wins the game!` : 'Game over!');
    return { ...s, phase: 'game-over', winner };
  }

  // Ensure phase advances so turn can end (bankruptcy can happen mid-minigame)
  return { ...s, phase: 'turn-end', activeMinigame: null, pendingRent: null };
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
      worth += houses * (tile.houseCost / 2);
    }
  }

  return worth;
}

export function startMinigame(state: GameState, context: MinigameContext): GameState {
  const player = currentPlayer(state);
  const tile = state.tiles[player.position];
  
  // All available minigames
  const allMinigames: MinigameId[] = [
    'slots', 'higher-lower', 'craps', 'wheel', 'minesweeper', 
    'card-war', 'lucky-number', 'blackjack', 'coin-flip', 'safe-cracker'
  ];
  
  // Exclude last 3 recent minigames
  const available = allMinigames.filter(id => !state.recentMinigames.slice(-3).includes(id));
  const selectedId = available[Math.floor(Math.random() * available.length)];
  
  // Calculate base amount
  let baseAmount = 0;
  if (context === 'buying' && (tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility')) {
    baseAmount = tile.price;
  } else if (context === 'rent' && state.pendingRent) {
    baseAmount = state.pendingRent.amount;
  }
  
  const minigameState: MinigameState = {
    id: selectedId,
    context,
    tileIndex: player.position,
    baseAmount,
    status: 'intro',
    tier: null,
    data: {}
  };
  
  let s: GameState = { ...state, activeMinigame: minigameState, phase: 'minigame' };
  s = addLog(s, `${player.name} chose to gamble! Starting ${selectedId}...`, state.currentPlayerIndex);
  
  return s;
}

export function resolveMinigame(state: GameState, tier: MinigameTier): GameState {
  if (!state.activeMinigame) return state;
  
  const player = currentPlayer(state);
  const minigame = state.activeMinigame;
  const { context, baseAmount, tileIndex, id } = minigame;
  
  // Update recent minigames
  const updatedRecent = [...state.recentMinigames, id].slice(-10);
  
  let s = { ...state, recentMinigames: updatedRecent };
  
  // Calculate multipliers based on tier
  const multipliers: Record<MinigameTier, number> = {
    'win': 0,           // Free or no payment
    'close-win': 0.5,   // 50% price/rent
    'close-loss': 1.5,  // 1.5x price/rent
    'loss': 2,          // 2x price/rent
    'catastrophic': 5   // 5x price/rent
  };
  
  const multiplier = multipliers[tier];
  const actualAmount = Math.floor(baseAmount * multiplier);
  
  // Card Shark buff: Stacked Deck — better minigame payouts
  // Reduces penalty multipliers, increases win benefits
  const minigameBoost = getBuffModifier(player, 'minigame-boost');

  if (context === 'buying') {
    const tile = s.tiles[tileIndex];
    if (tier === 'win') {
      // Get property for free
      if (tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') {
        s = updateCurrentPlayer(s, {
          properties: [...player.properties, tileIndex],
        });
        s = addLog(s, `${player.name} won the minigame! Got ${tile.name} for FREE!`, state.currentPlayerIndex);
      }
    } else if (tier === 'close-win') {
      // Get property at 50% price
      if (tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') {
        s = updateCurrentPlayer(s, {
          money: player.money - actualAmount,
          properties: [...player.properties, tileIndex],
        });
        s = addLog(s, `${player.name} almost won! Got ${tile.name} for $${actualAmount} (50% off)!`, state.currentPlayerIndex);
      }
    } else {
      // No property, pay penalty (Card Shark pays less on losses)
      let penalty = actualAmount;
      if (minigameBoost > 0) {
        penalty = applyDiscount(penalty, minigameBoost);
      }
      s = updateCurrentPlayer(s, { money: player.money - penalty });
      const tierMsg = tier === 'close-loss' ? 'almost lost' : tier === 'loss' ? 'lost' : 'failed catastrophically';
      s = addLog(s, `${player.name} ${tierMsg} and paid $${penalty} penalty!`, state.currentPlayerIndex);
    }
  } else if (context === 'rent') {
    if (state.pendingRent) {
      const { toPlayer } = state.pendingRent;
      if (tier === 'win') {
        s = addLog(s, `${player.name} won the minigame! No rent to pay!`, state.currentPlayerIndex);
      } else {
        // Card Shark pays less rent on losses
        let rentToPay = actualAmount;
        if (minigameBoost > 0 && (tier === 'close-loss' || tier === 'loss' || tier === 'catastrophic')) {
          rentToPay = applyDiscount(rentToPay, minigameBoost);
        }
        s = updateCurrentPlayer(s, { money: player.money - rentToPay });
        s = updatePlayer(s, toPlayer, {
          money: s.players[toPlayer].money + rentToPay,
        });
        const tierMsg = tier === 'close-win' ? 'almost won' : tier === 'close-loss' ? 'almost lost' : tier === 'loss' ? 'lost' : 'failed catastrophically';
        s = addLog(s, `${player.name} ${tierMsg} and paid $${rentToPay} rent to ${s.players[toPlayer].name}!`, state.currentPlayerIndex);
      }
    }
    s = { ...s, pendingRent: null };
  }
  
  // Clear minigame and check for negative money → debt/bankruptcy
  s = { ...s, activeMinigame: null };
  
  if (s.players[state.currentPlayerIndex].money < 0) {
    const deficit = Math.abs(s.players[state.currentPlayerIndex].money);
    // Restore money to 0, then enter debt for the deficit amount
    s = updateCurrentPlayer(s, { money: 0 });
    const creditor = context === 'rent' && state.pendingRent ? state.pendingRent.toPlayer : null;
    return enterDebtOrBankrupt(s, deficit, creditor);
  }
  
  return { ...s, phase: 'turn-end' };
}
