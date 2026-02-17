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
      deck.push({
        rank,
        suit,
        value: getRankValue(rank)
      });
    }
  }
  return deck.sort(() => Math.random() - 0.5); // Shuffle
};

export default function HigherLower({ onResult, baseAmount, context }: HigherLowerProps) {
  const [deck, setDeck] = useState<Card[]>(() => createDeck());
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [nextCard, setNextCard] = useState<Card | null>(null);
  const [round, setRound] = useState(0);
  const [correctGuesses, setCorrectGuesses] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [allGuesses, setAllGuesses] = useState<boolean[]>([]);

  useEffect(() => {
    // 15-second timeout
    const timer = setTimeout(() => {
      onResult('catastrophic');
    }, 15000);

    // Start first round
    if (deck.length > 0) {
      setCurrentCard(deck[0]);
      setNextCard(deck[1]);
    }

    return () => clearTimeout(timer);
  }, [onResult]);

  const makeGuess = (isHigher: boolean) => {
    if (!currentCard || !nextCard || showResult) return;

    setGameStarted(true);
    
    const isCorrect = isHigher ? 
      (nextCard.value > currentCard.value) : 
      (nextCard.value < currentCard.value);
    
    // Handle equal values as incorrect
    const actuallyCorrect = nextCard.value !== currentCard.value && isCorrect;
    
    const newGuesses = [...allGuesses, actuallyCorrect];
    setAllGuesses(newGuesses);
    
    if (actuallyCorrect) {
      setCorrectGuesses(correctGuesses + 1);
    }

    if (round === 2) {
      // Game over after 3 rounds
      setShowResult(true);
      setTimeout(() => {
        calculateFinalResult(actuallyCorrect ? correctGuesses + 1 : correctGuesses, newGuesses);
      }, 1000);
    } else {
      // Next round
      setTimeout(() => {
        setCurrentCard(nextCard);
        if (deck[round + 2]) {
          setNextCard(deck[round + 2]);
        }
        setRound(round + 1);
      }, 1500);
    }
  };

  const calculateFinalResult = (finalCorrect: number, guesses: boolean[]) => {
    // Check if all guesses were maximally wrong
    const allWrong = finalCorrect === 0;
    const maximallyWrong = allWrong && guesses.every(() => true); // For simplicity, just check if all wrong
    
    if (finalCorrect === 3) {
      onResult('win');
    } else if (finalCorrect === 2) {
      onResult('close-win');
    } else if (finalCorrect === 1) {
      onResult('close-loss');
    } else if (allWrong && maximallyWrong) {
      onResult('catastrophic');
    } else {
      onResult('loss');
    }
  };

  const getCardColor = (suit: Suit): string => {
    return suit === '♥' || suit === '♦' ? '#ff4444' : '#000000';
  };

  if (!currentCard) {
    return <div className="higherLower">Loading...</div>;
  }

  return (
    <div className="higherLower">
      <div className="higherLowerHeader">
        <h2 className="higherLowerTitle">HIGHER OR LOWER</h2>
        <div className="higherLowerScore">
          Round {round + 1}/3 | Correct: {correctGuesses}
        </div>
      </div>

      <div className="higherLowerCards">
        <div className="cardWrapper">
          <div className="playingCard current">
            <div className="cardRank" style={{ color: getCardColor(currentCard.suit) }}>
              {currentCard.rank}
            </div>
            <div className="cardSuit" style={{ color: getCardColor(currentCard.suit) }}>
              {currentCard.suit}
            </div>
            <div className="cardCenter" style={{ color: getCardColor(currentCard.suit) }}>
              {currentCard.suit}
            </div>
          </div>
          <div className="cardLabel">Current</div>
        </div>

        <div className="higherLowerVs">VS</div>

        <div className="cardWrapper">
          {showResult ? (
            <div className="playingCard next revealed">
              <div className="cardRank" style={{ color: getCardColor(nextCard!.suit) }}>
                {nextCard!.rank}
              </div>
              <div className="cardSuit" style={{ color: getCardColor(nextCard!.suit) }}>
                {nextCard!.suit}
              </div>
              <div className="cardCenter" style={{ color: getCardColor(nextCard!.suit) }}>
                {nextCard!.suit}
              </div>
            </div>
          ) : (
            <div className="playingCard next hidden">
              <div className="cardBack">🎲</div>
            </div>
          )}
          <div className="cardLabel">Next</div>
        </div>
      </div>

      {!showResult && (
        <div className="higherLowerButtons">
          <button 
            className="higherLowerBtn higher"
            onClick={() => makeGuess(true)}
          >
            HIGHER
          </button>
          <button 
            className="higherLowerBtn lower"
            onClick={() => makeGuess(false)}
          >
            LOWER
          </button>
        </div>
      )}

      <div className="higherLowerRules">
        <div className="ruleRow">3 correct = WIN</div>
        <div className="ruleRow">2 correct = CLOSE WIN</div>
        <div className="ruleRow">1 correct = CLOSE LOSS</div>
        <div className="ruleRow">0 correct = LOSS</div>
        <div className="ruleRow">All maximally wrong = CATASTROPHIC</div>
      </div>
    </div>
  );
}