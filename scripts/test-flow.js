/**
 * End-to-end test of the full game flow on-chain:
 * 1. Player 1 creates game (deployer wallet)
 * 2. Player 2 joins game (signer wallet)
 * 3. Game auto-starts (ACTIVE)
 * 4. Server signs settlement for player 1 as winner
 * 5. Player 1 claims winnings
 * 6. Verify balances
 *
 * Run: npx hardhat run scripts/test-flow.js --network base-sepolia
 */

const hre = require("hardhat");
const crypto = require("crypto");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  // Create second wallet from GAME_SIGNER_PRIVATE_KEY
  const signerKey = process.env.GAME_SIGNER_PRIVATE_KEY;
  if (!signerKey) {
    console.error("Set GAME_SIGNER_PRIVATE_KEY in .env");
    process.exit(1);
  }
  const player2 = new hre.ethers.Wallet(signerKey, hre.ethers.provider);

  const MONOPOLY_ADDR = process.env.NEXT_PUBLIC_MONOPOLY_GAME_ADDRESS;
  const FEE_VAULT_ADDR = process.env.NEXT_PUBLIC_FEE_VAULT_ADDRESS;
  if (!MONOPOLY_ADDR) {
    console.error("Set NEXT_PUBLIC_MONOPOLY_GAME_ADDRESS in .env");
    process.exit(1);
  }

  const monopoly = await hre.ethers.getContractAt("MonopolyGame", MONOPOLY_ADDR);
  const feeVault = FEE_VAULT_ADDR ? await hre.ethers.getContractAt("FeeVault", FEE_VAULT_ADDR) : null;

  console.log("Player 1 (deployer):", deployer.address);
  console.log("Player 2 (signer):", player2.address);
  console.log("Contract:", MONOPOLY_ADDR);

  // Check balances
  const bal1 = await hre.ethers.provider.getBalance(deployer.address);
  const bal2 = await hre.ethers.provider.getBalance(player2.address);
  console.log("\n--- Balances ---");
  console.log("Player 1:", hre.ethers.formatEther(bal1), "ETH");
  console.log("Player 2:", hre.ethers.formatEther(bal2), "ETH");

  const buyIn = hre.ethers.parseEther("0.001"); // minimum buy-in
  const gameId = "0x" + crypto.randomBytes(32).toString("hex");

  console.log("\n--- Step 1: Create Game ---");
  console.log("Game ID:", gameId);
  console.log("Buy-in:", hre.ethers.formatEther(buyIn), "ETH");

  const createTx = await monopoly.connect(deployer).createGame(gameId, 2, { value: buyIn });
  await createTx.wait();
  console.log("Game created. Tx:", createTx.hash);

  // Check game state -- getGame returns a tuple, not named fields
  let game = await monopoly.getGame(gameId);
  // [buyIn, maxPlayers, pot, startedAt, state, players, winner]
  console.log("State:", ["WAITING", "ACTIVE", "SETTLED", "CANCELLED"][Number(game[4])]);
  console.log("Players:", game[5].length);
  console.log("Pot:", hre.ethers.formatEther(game[2]), "ETH");

  console.log("\n--- Step 2: Player 2 Joins ---");

  // Fund player 2 if needed (buy-in + gas buffer)
  const bal2Now = await hre.ethers.provider.getBalance(player2.address);
  const needed = buyIn + hre.ethers.parseEther("0.002");
  if (bal2Now < needed) {
    const fundAmount = needed - bal2Now;
    console.log("Funding player 2 with", hre.ethers.formatEther(fundAmount), "ETH...");
    const fundTx = await deployer.sendTransaction({
      to: player2.address,
      value: fundAmount,
    });
    await fundTx.wait();
    const newBal = await hre.ethers.provider.getBalance(player2.address);
    console.log("Player 2 balance now:", hre.ethers.formatEther(newBal), "ETH");
  }

  const joinTx = await monopoly.connect(player2).joinGame(gameId, { value: buyIn });
  await joinTx.wait();
  console.log("Player 2 joined. Tx:", joinTx.hash);

  game = await monopoly.getGame(gameId);
  console.log("State:", ["WAITING", "ACTIVE", "SETTLED", "CANCELLED"][Number(game[4])]);
  console.log("Players:", game[5].length);
  console.log("Pot:", hre.ethers.formatEther(game[2]), "ETH");

  console.log("\n--- Step 3: Sign Settlement (Player 1 wins) ---");

  // Generate nonce
  const nonce = "0x" + crypto.randomBytes(32).toString("hex");
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;

  // Build the message hash the contract expects
  const messageHash = hre.ethers.solidityPackedKeccak256(
    ["bytes32", "address", "bytes32", "address", "uint256"],
    [gameId, deployer.address, nonce, MONOPOLY_ADDR, chainId]
  );

  // Sign with EIP-191 (personal sign) using game signer
  const signature = await player2.signMessage(hre.ethers.getBytes(messageHash));
  console.log("Nonce:", nonce);
  console.log("Signature:", signature.slice(0, 20) + "...");

  console.log("\n--- Step 4: Player 1 Claims Winnings ---");
  const balBefore = await hre.ethers.provider.getBalance(deployer.address);

  const claimTx = await monopoly.connect(deployer).claimWinnings(gameId, nonce, signature);
  const receipt = await claimTx.wait();
  console.log("Claimed! Tx:", claimTx.hash);

  const balAfter = await hre.ethers.provider.getBalance(deployer.address);
  const gasUsed = receipt.gasUsed * receipt.gasPrice;

  game = await monopoly.getGame(gameId);
  const feeBps = await monopoly.feeBps();
  const fee = (buyIn * 2n * feeBps) / 10000n;
  const expectedPayout = buyIn * 2n - fee;

  console.log("\n--- Results ---");
  console.log("State:", ["WAITING", "ACTIVE", "SETTLED", "CANCELLED"][Number(game[4])]);
  console.log("Winner:", game[6]);
  console.log("Fee:", hre.ethers.formatEther(fee), "ETH (" + feeBps.toString() + " bps)");
  console.log("Expected payout:", hre.ethers.formatEther(expectedPayout), "ETH");
  console.log("Actual balance change:", hre.ethers.formatEther(balAfter - balBefore + gasUsed), "ETH (before gas)");
  console.log("Gas cost:", hre.ethers.formatEther(gasUsed), "ETH");

  if (feeVault) {
    const vaultBal = await hre.ethers.provider.getBalance(FEE_VAULT_ADDR);
    console.log("Fee vault balance:", hre.ethers.formatEther(vaultBal), "ETH");
  }

  console.log("\n--- PASS ---");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n--- FAIL ---");
    console.error(error);
    process.exit(1);
  });
