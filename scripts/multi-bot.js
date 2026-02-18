/**
 * Spawn N bots that join a room, ready up, and auto-play.
 * Usage: ROOM_CODE=ABC123 BOTS=3 node scripts/multi-bot.js
 */
const { io } = require("socket.io-client");

const roomCode = process.env.ROOM_CODE;
const botCount = parseInt(process.env.BOTS || "3");
const serverUrl = process.env.SERVER_URL || "http://localhost:3001";

if (!roomCode) {
  console.error("Set ROOM_CODE env var");
  process.exit(1);
}

const BOT_CONFIGS = [
  { name: "Bot-Alpha", color: "#ff4444" },
  { name: "Bot-Bravo", color: "#44ff44" },
  { name: "Bot-Charlie", color: "#4444ff" },
  { name: "Bot-Delta", color: "#ffff44" },
  { name: "Bot-Echo", color: "#ff44ff" },
];

for (let i = 0; i < Math.min(botCount, BOT_CONFIGS.length); i++) {
  const cfg = BOT_CONFIGS[i];
  const socket = io(serverUrl);

  socket.on("connect", () => {
    console.log(`[${cfg.name}] Connected`);

    socket.emit("room:join", {
      code: roomCode,
      name: cfg.name,
      color: cfg.color,
    }, (res) => {
      console.log(`[${cfg.name}] Join:`, res.ok ? "OK" : res.error);
      if (res.ok) {
        setTimeout(() => socket.emit("room:ready"), 500 + i * 300);
      }
    });
  });

  socket.on("game:state", (gs) => {
    if (!gs) return;
    const me = gs.players.find(p => p.name === cfg.name);
    if (!me || gs.currentPlayer !== me.id) return;

    console.log(`[${cfg.name}] My turn — phase: ${gs.phase}`);

    setTimeout(() => {
      switch (gs.phase) {
        case "pre-roll": socket.emit("game:roll"); break;
        case "buying":
          // Buy if we can afford, otherwise decline
          if (me.money > 200) socket.emit("game:buy");
          else socket.emit("game:decline");
          break;
        case "paying-rent": socket.emit("game:pay-rent"); break;
        case "drawing-card": socket.emit("game:draw-card"); break;
        case "applying-card": socket.emit("game:apply-card"); break;
        case "resolving-card": socket.emit("game:resolve-card"); break;
        case "turn-end": socket.emit("game:end-turn"); break;
        case "jail": socket.emit("game:jail-escape", { method: "roll" }); break;
        case "game-over": console.log(`[${cfg.name}] Game over! Winner: ${gs.winner}`); break;
        default: socket.emit("game:end-turn"); break;
      }
    }, 300 + Math.random() * 400);
  });

  socket.on("room:error", (err) => console.log(`[${cfg.name}] Error:`, err));
  socket.on("disconnect", () => console.log(`[${cfg.name}] Disconnected`));
}

console.log(`Spawning ${botCount} bots for room ${roomCode} on ${serverUrl}`);
console.log("Press Ctrl+C to stop.\n");
