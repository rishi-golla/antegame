'use client';

import { useState, useEffect, useRef } from 'react';

interface ChatViewProps {
  messages: Array<{
    id: string;
    senderName: string;
    senderColor: string;
    text: string;
    system: boolean;
  }>;
  onSend: (text: string) => void;
}

export default function ChatView({ messages, onSend }: ChatViewProps) {
  const [input, setInput] = useState('');
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div className="sideContent chatContent">
      <div className="feed chatFeed" ref={feedRef}>
        {messages.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.78rem', padding: '20px 0' }}>
            No messages yet. Say something!
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`bubble ${msg.system ? 'systemBubble' : ''}`} style={{ animationDelay: '0ms' }}>
            {!msg.system && (
              <div className="bubbleAvatar" style={{ background: msg.senderColor }}>
                {msg.senderName[0]}
              </div>
            )}
            <div className="bubbleText">
              {!msg.system && <strong style={{ color: msg.senderColor }}>{msg.senderName}</strong>}
              <p style={{ fontStyle: msg.system ? 'italic' : 'normal', color: msg.system ? 'var(--muted)' : '#d5e4ff' }}>
                {msg.text}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="inputRow">
        <input
          placeholder="Drop a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
