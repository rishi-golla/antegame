/**
 * Create a game on-chain for a given room code.
 * Usage: ROOM_CODE=XKN3RU BUY_IN=0.001 MAX_PLAYERS=2 npx hardhat run scripts/create-game.js --network base-mainnet
 */
require("dotenv").config();
const hre = require("hardhat");
const { keccak256, encodePacked } = require("viem");

async function main() {
  const roomCode = process.env.ROOM_CODE;
  const buyIn = process.env.BUY_IN || "0.001";
  const maxPlayers = parseInt(process.env.MAX_PLAYERS || "2");

  if (!roomCode) {
    console.error("Set ROOM_CODE env var");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Creator wallet:", deployer.address);

  const gameId = keccak256(encodePacked(["string"], [roomCode]));
  console.log("Room:", roomCode, "| Game ID:", gameId);
  console.log("Buy-in:", buyIn, "ETH | Max players:", maxPlayers);

  const monopoly = await hre.ethers.getContractAt(
    "MonopolyGame",
    process.env.MONOPOLY_GAME_ADDRESS
  );

  const tx = await monopoly.createGame(gameId, maxPlayers, {
    value: hre.ethers.parseEther(buyIn),
  });
  console.log("Tx sent:", tx.hash);
  const receipt = await tx.wait();
  console.log("Confirmed in block", receipt.blockNumber);

  const game = await monopoly.getGame(gameId);
  console.log("On-chain state:", ["WAITING","ACTIVE","SETTLED","CANCELLED"][game.state]);
  console.log("Buy-in:", hre.ethers.formatEther(game.buyIn), "ETH");
  console.log("Players:", game.players.length, "/", game.maxPlayers.toString());
}

main().catch((e) => { console.error(e); process.exit(1); });
