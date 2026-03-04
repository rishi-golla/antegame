import type { ReactNode } from 'react';
import { WalletProviderWrapper } from '@/context/SolanaWalletContext';
import { EVMWalletProvider } from '@/context/EVMWalletContext';
import './bridge.css';

export default function BridgeLayout({ children }: { children: ReactNode }) {
  return (
    <EVMWalletProvider>
      <WalletProviderWrapper>{children}</WalletProviderWrapper>
    </EVMWalletProvider>
  );
}
