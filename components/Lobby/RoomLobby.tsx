'use client';

import { useState } from 'react';
import { useSocket } from '@/context/SocketContext';

interface RoomLobbyProps {
  onLeave?: () => void;
}

export default function RoomLobby({ onLeave }: RoomLobbyProps) {
  const { roomState, toggleReady, startGame, leaveRoom, sendChat, chatMessages } = useSocket();
  const [chatInput, setChatInput] = useState('');
  const [startError, setStartError] = useState('');
  const [copied, setCopied] = useState(false);

  if (!roomState) return null;

  const me = roomState.players.find((p) => p.isYou);
  const isHost = me?.isHost ?? false;
  const allReady = roomState.players.every((p) => p.ready);

  const handleStart = async () => {
    setStartError('');
    const result = await startGame();
    if (!result.ok) {
      setStartError(result.error ?? 'Failed to start');
    }
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim());
    setChatInput('');
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomState.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="setupScreen">
      <div className="lobbyCard">
        <div className="lobbyHeader">
          <h1 className="setupTitle">Room Lobby</h1>
          <div className="lobbyCode" onClick={handleCopyCode} title="Click to copy">
            {roomState.code}
            {copied && <span className="copiedToast">Copied!</span>}
          </div>
          <p className="setupSubtitle">Share this code with friends</p>
        </div>

        <div className="lobbyContent">
          <div className="lobbyPlayers">
            <h3>Players ({roomState.players.length}/{roomState.maxPlayers})</h3>
            <div className="lobbyPlayerList">
              {roomState.players.map((player, i) => (
                <div key={i} className={`lobbyPlayer ${player.isYou ? 'lobbyPlayerYou' : ''}`}>
                  <div className="setupPlayerColor" style={{ background: player.color, width: 32, height: 32, fontSize: '0.8rem' }}>
                    {player.name[0]}
                  </div>
                  <span className="lobbyPlayerName">
                    {player.name}
                    {player.isHost && <span className="lobbyHostBadge">HOST</span>}
                    {player.isYou && <span className="lobbyYouBadge">YOU</span>}
                  </span>
                  <span className={`lobbyReadyDot ${player.ready ? 'ready' : ''}`}>
                    {player.ready ? 'Ready' : 'Not Ready'}
                  </span>
                </div>
              ))}
            </div>

            <div className="lobbyActions">
              <button className="setupStartBtn" onClick={toggleReady} style={{ fontSize: '0.9rem', padding: '10px 16px' }}>
                {me?.ready ? 'Unready' : 'Ready Up'}
              </button>
              {isHost && (
                <button
                  className="setupStartBtn"
                  onClick={handleStart}
                  disabled={!allReady || roomState.players.length < 2}
                  style={{ fontSize: '0.9rem', padding: '10px 16px' }}
                >
                  Start Game
                </button>
              )}
              <button className="lobbyBackBtn" onClick={onLeave ?? leaveRoom}>Leave</button>
            </div>
            {startError && <p className="lobbyError">{startError}</p>}
          </div>

          <div className="lobbyChat">
            <h3>Chat</h3>
            <div className="feed chatFeed lobbyChatFeed">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`bubble ${msg.system ? 'systemBubble' : ''}`}>
                  {!msg.system && (
                    <div className="bubbleAvatar" style={{ background: msg.senderColor, width: 28, height: 28, fontSize: '0.7rem' }}>
                      {msg.senderName[0]}
                    </div>
                  )}
                  <div className="bubbleText">
                    {!msg.system && <strong style={{ color: msg.senderColor, fontSize: '0.78rem' }}>{msg.senderName}</strong>}
                    <p style={{ fontSize: msg.system ? '0.72rem' : '0.82rem', fontStyle: msg.system ? 'italic' : 'normal' }}>{msg.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="inputRow">
              <input
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              />
              <button onClick={handleSendChat}>Send</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
