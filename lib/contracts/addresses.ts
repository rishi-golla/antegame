import type { Address } from 'viem';

export type ChainEnv = 'base-sepolia' | 'base-mainnet';

export interface ContractAddresses {
  monopolyGame: Address;
  feeVault: Address;
}

// TODO: Replace with deployed addresses after testnet deployment
const ADDRESSES: Record<ChainEnv, ContractAddresses> = {
  'base-sepolia': {
    monopolyGame: (process.env.NEXT_PUBLIC_MONOPOLY_GAME_ADDRESS ?? '0x0000000000000000000000000000000000000000') as Address,
    feeVault: (process.env.NEXT_PUBLIC_FEE_VAULT_ADDRESS ?? '0x0000000000000000000000000000000000000000') as Address,
  },
  'base-mainnet': {
    monopolyGame: (process.env.NEXT_PUBLIC_MONOPOLY_GAME_ADDRESS ?? '0x0000000000000000000000000000000000000000') as Address,
    feeVault: (process.env.NEXT_PUBLIC_FEE_VAULT_ADDRESS ?? '0x0000000000000000000000000000000000000000') as Address,
  },
};

export function getChainEnv(): ChainEnv {
  const env = process.env.NEXT_PUBLIC_CHAIN_ENV ?? 'base-sepolia';
  if (env === 'base-mainnet' || env === 'base-sepolia') return env;
  return 'base-sepolia';
}

export function getChainId(): number {
  return getChainEnv() === 'base-mainnet' ? 8453 : 84532;
}

export function getAddresses(): ContractAddresses {
  return ADDRESSES[getChainEnv()];
}

export function getRpcUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_RPC_URL ?? (
    getChainEnv() === 'base-mainnet'
      ? 'https://mainnet.base.org'
      : 'https://sepolia.base.org'
  );
}

export function getBlockExplorerUrl(): string {
  return getChainEnv() === 'base-mainnet'
    ? 'https://basescan.org'
    : 'https://sepolia.basescan.org';
}

export function getTxUrl(txHash: string): string {
  return `${getBlockExplorerUrl()}/tx/${txHash}`;
}
