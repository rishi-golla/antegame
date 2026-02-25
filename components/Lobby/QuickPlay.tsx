'use client';

import { useState, useEffect } from 'react';
import { useMultiChain } from '@/context/MultiChainContext';
import { CHARACTERS } from '@/lib/assetMap';
import { useWalletClient, useBalance, useAccount, useSwitchChain, useDisconnect } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { wagmiConfig } from '@/context/EVMWalletContext';
import { getChainId } from '@/lib/contracts/addresses';
import { createGameOnChain, joinGameOnChain } from '@/lib/contracts/monopolyGame';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useChainId } from 'wagmi';

const BUY_IN_OPTIONS = ['0.001', '0.01', '0.05', '0.25', '0.5'];

function CampaignStrip() {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/auth/referrals/campaign')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        if (d.phase === 'boost') setLabel('Referral Boost LIVE -- Earn 50% of house fees!');
        else if (d.phase === 'normal') setLabel('Referral Campaign LIVE -- Earn 10% + compete for 1% lifetime rev');
      })
      .catch(() => {});
  }, []);
  if (!label) return null;
  return <div className="campaignStrip">{label}</div>;
}
const TX_RECEIPT_TIMEOUT = 60_000;

interface QuickPlayProps {
  onMatched: () => void;
  onBack: () => void;
}

