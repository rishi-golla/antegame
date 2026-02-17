'use client';

import { useState, useEffect } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';

interface HigherLowerProps {
  onResult: (tier: MinigameTier) => void;
  baseAmount: number;
  context: MinigameContext;
}

type Suit = '♠' | '♥' | '♦' | '♣';
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

interface Card {
  rank: Rank;
  suit: Suit;
  value: number;
}

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

export default function HigherLower({ onResult, baseAmount, context }: HigherLowerProps) {
  const [deck] = useState<Card[]>(() => createDeck());
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [nextCard, setNextCard] = useState<Card | null>(null);
  const [round, setRound] = useState(0);
  const [correctGuesses, setCorrectGuesses] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [allGuesses, setAllGuesses] = useState<boolean[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => { onResult('catastrophic'); }, 15000);
    if (deck.length > 0) {
      setCurrentCard(deck[0]);
      setNextCard(deck[1]);
    }
    return () => clearTimeout(timer);
  }, [onResult]);

  const makeGuess = (isHigher: boolean) => {
    if (!currentCard || !nextCard || showResult) return;
    const isCorrect = isHigher ? (nextCard.value > currentCard.value) : (nextCard.value < currentCard.value);
    const actuallyCorrect = nextCard.value !== currentCard.value && isCorrect;
    const newGuesses = [...allGuesses, actuallyCorrect];
    setAllGuesses(newGuesses);
    if (actuallyCorrect) setCorrectGuesses(prev => prev + 1);

    if (round === 2) {
      setShowResult(true);
      setTimeout(() => {
        const finalCorrect = actuallyCorrect ? correctGuesses + 1 : correctGuesses;
        if (finalCorrect === 3) onResult('win');
        else if (finalCorrect === 2) onResult('close-win');
        else if (finalCorrect === 1) onResult('close-loss');
        else if (finalCorrect === 0) onResult('catastrophic');
        else onResult('loss');
      }, 1000);
    } else {
      setTimeout(() => {
        setCurrentCard(nextCard);
        if (deck[round + 2]) setNextCard(deck[round + 2]);
        setRound(round + 1);
      }, 1500);
    }
  };

  const getCardColor = (suit: Suit): string => (suit === '♥' || suit === '♦') ? 'var(--neon-red)' : '#1f2937';

  if (!currentCard) return <div className="higherLower pixelMinigame">Loading...</div>;

  return (
    <div className="higherLower pixelMinigame" style={{ backgroundImage: 'url(/assets/minigames/cards/card-table.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="hlOverlayBg">
        <div className="higherLowerHeader">
          <h2 className="higherLowerTitle">HIGHER OR LOWER</h2>
          <div className="higherLowerScore">ROUND {round + 1}/3 | CORRECT: {correctGuesses}</div>
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
            {showResult && nextCard ? (
              <div className="playingCard next revealed pixelCard cardRevealAnim">
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

        {!showResult && (
          <div className="higherLowerButtons">
            <button className="higherLowerBtn higher pixelBtn" onClick={() => makeGuess(true)}>▲ HIGHER</button>
            <button className="higherLowerBtn lower pixelBtn" onClick={() => makeGuess(false)}>▼ LOWER</button>
          </div>
        )}

        <div className="higherLowerRules">
          <div className="ruleRow">3 CORRECT = WIN</div>
          <div className="ruleRow">2 CORRECT = CLOSE WIN</div>
          <div className="ruleRow">1 CORRECT = CLOSE LOSS</div>
          <div className="ruleRow">0 CORRECT = CATASTROPHIC</div>
        </div>
      </div>
    </div>
  );
}
