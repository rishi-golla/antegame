'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';
import { useAudio } from '@/context/AudioContext';
import { useMinigameSync } from '@/hooks/useMinigameSync';

interface HigherLowerProps {
  onResult: (tier: MinigameTier) => void;
  spectator?: boolean;
  baseAmount: number;
  context: MinigameContext;
}

type Suit = '♠' | '♥' | '♦' | '♣';
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

interface Card { rank: Rank; suit: Suit; value: number; }

const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const getRankValue = (rank: Rank): number => {
  if (rank === 'A') return 1;
  if (rank === 'J') return 11;
  if (rank === 'Q') return 12;
  if (rank === 'K') return 13;
  return parseInt(rank);
};

const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit, value: getRankValue(rank) });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
};

const HLStyles = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Nunito:wght@400;600;700&display=swap');

@keyframes hl-spotlight {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

@keyframes hl-cardReveal {
  0% { transform: translateY(60px) scale(0.8); opacity: 0; }
  60% { transform: translateY(-5px) scale(1.02); opacity: 1; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}

@keyframes hl-correctRipple {
  0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.6); }
  100% { box-shadow: 0 0 0 30px rgba(34,197,94,0); }
}

@keyframes hl-wrongShake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
  20%, 40%, 60%, 80% { transform: translateX(4px); }
}