export default function QuickPlay({ onMatched, onBack }: QuickPlayProps) {
  const { user, activeChain } = useMultiChain();
  const { data: walletClient } = useWalletClient();
  const { isConnected: evmConnected, address: connectedAddress } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const currentChainId = useChainId();
  const targetChainId = getChainId();
  const wrongChain = currentChainId !== targetChainId;
  const { data: balance, refetch: refetchBalance } = useBalance({
    address: connectedAddress,
    chainId: getChainId(),
    query: { refetchInterval: 10_000, staleTime: 0 },
  });

  // Force refetch on mount (wagmi caches stale 0 from before wallet was ready)
  useEffect(() => {
    if (connectedAddress) {
      const t = setTimeout(() => refetchBalance(), 500);
      return () => clearTimeout(t);
    }
  }, [connectedAddress, refetchBalance]);

  const [name, setName] = useState(user?.displayName ?? '');
  const [selectedChar, setSelectedChar] = useState(
    user?.characterId ?? CHARACTERS[0].id
  );
  const [buyIn, setBuyIn] = useState('0.01');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [pendingReconnect, setPendingReconnect] = useState(false);

  const char = CHARACTERS.find((c) => c.id === selectedChar) ?? CHARACTERS[0];
  const isBase = activeChain === 'base';
  const balanceEth = balance ? parseFloat(balance.formatted) : 0;

  // After disconnect completes, open connect modal
  useEffect(() => {
    if (pendingReconnect && !evmConnected && openConnectModal) {
      setPendingReconnect(false);
      openConnectModal();
    }
  }, [pendingReconnect, evmConnected, openConnectModal]);

  const walletReady = !isBase || (evmConnected && walletClient);

  const handleFindMatch = async () => {
    const playerName = name.trim() || user?.displayName || 'Player';
    if (!walletReady || !walletClient) {
      setError('Wallet not connected.');
      if (openConnectModal) {
        openConnectModal();
      } else {
        setPendingReconnect(true);
        wagmiDisconnect();
      }
      return;
    }
    setLoading(true);
    setError('');

    try {
      // Auto-switch chain if needed
      if (wrongChain) {
        setStatus('Switching network...');
        await switchChainAsync({ chainId: targetChainId });
      }

      const { getSocket } = await import('@/lib/socket');
      const socket = getSocket();

      // Ensure socket is connected
      if (!socket.connected) {
        setStatus('Connecting to server...');
        socket.connect();
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Connection timeout. Try again.')), 8000);
          socket.once('connect', () => { clearTimeout(timeout); resolve(); });
          socket.once('connect_error', (err) => { clearTimeout(timeout); reject(new Error(`Connection failed: ${err.message}`)); });
        });
      }

      // Step 1: Find/create room on server
      setStatus('Finding match...');
      const result = await new Promise<{ ok: boolean; code?: string; isHost?: boolean; error?: string }>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Server did not respond. Try again.')), 10000);
        (socket as any).emit('room:quick-play-base', {
          name: playerName,
          color: char.color,
          buyInEth: buyIn,
          walletAddress: user?.walletAddress,
          characterId: selectedChar,
        }, (res: any) => { clearTimeout(timeout); resolve(res); });
      });

      if (!result.ok || !result.code) {
        throw new Error(result.error ?? 'Failed to find match');
      }

      const roomCode = result.code;
      const isHost = result.isHost ?? false;

      // Step 2: On-chain deposit
      setStatus('Waiting for wallet approval...');
      let txHash: string;
      if (isHost) {
        txHash = await createGameOnChain(walletClient, roomCode, 6, buyIn);
      } else {
        txHash = await joinGameOnChain(walletClient, roomCode, buyIn);
      }

      // Step 3: Wait for tx confirmation
      setStatus('Confirming on-chain...');
      const receipt = await Promise.race([
        waitForTransactionReceipt(wagmiConfig, { hash: txHash as `0x${string}` }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Transaction timed out. Check your wallet.')), TX_RECEIPT_TIMEOUT)
        ),
      ]);

      if (receipt.status === 'reverted') {
        socket.emit('room:leave');
        throw new Error('Transaction reverted on-chain');
      }

      // Step 4: Notify server deposit confirmed
      setStatus('Deposit confirmed! Entering lobby...');
      await new Promise<void>((resolve) => {
        (socket as any).emit('room:base-deposit', { txHash }, () => resolve());
      });

      onMatched();
    } catch (err: any) {
      // If user rejected or tx failed, leave the room so slot is freed
      try {
        const { getSocket } = await import('@/lib/socket');
        getSocket().emit('room:leave');
      } catch {}
      setError(err?.shortMessage || err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  return (
    <div className="setupScreen">
      <div className="setupCard">
        <h1 className="setupTitle marqueeTitle">Quick Play</h1>
        <p className="setupSubtitle casinoSubtitle">Pick your character & buy-in</p>
        <CampaignStrip />

        <div className="setupPlayerRow" style={{ marginBottom: 16 }}>
          <div
            className="setupPlayerColor casinoChipSelector"
            style={{ background: char.color, overflow: 'hidden' }}
          >
            <img
              src={char.sprite}
              alt={char.name}
              style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' as any }}
            />
          </div>
          <input
            className="setupPlayerInput"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={16}
          />
        </div>

        <div className="characterGrid">
          {CHARACTERS.map((c) => (
            <div
              key={c.id}
              className={`characterCard ${selectedChar === c.id ? 'characterCardSelected' : ''}`}
              onClick={() => setSelectedChar(c.id)}
            >
              <img src={c.sprite} alt={c.name} className="characterCardSprite" draggable={false} />
              <span className="characterCardName">{c.name}</span>
              <span className="characterCardBuff">{c.buff.name}</span>
              <span className="characterCardBuffDesc">{c.buff.description}</span>
            </div>
          ))}
        </div>

        {/* Buy-in selector — Base is the only active chain */}
        <div className="setupPlayerCount">
            <label>Buy-In (ETH)</label>
            <div className="setupCountBtns">
              {BUY_IN_OPTIONS.map((amt) => (
                <button
                  key={amt}
                  className={`setupCountBtn ${buyIn === amt ? 'active' : ''}`}
                  onClick={() => setBuyIn(amt)}
                  disabled={balanceEth < parseFloat(amt)}
                >
                  {amt}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: 4 }}>
              Balance: {balanceEth.toFixed(4)} ETH
              {balanceEth < parseFloat(buyIn) && (
                <span style={{ color: '#ff4444' }}> (insufficient)</span>
              )}
            </p>
          </div>

        {!walletReady && (
          <p className="lobbyError" style={{ color: '#d4a843' }}>
            Wallet not connected.{' '}
            <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => {
              if (openConnectModal) {
                openConnectModal();
              } else if (evmConnected) {
                setPendingReconnect(true);
                wagmiDisconnect();
              }
            }}>
              Reconnect wallet
            </span>
          </p>
        )}
        {error && <p className="lobbyError">{error}</p>}
        {status && <p className="lobbyError" style={{ color: '#d4a843' }}>{status}</p>}

        <button
          className="setupStartBtn"
          onClick={handleFindMatch}
          disabled={loading || (isBase && !walletReady) || (isBase && balanceEth < parseFloat(buyIn))}
        >
          {loading ? status || 'Processing...' : `Find Match (${buyIn} ETH)`}
        </button>
        <button className="lobbyBackBtn" onClick={onBack} disabled={loading}>Back</button>
      </div>
    </div>
  );
}
