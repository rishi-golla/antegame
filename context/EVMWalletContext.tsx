'use client';

import { type ReactNode } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RainbowKitProvider,
  connectorsForWallets,
} from '@rainbow-me/rainbowkit';
import {
  phantomWallet,
  metaMaskWallet,
  coinbaseWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';

import '@rainbow-me/rainbowkit/styles.css';

const CHAIN_ENV = process.env.NEXT_PUBLIC_CHAIN_ENV ?? 'base-sepolia';
const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL;
const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'placeholder';

const activeChain = CHAIN_ENV === 'base-mainnet' ? base : baseSepolia;

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [phantomWallet, metaMaskWallet, coinbaseWallet, walletConnectWallet],
    },
  ],
  {
    appName: 'Ante',
    projectId: PROJECT_ID,
  }
);

const config = createConfig({
  connectors,
  chains: [base, baseSepolia],
  transports: {
    [base.id]: http(CHAIN_ENV === 'base-mainnet' ? RPC_URL : undefined),
    [baseSepolia.id]: http(CHAIN_ENV === 'base-sepolia' ? RPC_URL : undefined),
  },
  ssr: true,
});

const queryClient = new QueryClient();

console.log('[EVMWallet] connectors configured:', config.connectors?.map((c: any) => c.name || c.id));

export function EVMWalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export { config as wagmiConfig, activeChain };
