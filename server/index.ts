import express from 'express';
import { createServer } from 'http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { RoomManager } from './roomManager';
import { applyGameAction, applyJailEscape } from './gameManager';
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
        players: room.players.map((p) => ({
          name: p.name,
          color: p.color,
          ready: p.ready,
          connected: p.connected,
          isHost: p.id === room.hostId,
          isYou: p.id === player.id,
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
  app.all('*', (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
