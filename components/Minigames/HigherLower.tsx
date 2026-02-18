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
  const [deck, setDeck] = useState<Card[]>([]);
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [nextCard, setNextCard] = useState<Card | null>(null);
  const [round, setRound] = useState(0);
  const [correctGuesses, setCorrectGuesses] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [allGuesses, setAllGuesses] = useState<boolean[]>([]);
  const deckRef = useRef<Card[]>([]);

  const handleRemoteAction = useCallback((data: any) => {
    if (data.type === 'init') {
      const d = data.deck as Card[];
      deckRef.current = d;
      setDeck(d);
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
      setDeck(d);
      setCurrentCard(d[0]);
      setNextCard(d[1]);
      emitAction({ type: 'init', deck: d });
    }
    const timer = setTimeout(() => { onResult('catastrophic'); }, 30000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doGuess = (isHigher: boolean) => {
    setCurrentCard(cur => {
      setNextCard(nxt => {
        if (!cur || !nxt) return nxt;
        play('minigames/card-flip');
        const isCorrect = isHigher ? (nxt.value > cur.value) : (nxt.value < cur.value);
        const actuallyCorrect = nxt.value !== cur.value && isCorrect;

        setAllGuesses(prev => [...prev, actuallyCorrect]);
        if (actuallyCorrect) setCorrectGuesses(prev => prev + 1);

        setRound(r => {
          if (r === 2) {
            setShowResult(true);
            setCorrectGuesses(cc => {
              const finalCorrect = actuallyCorrect ? cc + 1 : cc;
              setTimeout(() => {
                if (finalCorrect === 3) onResult('win');
                else if (finalCorrect === 2) onResult('close-win');
                else if (finalCorrect === 1) onResult('close-loss');
                else onResult('catastrophic');
              }, 1000);
              return finalCorrect;
            });
          } else {
            setTimeout(() => {
              setCurrentCard(nxt);
              setNextCard(deckRef.current[r + 2] || null);
            }, 1500);
          }
          return r + 1;
        });
        return nxt;
      });
      return cur;
    });
  };

  const makeGuess = (isHigher: boolean) => {
    if (!currentCard || !nextCard || showResult || spectator) return;
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
            <button className="higherLowerBtn higher pixelBtn" onClick={() => makeGuess(true)} disabled={spectator}>▲ HIGHER</button>
            <button className="higherLowerBtn lower pixelBtn" onClick={() => makeGuess(false)} disabled={spectator}>▼ LOWER</button>
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
