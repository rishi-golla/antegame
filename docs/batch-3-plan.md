# Batch 3: Multiplayer + Live Chat

## Goal
Transform the local single-device game into a real-time multiplayer web game with live chat. Players create/join rooms, chat in real-time, and play together with server-authoritative game state.

## Architecture
- Custom Node.js server wrapping Next.js + Socket.IO (single process)
- Server holds all game state (reuses gameEngine pure functions)
- Clients send actions (roll, buy, decline, etc.) via socket events
- Server validates, applies to state, broadcasts updates to room
- Chat messages relay through server to all room members

## Tasks

### 3.1 Server Setup
- Install `socket.io`, `socket.io-client`, `express`
- Create `server/index.ts` — custom Express server that:
  - Serves Next.js (next handler)
  - Attaches Socket.IO
  - Listens on single port (3000)
- Create `server/types.ts` — server-specific types (Room, ServerPlayer, etc.)
- Update `package.json` scripts: `"dev": "ts-node server/index.ts"`, add `tsx` for TS execution
- Update `next.config.mjs` if needed

### 3.2 Room Management
- Create `server/roomManager.ts`:
  - `createRoom(hostName, hostColor, settings)` -> room code (6 char alphanumeric)
  - `joinRoom(code, playerName, playerColor)` -> success/error
  - `leaveRoom(code, playerId)`
  - `getRoomState(code)` -> lobby state or game state
  - Room settings: max players (2-6), room name
  - Room states: `lobby` (waiting for players) -> `playing` -> `finished`
  - Auto-cleanup rooms after 30min inactivity
- Socket events:
  - `room:create` -> creates room, joins creator
  - `room:join` -> joins existing room
  - `room:leave` -> leaves room
  - `room:ready` -> toggle ready status
  - `room:start` -> host starts game (all must be ready)
  - `room:state` -> broadcast room/game state to all members

Tests:
- Room creation returns valid code
- Join with valid code succeeds
- Join with invalid code fails
- Room auto-starts when host triggers and all ready
- Max player limit enforced

### 3.3 Server-Authoritative Game Logic
- Create `server/gameManager.ts`:
  - Wraps `gameEngine.ts` functions
  - Server generates dice rolls (no client-side randomness)
  - Validates actions: only current player can roll, buy, etc.
  - Broadcasts state diff or full state after each action
- Socket events:
  - `game:roll` -> server rolls, applies, broadcasts
  - `game:buy` -> server validates, applies, broadcasts
  - `game:decline` -> server applies, broadcasts
  - `game:end-turn` -> server advances turn, broadcasts
  - `game:draw-card` -> server draws, broadcasts
  - `game:apply-card` -> server applies card effect, broadcasts
  - `game:jail-escape` -> server handles, broadcasts
  - `game:state` -> full state sync (on connect/reconnect)

Tests:
- Only current player can roll
- Server-generated dice are 1-6
- Buy deducts money and adds property on server state
- State broadcasts to all room members
- Invalid actions are rejected

### 3.4 Live Chat
- Create `server/chatManager.ts`:
  - Messages scoped to rooms
  - Recent message history (last 100 per room)
  - Messages include sender name, color, timestamp
- Socket events:
  - `chat:send` -> client sends message
  - `chat:message` -> server broadcasts to room
  - `chat:history` -> sent on join (last 100 messages)
- Update `components/SidePanel/ChatView.tsx`:
  - Replace static messages with real-time socket messages
  - Input sends via socket
  - Auto-scroll on new messages
  - Show player color + name
  - Show system messages (join/leave/game events) in chat too

Tests:
- Message broadcasts to all room members
- Message history sent on join
- Messages include correct sender info

### 3.5 Client Integration
- Create `lib/socket.ts` — singleton socket client, connection management
- Create `context/SocketContext.tsx` — React context for socket + room state
- Create `context/MultiplayerGameContext.tsx` — replaces local GameContext in multiplayer mode
  - Receives state from server via socket
  - Dispatches actions to server instead of local reducer
  - Same `useGame()` interface so components don't change
- Update `components/Board/BoardCenterArt.tsx`:
  - Only show action buttons for the local player's turn
  - Disable controls when it's not your turn
- Update `components/PlayerList/PlayerList.tsx`:
  - Highlight "You" indicator on local player
  - Show connection status (green dot = connected)

### 3.6 Lobby UI
- Create `components/Lobby/CreateRoom.tsx`:
  - Player name input, color picker
  - Room settings (max players)
  - "Create Room" button
- Create `components/Lobby/JoinRoom.tsx`:
  - Room code input
  - Player name input, color picker
  - "Join Room" button
- Create `components/Lobby/RoomLobby.tsx`:
  - Show room code (copyable)
  - Player list with ready status
  - Ready toggle button
  - Host has "Start Game" button (enabled when all ready)
  - Chat available in lobby too
- Update `app/page.tsx`:
  - Flow: Menu -> Create/Join -> Lobby -> Game
  - Keep local play option (current setup screen)

### 3.7 Reconnection
- On disconnect, hold player slot for 2 minutes
- On reconnect with same session ID, restore player to room
- During disconnect, auto-skip turns (or timer-based forfeit)
- Show "(disconnected)" badge on player list

## Completion Criteria
- Two+ browsers can create/join a room and play a full game
- Chat works in real-time in lobby and during game
- Server validates all game actions
- Reconnection works within timeout window
- Local play mode still works
- All tests pass, TS clean, build clean

## Files Created/Modified
- `server/index.ts` (new)
- `server/types.ts` (new)
- `server/roomManager.ts` (new)
- `server/gameManager.ts` (new)
- `server/chatManager.ts` (new)
- `server/roomManager.test.ts` (new)
- `server/gameManager.test.ts` (new)
- `server/chatManager.test.ts` (new)
- `lib/socket.ts` (new)
- `context/SocketContext.tsx` (new)
- `context/MultiplayerGameContext.tsx` (new)
- `components/Lobby/CreateRoom.tsx` (new)
- `components/Lobby/JoinRoom.tsx` (new)
- `components/Lobby/RoomLobby.tsx` (new)
- `components/SidePanel/ChatView.tsx` (modified)
- `components/Board/BoardCenterArt.tsx` (modified)
- `components/PlayerList/PlayerList.tsx` (modified)
- `app/page.tsx` (modified)
- `app/globals.css` (modified)
- `package.json` (modified)
- `next.config.mjs` (modified)
