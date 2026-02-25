'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';

export interface AuthUser {
  walletAddress: string;
  displayName: string | null;
  characterId: string | null;
  chain: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  connectAndSign: () => Promise<void>;
  disconnect: () => Promise<void>;
  updateProfile: (displayName?: string, characterId?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Check existing session on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const connectAndSign = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signMessage) {
      // Trigger wallet connect
      if (wallet.connect) await wallet.connect();
      if (!wallet.publicKey || !wallet.signMessage) {
        throw new Error('Wallet does not support message signing');
      }
    }

    // Get nonce
    const nonceRes = await fetch('/api/auth/nonce');
    const { nonce } = await nonceRes.json();

    // Sign message
    const message = new TextEncoder().encode(
      `Sign this message to connect to Ante Casino.\n\nNonce: ${nonce}`
    );
    const signature = await wallet.signMessage(message);

    // Extract referral param from URL or sessionStorage fallback
    const urlRef = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('ref')
      : null;
    const ref = urlRef ?? sessionStorage.getItem('ref');
    if (ref) sessionStorage.removeItem('ref');

    // Verify with server
    const verifyRes = await fetch('/api/auth/verify-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: wallet.publicKey.toBase58(),
        signature: bs58.encode(signature),
        nonce,
        chain: 'solana',
        ...(ref ? { ref } : {}),
      }),
    });

    if (!verifyRes.ok) {
      const err = await verifyRes.json();
      throw new Error(err.error || 'Verification failed');
    }

    const data = await verifyRes.json();
    setUser(data.user);
  }, [wallet]);

  const disconnect = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    if (wallet.disconnect) await wallet.disconnect();
  }, [wallet]);

  const updateProfile = useCallback(
    async (displayName?: string, characterId?: string) => {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, characterId }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    },
    []
  );

  return (
    <AuthContext.Provider value={{ user, loading, connectAndSign, disconnect, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
