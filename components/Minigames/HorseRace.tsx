'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';
import { useAudio } from '@/context/AudioContext';
import { useMinigameSync } from '@/hooks/useMinigameSync';

interface CardWarProps {
  onResult: (tier: MinigameTier) => void;
  spectator?: boolean;
  baseAmount: number;
  context: MinigameContext;
}

const SUITS = ['♠', '♥', '♦', '♣'] as const;
const RANK_NAMES: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

interface CardData {
  rank: number;
  suit: typeof SUITS[number];
}

function randomCard(): CardData {
  return {
    rank: Math.floor(Math.random() * 13) + 2,
    suit: SUITS[Math.floor(Math.random() * 4)],
  };
}

function suitColor(suit: string): string {
  return suit === '♥' || suit === '♦' ? '#dc2626' : '#1a1a2e';
}

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Nunito:wght@600;700;800&display=swap');

@keyframes hrCardSlideLeft {
  0% { transform: translateX(-120px) scale(0.8); opacity: 0; }
  60% { transform: translateX(0) scale(1.05); opacity: 1; }
  100% { transform: translateX(0) scale(1); opacity: 1; }
}
@keyframes hrCardSlideRight {
  0% { transform: translateX(120px) scale(0.8); opacity: 0; }
  60% { transform: translateX(0) scale(1.05); opacity: 1; }
  100% { transform: translateX(0) scale(1); opacity: 1; }
}
@keyframes hrCardBack {
  0%, 100% { transform: rotateY(0deg); }
}
@keyframes hrGlowGold {
  0%, 100% { box-shadow: 0 0 15px rgba(255,215,0,0.5), 0 0 30px rgba(255,215,0,0.3); }
  50% { box-shadow: 0 0 25px rgba(255,215,0,0.8), 0 0 50px rgba(255,215,0,0.5); }
}
@keyframes hrGlowRed {
  0%, 100% { box-shadow: 0 0 15px rgba(220,38,38,0.5), 0 0 30px rgba(220,38,38,0.3); }
  50% { box-shadow: 0 0 25px rgba(220,38,38,0.8), 0 0 50px rgba(220,38,38,0.5); }
}
@keyframes hrDim {
  0% { opacity: 1; filter: brightness(1); }
  100% { opacity: 0.5; filter: brightness(0.5) saturate(0.3); }
}
@keyframes hrWarSlam {
  0% { transform: scale(0) rotate(-10deg); opacity: 0; }
  60% { transform: scale(1.3) rotate(3deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes hrPulseAmber {
  0%, 100% { box-shadow: 0 0 10px rgba(255,180,0,0.4); }
  50% { box-shadow: 0 0 20px rgba(255,180,0,0.7), 0 0 40px rgba(255,180,0,0.3); }
}
@keyframes hrVsSpark {
  0%, 100% { text-shadow: 0 0 10px rgba(255,215,0,0.5); }
  50% { text-shadow: 0 0 20px rgba(255,215,0,1), 0 0 40px rgba(255,215,0,0.5); }
}
@keyframes hrSpotlight {
  0%, 100% { opacity: 0.06; }
  50% { opacity: 0.12; }
}
`;

function CardFace({ card, side, result }: { card: CardData; side: 'left' | 'right'; result?: 'win' | 'lose' | 'tie' }) {
  const color = suitColor(card.suit);
  return (
    <div style={{
      width: 120, height: 168,
      background: 'linear-gradient(135deg, #ffffff, #f5f5f0)',
      borderRadius: 10,
      border: '2px solid #ddd',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      position: 'relative',
      animation: `${side === 'left' ? 'hrCardSlideLeft' : 'hrCardSlideRight'} 0.6s ease-out forwards${result === 'win' ? ', hrGlowGold 1s infinite 0.6s' : result === 'lose' ? ', hrDim 0.5s ease-out 0.6s forwards' : result === 'tie' ? ', hrPulseAmber 0.6s infinite 0.6s' : ''}`,
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    }}>
      <span style={{
        position: 'absolute', top: 6, left: 8,
        fontFamily: 'Cinzel, serif', fontSize: 16, fontWeight: 900, color,
      }}>
        {RANK_NAMES[card.rank]}
      </span>
      <span style={{
        position: 'absolute', top: 22, left: 8,
        fontSize: 12, color,
      }}>
        {card.suit}
      </span>
      <span style={{
        fontSize: 42, color,
        textShadow: `0 2px 4px rgba(0,0,0,0.1)`,
      }}>
        {card.suit}
      </span>
      <span style={{
        position: 'absolute', bottom: 6, right: 8,
        fontFamily: 'Cinzel, serif', fontSize: 16, fontWeight: 900, color,
        transform: 'rotate(180deg)',
      }}>
        {RANK_NAMES[card.rank]}
      </span>
    </div>
  );
}

function CardBack() {
  return (
    <div style={{
      width: 120, height: 168,
      borderRadius: 10,
      border: '2px solid #d4af37',
      background: `
        repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(212,175,55,0.15) 8px, rgba(212,175,55,0.15) 9px),
        repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(212,175,55,0.15) 8px, rgba(212,175,55,0.15) 9px),
        linear-gradient(135deg, #3d0f22, #2a0f1f)
      `,
      boxShadow: '0 4px 16px rgba(0,0,0,0.4), inset 0 0 20px rgba(201,168,76,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{
        fontFamily: 'Cinzel, serif',
        fontSize: 24,
        fontWeight: 900,
        color: '#d4af37',
        opacity: 0.6,
      }}>
        ♠
      </span>
    </div>
  );
}

export default function CardWar({ onResult, spectator = false }: CardWarProps) {
  const { play } = useAudio();
  const [round, setRound] = useState(0);
  const [playerWins, setPlayerWins] = useState(0);
  const [houseWins, setHouseWins] = useState(0);
  const [playerCard, setPlayerCard] = useState<CardData | null>(null);
  const [houseCard, setHouseCard] = useState<CardData | null>(null);
  const [roundRevealed, setRoundRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const [roundResult, setRoundResult] = useState<'player' | 'house' | 'tie' | null>(null);
  const [pendingDraw, setPendingDraw] = useState<{ pc: CardData; hc: CardData } | null>(null);

  const handleRemoteAction = useCallback((data: any) => {
    if (data.type === 'draw') {
      setPendingDraw({ pc: data.pc, hc: data.hc });
    }
  }, []);

  const { emitAction } = useMinigameSync(spectator, handleRemoteAction);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!done) onResult('catastrophic');
    }, 30000);
    return () => clearTimeout(timer);
  }, [done, onResult]);

  const executeRound = useCallback((pc: CardData, hc: CardData) => {
    play('minigames/horse-gallop');
    setPlayerCard(pc);
    setHouseCard(hc);
    setRoundRevealed(true);

    const newRound = round + 1;
    let pw = playerWins;
    let hw = houseWins;
    if (pc.rank > hc.rank) { pw += 1; setRoundResult('player'); }
    else if (hc.rank > pc.rank) { hw += 1; setRoundResult('house'); }
    else { pw += 0.5; hw += 0.5; setRoundResult('tie'); }

    setPlayerWins(pw);
    setHouseWins(hw);

    if (newRound >= 3) {
      setDone(true);
      let tier: MinigameTier;
      if (pw === 3) tier = 'win';
      else if (pw > hw) tier = 'close-win';
      else if (pw === hw) tier = 'close-loss';
      else if (hw > pw && pw > 0) tier = 'loss';
      else tier = 'catastrophic';
      setTimeout(() => onResult(tier), 2000);
    }

    if (newRound < 3) {
      setTimeout(() => {
        setRound(newRound);
        setRoundRevealed(false);
        setRoundResult(null);
        setPlayerCard(null);
        setHouseCard(null);
      }, 1500);
    }
  }, [round, playerWins, houseWins, onResult, play]);

  useEffect(() => {
    if (spectator && pendingDraw && !roundRevealed) {
      const { pc, hc } = pendingDraw;
      setPendingDraw(null);
      executeRound(pc, hc);
    }
  }, [spectator, pendingDraw, roundRevealed]); // eslint-disable-line react-hooks/exhaustive-deps

  const drawRound = useCallback(() => {
    if (round >= 3 || roundRevealed || spectator) return;
    const pc = randomCard();
    const hc = randomCard();
    emitAction({ type: 'draw', pc, hc });
    executeRound(pc, hc);
  }, [round, roundRevealed, spectator, emitAction, executeRound]);

  return (
    <>
      <style>{STYLES}</style>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22,
        maxWidth: '600px', margin: '0 auto',
      }}>
        {/* Title */}
        <h2 style={{
          fontFamily: 'Cinzel, serif',
          fontSize: 36,
          fontWeight: 900,
          color: '#ffd700',
          letterSpacing: 4,
          margin: 0,
          textShadow: '0 0 12px rgba(255,215,0,0.4)',
        }}>
          CARD WAR
        </h2>

        {/* Score */}
        <div style={{
          fontFamily: 'Nunito, sans-serif',
          fontSize: 18,
          fontWeight: 800,
          color: '#e0e0e0',
          letterSpacing: 2,
          display: 'flex', gap: 12, alignItems: 'center',
          background: 'rgba(0,0,0,0.5)',
          padding: '6px 18px',
          borderRadius: 20,
          backdropFilter: 'blur(4px)',
        }}>
          <span style={{ color: '#ffd700', textShadow: '0 2px 6px rgba(0,0,0,0.9)' }}>YOU {playerWins}</span>
          <span style={{ color: '#888', textShadow: '0 2px 6px rgba(0,0,0,0.9)' }}>—</span>
          <span style={{ color: '#ef4444', textShadow: '0 2px 6px rgba(0,0,0,0.9)' }}>{houseWins} HOUSE</span>
        </div>

        {/* Round indicator */}
        <div style={{
          fontFamily: 'Nunito, sans-serif',
          fontSize: 12,
          fontWeight: 700,
          color: '#888',
          letterSpacing: 2,
        }}>
          ROUND {Math.min(round + 1, 3)} / 3
        </div>

        {/* Card arena */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 28,
          padding: '28px 24px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.3), rgba(0,0,0,0.1), rgba(0,0,0,0.3))',
          borderRadius: 16,
          position: 'relative',
        }}>
          {/* Spotlight left */}
          <div style={{
            position: 'absolute', left: 30, top: -20, width: 100, height: 60,
            background: 'radial-gradient(ellipse, rgba(212,175,55,0.08), transparent)',
            animation: 'hrSpotlight 3s infinite',
            pointerEvents: 'none',
          }} />
          {/* Spotlight right */}
          <div style={{
            position: 'absolute', right: 30, top: -20, width: 100, height: 60,
            background: 'radial-gradient(ellipse, rgba(212,175,55,0.08), transparent)',
            animation: 'hrSpotlight 3s infinite 1.5s',
            pointerEvents: 'none',
          }} />

          {/* Player card slot */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontFamily: 'Nunito, sans-serif', fontSize: 11, fontWeight: 800,
              color: '#ffd700', letterSpacing: 2, textTransform: 'uppercase',
            }}>YOU</span>
            {playerCard ? (
              <CardFace card={playerCard} side="left"
                result={roundResult === 'player' ? 'win' : roundResult === 'house' ? 'lose' : roundResult === 'tie' ? 'tie' : undefined}
              />
            ) : <CardBack />}
          </div>

          {/* VS */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{
              fontFamily: 'Cinzel, serif',
              fontSize: 28,
              fontWeight: 900,
              color: '#ffd700',
              animation: roundRevealed ? 'hrVsSpark 0.5s infinite' : 'none',
              textShadow: '0 0 10px rgba(255,215,0,0.4)',
            }}>
              VS
            </span>
            {roundResult === 'tie' && (
              <div style={{
                position: 'absolute', top: -30,
                fontFamily: 'Cinzel, serif',
                fontSize: 20,
                fontWeight: 900,
                color: '#ffaa00',
                animation: 'hrWarSlam 0.4s ease-out',
                textShadow: '0 0 15px rgba(255,170,0,0.8)',
              }}>
                WAR!
              </div>
            )}
          </div>

          {/* House card slot */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontFamily: 'Nunito, sans-serif', fontSize: 11, fontWeight: 800,
              color: '#dc2626', letterSpacing: 2, textTransform: 'uppercase',
            }}>HOUSE</span>
            {houseCard ? (
              <CardFace card={houseCard} side="right"
                result={roundResult === 'house' ? 'win' : roundResult === 'player' ? 'lose' : roundResult === 'tie' ? 'tie' : undefined}
              />
            ) : <CardBack />}
          </div>
        </div>

        {/* Draw button */}
        {round < 3 && !roundRevealed && (
          <button
            onClick={drawRound}
            disabled={spectator}
            style={{
              fontFamily: 'Nunito, sans-serif',
              fontSize: 18,
              fontWeight: 800,
              color: '#1a0f0f',
              background: 'linear-gradient(180deg, #ffd700, #c9a84c)',
              border: 'none',
              borderRadius: 12,
              padding: '14px 48px',
              cursor: spectator ? 'default' : 'pointer',
              letterSpacing: 2,
              boxShadow: '0 4px 12px rgba(255,215,0,0.3)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
          >
            DRAW
          </button>
        )}

        {/* Paytable */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 1,
          fontFamily: 'Nunito, sans-serif',
          fontSize: 14,
          color: '#d5c4a1',
          textAlign: 'center',
          padding: '12px 20px',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          borderRadius: 10,
          border: '1px solid rgba(212,175,55,0.15)',
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1.8,
          textShadow: '0 1px 4px rgba(0,0,0,0.8)',
        }}>
          <div>3-0 — <span style={{ color: '#4ade80' }}>Win</span></div>
          <div>2-1 — <span style={{ color: '#86efac' }}>Close Win</span></div>
          <div>Tie — <span style={{ color: '#fbbf24' }}>Close Loss</span></div>
          <div>1-2 — <span style={{ color: '#f87171' }}>Loss</span></div>
        </div>
      </div>
    </>
  );
}
