'use client';

import { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/context/SocketContext';
import { useAudio } from '@/context/AudioContext';
import { CHARACTERS } from '@/lib/assetMap';
import ChatView from '@/components/SidePanel/ChatView';

interface QuickPlayLobbyProps {
  onLeave: () => void;
  onGameStart: () => void;
}

export default function QuickPlayLobby({ onLeave, onGameStart }: QuickPlayLobbyProps) {
  const { roomState, leaveRoom, chatMessages, sendChat } = useSocket();
  const { play } = useAudio();
  const [countdown, setCountdown] = useState<number | null>(null);
  const prevPlayerCount = useRef(0);

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
      play('sfx/game-over'); // reuse as match-start fanfare for now
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

  const handleLeave = () => {
    leaveRoom();
    onLeave();
  };

  return (
    <div className="setupScreen">
      <div className="setupCard quickPlayLobbyCard">
        <h1 className="setupTitle marqueeTitle">Quick Play</h1>
        <div className="qpTierBadge">{buyIn} ETH</div>
        <p className="qpPlayerCount">{playerCount}/{maxPlayers} Players</p>

        <div className="qpPlayerList">
          {roomState.players.map((p, i) => {
            const char = CHARACTERS.find(c => c.color === p.color);
            return (
              <div key={i} className={`qpPlayerSlot qpPlayerFilled ${p.isYou ? 'qpPlayerYou' : ''}`}>
                <div className="qpPlayerSprite" style={{ background: p.color }}>
                  {char && <img src={char.sprite} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' as any }} />}
                </div>
                <span className="qpPlayerName">{p.name}</span>
                <span className="qpPlayerStatus">
                  {p.ready ? '✓' : '⏳'}
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

        {countdown === null && playerCount < 4 && (
          <p className="qpStatusMsg">
            {playerCount === 1 && 'Waiting for players...'}
            {playerCount === 2 && 'Found a challenger! Need 2 more...'}
            {playerCount === 3 && 'Almost there! 1 more player...'}
          </p>
        )}

        {countdown === null && playerCount >= 4 && (
          <p className="qpStatusMsg qpStatusReady">Ready to start!</p>
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
