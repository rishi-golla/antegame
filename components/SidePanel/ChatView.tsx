'use client';

import { useState } from 'react';

interface ChatMessage {
  from: string;
  color: string;
  text: string;
}

// Placeholder chat - will be real in multiplayer batch
const staticMessages: ChatMessage[] = [
  { from: 'Ava', color: '#ff6b6b', text: 'I am buying Boardwalk!' },
  { from: 'Kai', color: '#5cd6c0', text: 'Nooo, that is expensive.' },
  { from: 'Maya', color: '#ffd166', text: 'Rent time soon.' },
  { from: 'Leo', color: '#8fb8ff', text: 'Rolling big next turn.' },
];

export default function ChatView() {
  const [input, setInput] = useState('');

  return (
    <div className="sideContent chatContent">
      <div className="feed chatFeed">
        {staticMessages.map((message, i) => (
          <div key={i} className="bubble" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="bubbleAvatar" style={{ background: message.color }}>
              {message.from[0]}
            </div>
            <div className="bubbleText">
              <strong style={{ color: message.color }}>{message.from}</strong>
              <p>{message.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="inputRow">
        <input
          placeholder="Drop a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button>Send</button>
      </div>
    </div>
  );
}
