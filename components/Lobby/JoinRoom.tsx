'use client';

import { useState, useEffect } from 'react';
import { useSocket } from '@/context/SocketContext';
import { useMultiChain } from '@/context/MultiChainContext';
import { CHARACTERS } from '@/lib/assetMap';
import { useWalletClient, useBalance, useAccount, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import { joinGameOnChain, getGameOnChain, formatEther } from '@/lib/contracts/monopolyGame';
import { getChainId } from '@/lib/contracts/addresses';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { wagmiConfig } from '@/context/EVMWalletContext';
import { useConnectModal } from '@rainbow-me/rainbowkit';

const TX_RECEIPT_TIMEOUT = 60_000; // 60 seconds

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

interface JoinRoomProps {
  onJoined: () => void;
  onBack: () => void;
  initialCode?: string;
}

export default function JoinRoom({ onJoined, onBack, initialCode }: JoinRoomProps) {
  const { joinRoom } = useSocket();
  const { user, activeChain } = useMultiChain();
  const { data: walletClient } = useWalletClient();
  const { isConnected: evmConnected, address: connectedAddress } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const targetChainId = getChainId();
  const { data: balance } = useBalance({
    address: connectedAddress,
    chainId: getChainId(),
  });

  const [name, setName] = useState(user?.displayName ?? '');
  const [code, setCode] = useState(initialCode ?? '');
  const [selectedChar, setSelectedChar] = useState(
    user?.characterId ?? CHARACTERS[1].id
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [buyInDisplay, setBuyInDisplay] = useState<string | null>(null);
  const [pendingReconnect, setPendingReconnect] = useState(false);

  const char = CHARACTERS.find((c) => c.id === selectedChar) ?? CHARACTERS[1];
  const isBase = activeChain === 'base';
  const balanceEth = balance ? parseFloat(balance.formatted) : 0;

  // After disconnect completes, open connect modal
  useEffect(() => {
    if (pendingReconnect && !evmConnected && openConnectModal) {
      setPendingReconnect(false);
      openConnectModal();
    }
  }, [pendingReconnect, evmConnected, openConnectModal]);

  // Base chain users MUST have a wallet connected
  const walletReady = !isBase || (evmConnected && walletClient);

  const handleJoin = async () => {
    const playerName = name.trim() || user?.displayName || 'Player';
    if (!code.trim() || code.trim().length !== 6) {
      setError('Enter a 6-character room code');
      return;
    }
    setLoading(true);
    setError('');
    setStatus('');

    try {
      const roomCode = code.trim().toUpperCase();

      if (isBase) {
        // Wallet MUST be connected for Base chain — no exceptions
        if (!walletClient || !evmConnected) {
          setError('Wallet not connected. Please reconnect your wallet.');
          if (openConnectModal) {
            openConnectModal();
          } else {
            setPendingReconnect(true);
            wagmiDisconnect();
          }
          setLoading(false);
          return;
        }

        // Step 0a: Switch to correct chain if needed
        if (currentChainId !== targetChainId) {
          setStatus('Switching network...');
          try {
            await switchChainAsync({ chainId: targetChainId });
          } catch {
            setError(`Please switch your wallet to Base (chain ${targetChainId})`);
            setLoading(false);
            return;
          }
        }

        // Step 0b: Validate color/room on server BEFORE depositing
        setStatus('Validating...');
        const { getSocket } = await import('@/lib/socket');
        const validation = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
          getSocket().emit('room:validate-join' as any, { code: roomCode, color: char.color, characterId: selectedChar }, resolve);
        });
        if (!validation.ok) {
          setError(validation.error ?? 'Cannot join room');
          setLoading(false);
          return;
        }

        // Step 1: Check game on-chain and get buy-in
        setStatus('Checking game...');
        const game = await getGameOnChain(roomCode);
        if (!game || game.buyIn === BigInt(0)) {
          setError('No on-chain game found for this room. The host may not have deposited yet.');
          setLoading(false);
          return;
        }

        const buyInEth = formatEther(game.buyIn);
        setBuyInDisplay(buyInEth);

        // Check if player already deposited on-chain (e.g. retry after non-color error)
        const alreadyDeposited = game.players.some(
          (addr) => addr.toLowerCase() === user?.walletAddress?.toLowerCase()
        );

        let txHash: string | undefined;

        if (alreadyDeposited) {
          setStatus('Deposit already confirmed on-chain. Joining room...');
        } else {
          if (balanceEth < parseFloat(buyInEth)) {
            setError(`Insufficient balance. Need ${buyInEth} ETH, have ${balanceEth.toFixed(4)} ETH`);
            setLoading(false);
            return;
          }

          // Step 2: Join on-chain — send deposit
          setStatus(`Waiting for wallet approval (${buyInEth} ETH)...`);
          try {
            txHash = await joinGameOnChain(walletClient, roomCode, buyInEth);
          } catch (err: any) {
            throw err;
          }

          // Step 3: Wait for on-chain confirmation with timeout
          setStatus('Confirming on-chain...');
          const receipt = await Promise.race([
            waitForTransactionReceipt(wagmiConfig, { hash: txHash as `0x${string}` }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Transaction confirmation timed out. Check your wallet for status.')), TX_RECEIPT_TIMEOUT)
            ),
          ]);
          if (receipt.status === 'reverted') {
            throw new Error('Transaction reverted on-chain. You were not charged.');
          }

          setStatus('Deposit confirmed! Joining room...');
        }

        // Step 4: On-chain deposit CONFIRMED — now join the server room
        const result = await joinRoom(roomCode, playerName, char.color, {
          walletAddress: user?.walletAddress,
          characterId: selectedChar,
        });
        if (!result.ok) {
          setError(result.error ?? 'Failed to join room');
          setLoading(false);
          return;
        }

        // Step 5: Notify server of confirmed deposit
        const { getSocket: getSocket2 } = await import('@/lib/socket');
        await new Promise<void>((resolve) => {
          getSocket2().emit('room:base-deposit' as any, { txHash }, () => resolve());
        });

        onJoined();
      } else {
        // Non-Base flow (Solana or free play)
        const result = await joinRoom(roomCode, playerName, char.color, { characterId: selectedChar });
        if (result.ok) {
          onJoined();
        } else {
          setError(result.error ?? 'Failed to join room');
        }
      }
    } catch (err: any) {
      if (err.message?.includes('User rejected') || err.message?.includes('denied')) {
        setError('Transaction cancelled');
      } else {
        setError(err.shortMessage ?? err.message ?? 'Transaction failed');
      }
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  return (
    <div className="setupScreen">
      <div className="setupCard">
        <h1 className="setupTitle marqueeTitle">Join Room</h1>
        <p className="setupSubtitle casinoSubtitle">Pick your character</p>
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

        <input
          className="setupPlayerInput lobbyCodeInput"
          placeholder="ROOM CODE"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.15em', marginBottom: 16 }}
        />

        {isBase && (
          <p style={{ fontSize: '0.7rem', opacity: 0.7, textAlign: 'center' }}>
            Balance: {balanceEth.toFixed(4)} ETH
            {buyInDisplay && <span> | Buy-in: {buyInDisplay} ETH</span>}
          </p>
        )}

        {isBase && !walletReady && (
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

        <button className="setupStartBtn" onClick={handleJoin} disabled={loading || (isBase && !walletReady)}>
          {loading ? status || 'Joining...' : 'Join Room'}
        </button>
        <button className="lobbyBackBtn" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