@keyframes hl-neonPulse {
  0%, 100% { text-shadow: 0 0 8px #d4af37, 0 0 16px #d4af37; }
  50% { text-shadow: 0 0 16px #ffd700, 0 0 32px #ffd700, 0 0 48px rgba(255,215,0,0.4); }
}
`;

export default function HigherLower({ onResult, baseAmount, context, spectator = false }: HigherLowerProps) {
  const { play } = useAudio();
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [nextCard, setNextCard] = useState<Card | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [round, setRound] = useState(0);
  const [correctGuesses, setCorrectGuesses] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [lastGuessCorrect, setLastGuessCorrect] = useState<boolean | null>(null);
  const [history, setHistory] = useState<boolean[]>([]);

  const deckRef = useRef<Card[]>([]);
  const roundRef = useRef(0);
  const correctRef = useRef(0);
  const endedRef = useRef(false);
  const currentRef = useRef<Card | null>(null);
  const nextRef = useRef<Card | null>(null);

  const handleRemoteAction = useCallback((data: any) => {
    if (data.type === 'init') {
      const d = data.deck as Card[];
      deckRef.current = d;
      currentRef.current = d[0];
      nextRef.current = d[1];
      setCurrentCard(d[0]);
      setNextCard(d[1]);
    } else if (data.type === 'guess') {
      doGuess(data.isHigher);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { emitAction } = useMinigameSync(spectator, handleRemoteAction);

  useEffect(() => {
    if (!spectator) {
      const d = createDeck();
      deckRef.current = d;
      currentRef.current = d[0];
      nextRef.current = d[1];
      setCurrentCard(d[0]);
      setNextCard(d[1]);
      emitAction({ type: 'init', deck: d });
    }
    const timer = setTimeout(() => {
      if (!endedRef.current) {
        endedRef.current = true;
        onResult('catastrophic');
      }
    }, 30000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doGuess = (isHigher: boolean) => {
    if (endedRef.current) return;
    const cur = currentRef.current;
    const nxt = nextRef.current;
    if (!cur || !nxt) return;

    play('minigames/card-flip');

    let isCorrect: boolean;
    if (nxt.value === cur.value) {
      isCorrect = true;
    } else {
      isCorrect = isHigher ? (nxt.value > cur.value) : (nxt.value < cur.value);
    }

    const newCorrect = correctRef.current + (isCorrect ? 1 : 0);
    correctRef.current = newCorrect;
    setCorrectGuesses(newCorrect);
    setLastGuessCorrect(isCorrect);
    setHistory(prev => [...prev, isCorrect]);

    const r = roundRef.current;

    setRevealed(true);

    if (r === 2) {
      endedRef.current = true;
      setShowResult(true);
      setTimeout(() => {
        if (newCorrect === 3) onResult('win');
        else if (newCorrect === 2) onResult('close-win');
        else if (newCorrect === 1) onResult('close-loss');
        else onResult('catastrophic');
      }, 1500);
    } else {
      setTimeout(() => {
        const newCurrent = nxt;
        const newNext = deckRef.current[r + 2] || null;
        currentRef.current = newCurrent;
        nextRef.current = newNext;
        setCurrentCard(newCurrent);
        setNextCard(newNext);
        setRevealed(false);
        setLastGuessCorrect(null);
        roundRef.current = r + 1;
        setRound(r + 1);
      }, 1500);
    }

    roundRef.current = r + 1;
    setRound(r + 1);
  };

  const makeGuess = (isHigher: boolean) => {
    if (!currentRef.current || !nextRef.current || endedRef.current || spectator || revealed) return;
    emitAction({ type: 'guess', isHigher });
    doGuess(isHigher);
  };

  const isRed = (suit: Suit): boolean => suit === '♥' || suit === '♦';

  const cardStyle = (large: boolean, animClass?: string): React.CSSProperties => ({
    width: large ? '120px' : '90px',
    height: large ? '168px' : '126px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #fffef5, #f5f0e0)',
    border: '2px solid #c9b06b',
    boxShadow: '0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'space-between',
    padding: '6px 8px',
    animation: animClass,
    flexShrink: 0,
  });

  const renderCardFace = (card: Card, large = false, extraStyle?: React.CSSProperties) => {
    const red = isRed(card.suit);
    const color = red ? '#c0392b' : '#1a1a2e';
    const sz = large ? '20px' : '16px';
    const centerSz = large ? '36px' : '28px';

    return (
      <div style={{ ...cardStyle(large), ...extraStyle }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
          <span style={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: sz, color }}>{card.rank}</span>
          <span style={{ fontSize: large ? '18px' : '14px', color }}>{card.suit}</span>
        </div>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: centerSz, color, opacity: 0.8 }}>
          {card.suit}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1, transform: 'rotate(180deg)' }}>
          <span style={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: sz, color }}>{card.rank}</span>
          <span style={{ fontSize: large ? '18px' : '14px', color }}>{card.suit}</span>
        </div>
      </div>
    );
  };

  const cardBackEl = (
    <div style={{
      width: '120px', height: '168px', borderRadius: '10px',
      background: 'repeating-conic-gradient(#3d0f22 0% 25%, #2a0f1f 0% 50%) 50% / 16px 16px',
      border: '2px solid #d4af37',
      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      position: 'relative' as const, overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: '6px', borderRadius: '6px', border: '1px solid #d4af37', background: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(212,175,55,0.08) 8px, rgba(212,175,55,0.08) 16px)' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: '#d4af37', fontSize: '28px', opacity: 0.4 }}>♠</div>
    </div>
  );

  if (!currentCard) return <div style={{ color: '#d4af37', textAlign: 'center', padding: '40px', fontFamily: 'Nunito, sans-serif' }}>Loading...</div>;

  return (
    <div style={{
      position: 'relative', width: '100%', maxWidth: '600px', margin: '0 auto', minHeight: '440px',
      background: 'linear-gradient(180deg, #1a0f0f 0%, #2a0f1f 50%, #1a0f0f 100%)',
      borderRadius: '16px', overflow: 'hidden', fontFamily: 'Nunito, sans-serif',
    }}>
      <style>{HLStyles}</style>

      {/* Spotlight effect */}
      <div style={{
        position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)',
        width: '300px', height: '300px',
        background: 'radial-gradient(ellipse, rgba(212,175,55,0.12) 0%, transparent 70%)',
        pointerEvents: 'none', animation: 'hl-spotlight 3s ease-in-out infinite',
      }} />

      {/* Header */}
      <div style={{ textAlign: 'center', padding: '16px 0 4px' }}>
        <h2 style={{
          fontFamily: 'Cinzel, serif', fontSize: '36px', fontWeight: 900,
          color: '#d4af37', textShadow: '0 0 12px rgba(212,175,55,0.5)',
          margin: 0, letterSpacing: '3px',
        }}>HIGHER OR LOWER</h2>
        <div style={{ fontSize: '16px', color: 'rgba(212,175,55,0.7)', marginTop: '6px', letterSpacing: '1px' }}>
          ROUND {Math.min(round + 1, 3)}/3
        </div>
      </div>

      {/* Streak counter */}
      <div style={{
        textAlign: 'center', margin: '8px 0',
        fontFamily: 'Cinzel, serif', fontSize: '20px', fontWeight: 700,
        color: '#ffd700', letterSpacing: '3px',
        animation: 'hl-neonPulse 2s ease-in-out infinite',
      }}>
        STREAK: {correctGuesses}
      </div>

      {/* Cards area */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '32px', padding: '24px 24px' }}>
        {/* Current card */}
        <div style={{ textAlign: 'center' }}>
          {renderCardFace(currentCard, true)}
          <div style={{ marginTop: '8px', fontSize: '11px', color: 'rgba(212,175,55,0.6)', letterSpacing: '2px', textTransform: 'uppercase' as const }}>CURRENT</div>
        </div>

        {/* VS */}
        <div style={{
          fontFamily: 'Cinzel, serif', fontSize: '20px', fontWeight: 900,
          color: 'rgba(212,175,55,0.4)', textShadow: '0 0 8px rgba(212,175,55,0.2)',
        }}>VS</div>

        {/* Next card */}
        <div style={{ textAlign: 'center' }}>
          {revealed && nextCard ? (
            renderCardFace(nextCard, true, {
              animation: 'hl-cardReveal 0.5s ease-out both' + (lastGuessCorrect === true ? ', hl-correctRipple 0.6s ease-out 0.3s' : lastGuessCorrect === false ? ', hl-wrongShake 0.4s ease-out 0.3s' : ''),
              ...(lastGuessCorrect === false ? { borderColor: '#dc2626', boxShadow: '0 0 20px rgba(220,38,38,0.4)' } : {}),
              ...(lastGuessCorrect === true ? { borderColor: '#22c55e', boxShadow: '0 0 20px rgba(34,197,94,0.4)' } : {}),
            })
          ) : cardBackEl}
          <div style={{ marginTop: '8px', fontSize: '11px', color: 'rgba(212,175,55,0.6)', letterSpacing: '2px', textTransform: 'uppercase' as const }}>NEXT</div>
        </div>
      </div>

      {/* Round history */}
      {history.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          {history.map((correct, i) => (
            <div key={i} style={{
              width: '28px', height: '28px', borderRadius: '6px',
              background: correct ? 'rgba(34,197,94,0.2)' : 'rgba(220,38,38,0.2)',
              border: `1px solid ${correct ? '#22c55e' : '#dc2626'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', color: correct ? '#22c55e' : '#dc2626', fontWeight: 700,
            }}>{correct ? '★' : '✕'}</div>
          ))}
          {Array.from({ length: 3 - history.length }).map((_, i) => (
            <div key={`e-${i}`} style={{
              width: '28px', height: '28px', borderRadius: '6px',
              background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.2)',
            }} />
          ))}
        </div>
      )}

      {/* Feedback */}
      {revealed && lastGuessCorrect !== null && !showResult && (
        <div style={{
          textAlign: 'center', padding: '8px 0',
          fontFamily: 'Cinzel, serif', fontSize: '22px', fontWeight: 700,
          color: lastGuessCorrect ? '#22c55e' : '#dc2626',
          textShadow: lastGuessCorrect ? '0 0 12px rgba(34,197,94,0.5)' : '0 0 12px rgba(220,38,38,0.5)',
        }}>
          {lastGuessCorrect ? '★ CORRECT ★' : '✕ WRONG ✕'}
        </div>
      )}

      {/* Buttons */}
      {!revealed && !showResult && (
        <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
          <div style={{ fontSize: '13px', color: 'rgba(212,175,55,0.6)', marginBottom: '12px', letterSpacing: '1px' }}>
            Will the next card be higher or lower?
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', padding: '0 16px' }}>
            <button onClick={() => makeGuess(true)} disabled={spectator} style={{
              fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: '16px',
              padding: '14px 36px', borderRadius: '12px',
              background: 'linear-gradient(180deg, #d4af37 0%, #a68628 100%)',
              color: '#1a0f0f', border: '2px solid #ffd700',
              cursor: spectator ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px rgba(212,175,55,0.3), inset 0 1px 0 rgba(255,255,255,0.3)',
              letterSpacing: '2px',
              transition: 'transform 0.1s',
            }}>▲ HIGHER</button>
            <button onClick={() => makeGuess(false)} disabled={spectator} style={{
              fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: '16px',
              padding: '14px 36px', borderRadius: '12px',
              background: 'linear-gradient(180deg, #8b6914 0%, #5a4a20 100%)',
              color: '#fff8e7', border: '2px solid #d4af37',
              cursor: spectator ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
              letterSpacing: '2px',
              transition: 'transform 0.1s',
            }}>▼ LOWER</button>
          </div>
        </div>
      )}

      {/* Rules */}
      <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
        {['3 CORRECT = WIN', '2 CORRECT = CLOSE WIN', 'TIES = PUSH (FREE)'].map((r, i) => (
          <div key={i} style={{ fontSize: '11px', color: 'rgba(212,175,55,0.4)', letterSpacing: '1px', lineHeight: 1.8 }}>{r}</div>
        ))}
      </div>
    </div>
  );
}
