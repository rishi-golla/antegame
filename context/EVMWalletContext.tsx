'use client';

import { type ReactNode } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';

import '@rainbow-me/rainbowkit/styles.css';

const CHAIN_ENV = process.env.NEXT_PUBLIC_CHAIN_ENV ?? 'base-sepolia';
const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL;

const activeChain = CHAIN_ENV === 'base-mainnet' ? base : baseSepolia;

const config = getDefaultConfig({
  appName: 'Monopoly Game',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'placeholder',
  chains: [activeChain],
  transports: {
    [activeChain.id]: http(RPC_URL),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function EVMWalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export { config as wagmiConfig, activeChain };
