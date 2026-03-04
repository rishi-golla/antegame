'use client';

import { useMemo, type ReactNode } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { SolflareWalletAdapter, WalletConnectWalletAdapter } from '@solana/wallet-adapter-wallets';

import '@solana/wallet-adapter-react-ui/styles.css';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const SOLANA_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta') as 'devnet' | 'mainnet-beta';
const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

export function WalletContextProvider({ children }: { children: ReactNode }) {
  const wallets = useMemo(
    () => [
      new SolflareWalletAdapter(),
      ...(WALLETCONNECT_PROJECT_ID
        ? [new WalletConnectWalletAdapter({
            network: SOLANA_NETWORK === 'mainnet-beta' ? 'mainnet' as any : SOLANA_NETWORK as any,
            options: { projectId: WALLETCONNECT_PROJECT_ID },
          })]
        : []),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect={true}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
