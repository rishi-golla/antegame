'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';
import { useAudio } from '@/context/AudioContext';
import { useMinigameSync } from '@/hooks/useMinigameSync';

interface BlackjackProps {
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

const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      let value = parseInt(rank);
      if (rank === 'A') value = 11;
      if (['J', 'Q', 'K'].includes(rank)) value = 10;
      deck.push({ rank, suit, value });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
};

const calculateHandValue = (hand: Card[]): number => {
  let value = 0; let aces = 0;
  for (const card of hand) {
    if (card.rank === 'A') { aces++; value += 11; } else { value += card.value; }
  }
  while (value > 21 && aces > 0) { value -= 10; aces--; }
  return value;
};

const BJStyles = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Nunito:wght@400;600;700&display=swap');

@keyframes bj-cardDeal {
  0% { transform: translateX(300px) rotate(15deg); opacity: 0; }
  60% { transform: translateX(-8px) rotate(-2deg); opacity: 1; }
  80% { transform: translateX(4px) rotate(1deg); }
  100% { transform: translateX(0) rotate(0deg); opacity: 1; }
}

@keyframes bj-cardFlip {
  0% { transform: perspective(600px) rotateY(180deg); }
  100% { transform: perspective(600px) rotateY(0deg); }
}

@keyframes bj-pulseGlow {
  0%, 100% { box-shadow: 0 0 8px rgba(212,175,55,0.3); }
  50% { box-shadow: 0 0 20px rgba(212,175,55,0.7); }
}

@keyframes bj-bustStamp {
  0% { transform: scale(3) rotate(-15deg); opacity: 0; }
  50% { transform: scale(1.1) rotate(-12deg); opacity: 1; }
  100% { transform: scale(1) rotate(-12deg); opacity: 1; }
}

