'use client';

import { useState } from 'react';
import ChatView from './ChatView';
import GameLogView from './GameLogView';

export default function SidePanel() {
  const [mode, setMode] = useState<'chat' | 'log'>('log');

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
        {mode === 'chat' ? <ChatView /> : <GameLogView />}
      </div>
    </aside>
  );
}
