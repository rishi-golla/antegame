'use client';

/**
 * Multi-chain context that unifies Solana and EVM (Base) wallet auth.
 * 
 * The connect screen lets users pick their chain. Once connected,
 * this context provides a unified interface for the rest of the app.
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useEVMAuth } from './EVMAuthContext';

export type Chain = 'solana' | 'base';

interface MultiChainUser {
  walletAddress: string;
  displayName: string | null;
  characterId: string | null;
  chain: Chain;
}

interface MultiChainContextType {
  user: MultiChainUser | null;
  loading: boolean;
  isNewUser: boolean;
  activeChain: Chain | null;
  setActiveChain: (chain: Chain) => void;
  connectAndSign: () => Promise<void>;
  disconnect: () => Promise<void>;
  updateProfile: (displayName: string, characterId: string) => Promise<void>;
}

const MultiChainContext = createContext<MultiChainContextType>({
  user: null,
  loading: true,
  isNewUser: false,
  activeChain: null,
  setActiveChain: () => {},
  connectAndSign: async () => {},
  disconnect: async () => {},
  updateProfile: async () => {},
});

export function useMultiChain() {
  return useContext(MultiChainContext);
}

export function MultiChainProvider({ children }: { children: ReactNode }) {
  const solana = useAuth();
  const evm = useEVMAuth();
  const [activeChain, setActiveChain] = useState<Chain | null>(() => {
    if (solana.user) return 'solana';
    if (evm.user) return 'base';
    return null;
  });

  // Auto-set activeChain when user session loads (e.g. from cookie on refresh)
  useEffect(() => {
    if (activeChain) return; // already set by user action
    if (evm.user) setActiveChain('base');
    else if (solana.user) setActiveChain('solana');
  }, [evm.user, solana.user, activeChain]);

  const loading = solana.loading || evm.loading;

  // Determine active user based on chain
  const user: MultiChainUser | null = (() => {
    if (activeChain === 'base' && evm.user) {
      return { ...evm.user, chain: 'base' as Chain };
    }
    if (activeChain === 'solana' && solana.user) {
      return {
        walletAddress: solana.user.walletAddress,
        displayName: solana.user.displayName,
        characterId: solana.user.characterId,
        chain: 'solana' as Chain,
      };
    }
    // Auto-detect from existing session
    if (evm.user) return { ...evm.user, chain: 'base' as Chain };
    if (solana.user) return {
      walletAddress: solana.user.walletAddress,
      displayName: solana.user.displayName,
      characterId: solana.user.characterId,
      chain: 'solana' as Chain,
    };
    return null;
  })();

  const isNewUser = activeChain === 'base' ? evm.isNewUser : (solana as any).isNewUser ?? false;

  const connectAndSign = useCallback(async () => {
    if (activeChain === 'base') {
      await evm.connectAndSign();
    } else {
      // Solana connect is handled by wallet adapter modal
    }
  }, [activeChain, evm]);

  const disconnect = useCallback(async () => {
    try { await evm.disconnect(); } catch {}
    try { await solana.disconnect?.(); } catch {}
    setActiveChain(null);
  }, [evm, solana]);

  const updateProfile = useCallback(async (displayName: string, characterId: string) => {
    if (activeChain === 'base') {
      await evm.updateProfile(displayName, characterId);
    } else {
      await (solana as any).updateProfile?.(displayName, characterId);
    }
  }, [activeChain, evm, solana]);

  return (
    <MultiChainContext.Provider value={{
      user,
      loading,
      isNewUser,
      activeChain,
      setActiveChain,
      connectAndSign,
      disconnect,
      updateProfile,
    }}>
      {children}
    </MultiChainContext.Provider>
  );
}
