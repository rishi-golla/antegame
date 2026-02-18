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
  return suit === '♥' || suit === '♦' ? '#dc2626' : '#1a1a1a';
}

function CardFace({ card }: { card: CardData }) {
  const color = suitColor(card.suit);
  return (
    <div className="playingCard cardRevealAnim" style={{ color }}>
      <span className="cardRank">{RANK_NAMES[card.rank]}</span>
      <span className="cardSuit">{card.suit}</span>
      <span className="cardCenter">{card.suit}</span>
    </div>
  );
}

function CardBack() {
  return (
    <div className="playingCard hidden">
      <img src="/assets/minigames/cards/card-back.png" alt="card back" className="cardBackImg" />
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
    if (pc.rank > hc.rank) pw += 1;
    else if (hc.rank > pc.rank) hw += 1;
    else { pw += 0.5; hw += 0.5; }

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

    setTimeout(() => {
      setRound(newRound);
      setRoundRevealed(false);
      setPlayerCard(null);
      setHouseCard(null);
    }, 1500);
  }, [round, playerWins, houseWins, onResult, play]);

  // Spectator: react when pending draw arrives
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
    <div className="cardWar pixelMinigame">
      <h2 className="cardWarTitle">CARD WAR</h2>

      <div className="cardWarScore">
        YOU {playerWins} - {houseWins} HOUSE
      </div>

      <div className="cardWarRound">ROUND {Math.min(round + 1, 3)} / 3</div>

      <div className="cardWarTable">
        <div className="cardWarSlot">
          <div className="cardWarSlotLabel">YOU</div>
          {playerCard ? <CardFace card={playerCard} /> : <CardBack />}
        </div>
        <div className="cardWarVs">VS</div>
        <div className="cardWarSlot">
          <div className="cardWarSlotLabel">HOUSE</div>
          {houseCard ? <CardFace card={houseCard} /> : <CardBack />}
        </div>
      </div>

      {round < 3 && !roundRevealed && (
        <button className="cardWarDrawBtn pixelBtn" onClick={drawRound} disabled={spectator}>
          DRAW
        </button>
      )}

      <div className="cardWarPaytable">
        <div className="paytableRow">3-0 = WIN</div>
        <div className="paytableRow">2-1 = CLOSE WIN</div>
        <div className="paytableRow">TIE = CLOSE LOSS</div>
        <div className="paytableRow">1-2 = LOSS</div>
      </div>
    </div>
  );
}
