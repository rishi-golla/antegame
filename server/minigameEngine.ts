/**
 * Server-side minigame engine (H2).
 * 
 * Each minigame pre-generates all random outcomes server-side.
 * The client sends player actions, the server determines the result.
 * Client animations are purely cosmetic.
 */

import crypto from 'crypto';
import type { MinigameTier } from '@/types/game';

// ---- Types ----

export interface MinigameServerState {
  id: string;
  roomCode: string;
  playerIndex: number;
  /** Pre-generated secret data (NOT sent to client) */
  secret: any;
  /** Commitment hash sent to client for fairness verification */
  commitHash: string;
  /** Whether the game has been resolved */
  resolved: boolean;
  /** The final tier once resolved */
  result?: MinigameTier;
  /** Player actions received */
  actions: any[];
  createdAt: number;
}

// Active minigame states keyed by roomCode
const activeMinigames = new Map<string, MinigameServerState>();

function secureRandom(max: number): number {
  const buf = crypto.randomBytes(4);
  return buf.readUInt32BE(0) % max;
}

function commitSecret(secret: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(secret)).digest('hex');
}

// ---- Minigame Generators ----

type SlotSymbol = 'cherry' | 'seven' | 'diamond' | 'bar' | 'skull';
const SLOT_SYMBOLS: SlotSymbol[] = ['cherry', 'seven', 'diamond', 'bar', 'skull'];

function generateSlots(): { secret: any; initData: any } {
  const reels: SlotSymbol[] = [
    SLOT_SYMBOLS[secureRandom(5)],
    SLOT_SYMBOLS[secureRandom(5)],
    SLOT_SYMBOLS[secureRandom(5)],
  ];
  return { secret: { reels }, initData: {} };
}

function resolveSlots(secret: any): MinigameTier {
  const [r1, r2, r3] = secret.reels as SlotSymbol[];
  if (r1 === 'skull' && r2 === 'skull' && r3 === 'skull') return 'catastrophic';
  if (r1 === r2 && r2 === r3) return 'win';
  const idx = (s: SlotSymbol) => SLOT_SYMBOLS.indexOf(s);
  if (r1 === r2) {
    const d = Math.abs(idx(r2) - idx(r3));
    if (d === 1 || d === 4) return 'close-win';
  }
  if (r2 === r3) {
    const d = Math.abs(idx(r1) - idx(r2));
    if (d === 1 || d === 4) return 'close-win';
  }
  if (r1 === r2 || r2 === r3 || r1 === r3) return 'close-loss';
  return 'loss';
}

function generateCoinFlip(): { secret: any; initData: any } {
  const coins = [secureRandom(2), secureRandom(2), secureRandom(2)]; // 0=heads, 1=tails
  return { secret: { coins }, initData: { rounds: 3 } };
}

function resolveCoinFlip(secret: any, actions: any[]): MinigameTier {
  const coins = secret.coins as number[];
  let wins = 0;
  for (let i = 0; i < 3; i++) {
    const pick = actions[i]?.choice ?? 0;
    if (pick === coins[i]) wins++;
  }
  if (wins === 3) return 'win';
  if (wins === 2) return 'close-win';
  if (wins === 1) return 'close-loss';
  return 'catastrophic';
}

function generateHigherLower(): { secret: any; initData: any } {
  const cards: number[] = [];
  for (let i = 0; i < 5; i++) cards.push(secureRandom(13) + 1); // 1-13
  return { secret: { cards }, initData: { firstCard: cards[0] } };
}

function resolveHigherLower(secret: any, actions: any[]): MinigameTier {
  const cards = secret.cards as number[];
  let correct = 0;
  for (let i = 0; i < Math.min(actions.length, 4); i++) {
    const guess = actions[i]?.choice; // 'higher' or 'lower'
    const actual = cards[i + 1] > cards[i] ? 'higher' : cards[i + 1] < cards[i] ? 'lower' : 'higher';
    if (guess === actual) correct++;
  }
  if (correct >= 4) return 'win';
  if (correct === 3) return 'close-win';
  if (correct === 2) return 'close-loss';
  if (correct === 1) return 'loss';
  return 'catastrophic';
}

