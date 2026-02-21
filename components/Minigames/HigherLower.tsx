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

export default function HigherLower({ onResult, baseAmount, context, spectator = false }: HigherLowerProps) {
  const { play } = useAudio();
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [nextCard, setNextCard] = useState<Card | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [round, setRound] = useState(0);
  const [correctGuesses, setCorrectGuesses] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [lastGuessCorrect, setLastGuessCorrect] = useState<boolean | null>(null);

  // Refs to avoid nested setState race conditions
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

    // Ties are a push (count as correct) — not a penalty
    let isCorrect: boolean;
    if (nxt.value === cur.value) {
      isCorrect = true; // push
    } else {
      isCorrect = isHigher ? (nxt.value > cur.value) : (nxt.value < cur.value);
    }

    const newCorrect = correctRef.current + (isCorrect ? 1 : 0);
    correctRef.current = newCorrect;
    setCorrectGuesses(newCorrect);
    setLastGuessCorrect(isCorrect);

    const r = roundRef.current;

    // Reveal the next card
    setRevealed(true);

    if (r === 2) {
      // Final round — show results
      endedRef.current = true;
      setShowResult(true);
      setTimeout(() => {
        if (newCorrect === 3) onResult('win');
        else if (newCorrect === 2) onResult('close-win');
        else if (newCorrect === 1) onResult('close-loss');
        else onResult('catastrophic');
      }, 1500);
    } else {
      // Advance to next round after reveal
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

  const getCardColor = (suit: Suit): string => (suit === '♥' || suit === '♦') ? 'var(--neon-red)' : '#1f2937';

  if (!currentCard) return <div className="higherLower pixelMinigame">Loading...</div>;

  return (
    <div className="higherLower pixelMinigame" style={{ backgroundImage: 'url(/assets/minigames/cards/card-table.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="hlOverlayBg">
        <div className="higherLowerHeader">
          <h2 className="higherLowerTitle">HIGHER OR LOWER</h2>
          <div className="higherLowerScore">ROUND {Math.min(round + 1, 3)}/3 | CORRECT: {correctGuesses}</div>
        </div>

        <div className="higherLowerCards">
          <div className="cardWrapper">
            <div className="playingCard current pixelCard">
              <div className="cardRank" style={{ color: getCardColor(currentCard.suit) }}>{currentCard.rank}</div>
              <div className="cardSuit" style={{ color: getCardColor(currentCard.suit) }}>{currentCard.suit}</div>
              <div className="cardCenter" style={{ color: getCardColor(currentCard.suit) }}>{currentCard.suit}</div>
            </div>
            <div className="cardLabel">CURRENT</div>
          </div>

          <div className="higherLowerVs">VS</div>

          <div className="cardWrapper">
            {revealed && nextCard ? (
              <div className={`playingCard next revealed pixelCard cardRevealAnim ${lastGuessCorrect === true ? 'cardCorrect' : lastGuessCorrect === false ? 'cardWrong' : ''}`}>
                <div className="cardRank" style={{ color: getCardColor(nextCard.suit) }}>{nextCard.rank}</div>
                <div className="cardSuit" style={{ color: getCardColor(nextCard.suit) }}>{nextCard.suit}</div>
                <div className="cardCenter" style={{ color: getCardColor(nextCard.suit) }}>{nextCard.suit}</div>
              </div>
            ) : (
              <div className="playingCard next hidden pixelCard">
                <img src="/assets/minigames/cards/card-back.png" alt="?" className="cardBackImg" />
              </div>
            )}
            <div className="cardLabel">NEXT</div>
          </div>
        </div>

        {!revealed && !showResult && (
          <div className="higherLowerButtons">
            <p className="higherLowerPrompt">Will the next card be higher or lower?</p>
            <button className="higherLowerBtn higher pixelBtn" onClick={() => makeGuess(true)} disabled={spectator}>▲ HIGHER</button>
            <button className="higherLowerBtn lower pixelBtn" onClick={() => makeGuess(false)} disabled={spectator}>▼ LOWER</button>
          </div>
        )}

        {revealed && lastGuessCorrect !== null && !showResult && (
          <div className="hlRoundFeedback">
            {lastGuessCorrect ? '✓ CORRECT' : '✗ WRONG'}
          </div>
        )}

        <div className="higherLowerRules">
          <div className="ruleRow">3 CORRECT = WIN</div>
          <div className="ruleRow">2 CORRECT = CLOSE WIN</div>
          <div className="ruleRow">TIES = PUSH (FREE)</div>
        </div>
      </div>
    </div>
  );
}
