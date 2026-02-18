'use client';

import { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/context/SocketContext';
import { useAudio } from '@/context/AudioContext';
import { useMultiChain } from '@/context/MultiChainContext';

interface RoomLobbyProps {
  onLeave?: () => void;
}

export default function RoomLobby({ onLeave }: RoomLobbyProps) {
  const { roomState, toggleReady, startGame, leaveRoom, sendChat, chatMessages } = useSocket();
  const { play } = useAudio();
  const [chatInput, setChatInput] = useState('');
  const prevPlayerCountRef = useRef(0);
  const [startError, setStartError] = useState('');
  const [copied, setCopied] = useState(false);

  const { activeChain } = useMultiChain();

  // Detect new player joining
  useEffect(() => {
    if (!roomState) return;
    if (prevPlayerCountRef.current > 0 && roomState.players.length > prevPlayerCountRef.current) {
      play('sfx/player-join');
    }
    prevPlayerCountRef.current = roomState.players.length;
  }, [roomState?.players.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!roomState) return null;

  const me = roomState.players.find((p) => p.isYou);
  const isBase = activeChain === 'base';
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

  const [linkCopied, setLinkCopied] = useState(false);
  const handleCopyLink = () => {
    const myWallet = me?.walletAddress ?? '';
    const refParam = myWallet ? `&ref=${myWallet}` : '';
    const url = `${window.location.origin}/join?room=${roomState.code}${refParam}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className="setupScreen">
      <div className="lobbyCard vipRoom">
        <div className="lobbyHeader vipHeader">
          <h1 className="setupTitle marqueeTitle">VIP Lounge</h1>
          <div className="lobbyCode vipTableCode" onClick={handleCopyCode} title="Click to copy">
            Table #{roomState.code}
            {copied && <span className="copiedToast">Copied!</span>}
          </div>
          <p className="setupSubtitle casinoSubtitle">Share this table number with friends</p>
          <button className="copyLinkBtn" onClick={handleCopyLink}>
            {linkCopied ? '✓ Link Copied!' : '🔗 Copy Invite Link'}
          </button>
          {roomState.entryFeeLamports > 0 && !isBase && (
            <div className="lobbyEntryBanner">
              <span>Entry: {(roomState.entryFeeLamports / 1_000_000_000).toFixed(2)} SOL</span>
              <span className="lobbyPotAmount">
                Pot: {(roomState.potLamports / 1_000_000_000).toFixed(2)} SOL
              </span>
            </div>
          )}
          {roomState.isOnChain && roomState.buyInEth && (
            <div className="lobbyEntryBanner">
              <span>Buy-in: {roomState.buyInEth} ETH (Base)</span>
            </div>
          )}
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
                  {roomState.entryFeeLamports > 0 && (
                    <span className={`lobbyDepositDot ${player.deposited ? 'deposited' : ''}`}>
                      {player.deposited ? '✓ Paid' : 'Unpaid'}
                    </span>
                  )}
                  <span className={`lobbyReadyDot ${player.ready ? 'ready' : ''}`}>
                    {player.ready ? 'Ready' : 'Not Ready'}
                  </span>
                </div>
              ))}
            </div>

            <div className="lobbyActions">
              <button className="setupStartBtn" onClick={() => { play('sfx/ready-up'); toggleReady(); }} style={{ fontSize: '0.9rem', padding: '10px 16px' }}>
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
