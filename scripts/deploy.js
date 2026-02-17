const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");

  // --- Config ---
  // The gameSigner signs settlement/cancellation messages off-chain.
  // For testnet, we use the deployer as both admin and signer.
  // In production, use a dedicated hot wallet for signing.
  const admin = deployer.address;
  const gameSigner = deployer.address;
  const sweepCooldown = 3600; // 1 hour between fee sweeps
  const feeBps = 500; // 5% house fee

  // --- Deploy FeeVault ---
  console.log("\nDeploying FeeVault...");
  const FeeVault = await hre.ethers.getContractFactory("FeeVault");
  const feeVault = await FeeVault.deploy(admin, deployer.address, sweepCooldown);
  await feeVault.waitForDeployment();
  const feeVaultAddress = await feeVault.getAddress();
  console.log("FeeVault deployed to:", feeVaultAddress);

  // --- Deploy MonopolyGame ---
  console.log("\nDeploying MonopolyGame...");
  const MonopolyGame = await hre.ethers.getContractFactory("MonopolyGame");
  const monopolyGame = await MonopolyGame.deploy(admin, gameSigner, feeVaultAddress, feeBps);
  await monopolyGame.waitForDeployment();
  const monopolyGameAddress = await monopolyGame.getAddress();
  console.log("MonopolyGame deployed to:", monopolyGameAddress);

  // --- Summary ---
  console.log("\n========== DEPLOYMENT COMPLETE ==========");
  console.log("FeeVault:     ", feeVaultAddress);
  console.log("MonopolyGame: ", monopolyGameAddress);
  console.log("Admin:        ", admin);
  console.log("Game Signer:  ", gameSigner);
  console.log("Fee:          ", feeBps / 100 + "%");
  console.log("Sweep Cooldown:", sweepCooldown + "s");
  console.log("=========================================");
  console.log("\nUpdate your .env with:");
  console.log(`NEXT_PUBLIC_MONOPOLY_GAME_ADDRESS=${monopolyGameAddress}`);
  console.log(`NEXT_PUBLIC_FEE_VAULT_ADDRESS=${feeVaultAddress}`);
  console.log(`MONOPOLY_GAME_ADDRESS=${monopolyGameAddress}`);

  // --- Verify (optional, needs BASESCAN_API_KEY) ---
  if (process.env.BASESCAN_API_KEY) {
    console.log("\nVerifying contracts on Basescan...");
    try {
      await hre.run("verify:verify", {
        address: feeVaultAddress,
        constructorArguments: [admin, deployer.address, sweepCooldown],
      });
      console.log("FeeVault verified");
    } catch (e) {
      console.log("FeeVault verification failed:", e.message);
    }
    try {
      await hre.run("verify:verify", {
        address: monopolyGameAddress,
        constructorArguments: [admin, gameSigner, feeVaultAddress, feeBps],
      });
      console.log("MonopolyGame verified");
    } catch (e) {
      console.log("MonopolyGame verification failed:", e.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
