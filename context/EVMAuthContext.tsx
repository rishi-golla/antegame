'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAccount, useSignMessage, useDisconnect } from 'wagmi';

interface EVMUser {
  walletAddress: string;
  displayName: string | null;
  characterId: string | null;
  chain: 'base';
}

interface EVMAuthContextType {
  user: EVMUser | null;
  loading: boolean;
  isNewUser: boolean;
  connectAndSign: (ref?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  updateProfile: (displayName: string, characterId: string) => Promise<void>;
}

const EVMAuthContext = createContext<EVMAuthContextType>({
  user: null,
  loading: true,
  isNewUser: false,
  connectAndSign: async () => {},
  disconnect: async () => {},
  updateProfile: async () => {},
});

export function useEVMAuth() {
  return useContext(EVMAuthContext);
}

export function EVMAuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  const [user, setUser] = useState<EVMUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);

  // Check existing session on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          setIsNewUser(!data.user.displayName);
        }
      } catch {
        // No session
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Auto-sign when wallet connects and no session exists
  const connectAndSign = useCallback(async (ref?: string) => {
    if (!address) return;

    try {
      // Get nonce
      const nonceRes = await fetch('/api/auth/nonce');
      const { nonce, message } = await nonceRes.json();

      // Sign with EVM wallet
      const signature = await signMessageAsync({ message });

      // Check for ref param in URL if not passed directly
      const refParam = ref ?? new URLSearchParams(window.location.search).get('ref') ?? undefined;

      // Verify on server
      const verifyRes = await fetch('/api/auth/verify-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          signature,
          nonce,
          chain: 'base',
          ...(refParam ? { ref: refParam } : {}),
        }),
      });

      const data = await verifyRes.json();
      if (data.user) {
        setUser(data.user);
        setIsNewUser(data.isNewUser ?? !data.user.displayName);
      }
    } catch (err) {
      console.error('EVM auth failed:', err);
    }
  }, [address, signMessageAsync]);

  const disconnect = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    wagmiDisconnect();
    setUser(null);
    setIsNewUser(false);
  }, [wagmiDisconnect]);

  const updateProfile = useCallback(async (displayName: string, characterId: string) => {
    const res = await fetch('/api/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, characterId }),
    });
    const data = await res.json();
    if (data.user) {
      setUser(data.user);
      setIsNewUser(false);
    }
  }, []);

  return (
    <EVMAuthContext.Provider value={{ user, loading, isNewUser, connectAndSign, disconnect, updateProfile }}>
      {children}
    </EVMAuthContext.Provider>
  );
}
