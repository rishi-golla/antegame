'use client';

import { useState, useEffect, useRef } from 'react';
import { useAudio } from '@/context/AudioContext';

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
  const { play } = useAudio();
  const prevMsgCount = useRef(messages.length);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
    if (messages.length > prevMsgCount.current) {
      play('sfx/chat-message');
    }
    prevMsgCount.current = messages.length;
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <textarea
          placeholder="Drop a message..."
          value={input}
          rows={1}
          onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); e.currentTarget.style.height = 'auto'; } }}
          style={{ resize: 'none', overflow: 'auto', maxHeight: '60px' }}
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
