/**
 * Monopoly Bot — joins a room and plays automatically.
 * Usage: npx tsx bot.ts <ROOM_CODE> [name] [color]
 */
import { io, Socket } from 'socket.io-client';

const ROOM_CODE = process.argv[2];
const BOT_NAME = process.argv[3] || 'Bot';
const BOT_COLOR = process.argv[4] || '#ff6600';
const SERVER = process.env.SERVER_URL || 'http://localhost:3000';

if (!ROOM_CODE) {
  console.error('Usage: npx tsx bot.ts <ROOM_CODE> [name] [color]');
  process.exit(1);
}

const socket: Socket = io(SERVER);

let myPlayerIndex = -1;
let lastPhase = '';

function log(msg: string) {
  console.log(`[Bot] ${msg}`);
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const RECONNECT = process.argv.includes('--reconnect');

socket.on('connect', () => {
  log(`Connected as ${socket.id}, ${RECONNECT ? 'reconnecting to' : 'joining'} room ${ROOM_CODE}...`);

  if (RECONNECT) {
    socket.emit('room:reconnect', { code: ROOM_CODE, name: BOT_NAME }, (res: any) => {
      if (res.ok) {
        log('Reconnected to room successfully');
      } else {
        log(`Failed to reconnect: ${res.error}, trying fresh join...`);
        freshJoin();
      }
    });
  } else {
    freshJoin();
  }
});

function freshJoin() {
  socket.emit('room:join', { code: ROOM_CODE, name: BOT_NAME, color: BOT_COLOR }, (res: any) => {
    if (res.ok) {
      log('Joined room successfully');
      setTimeout(() => {
        socket.emit('room:ready');
        log('Marked as ready');
      }, 1000);
    } else {
      log(`Failed to join: ${res.error}`);
      process.exit(1);
    }
  });
}

socket.on('room:state', (room: any) => {
  // Find our index
  const me = room.players.find((p: any) => p.isYou);
  if (me) {
    myPlayerIndex = room.players.indexOf(me);
  }
});

socket.on('game:state', (state: any) => {
  const isMyTurn = state.currentPlayerIndex === myPlayerIndex;
  const phase = state.phase;

  // Dedup — but include a counter from the log length to allow retries on new state updates
  const phaseKey = `${phase}-${state.currentPlayerIndex}-${state.log?.length}`;
  if (phaseKey === lastPhase) return;
  lastPhase = phaseKey;

  if (!isMyTurn && phase !== 'trading' && phase !== 'paying-rent' && phase !== 'game-over') return;

  log(`Phase: ${phase}, myTurn: ${isMyTurn}, player: ${state.currentPlayerIndex}`);

  // Small delay to feel more natural and avoid race conditions
  setTimeout(() => act(state, phase, isMyTurn), 300 + Math.random() * 700);
});

function act(state: any, phase: string, isMyTurn: boolean) {
  const me = state.players[myPlayerIndex];

  switch (phase) {
    case 'rolling':
    case 'waiting':
      if (isMyTurn) {
        log('Rolling dice...');
        socket.emit('game:roll');
      }
      break;

    case 'landed':
      if (isMyTurn) {
        log('Landed, ending turn...');
        socket.emit('game:end-turn');
      }
      break;

    case 'buying': {
      if (!isMyTurn) break;
      // Buy if we can afford it, otherwise decline
      const tile = state.tiles[me.position];
      if (tile?.price && me.money >= tile.price && Math.random() > 0.2) {
        log(`Buying ${tile.name} for $${tile.price}`);
        socket.emit('game:buy');
      } else {
        log('Declining purchase');
        socket.emit('game:decline');
      }
      break;
    }

    case 'paying-rent': {
      // If we owe rent, pay it
      if (state.pendingRent && state.currentPlayerIndex === myPlayerIndex) {
        log(`Paying rent: $${state.pendingRent.amount}`);
        socket.emit('game:pay-rent');
      } else if (state.pendingRent) {
        // It's the other player's turn to pay
        break;
      }
      break;
    }

    case 'drawing-card':
      if (isMyTurn) {
        log(`Drawing card (drawnCard=${!!state.drawnCard})...`);
        // If card is already shown, apply it. Otherwise draw first.
        if (state.drawnCard) {
          socket.emit('game:apply-card');
        } else {
          socket.emit('game:draw-card');
        }
      }
      break;

    case 'applying-card':
      if (isMyTurn) {
        log('Resolving card...');
        socket.emit('game:resolve-card');
      }
      break;

    case 'in-jail':
      if (isMyTurn) {
        // Try bail if we have money, otherwise roll
        if (me.getOutOfJailCards > 0) {
          log('Using get-out-of-jail card');
          socket.emit('game:jail-escape', { method: 'card' });
        } else if (me.money >= 50) {
          log('Paying bail');
          socket.emit('game:jail-escape', { method: 'bail' });
        } else {
          log('Rolling to escape jail');
          socket.emit('game:jail-escape', { method: 'roll' });
        }
      }
      break;

    case 'turn-end':
      if (isMyTurn) {
        log('Ending turn');
        socket.emit('game:end-turn');
      }
      break;

    case 'trading': {
      // If a trade is offered to us, randomly accept or reject
      const trade = state.activeTradeOffer;
      if (trade && trade.toPlayer === myPlayerIndex) {
        if (Math.random() > 0.5) {
          log('Accepting trade');
          socket.emit('game:accept-trade');
        } else {
          log('Rejecting trade');
          socket.emit('game:reject-trade');
        }
      }
      break;
    }

    case 'minigame': {
      if (!isMyTurn) break;
      const mg = state.activeMinigame;
      if (mg?.status === 'intro') {
        // Gamble on it
        log(`Starting minigame: ${mg.id}`);
        socket.emit('game:gamble', { context: mg.context });
      } else if (mg?.status === 'playing') {
        // Submit a random result
        const tiers = ['win', 'close-win', 'close-loss', 'loss'];
        const tier = randomChoice(tiers);
        log(`Minigame result: ${tier}`);
        socket.emit('game:minigame-result', { tier });
      }
      break;
    }

    case 'in-debt': {
      if (!isMyTurn) break;
      const debt = state.debt;
      log(`In debt! Owe $${debt?.amount}, have $${me.money}`);
      
      // Try to mortgage properties first
      const unmortgaged = me.properties.filter((idx: number) => !me.mortgaged.includes(idx));
      if (unmortgaged.length > 0) {
        const toMortgage = unmortgaged[0];
        log(`Mortgaging property at tile ${toMortgage}`);
        socket.emit('game:mortgage', { tileIndex: toMortgage });
      } else if (me.money >= (debt?.amount ?? 0)) {
        log('Can now pay debt');
        socket.emit('game:resolve-debt');
      } else {
        log('Cannot pay — declaring bankruptcy');
        socket.emit('game:bankruptcy');
      }
      break;
    }

    case 'game-over':
      log('Game over!');
      break;

    default:
      log(`Unhandled phase: ${phase}`);
  }
}

// Handle bankruptcy — if we're broke just declare it
socket.on('room:error', (error: string) => {
  log(`Error: ${error}`);
  // If we can't pay, go bankrupt
  if (error.includes('afford') || error.includes('money')) {
    log('Going bankrupt...');
    socket.emit('game:bankruptcy');
  }
});

socket.on('disconnect', () => {
  log('Disconnected');
  process.exit(0);
});

socket.on('connect_error', (err: Error) => {
  log(`Connection error: ${err.message}`);
  process.exit(1);
});

// Keep alive
process.on('SIGINT', () => {
  log('Shutting down...');
  socket.disconnect();
  process.exit(0);
});