@keyframes bj-blackjackFlash {
  0% { text-shadow: 0 0 20px #d4af37, 0 0 40px #d4af37; transform: scale(0.5); opacity: 0; }
  50% { text-shadow: 0 0 40px #ffd700, 0 0 80px #ffd700, 0 0 120px rgba(255,215,0,0.5); transform: scale(1.1); opacity: 1; }
  100% { text-shadow: 0 0 20px #d4af37, 0 0 40px #d4af37; transform: scale(1); opacity: 1; }
}

@keyframes bj-redFlash {
  0% { background-color: rgba(220,38,38,0); }
  30% { background-color: rgba(220,38,38,0.25); }
  100% { background-color: rgba(220,38,38,0); }
}

@keyframes bj-sparkle {
  0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
  50% { opacity: 1; transform: scale(1) rotate(180deg); }
}
`;

export default function Blackjack({ onResult, baseAmount, context, spectator = false }: BlackjackProps) {
  const { play } = useAudio();

  const deckRef = useRef<Card[]>([]);
  const playerHandRef = useRef<Card[]>([]);
  const dealerHandRef = useRef<Card[]>([]);
  const playerTurnRef = useRef(true);
  const gameEndedRef = useRef(false);
  const initRef = useRef(false);

  const [, forceRender] = useState(0);
  const rerender = () => forceRender(n => n + 1);

  const [dealerHidden, setDealerHidden] = useState(true);
  const [bustAnimation, setBustAnimation] = useState(false);
  const [blackjackAnimation, setBlackjackAnimation] = useState(false);

  const resolveGame = useCallback(() => {
    if (gameEndedRef.current) return;
    gameEndedRef.current = true;

    const pv = calculateHandValue(playerHandRef.current);
    const dv = calculateHandValue(dealerHandRef.current);

    let tier: MinigameTier;
    if (pv > 21) {
      tier = 'catastrophic';
    } else if (pv === 21 && playerHandRef.current.length === 2) {
      tier = 'win';
    } else if (dv > 21) {
      tier = 'close-win';
    } else if (pv > dv) {
      tier = 'close-win';
    } else if (pv === dv) {
      tier = 'close-loss';
    } else {
      tier = 'loss';
    }

    rerender();
    onResult(tier);
  }, [onResult]);

  const doDealerPlay = useCallback(() => {
    playerTurnRef.current = false;
    setDealerHidden(false);
    play('minigames/card-flip');
    rerender();

    setTimeout(() => {
      while (calculateHandValue(dealerHandRef.current) < 17 && deckRef.current.length > 0) {
        dealerHandRef.current = [...dealerHandRef.current, deckRef.current[0]];
        deckRef.current = deckRef.current.slice(1);
      }
      rerender();

      setTimeout(() => resolveGame(), 1000);
    }, 1000);
  }, [play, resolveGame]);

  const doHit = useCallback(() => {
    if (gameEndedRef.current || !playerTurnRef.current) return;

    const card = deckRef.current[0];
    if (!card) return;
    deckRef.current = deckRef.current.slice(1);
    playerHandRef.current = [...playerHandRef.current, card];
    play('minigames/blackjack-hit');
    rerender();

    const hv = calculateHandValue(playerHandRef.current);
    if (hv > 21) {
      setBustAnimation(true);
      setDealerHidden(false);
      gameEndedRef.current = true;
      rerender();
      setTimeout(() => onResult('catastrophic'), 1000);
    } else if (hv === 21) {
      setTimeout(() => doDealerPlay(), 500);
    }
  }, [play, doDealerPlay, onResult]);

  const handleRemoteAction = useCallback((data: any) => {
    if (data.type === 'init') {
      const d = data.deck as Card[];
      deckRef.current = d.slice(4);
      playerHandRef.current = [d[0], d[1]];
      dealerHandRef.current = [d[2], d[3]];
      initRef.current = true;
      rerender();
    } else if (data.type === 'hit') {
      doHit();
    } else if (data.type === 'stand') {
      doDealerPlay();
    }
  }, [doHit, doDealerPlay]);

  const { emitAction } = useMinigameSync(spectator, handleRemoteAction);

  useEffect(() => {
    if (initRef.current || spectator) return;
    initRef.current = true;

    const d = createDeck();
    deckRef.current = d.slice(4);
    playerHandRef.current = [d[0], d[1]];
    dealerHandRef.current = [d[2], d[3]];
    rerender();

    emitAction({ type: 'init', deck: d });

    if (calculateHandValue(playerHandRef.current) === 21) {
      setBlackjackAnimation(true);
      setTimeout(() => doDealerPlay(), 1000);
    }

    return () => {};
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!gameEndedRef.current) {
        gameEndedRef.current = true;
        onResult('catastrophic');
      }
    }, 60000);
    return () => clearTimeout(timer);
  }, [onResult]);

  const hit = () => {
    if (!playerTurnRef.current || gameEndedRef.current || spectator) return;
    emitAction({ type: 'hit' });
    doHit();
  };

  const stand = () => {
    if (!playerTurnRef.current || gameEndedRef.current || spectator) return;
    emitAction({ type: 'stand' });
    doDealerPlay();
  };

  const isRed = (suit: Suit): boolean => suit === '♥' || suit === '♦';

  const cardFaceStyle = (index: number): React.CSSProperties => ({
    width: '80px',
    height: '112px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #fffef5, #f5f0e0)',
    border: '2px solid #c9b06b',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'space-between',
    padding: '6px 8px',
    animation: `bj-cardDeal 0.5s ease-out ${index * 0.15}s both`,
    flexShrink: 0,
  });

  const cardBackStyle = (pulsing: boolean): React.CSSProperties => ({
    width: '80px',
    height: '112px',
    borderRadius: '10px',
    background: 'repeating-conic-gradient(#3d0f22 0% 25%, #2a0f1f 0% 50%) 50% / 16px 16px',
    border: '2px solid #d4af37',
    boxShadow: pulsing ? undefined : '0 4px 12px rgba(0,0,0,0.4)',
    position: 'relative' as const,
    overflow: 'hidden',
    animation: pulsing ? 'bj-pulseGlow 1.5s ease-in-out infinite' : undefined,
    flexShrink: 0,
  });

  const cardBackOverlay: React.CSSProperties = {
    position: 'absolute',
    inset: '6px',
    borderRadius: '6px',
    border: '1px solid #d4af37',
    background: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(212,175,55,0.08) 8px, rgba(212,175,55,0.08) 16px)',
  };

  const renderCard = (card: Card | null, hidden = false, index = 0) => {
    if (!card) return null;
    const red = isRed(card.suit);
    const color = red ? '#c0392b' : '#1a1a2e';

    if (hidden) {
      return (
        <div key={`hidden-${index}`} style={cardBackStyle(true)}>
          <div style={cardBackOverlay} />
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: '#d4af37', fontSize: '24px', opacity: 0.4 }}>✦</div>
        </div>
      );
    }

    return (
      <div key={`${card.rank}-${card.suit}-${index}`} style={cardFaceStyle(index)}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
          <span style={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '16px', color }}>{card.rank}</span>
          <span style={{ fontSize: '14px', color }}>{card.suit}</span>
        </div>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: '28px', color, opacity: 0.8 }}>
          {card.suit}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1, transform: 'rotate(180deg)' }}>
          <span style={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '16px', color }}>{card.rank}</span>
          <span style={{ fontSize: '14px', color }}>{card.suit}</span>
        </div>
      </div>
    );
  };

  const playerValue = calculateHandValue(playerHandRef.current);
  const dealerValue = calculateHandValue(dealerHandRef.current);
  const gameEnded = gameEndedRef.current;
  const playerTurn = playerTurnRef.current;
  const showControls = playerTurn && !gameEnded && playerValue < 21 && playerHandRef.current.length >= 2;

  const isBlackjack = playerValue === 21 && playerHandRef.current.length === 2;
  const isBust = playerValue > 21;

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      minHeight: '420px',
      background: 'linear-gradient(180deg, #1a0f0f 0%, #2a0f1f 50%, #1a0f0f 100%)',
      borderRadius: '16px',
      overflow: 'hidden',
      fontFamily: 'Nunito, sans-serif',
    }}>
      <style>{BJStyles}</style>

      {/* Felt texture */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at 50% 60%, rgba(107,26,58,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Title */}
      <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
        <h2 style={{
          fontFamily: 'Cinzel, serif',
          fontSize: '28px',
          fontWeight: 900,
          color: '#d4af37',
          textShadow: '0 0 12px rgba(212,175,55,0.5)',
          margin: 0,
          letterSpacing: '3px',
        }}>BLACKJACK</h2>
      </div>

      {/* Bust red flash overlay */}
      {bustAnimation && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none',
          animation: 'bj-redFlash 0.6s ease-out',
        }} />
      )}

      {/* Table area */}
      <div style={{ padding: '0 20px 16px', position: 'relative', zIndex: 1 }}>
        {/* Dealer */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: '13px',
            color: '#d4af37', textTransform: 'uppercase' as const, letterSpacing: '2px', marginBottom: '8px',
            textShadow: '0 0 8px rgba(212,175,55,0.4)',
          }}>
            Dealer {!dealerHidden || gameEnded ? `(${dealerValue})` : '(??)'}
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {dealerHandRef.current.map((card, index) =>
              renderCard(card, index === 1 && dealerHidden && !gameEnded, index)
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #d4af37, transparent)', margin: '8px 0 16px' }} />

        {/* Player */}
        <div style={{ position: 'relative' }}>
          <div style={{
            fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: '13px',
            color: '#d4af37', textTransform: 'uppercase' as const, letterSpacing: '2px', marginBottom: '8px',
            textShadow: '0 0 8px rgba(212,175,55,0.4)',
          }}>
            You ({playerValue})
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {playerHandRef.current.map((card, index) => renderCard(card, false, index))}
          </div>

          {/* Bust stamp */}
          {isBust && (
            <div style={{
              position: 'absolute', top: '30%', left: '50%',
              fontFamily: 'Cinzel, serif', fontWeight: 900, fontSize: '48px',
              color: '#dc2626', border: '4px solid #dc2626', padding: '4px 16px',
              borderRadius: '8px', transform: 'translate(-50%,-50%) rotate(-12deg)',
              animation: 'bj-bustStamp 0.4s ease-out both',
              textShadow: '0 0 20px rgba(220,38,38,0.6)',
              pointerEvents: 'none', zIndex: 5,
            }}>BUST</div>
          )}

          {/* Blackjack banner */}
          {isBlackjack && (
            <div style={{
              position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
              fontFamily: 'Cinzel, serif', fontWeight: 900, fontSize: '36px',
              color: '#ffd700',
              animation: 'bj-blackjackFlash 0.8s ease-out both',
              pointerEvents: 'none', zIndex: 5, whiteSpace: 'nowrap',
            }}>
              ✦ BLACKJACK! ✦
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      {showControls && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', padding: '8px 0 16px' }}>
          <button onClick={hit} disabled={spectator} style={{
            fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: '16px',
            padding: '12px 32px', borderRadius: '50px',
            background: 'linear-gradient(180deg, #d4af37 0%, #8b6914 100%)',
            color: '#ffd700', border: '2px solid #d4af37',
            cursor: spectator ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
            letterSpacing: '2px', textTransform: 'uppercase' as const,
            transition: 'transform 0.1s, box-shadow 0.1s',
          }}
            onMouseDown={e => { (e.target as HTMLElement).style.transform = 'scale(0.95)'; }}
            onMouseUp={e => { (e.target as HTMLElement).style.transform = 'scale(1)'; }}
          >HIT</button>
          <button onClick={stand} disabled={spectator} style={{
            fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: '16px',
            padding: '12px 32px', borderRadius: '50px',
            background: 'linear-gradient(180deg, #6b1a3a 0%, #3d0f22 100%)',
            color: '#ffd700', border: '2px solid #d4af37',
            cursor: spectator ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
            letterSpacing: '2px', textTransform: 'uppercase' as const,
            transition: 'transform 0.1s, box-shadow 0.1s',
          }}
            onMouseDown={e => { (e.target as HTMLElement).style.transform = 'scale(0.95)'; }}
            onMouseUp={e => { (e.target as HTMLElement).style.transform = 'scale(1)'; }}
          >STAND</button>
        </div>
      )}

      {/* Status */}
      <div style={{
        textAlign: 'center', padding: '8px 0 16px',
        fontFamily: 'Nunito, sans-serif', fontWeight: 600, fontSize: '14px',
        color: 'rgba(212,175,55,0.8)', letterSpacing: '1px',
      }}>
        {gameEnded ? 'GAME OVER' : !playerTurn ? 'DEALER PLAYS...' : playerValue > 21 ? 'BUST!' : playerValue === 21 ? '★ PERFECT 21 ★' : 'HIT OR STAND?'}
      </div>
    </div>
  );
}
