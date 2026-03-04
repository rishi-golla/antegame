'use client';

import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; message?: string };

export default class AppCrashBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    const msg = error instanceof Error ? error.message : 'Unknown runtime error';
    return { hasError: true, message: msg };
  }

  componentDidCatch(error: unknown) {
    console.error('[AppCrashBoundary]', error);
  }

  handleReload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e8d5b5', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ width: 'min(560px, 92vw)', border: '1px solid rgba(212,175,55,.35)', borderRadius: 14, background: 'rgba(26,15,15,.92)', padding: 20 }}>
          <h2 style={{ margin: 0, fontFamily: 'Cinzel, serif', fontSize: 24 }}>App hit an unexpected error</h2>
          <p style={{ marginTop: 10, opacity: 0.9, fontFamily: 'Nunito, sans-serif' }}>
            We can recover by refreshing. If this keeps happening, send this message to support.
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, opacity: 0.8, background: 'rgba(0,0,0,.35)', padding: 10, borderRadius: 8 }}>
            {this.state.message || 'No error message'}
          </pre>
          <button onClick={this.handleReload} style={{ marginTop: 12, border: '1px solid rgba(255,215,0,.45)', borderRadius: 10, background: 'linear-gradient(180deg,#ffe066,#d4af37)', color: '#2a1800', fontWeight: 800, padding: '10px 14px', cursor: 'pointer' }}>
            Reload App
          </button>
        </div>
      </div>
    );
  }
}
