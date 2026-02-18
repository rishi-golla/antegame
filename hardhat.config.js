require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const os = require("os");

// Load keys from secure keyfile, fallback to env
let secureKeys = {};
try {
  const keysPath = path.join(os.homedir(), ".config", "ante", "keys.json");
  secureKeys = JSON.parse(fs.readFileSync(keysPath, "utf-8"));
} catch {}

const ALCHEMY_API_KEY = secureKeys.ALCHEMY_API_KEY ?? process.env.ALCHEMY_API_KEY ?? "";
const DEPLOYER_PRIVATE_KEY = secureKeys.DEPLOYER_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY ?? "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    "base-sepolia": {
      url: `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
    "base-mainnet": {
      url: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: secureKeys.BASESCAN_API_KEY ?? process.env.BASESCAN_API_KEY ?? "",
  },
  sourcify: {
    enabled: true,
  },
};
