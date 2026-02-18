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
  const { connected: solConnected, publicKey } = useWallet();
  const { setVisible: setSolanaModalVisible } = useWalletModal();
  const { openConnectModal } = useConnectModal();
  const { isConnected: evmConnected, address: evmAddress } = useAccount();
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [pendingChain, setPendingChain] = useState<Chain | null>(null);

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
        <div className="connectDice">&#x1F3B2;</div>
        <h1 className="connectTitle">MONOPOLY CASINO</h1>
        <p className="connectTagline">Stake crypto. Roll dice. Win the pot.</p>

        <div className="connectChainPicker">
          <button
            className="connectBtn connectBtnBase"
            onClick={handleBase}
            disabled={connecting}
          >
            {connecting && pendingChain === 'base' ? 'CONNECTING...' : 'CONNECT WITH BASE'}
          </button>
          <button
            className="connectBtn connectBtnSolana"
            disabled
            style={{ opacity: 0.4, cursor: 'not-allowed' }}
          >
            CONNECT WITH SOLANA (COMING SOON)
          </button>
        </div>

        {error && <p className="connectError">{error}</p>}
        {onFreePlay && (
          <button className="lobbyBackBtn" onClick={onFreePlay} style={{ marginTop: 16 }}>
            Play for Free
          </button>
        )}
        <p className="connectChain">Base (ETH) &bull; Solana (SOL)</p>
      </div>
    </div>
  );
}
