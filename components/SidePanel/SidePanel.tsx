'use client';

import { useState } from 'react';
import ChatView from './ChatView';
import GameLogView from './GameLogView';
import type { ChatMessage } from '@/server/types';

interface SidePanelProps {
  chatMessages?: ChatMessage[];
  onSendChat?: (text: string) => void;
}

export default function SidePanel({ chatMessages = [], onSendChat }: SidePanelProps) {
  const [mode, setMode] = useState<'chat' | 'log'>('log');

  const handleSend = (text: string) => {
    if (onSendChat) {
      onSendChat(text);
    }
  };

  return (
    <aside className="rightPanel panel">
      <div className="toggleRow">
        <button className={mode === 'chat' ? 'active' : ''} onClick={() => setMode('chat')}>
          Chat
        </button>
        <button className={mode === 'log' ? 'active' : ''} onClick={() => setMode('log')}>
          Game Log
        </button>
      </div>
      <div className="rightPanelBody">
        {mode === 'chat' ? (
          <ChatView messages={chatMessages} onSend={handleSend} />
        ) : (
          <GameLogView />
        )}
      </div>
    </aside>
  );
}
