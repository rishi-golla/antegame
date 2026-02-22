'use client';

import { useGame } from '@/context/GameContext';
import React, { useEffect, useRef } from 'react';

type LogStyle = {
  icon: string;
  color: string;
  accent?: string;
};

function classifyLog(message: string): LogStyle {
  const m = message.toLowerCase();
  
  if (m.includes('rolled') && m.includes('doubles'))
    return { icon: '⬡', color: '#fbbf24', accent: 'var(--gold-bright)' };
  if (m.includes('rolled'))
    return { icon: '⬡', color: 'var(--ink-secondary)' };
  if (m.includes('bought'))
    return { icon: '◆', color: '#4ade80' };
  if (m.includes('passed go') || m.includes('collected'))
    return { icon: '→', color: '#4ade80', accent: '#4ade80' };
  if (m.includes('paid') && m.includes('rent'))
    return { icon: '−', color: '#f87171' };
  if (m.includes('paid') || m.includes('tax'))
    return { icon: '−', color: '#fb923c' };
  if (m.includes('jail') || m.includes('sent to'))
    return { icon: '⊘', color: '#f87171', accent: '#ef4444' };
  if (m.includes('declined'))
    return { icon: '✕', color: 'var(--muted)' };
  if (m.includes('drew'))
    return { icon: '▣', color: '#c084fc' };
  if (m.includes('minigame') || m.includes('jackpot'))
    return { icon: '★', color: '#fbbf24', accent: 'var(--gold-bright)' };
  if (m.includes('bankrupt'))
    return { icon: '☠', color: '#ef4444', accent: '#dc2626' };
  if (m.includes('mortgage'))
    return { icon: '▤', color: '#f59e0b' };
  if (m.includes('built') || m.includes('house'))
    return { icon: '▲', color: '#22c55e' };
  if (m.includes('won') || m.includes('wins'))
    return { icon: '♛', color: '#fbbf24', accent: 'var(--gold-bright)' };
  if (m.includes('landed'))
    return { icon: '●', color: 'var(--ink-dim)' };
  if (m.includes('game started'))
    return { icon: '►', color: 'var(--gold-bright)' };
  if (m.includes('trade'))
    return { icon: '⇄', color: '#60a5fa' };
  if (m.includes('owes'))
    return { icon: '!', color: '#f87171' };
    
  return { icon: '·', color: 'var(--ink-secondary)' };
}

function highlightMessage(message: string, players: { name: string; color: string }[]): React.ReactElement[] {
  // Highlight player names and dollar amounts
  const parts: React.ReactElement[] = [];
  let remaining = message;
  let key = 0;

  // Build regex for player names and $amounts
  const playerNames = players.map(p => p.name).filter(Boolean);
  const namePattern = playerNames.length > 0 
    ? playerNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
    : null;
  const moneyPattern = /\$[\d,]+/g;
  
  const combinedPattern = namePattern 
    ? new RegExp(`(${namePattern}|\\$[\\d,]+)`, 'g')
    : moneyPattern;

  let match;
  let lastIndex = 0;
  const regex = new RegExp(combinedPattern);
  
  // Use matchAll for safe iteration
  const matches = [...remaining.matchAll(new RegExp(combinedPattern, 'g'))];
  
  for (const match of matches) {
    const before = remaining.slice(lastIndex, match.index);
    if (before) parts.push(<span key={key++}>{before}</span>);
    
    const matched = match[0];
    const player = players.find(p => p.name === matched);
    
    if (player) {
      parts.push(
        <span key={key++} style={{ color: player.color, fontWeight: 700 }}>{matched}</span>
      );
    } else if (matched.startsWith('$')) {
      parts.push(
        <span key={key++} className="logMoney">{matched}</span>
      );
    }
    
    lastIndex = (match.index ?? 0) + matched.length;
  }
  
  const tail = remaining.slice(lastIndex);
  if (tail) parts.push(<span key={key++}>{tail}</span>);
  
  return parts.length > 0 ? parts : [<span key={0}>{message}</span>];
}

export default function GameLogView() {
  const { state } = useGame();
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [state.log.length]);

  const players = state.players.map(p => ({ name: p.name, color: p.color }));

  return (
    <div className="sideContent">
      <div className="feed logFeed" ref={feedRef}>
        {state.log.map((entry, i) => {
          const style = classifyLog(entry.message);
          return (
            <div
              key={i}
              className={`logEntry ${style.accent ? 'logEntryAccent' : ''}`}
              style={{
                animationDelay: `${Math.min(i, 5) * 50}ms`,
                borderLeftColor: style.accent || 'transparent',
              }}
            >
              <span className="logIcon" style={{ color: style.color }}>{style.icon}</span>
              <span className="logText" style={{ color: style.color }}>
                {highlightMessage(entry.message, players)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
