import express from 'express';
import { createServer } from 'http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { RoomManager } from './roomManager';
import { applyGameAction, applyJailEscape, isCurrentPlayer } from './gameManager';
import { declareBankruptcy, startMinigame, resolveMinigame, payRentNormally } from '@/lib/gameEngine';
import { buildHouse, sellHouse, mortgageProperty, unmortgageProperty } from '@/lib/propertyActions';
import { proposeTrade, acceptTrade, rejectTrade } from '@/lib/trading';
import authRouter, { sessionMiddleware } from './routes/auth';
import statsRouter from './routes/stats';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  ChatMessage,
  RoomClientState,
} from './types';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

const rm = new RoomManager();

nextApp.prepare().then(() => {
  const app = express();
  app.use(express.json());
  app.use(sessionMiddleware);
  app.use('/api/auth', authRouter);
  app.use('/api/stats', statsRouter);
  const httpServer = createServer(app);

  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: '*' },
  });

  // Cleanup stale rooms every 5 minutes
  setInterval(() => rm.cleanup(), 5 * 60 * 1000);

  function broadcastRoomState(code: string) {
    const room = rm.getRoom(code);
    if (!room) return;

    for (const player of room.players) {
      const socket = io.sockets.sockets.get(player.id);
      if (!socket) continue;

      const clientState: RoomClientState = {
        code: room.code,
        phase: room.phase,
        maxPlayers: room.maxPlayers,
        hostName: room.players.find((p) => p.id === room.hostId)?.name ?? '',
        entryFeeLamports: room.entryFeeLamports,
        potLamports: room.potLamports,
        isQuickPlay: room.isQuickPlay,
        players: room.players.map((p) => ({
          name: p.name,
          color: p.color,
          ready: p.ready,
          connected: p.connected,
          isHost: p.id === room.hostId,
          isYou: p.id === player.id,
          deposited: p.deposited,
        })),
      };

      socket.emit('room:state', clientState);
    }
  }

  function broadcastGameState(code: string) {
    const room = rm.getRoom(code);
    if (!room?.gameState) return;
    io.to(code).emit('game:state', room.gameState);
  }

  function broadcastChat(code: string, message: ChatMessage) {
    rm.addChatMessage(code, message);
    io.to(code).emit('chat:message', message);
  }

  function systemMessage(code: string, text: string) {
    const msg: ChatMessage = {
      id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderName: 'System',
      senderColor: '#8ca8d6',
      text,
      system: true,
      timestamp: Date.now(),
    };
    broadcastChat(code, msg);
  }

  io.on('connection', (socket) => {
    // Room: Create
    socket.on('room:create', (data, cb) => {
      const result = rm.createRoom(socket.id, data.name, data.color, data.maxPlayers);
      if (result.ok && result.code) {
        socket.join(result.code);
        broadcastRoomState(result.code);
        systemMessage(result.code, `${data.name} created the room.`);
      }
      cb(result);
    });

    // Room: Join
    socket.on('room:join', (data, cb) => {
      const code = data.code.toUpperCase();
      const result = rm.joinRoom(code, socket.id, data.name, data.color);
      if (result.ok) {
        socket.join(code);
        // Send chat history to new joiner
        const room = rm.getRoom(code);
        if (room) {
          socket.emit('chat:history', room.chatHistory);
        }
        broadcastRoomState(code);
        systemMessage(code, `${data.name} joined the room.`);
      }
      cb(result);
    });

    // Room: Leave
    socket.on('room:leave', () => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const player = rm.getPlayerInRoom(code, socket.id);
      const result = rm.leaveRoom(socket.id);
      if (result) {
        socket.leave(code);
        if (!result.deleted && player) {
          systemMessage(code, `${player.name} left the room.`);
          broadcastRoomState(code);
        }
      }
    });

    // Room: Ready
    socket.on('room:ready', () => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      rm.setReady(code, socket.id);
      broadcastRoomState(code);
    });

    // Room: Start
    socket.on('room:start', (cb) => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return cb({ ok: false, error: 'Not in a room' });
      const result = rm.startGame(code, socket.id);
      if (result.ok) {
        systemMessage(code, 'Game started!');
        broadcastRoomState(code);
        broadcastGameState(code);
      }
      cb(result);
    });

    // Game actions
    const gameActions = [
      'game:roll',
      'game:buy',
      'game:decline',
      'game:end-turn',
      'game:draw-card',
      'game:apply-card',
      'game:resolve-card',
    ] as const;

    for (const event of gameActions) {
      socket.on(event, () => {
        const code = rm.findRoomBySocket(socket.id);
        if (!code) return;
        const room = rm.getRoom(code);
        if (!room) return;

        const action = event.replace('game:', '') as Parameters<typeof applyGameAction>[2];
        const result = applyGameAction(room, socket.id, action);

        if (result.ok) {
          broadcastGameState(code);
          if (room.phase === 'finished') {
            broadcastRoomState(code);
          }
        } else {
          socket.emit('room:error', result.error ?? 'Action failed');
        }
      });
    }

    // Jail escape
    socket.on('game:jail-escape', (data) => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room) return;

      const result = applyJailEscape(room, socket.id, data.method);
      if (result.ok) {
        broadcastGameState(code);
      } else {
        socket.emit('room:error', result.error ?? 'Action failed');
      }
    });

    // Chat
    socket.on('chat:send', (data) => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const player = rm.getPlayerInRoom(code, socket.id);
      if (!player) return;

      const msg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        senderName: player.name,
        senderColor: player.color,
        text: data.text.slice(0, 500), // limit message length
        system: false,
        timestamp: Date.now(),
      };
      broadcastChat(code, msg);
    });

    // Reconnect
    socket.on('room:reconnect', (data, cb) => {
      const code = data.code.toUpperCase();
      const room = rm.getRoom(code);
      if (!room) return cb({ ok: false, error: 'Room not found' });

      // Find disconnected player by name
      const disconnected = room.players.find(
        (p) => p.name === data.name && !p.connected
      );
      if (!disconnected) return cb({ ok: false, error: 'No disconnected player with that name' });

      const success = rm.reconnect(code, disconnected.id, socket.id);
      if (!success) return cb({ ok: false, error: 'Reconnection failed' });

      socket.join(code);
      // Send chat history
      socket.emit('chat:history', room.chatHistory);
      systemMessage(code, `${data.name} reconnected.`);
      io.to(code).emit('player:reconnected', { playerIndex: disconnected.playerIndex });
      broadcastRoomState(code);
      if (room.gameState) {
        broadcastGameState(code);
      }
      cb({ ok: true });
    });

    // Game: Declare bankruptcy
    socket.on('game:bankruptcy', () => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room?.gameState) return;

      if (!isCurrentPlayer(room, socket.id)) {
        socket.emit('room:error', 'Not your turn');
        return;
      }

      const player = room.players.find((p) => p.id === socket.id);
      if (!player) return;

      try {
        room.gameState = declareBankruptcy(room.gameState, player.playerIndex);
        room.lastActivity = Date.now();
        if (room.gameState.phase === 'game-over') {
          room.phase = 'finished';
        }
        broadcastGameState(code);
        if (room.phase === 'finished') {
          broadcastRoomState(code);
        }
      } catch {
        socket.emit('room:error', 'Cannot declare bankruptcy');
      }
    });

    // Property actions (can be done on your turn)
    const propertyActionHandler = (
      action: 'build-house' | 'sell-house' | 'mortgage' | 'unmortgage',
      data: { tileIndex: number }
    ) => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room?.gameState) return;
      if (!isCurrentPlayer(room, socket.id)) {
        socket.emit('room:error', 'Not your turn');
        return;
      }
      const player = room.players.find((p) => p.id === socket.id);
      if (!player) return;
      try {
        const fns = {
          'build-house': () => buildHouse(room.gameState!, player.playerIndex, data.tileIndex),
          'sell-house': () => sellHouse(room.gameState!, player.playerIndex, data.tileIndex),
          'mortgage': () => mortgageProperty(room.gameState!, player.playerIndex, data.tileIndex),
          'unmortgage': () => unmortgageProperty(room.gameState!, player.playerIndex, data.tileIndex),
        };
        room.gameState = fns[action]();
        room.lastActivity = Date.now();
        broadcastGameState(code);
      } catch (e: any) {
        socket.emit('room:error', e.message ?? 'Action failed');
      }
    };

    socket.on('game:build-house', (data) => propertyActionHandler('build-house', data));
    socket.on('game:sell-house', (data) => propertyActionHandler('sell-house', data));
    socket.on('game:mortgage', (data) => propertyActionHandler('mortgage', data));
    socket.on('game:unmortgage', (data) => propertyActionHandler('unmortgage', data));

    // Trade actions
    socket.on('game:propose-trade', (data) => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room?.gameState) return;
      try {
        room.gameState = proposeTrade(room.gameState, data.offer);
        room.lastActivity = Date.now();
        broadcastGameState(code);
      } catch (e: any) {
        socket.emit('room:error', e.message ?? 'Trade proposal failed');
      }
    });

    socket.on('game:accept-trade', () => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room?.gameState) return;
      try {
        room.gameState = acceptTrade(room.gameState);
        room.lastActivity = Date.now();
        broadcastGameState(code);
      } catch (e: any) {
        socket.emit('room:error', e.message ?? 'Accept trade failed');
      }
    });

    socket.on('game:reject-trade', () => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room?.gameState) return;
      try {
        room.gameState = rejectTrade(room.gameState);
        room.lastActivity = Date.now();
        broadcastGameState(code);
      } catch (e: any) {
        socket.emit('room:error', e.message ?? 'Reject trade failed');
      }
    });

    // Minigame actions
    socket.on('game:gamble', (data) => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room?.gameState) return;
      if (!isCurrentPlayer(room, socket.id)) {
        socket.emit('room:error', 'Not your turn');
        return;
      }
      try {
        room.gameState = startMinigame(room.gameState, data.context);
        room.lastActivity = Date.now();
        broadcastGameState(code);
      } catch (e: any) {
        socket.emit('room:error', e.message ?? 'Gamble failed');
      }
    });

    socket.on('game:minigame-result', (data) => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room?.gameState) return;
      if (!isCurrentPlayer(room, socket.id)) {
        socket.emit('room:error', 'Not your turn');
        return;
      }
      try {
        room.gameState = resolveMinigame(room.gameState, data.tier);
        room.lastActivity = Date.now();
        broadcastGameState(code);
        if (room.gameState.phase === 'game-over') {
          room.phase = 'finished';
          broadcastRoomState(code);
        }
      } catch (e: any) {
        socket.emit('room:error', e.message ?? 'Minigame result failed');
      }
    });

    socket.on('game:pay-rent', () => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;
      const room = rm.getRoom(code);
      if (!room?.gameState) return;
      if (!isCurrentPlayer(room, socket.id)) {
        socket.emit('room:error', 'Not your turn');
        return;
      }
      try {
        room.gameState = payRentNormally(room.gameState);
        room.lastActivity = Date.now();
        broadcastGameState(code);
        if (room.gameState.phase === 'game-over') {
          room.phase = 'finished';
          broadcastRoomState(code);
        }
      } catch (e: any) {
        socket.emit('room:error', e.message ?? 'Pay rent failed');
      }
    });

    // Quick Play
    socket.on('room:quick-play', (data, cb) => {
      const existing = rm.findQuickPlayRoom(data.entryFeeLamports);
      if (existing) {
        const joinResult = rm.joinRoom(existing.code, socket.id, data.name, data.color);
        if (joinResult.ok) {
          const player = rm.getPlayerInRoom(existing.code, socket.id);
          if (player) player.walletAddress = data.walletAddress;
          socket.join(existing.code);
          const room = rm.getRoom(existing.code);
          if (room) socket.emit('chat:history', room.chatHistory);
          broadcastRoomState(existing.code);
          systemMessage(existing.code, `${data.name} joined the table.`);

          // Auto-start when full (4 players) or schedule 60s timer
          if (existing.players.length >= existing.maxPlayers) {
            // Will start when all deposited+ready
          }
          cb({ ok: true, code: existing.code });
        } else {
          cb(joinResult);
        }
      } else {
        const result = rm.createQuickPlayRoom(socket.id, data.name, data.color, data.entryFeeLamports, data.walletAddress);
        if (result.ok && result.code) {
          socket.join(result.code);
          broadcastRoomState(result.code);
          systemMessage(result.code, `${data.name} created a quick-play table.`);
        }
        cb(result);
      }
    });

    // Deposit
    socket.on('room:deposit', (data, cb) => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return cb({ ok: false, error: 'Not in a room' });
      // In production, verify the tx signature on-chain here
      const success = rm.markDeposited(code, socket.id);
      if (!success) return cb({ ok: false, error: 'Deposit tracking failed' });
      const player = rm.getPlayerInRoom(code, socket.id);
      if (player) {
        io.to(code).emit('player:deposited', { playerIndex: player.playerIndex });
        systemMessage(code, `${player.name} deposited entry fee.`);
      }
      broadcastRoomState(code);
      cb({ ok: true });
    });

    // Disconnect
    socket.on('disconnect', () => {
      const code = rm.findRoomBySocket(socket.id);
      if (!code) return;

      const room = rm.getRoom(code);
      if (!room) return;

      if (room.phase === 'playing') {
        // Mark disconnected for reconnection
        const result = rm.markDisconnected(socket.id);
        if (result) {
          systemMessage(code, `${room.players.find((p) => p.id === socket.id)?.name ?? 'A player'} disconnected.`);
          io.to(code).emit('player:disconnected', { playerIndex: result.playerIndex });
          broadcastRoomState(code);
        }
      } else {
        // In lobby, just leave
        const player = rm.getPlayerInRoom(code, socket.id);
        const leaveResult = rm.leaveRoom(socket.id);
        if (leaveResult && !leaveResult.deleted && player) {
          systemMessage(code, `${player.name} left the room.`);
          broadcastRoomState(code);
        }
      }
    });
  });

  // Next.js handler
  app.all('{*path}', (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
