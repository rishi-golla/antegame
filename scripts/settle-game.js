/**
 * Settle a game and claim winnings for the winner.
 * Usage: ROOM_CODE=ZUB6UN WINNER=0x... npx hardhat run scripts/settle-game.js --network base-mainnet
 * WINNER defaults to deployer (DEPLOYER_PRIVATE_KEY).
 */
require("dotenv").config();
const hre = require("hardhat");
const crypto = require("crypto");
const { keccak256, encodePacked } = require("viem");

async function main() {
  const roomCode = process.env.ROOM_CODE;
  if (!roomCode) { console.error("Set ROOM_CODE"); process.exit(1); }

  const [deployer] = await hre.ethers.getSigners();
  const signerKey = process.env.GAME_SIGNER_PRIVATE_KEY;
  const signer = new hre.ethers.Wallet(signerKey, hre.ethers.provider);

  const MONOPOLY_ADDR = process.env.NEXT_PUBLIC_MONOPOLY_GAME_ADDRESS;
  const monopoly = await hre.ethers.getContractAt("MonopolyGame", MONOPOLY_ADDR);

  const gameId = keccak256(encodePacked(["string"], [roomCode]));
  const winner = process.env.WINNER || deployer.address;

  console.log("Room:", roomCode);
  console.log("Game ID:", gameId);
  console.log("Winner:", winner);
  console.log("Signer:", signer.address);

  const game = await monopoly.getGame(gameId);
  console.log("State:", ["WAITING","ACTIVE","SETTLED","CANCELLED"][Number(game[4])]);
  console.log("Pot:", hre.ethers.formatEther(game[3]), "ETH");

  // Generate nonce and sign settlement
  const nonce = "0x" + crypto.randomBytes(32).toString("hex");
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;

  const messageHash = hre.ethers.solidityPackedKeccak256(
    ["bytes32", "address", "bytes32", "address", "uint256"],
    [gameId, winner, nonce, MONOPOLY_ADDR, chainId]
  );
  const signature = await signer.signMessage(hre.ethers.getBytes(messageHash));

  console.log("\nSettling...");

  // Winner claims
  const winnerSigner = deployer.address.toLowerCase() === winner.toLowerCase()
    ? deployer
    : new hre.ethers.Wallet(process.env.WINNER_KEY, hre.ethers.provider);

  const balBefore = await hre.ethers.provider.getBalance(winnerSigner.address);
  const tx = await monopoly.connect(winnerSigner).claimWinnings(gameId, nonce, signature);
  const receipt = await tx.wait();
  const balAfter = await hre.ethers.provider.getBalance(winnerSigner.address);
  const gasUsed = receipt.gasUsed * receipt.gasPrice;

  console.log("Claimed! Tx:", tx.hash);
  console.log("Payout received:", hre.ethers.formatEther(balAfter - balBefore + gasUsed), "ETH (before gas)");

  const gameAfter = await monopoly.getGame(gameId);
  console.log("Final state:", ["WAITING","ACTIVE","SETTLED","CANCELLED"][Number(gameAfter[4])]);
  console.log("Winner on-chain:", gameAfter[6]);
}

main().catch((e) => { console.error(e); process.exit(1); });
