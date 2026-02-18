'use client';

import { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/context/SocketContext';
import { useAudio } from '@/context/AudioContext';
import { useMultiChain } from '@/context/MultiChainContext';
import { CHARACTERS } from '@/lib/assetMap';
import { createGameOnChain, joinGameOnChain } from '@/lib/contracts/monopolyGame';
import { useWalletClient } from 'wagmi';
import { waitForTransactionReceipt } from '@wagmi/core';
import { wagmiConfig } from '@/context/EVMWalletContext';
import ChatView from '@/components/SidePanel/ChatView';

const TX_RECEIPT_TIMEOUT = 60_000;

interface QuickPlayLobbyProps {
  onLeave: () => void;
  onGameStart: () => void;
}

export default function QuickPlayLobby({ onLeave, onGameStart }: QuickPlayLobbyProps) {
  const { roomState, leaveRoom, chatMessages, sendChat } = useSocket();
  const { play } = useAudio();
  const { user } = useMultiChain();
  const { data: walletClient } = useWalletClient();
  const [countdown, setCountdown] = useState<number | null>(null);
  const [depositStatus, setDepositStatus] = useState<'pending' | 'depositing' | 'confirmed'>('pending');
  const [depositError, setDepositError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const prevPlayerCount = useRef(0);

  // Detect if I'm the room creator (first player / host)
  const myPlayer = roomState?.players.find(p => p.isYou);
  const isHost = roomState?.players[0]?.isYou ?? false;
  const roomCode = (roomState as any)?.code || '';
  const buyIn = (roomState as any)?.buyInEth || '0';
  const maxPlayers = 6;

  // Check if already deposited (reconnection case)
  useEffect(() => {
    if (myPlayer && (myPlayer as any).deposited) {
      setDepositStatus('confirmed');
    }
  }, [myPlayer]);

  // Listen for countdown events
  useEffect(() => {
    const { getSocket } = require('@/lib/socket');
    const socket = getSocket();

    const onCountdown = (data: { remaining: number; total: number }) => {
      setCountdown(data.remaining);
      if (data.remaining <= 5 && data.remaining > 0) {
        play('sfx/countdown');
      }
    };

    const onCountdownCancel = () => {
      setCountdown(null);
    };

    socket.on('quickplay:countdown', onCountdown);
    socket.on('quickplay:countdown-cancel', onCountdownCancel);

    return () => {
      socket.off('quickplay:countdown', onCountdown);
      socket.off('quickplay:countdown-cancel', onCountdownCancel);
    };
  }, [play]);

  // Detect game start
  useEffect(() => {
    if (roomState?.phase === 'playing') {
      play('sfx/game-over');
      onGameStart();
    }
  }, [roomState?.phase, onGameStart, play]);

  // Player join sound
  useEffect(() => {
    if (!roomState) return;
    const count = roomState.players.length;
    if (count > prevPlayerCount.current && prevPlayerCount.current > 0) {
      play('sfx/player-join');
    }
    prevPlayerCount.current = count;
  }, [roomState?.players.length, play]);

  const handleDeposit = async () => {
    if (!walletClient || !roomCode || !buyIn) return;
    setDepositStatus('depositing');
    setDepositError('');

    try {
      // Host creates game on-chain, others join
      let txHash: string;
      if (isHost) {
        setStatusMsg('Creating game on-chain...');
        txHash = await createGameOnChain(walletClient, roomCode, maxPlayers, buyIn);
      } else {
        setStatusMsg('Joining game on-chain...');
        txHash = await joinGameOnChain(walletClient, roomCode, buyIn);
      }

      // Wait for confirmation
      setStatusMsg('Confirming transaction...');
      const receipt = await Promise.race([
        waitForTransactionReceipt(wagmiConfig, { hash: txHash as `0x${string}` }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Transaction timed out. Check your wallet.')), TX_RECEIPT_TIMEOUT)
        ),
      ]);

      if (receipt.status === 'reverted') {
        throw new Error('Transaction reverted on-chain');
      }

      // Notify server
      setStatusMsg('Deposit confirmed!');
      const { getSocket } = await import('@/lib/socket');
      await new Promise<void>((resolve) => {
        getSocket().emit('room:base-deposit' as any, { txHash }, () => resolve());
      });

      setDepositStatus('confirmed');
      setStatusMsg('');
      play('sfx/coin');
    } catch (err: any) {
      setDepositStatus('pending');
      setDepositError(err?.shortMessage || err?.message || 'Deposit failed');
      setStatusMsg('');
    }
  };

  const handleLeave = () => {
    leaveRoom();
    onLeave();
  };

  if (!roomState) return null;

  const playerCount = roomState.players.length;
  const emptySlots = maxPlayers - playerCount;
  const depositedCount = roomState.players.filter((p: any) => p.deposited).length;

  return (
    <div className="setupScreen">
      <div className="setupCard quickPlayLobbyCard">
        <h1 className="setupTitle marqueeTitle">Quick Play</h1>
        <div className="qpTierBadge">{buyIn} ETH</div>
        <p className="qpPlayerCount">{playerCount}/{maxPlayers} Players</p>

        <div className="qpPlayerList">
          {roomState.players.map((p: any, i: number) => {
            const char = CHARACTERS.find(c => c.color === p.color);
            return (
              <div key={i} className={`qpPlayerSlot qpPlayerFilled ${p.isYou ? 'qpPlayerYou' : ''}`}>
                <div className="qpPlayerSprite" style={{ background: p.color }}>
                  {char && <img src={char.sprite} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' as any }} />}
                </div>
                <span className="qpPlayerName">{p.name}</span>
                <span className="qpPlayerStatus">
                  {p.deposited ? '💰' : '⏳'}
                </span>
              </div>
            );
          })}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <div key={`empty-${i}`} className="qpPlayerSlot qpPlayerEmpty">
              <div className="qpPlayerSprite qpEmptySprite" />
              <span className="qpPlayerName" style={{ opacity: 0.3 }}>Waiting...</span>
            </div>
          ))}
        </div>

        {/* Deposit section */}
        {depositStatus === 'pending' && (
          <button
            className="setupStartBtn"
            onClick={handleDeposit}
            disabled={!walletClient}
          >
            💰 Deposit {buyIn} ETH
          </button>
        )}

        {depositStatus === 'depositing' && (
          <div className="qpStatusMsg" style={{ color: '#d4a843' }}>
            {statusMsg || 'Processing...'}
          </div>
        )}

        {depositStatus === 'confirmed' && (
          <div className="qpStatusMsg" style={{ color: '#4ade80' }}>
            ✅ Deposited — {depositedCount}/{playerCount} ready
          </div>
        )}

        {depositError && (
          <p className="lobbyError">{depositError}</p>
        )}

        {countdown !== null && (
          <div className={`qpCountdown ${countdown <= 5 ? 'qpCountdownUrgent' : ''}`}>
            ⏱ Starting in: <span className="qpCountdownNum">{countdown}s</span>
          </div>
        )}

        {countdown === null && depositStatus === 'confirmed' && (
          <p className="qpStatusMsg" style={{ opacity: 0.7 }}>
            {playerCount < 4
              ? `Waiting for more players to join & deposit (need ${4 - depositedCount} more)...`
              : 'All deposits in — starting soon!'}
          </p>
        )}

        <div className="qpChat">
          <ChatView messages={chatMessages} onSend={sendChat} />
        </div>

        <button className="lobbyBackBtn" onClick={handleLeave}>
          Leave Queue
        </button>
      </div>
    </div>
  );
}
