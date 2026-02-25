'use client';

import { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/context/SocketContext';
import { useAudio } from '@/context/AudioContext';
import { CHARACTERS } from '@/lib/assetMap';
import ChatView from '@/components/SidePanel/ChatView';
import { preloadAllMinigameBackgrounds } from '@/components/Minigames/MinigameOverlay';

interface QuickPlayLobbyProps {
  onLeave: () => void;
  onGameStart: () => void;
}

export default function QuickPlayLobby({ onLeave, onGameStart }: QuickPlayLobbyProps) {
  const { roomState, leaveRoom, chatMessages, sendChat } = useSocket();
  const { play } = useAudio();
  const [countdown, setCountdown] = useState<number | null>(null);
  const prevPlayerCount = useRef(0);

  // Preload minigame backgrounds while players wait in lobby
  useEffect(() => { preloadAllMinigameBackgrounds(); }, []);

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

  if (!roomState) return null;

  const maxPlayers = 6;
  const playerCount = roomState.players.length;
  const emptySlots = maxPlayers - playerCount;
  const buyIn = (roomState as any).buyInEth || '?';
  const depositedCount = roomState.players.filter((p: any) => p.deposited).length;

  const handleLeave = () => {
    leaveRoom();
    onLeave();
  };

  return (
    <div className="setupScreen">
      <div className="setupCard quickPlayLobbyCard">
        <h1 className="setupTitle marqueeTitle">Quick Play</h1>
        <div className="qpTierBadge">{buyIn} ETH</div>
        <p className="qpPlayerCount">{depositedCount}/{maxPlayers} Players Deposited</p>

        <div className="qpPlayerList">
          {roomState.players.map((p: any, i: number) => {
            const char = p.characterId
              ? CHARACTERS.find(c => c.id === p.characterId)
              : CHARACTERS.find(c => c.color === p.color);
            return (
              <div key={i} className={`qpPlayerSlot qpPlayerFilled ${p.isYou ? 'qpPlayerYou' : ''}`}>
                <div className="qpPlayerSprite" style={{ background: p.color }}>
                  {char && <img src={char.sprite} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' as any }} />}
                </div>
                <div className="qpPlayerInfo">
                  <span className="qpPlayerName">{p.name}</span>
                  {char && (
                    <span className="qpPlayerBuff">{char.buff.name} — {char.buff.description}</span>
                  )}
                </div>
                <span className="qpPlayerStatus">
                  {p.deposited ? '💰' : '...'}
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

        {countdown !== null && (
          <div className={`qpCountdown ${countdown <= 5 ? 'qpCountdownUrgent' : ''}`}>
            ⏱ Starting in: <span className="qpCountdownNum">{countdown}s</span>
          </div>
        )}

        {countdown === null && (
          <p className="qpStatusMsg" style={{ opacity: 0.7 }}>
            {depositedCount < 4
              ? `Waiting for ${4 - depositedCount} more player${4 - depositedCount > 1 ? 's' : ''} to join & deposit...`
              : 'Enough players — starting soon!'}
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
