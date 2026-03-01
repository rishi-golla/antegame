'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useAuth } from '@/context/AuthContext';
import { useEVMAuth } from '@/context/EVMAuthContext';
import { useMultiChain, type Chain } from '@/context/MultiChainContext';

export default function ConnectScreen({ onFreePlay }: { onFreePlay?: () => void }) {
  const { connectAndSign: solanaSign } = useAuth();
  const { connectAndSign: evmSign } = useEVMAuth();
  const { setActiveChain } = useMultiChain();
  const { connected: solConnected, publicKey, wallet, connect } = useWallet();
  const { setVisible: setSolanaModalVisible } = useWalletModal();
  const { openConnectModal } = useConnectModal();
  const { isConnected: evmConnected, address: evmAddress } = useAccount();
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [pendingChain, setPendingChain] = useState<Chain | null>(null);


  // When user picks a wallet from the modal, trigger connect() (autoConnect is off)
  useEffect(() => {
    if (wallet && !solConnected && pendingChain === 'solana') {
      connect().catch((e: any) => {
        setError(e.message || 'Wallet connection failed');
        setPendingChain(null);
      });
    }
  }, [wallet, solConnected, pendingChain, connect]);

  // Auto-sign after Solana wallet connects
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

  // Auto-sign after EVM wallet connects (only when user explicitly chose Base)
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

  const handleSolana = () => {
    setError('');
    if (solConnected && publicKey) {
      setConnecting(true);
      setActiveChain('solana');
      solanaSign()
        .catch((e: any) => setError(e.message || 'Verification failed'))
        .finally(() => setConnecting(false));
    } else {
      setPendingChain('solana');
      setSolanaModalVisible(true);
    }
  };

  const handleBase = async () => {
    setError('');
    // If wallet is already connected (e.g. after hard refresh), just sign directly
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
    <div className="connectScreen">
      <div className="connectCard">
        <img src="/assets/misc/ante-logo.webp" alt="Ante" className="connectLogo" />
        <h1 className="connectTitle">ANTE</h1>
        <p className="connectTagline">Stake crypto. Roll dice. Win the pot.</p>

        <div className="connectChainPicker">
          <button
            className="connectBtn connectBtnBase"
            onClick={handleBase}
            disabled={connecting}
          >
            {connecting && pendingChain === 'base' ? 'Connecting...' : 'Connect with Base'}
          </button>
          <button
            className="connectBtn connectBtnSolana"
            onClick={handleSolana}
            disabled={connecting}
          >
            {connecting && pendingChain === 'solana' ? 'Connecting...' : 'Connect with Solana'}
          </button>
        </div>

        {error && <p className="connectError">{error}</p>}
        {onFreePlay && (
          <button className="connectBtnFreePlay" onClick={onFreePlay}>
            Play for Free
          </button>
        )}
        <p className="connectChain">Base (ETH) &bull; Solana (SOL)</p>
      </div>
    </div>
  );
}
