/**
 * Bot player that joins a game on-chain for solo testing.
 * 
 * Usage:
 *   node scripts/bot-join.js <room-code> [network]
 * 
 * Example:
 *   node scripts/bot-join.js ABC123 base-mainnet
 * 
 * The bot uses GAME_SIGNER_PRIVATE_KEY as its wallet.
 * It joins the on-chain game and the socket room, then auto-loses
 * by declaring bankruptcy after a few turns.
 */

require("dotenv").config();
const hre = require("hardhat");
const { io } = require("socket.io-client");
const { keccak256, encodePacked } = require("viem");

async function main() {
  const roomCode = process.argv[2];
  if (!roomCode) {
    console.error("Usage: npx hardhat run scripts/bot-join.js --network <network> -- <ROOM_CODE>");
    console.error("  Or:  ROOM_CODE=ABC123 npx hardhat run scripts/bot-join.js --network base-mainnet");
    process.exit(1);
  }

  const signerKey = process.env.GAME_SIGNER_PRIVATE_KEY;
  if (!signerKey) {
    console.error("Set GAME_SIGNER_PRIVATE_KEY in .env");
    process.exit(1);
  }

  const MONOPOLY_ADDR = process.env.NEXT_PUBLIC_MONOPOLY_GAME_ADDRESS;
  const bot = new hre.ethers.Wallet(signerKey, hre.ethers.provider);
  const monopoly = await hre.ethers.getContractAt("MonopolyGame", MONOPOLY_ADDR);

  console.log("Bot wallet:", bot.address);
  console.log("Room code:", roomCode);

  // Derive gameId from room code (same as frontend)
  const gameId = keccak256(encodePacked(["string"], [roomCode]));
  console.log("Game ID:", gameId);

  // Check game on-chain
  const game = await monopoly.getGame(gameId);
  const state = Number(game[4]);
  const buyIn = game[0];
  console.log("On-chain state:", ["WAITING", "ACTIVE", "SETTLED", "CANCELLED"][state]);
  console.log("Buy-in:", hre.ethers.formatEther(buyIn), "ETH");
  console.log("Players:", game[5].length, "/", game[1].toString());

  if (state !== 0) {
    console.error("Game is not in WAITING state, cannot join");
    process.exit(1);
  }

  // Fund bot if needed
  const [deployer] = await hre.ethers.getSigners();
  const botBal = await hre.ethers.provider.getBalance(bot.address);
  const needed = buyIn + hre.ethers.parseEther("0.001"); // buy-in + gas
  if (botBal < needed) {
    console.log("Funding bot...");
    const tx = await deployer.sendTransaction({ to: bot.address, value: needed - botBal });
    await tx.wait();
  }

  // Join on-chain
  console.log("\nJoining game on-chain...");
  const joinTx = await monopoly.connect(bot).joinGame(gameId, { value: buyIn });
  await joinTx.wait();
  console.log("Joined on-chain! Tx:", joinTx.hash);

  // Check if game started
  const gameAfter = await monopoly.getGame(gameId);
  console.log("State:", ["WAITING", "ACTIVE", "SETTLED", "CANCELLED"][Number(gameAfter[4])]);

  // Now join the socket room
  const serverUrl = process.env.SERVER_URL || "http://localhost:3001";
  console.log("\nConnecting to server:", serverUrl);

  const socket = io(serverUrl);

  socket.on("connect", () => {
    console.log("Socket connected");

    // Join the room
    socket.emit("room:join", {
      code: roomCode,
      name: "TestBot",
      color: "#ff4444",
    }, (res) => {
      console.log("Room join result:", res);
      if (res.ok) {
        // Ready up immediately
        socket.emit("room:ready");
        console.log("Bot is ready!");
      }
    });
  });

  // Auto-play: just end turns and eventually go bankrupt
  let turnCount = 0;
  socket.on("game:state", (gameState) => {
    if (!gameState) return;
    const botPlayer = gameState.players.find(p => p.name === "TestBot");
    if (!botPlayer) return;

    const isMyTurn = gameState.currentPlayer === botPlayer.id;
    if (!isMyTurn) return;

    turnCount++;
    console.log(`Bot turn #${turnCount}, phase: ${gameState.phase}`);

    // Auto-play based on phase
    setTimeout(() => {
      switch (gameState.phase) {
        case "pre-roll":
          socket.emit("game:roll");
          break;
        case "buying":
          socket.emit("game:decline"); // never buy
          break;
        case "paying-rent":
          socket.emit("game:pay-rent");
          break;
        case "drawing-card":
          socket.emit("game:draw-card");
          break;
        case "applying-card":
          socket.emit("game:apply-card");
          break;
        case "resolving-card":
          socket.emit("game:resolve-card");
          break;
        case "turn-end":
          socket.emit("game:end-turn");
          break;
        case "jail":
          socket.emit("game:jail-escape", { method: "roll" });
          break;
        default:
          // Try ending turn as fallback
          socket.emit("game:end-turn");
      }
    }, 500);
  });

  socket.on("room:error", (err) => {
    console.log("Room error:", err);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected");
  });

  // Keep alive
  console.log("\nBot is running. Press Ctrl+C to stop.");
  await new Promise(() => {}); // hang forever
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
