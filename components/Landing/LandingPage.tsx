'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useAuth } from '@/context/AuthContext';
import { useEVMAuth } from '@/context/EVMAuthContext';
import { useMultiChain, type Chain } from '@/context/MultiChainContext';

import LandingNav from './LandingNav';
import HeroSection from './HeroSection';
import HowItWorks from './HowItWorks';
import FeatureStrip from './FeatureStrip';
import StatsStrip from './StatsStrip';
import CTASection from './CTASection';
import LandingFooter from './LandingFooter';

interface LandingPageProps {
  onFreePlay?: () => void;
}

export default function LandingPage({ onFreePlay }: LandingPageProps) {
  const { connectAndSign: solanaSign } = useAuth();
  const { connectAndSign: evmSign } = useEVMAuth();
  const { setActiveChain } = useMultiChain();
  const { connected: solConnected, publicKey } = useWallet();
  const { setVisible: setSolanaModalVisible } = useWalletModal();
  const { openConnectModal } = useConnectModal();
  const { isConnected: evmConnected, address: evmAddress } = useAccount();
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [pendingChain, setPendingChain] = useState<Chain | null>(null);

  useEffect(() => {
    if (solConnected && publicKey && pendingChain === 'solana') {
      setPendingChain(null);
      setConnecting(true);
      setActiveChain('solana');
      solanaSign()
        .catch((e: any) => setError(e.message || 'Verification failed'))
        .finally(() => setConnecting(false));
    }
  }, [solConnected, publicKey, pendingChain, solanaSign, setActiveChain]);

  useEffect(() => {
    if (evmConnected && evmAddress && pendingChain === 'base') {
      setPendingChain(null);
      setConnecting(true);
      setActiveChain('base');
      evmSign()
        .catch((e: any) => setError(e.message || 'Verification failed'))
        .finally(() => setConnecting(false));
    }
  }, [evmConnected, evmAddress, pendingChain, evmSign, setActiveChain]);

  const handleBase = async () => {
    setError('');
    if (evmConnected && evmAddress) {
      setConnecting(true);
      setActiveChain('base');
      evmSign()
        .catch((e: any) => setError(e.message || 'Verification failed'))
        .finally(() => setConnecting(false));
      return;
    }
    setPendingChain('base');
    openConnectModal?.();
  };

  return (
    <div className="landingPage">
      <LandingNav onConnect={handleBase} connecting={connecting} />
      <HeroSection onConnect={handleBase} onFreePlay={onFreePlay} connecting={connecting} />
      <StatsStrip />
      <HowItWorks />
      <FeatureStrip />
      <CTASection onConnect={handleBase} onFreePlay={onFreePlay} connecting={connecting} />
      <LandingFooter />
      {error && <div className="landingError">{error}</div>}
    </div>
  );
}