function generateBlackjack(): { secret: any; initData: any } {
  // Pre-generate a shuffled deck (enough cards)
  const deck: number[] = [];
  for (let i = 0; i < 52; i++) deck.push(i);
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = secureRandom(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return { secret: { deck }, initData: { playerCards: [deck[0], deck[1]], dealerUp: deck[2] } };
}

function cardValue(card: number): number {
  const rank = (card % 13) + 1;
  if (rank >= 10) return 10;
  if (rank === 1) return 11;
  return rank;
}

function handTotal(cards: number[]): number {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const v = cardValue(c);
    if (v === 11) aces++;
    total += v;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function resolveBlackjack(secret: any, actions: any[]): MinigameTier {
  const deck = secret.deck as number[];
  const playerCards = [deck[0], deck[1]];
  let nextCard = 4; // deck[2]=dealerUp, deck[3]=dealerHole
  
  // Process player hits
  for (const action of actions) {
    if (action.choice === 'hit') {
      playerCards.push(deck[nextCard++]);
      if (handTotal(playerCards) > 21) break;
    } else break; // stand
  }
  
  const playerTotal = handTotal(playerCards);
  if (playerTotal > 21) return 'catastrophic'; // bust
  
  // Dealer plays (hits until 17+)
  const dealerCards = [deck[2], deck[3]];
  while (handTotal(dealerCards) < 17) {
    dealerCards.push(deck[nextCard++]);
  }
  const dealerTotal = handTotal(dealerCards);
  
  if (dealerTotal > 21) return 'win';
  if (playerTotal > dealerTotal) return 'win';
  if (playerTotal === dealerTotal) return 'close-win';
  if (dealerTotal - playerTotal <= 3) return 'close-loss';
  return 'loss';
}

function generateCraps(): { secret: any; initData: any } {
  const target = secureRandom(6) + secureRandom(6) + 2;
  const roll = secureRandom(6) + secureRandom(6) + 2;
  return { secret: { target, roll }, initData: {} };
}

function resolveCraps(secret: any): MinigameTier {
  const { target, roll } = secret;
  const diff = Math.abs(target - roll);
  if (diff === 0) return 'win';
  if (diff === 1) return 'close-win';
  if (diff <= 3) return 'close-loss';
  if (diff <= 5) return 'loss';
  return 'catastrophic';
}

function generateWheel(): { secret: any; initData: any } {
  const segments = ['win', 'close-win', 'close-loss', 'loss', 'catastrophic',
                     'win', 'close-win', 'close-loss', 'loss', 'close-win'];
  const landing = secureRandom(segments.length);
  return { secret: { landing, segments }, initData: { segments } };
}

function resolveWheel(secret: any): MinigameTier {
  return secret.segments[secret.landing] as MinigameTier;
}

function generateMinesweeper(): { secret: any; initData: any } {
  // 4x4 grid, 4 mines, need to clear 8 to win
  const mines = new Set<number>();
  while (mines.size < 4) mines.add(secureRandom(16));
  return { secret: { mines: Array.from(mines) }, initData: { gridSize: 16, mineCount: 4 } };
}

function resolveMinesweeper(secret: any, actions: any[]): MinigameTier {
  const mines = new Set(secret.mines as number[]);
  let cleared = 0;
  for (const action of actions) {
    if (mines.has(action.tile)) return cleared >= 6 ? 'close-loss' : cleared >= 3 ? 'loss' : 'catastrophic';
    cleared++;
  }
  if (cleared >= 8) return 'win';
  if (cleared >= 6) return 'close-win';
  if (cleared >= 4) return 'close-loss';
  return 'loss';
}

function generateLuckyNumber(): { secret: any; initData: any } {
  const houseNumber = secureRandom(10) + 1; // 1-10
  return { secret: { houseNumber }, initData: { range: [1, 10] } };
}

function resolveLuckyNumber(secret: any, actions: any[]): MinigameTier {
  const house = secret.houseNumber;
  const pick = actions[0]?.number ?? 1;
  const diff = Math.abs(house - pick);
  if (diff === 0) return 'win';
  if (diff === 1) return 'close-win';
  if (diff <= 3) return 'close-loss';
  if (diff <= 5) return 'loss';
  return 'catastrophic';
}

function generateCardWar(): { secret: any; initData: any } {
  // 5 rounds, each with two cards
  const rounds: Array<[number, number]> = [];
  for (let i = 0; i < 5; i++) {
    rounds.push([secureRandom(13) + 1, secureRandom(13) + 1]);
  }
  return { secret: { rounds }, initData: {} };
}

function resolveCardWar(secret: any): MinigameTier {
  const rounds = secret.rounds as Array<[number, number]>;
  let playerWins = 0;
  for (const [p, h] of rounds) {
    if (p > h) playerWins++;
  }
  if (playerWins >= 4) return 'win';
  if (playerWins === 3) return 'close-win';
  if (playerWins === 2) return 'close-loss';
  if (playerWins === 1) return 'loss';
  return 'catastrophic';
}

function generateSafeCracker(): { secret: any; initData: any } {
  const combo = [secureRandom(10), secureRandom(10), secureRandom(10)];
  return { secret: { combo }, initData: { digits: 3, range: 10 } };
}

function resolveSafeCracker(secret: any, actions: any[]): MinigameTier {
  const combo = secret.combo as number[];
  const guess = actions[0]?.combo ?? [0, 0, 0];
  let correct = 0;
  for (let i = 0; i < 3; i++) {
    if (guess[i] === combo[i]) correct++;
  }
  if (correct === 3) return 'win';
  if (correct === 2) return 'close-win';
  if (correct === 1) return 'close-loss';
  return 'loss';
}

// ---- Public API ----

const GENERATORS: Record<string, () => { secret: any; initData: any }> = {
  'slots': generateSlots,
  'coin-flip': generateCoinFlip,
  'higher-lower': generateHigherLower,
  'blackjack': generateBlackjack,
  'craps': generateCraps,
  'wheel': generateWheel,
  'minesweeper': generateMinesweeper,
  'lucky-number': generateLuckyNumber,
  'card-war': generateCardWar,
  'safe-cracker': generateSafeCracker,
};

const RESOLVERS: Record<string, (secret: any, actions: any[]) => MinigameTier> = {
  'slots': (s) => resolveSlots(s),
  'coin-flip': (s, a) => resolveCoinFlip(s, a),
  'higher-lower': (s, a) => resolveHigherLower(s, a),
  'blackjack': (s, a) => resolveBlackjack(s, a),
  'craps': (s) => resolveCraps(s),
  'wheel': (s) => resolveWheel(s),
  'minesweeper': (s, a) => resolveMinesweeper(s, a),
  'lucky-number': (s, a) => resolveLuckyNumber(s, a),
  'card-war': (s) => resolveCardWar(s),
  'safe-cracker': (s, a) => resolveSafeCracker(s, a),
};

/** Initialize a minigame server-side. Returns data to send to client. */
export function initMinigame(
  minigameId: string,
  roomCode: string,
  playerIndex: number
): { commitHash: string; initData: any } {
  const generator = GENERATORS[minigameId];
  if (!generator) throw new Error(`Unknown minigame: ${minigameId}`);

  const { secret, initData } = generator();
  const commitHash = commitSecret(secret);

  const state: MinigameServerState = {
    id: minigameId,
    roomCode,
    playerIndex,
    secret,
    commitHash,
    resolved: false,
    actions: [],
    createdAt: Date.now(),
  };

  activeMinigames.set(roomCode, state);

  return { commitHash, initData };
}

/** Record a player action. Returns reveal data if the action triggers one. */
export function recordMinigameAction(
  roomCode: string,
  action: any
): { reveal?: any } {
  const state = activeMinigames.get(roomCode);
  if (!state || state.resolved) return {};

  state.actions.push(action);

  // For games that reveal per-action, return reveal data
  if (state.id === 'coin-flip') {
    const idx = state.actions.length - 1;
    if (idx < state.secret.coins.length) {
      return { reveal: { round: idx, result: state.secret.coins[idx] } };
    }
  }
  if (state.id === 'higher-lower') {
    const idx = state.actions.length;
    if (idx < state.secret.cards.length) {
      return { reveal: { cardIndex: idx, value: state.secret.cards[idx] } };
    }
  }
  if (state.id === 'blackjack') {
    if (action.choice === 'hit') {
      const nextIdx = 4 + state.actions.filter((a: any) => a.choice === 'hit').length - 1;
      return { reveal: { card: state.secret.deck[nextIdx] } };
    }
  }
  if (state.id === 'minesweeper') {
    const mines = new Set(state.secret.mines as number[]);
    return { reveal: { tile: action.tile, isMine: mines.has(action.tile) } };
  }

  return {};
}

/** Resolve the minigame and return the server-determined tier + secret for verification. */
export function resolveServerMinigame(roomCode: string): { tier: MinigameTier; secret: any; commitHash: string } | null {
  const state = activeMinigames.get(roomCode);
  if (!state) return null;
  if (state.resolved && state.result) {
    return { tier: state.result, secret: state.secret, commitHash: state.commitHash };
  }

  const resolver = RESOLVERS[state.id];
  if (!resolver) return null;

  const tier = resolver(state.secret, state.actions);
  state.resolved = true;
  state.result = tier;

  return { tier, secret: state.secret, commitHash: state.commitHash };
}

/** Clean up after minigame is fully processed */
export function cleanupMinigame(roomCode: string): void {
  activeMinigames.delete(roomCode);
}

/** Check if a minigame is active for this room */
export function hasActiveMinigame(roomCode: string): boolean {
  return activeMinigames.has(roomCode);
}

/** Get the active minigame state (for timeout handling) */
export function getActiveMinigame(roomCode: string): MinigameServerState | undefined {
  return activeMinigames.get(roomCode);
}
