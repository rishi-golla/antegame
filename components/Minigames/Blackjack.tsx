'use client';

import { useState, useEffect } from 'react';
import type { MinigameTier, MinigameContext } from '@/types/game';

interface BlackjackProps {
  onResult: (tier: MinigameTier) => void;
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

export default function Blackjack({ onResult, baseAmount, context }: BlackjackProps) {
  const [deck, setDeck] = useState<Card[]>(() => createDeck());
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [playerTurn, setPlayerTurn] = useState(true);
  const [gameEnded, setGameEnded] = useState(false);
  const [dealerHidden, setDealerHidden] = useState(true);

  useEffect(() => {
    if (deck.length >= 4) {
      const newPlayerHand = [deck[0], deck[1]];
      const newDealerHand = [deck[2], deck[3]];
      setPlayerHand(newPlayerHand);
      setDealerHand(newDealerHand);
      setDeck(prev => prev.slice(4));
      setGameStarted(true);
      if (calculateHandValue(newPlayerHand) === 21) {
        setTimeout(() => stand(), 1000);
      }
    }
    const timer = setTimeout(() => { if (!gameEnded) onResult('catastrophic'); }, 15000);
    return () => clearTimeout(timer);
  }, []);

  const hit = () => {
    if (!playerTurn || gameEnded || deck.length === 0) return;
    const newCard = deck[0];
    const newPlayerHand = [...playerHand, newCard];
    setPlayerHand(newPlayerHand);
    setDeck(prev => prev.slice(1));
    const handValue = calculateHandValue(newPlayerHand);
    if (handValue > 21) {
      setGameEnded(true); setDealerHidden(false);
      setTimeout(() => onResult('catastrophic'), 1000);
    } else if (handValue === 21) {
      setTimeout(() => stand(), 500);
    }
  };

  const stand = () => {
    if (!playerTurn || gameEnded) return;
    setPlayerTurn(false); setDealerHidden(false);
    const playDealerTurn = () => {
      let currentDealerHand = [...dealerHand];
      while (calculateHandValue(currentDealerHand) < 17 && deck.length > 0) {
        const newCard = deck[0];
        currentDealerHand.push(newCard);
        setDeck(prev => prev.slice(1));
        setDealerHand(currentDealerHand);
      }
      setTimeout(() => resolveGame(currentDealerHand), 1000);
    };
    setTimeout(playDealerTurn, 1000);
  };

  const resolveGame = (finalDealerHand: Card[]) => {
    const playerValue = calculateHandValue(playerHand);
    const dealerValue = calculateHandValue(finalDealerHand);
    setGameEnded(true);
    if (playerValue === 21 && playerHand.length === 2) onResult('win');
    else if (dealerValue > 21) onResult('close-win');
    else if (playerValue > dealerValue) onResult('close-win');
    else if (playerValue === dealerValue) onResult('close-loss');
    else onResult('loss');
  };

  const getCardColor = (suit: Suit): string => (suit === '♥' || suit === '♦') ? 'var(--neon-red)' : '#1f2937';

  const renderCard = (card: Card | null, hidden = false, className = '') => {
    if (!card) return null;
    return (
      <div className={`blackjackCard pixelCard ${className}`}>
        {hidden ? (
          <img src="/assets/minigames/cards/card-back.png" alt="?" className="cardBackImg" />
        ) : (
          <>
            <div className="cardRank" style={{ color: getCardColor(card.suit) }}>{card.rank}</div>
            <div className="cardSuit" style={{ color: getCardColor(card.suit) }}>{card.suit}</div>
            <div className="cardCenter" style={{ color: getCardColor(card.suit) }}>{card.suit}</div>
          </>
        )}
      </div>
    );
  };

  const playerValue = calculateHandValue(playerHand);
  const dealerValue = calculateHandValue(dealerHand);

  return (
    <div className="blackjack pixelMinigame" style={{ backgroundImage: 'url(/assets/minigames/cards/card-table.png)', backgroundSize: 'cover' }}>
      <div className="bjOverlayBg">
        <div className="blackjackHeader">
          <h2 className="blackjackTitle">BLACKJACK</h2>
        </div>

        <div className="blackjackTable">
          <div className="handSection dealer">
            <div className="handLabel">DEALER {!dealerHidden || gameEnded ? `(${dealerValue})` : '(??)'}</div>
            <div className="cardHand">
              {dealerHand.map((card, index) => renderCard(card, index === 1 && dealerHidden && !gameEnded, 'dealerCard'))}
            </div>
          </div>

          <div className="handSection player">
            <div className="handLabel">
              YOU ({playerValue})
              {playerValue === 21 && playerHand.length === 2 && <span className="blackjackBadge">BLACKJACK!</span>}
              {playerValue > 21 && <span className="bustBadge">BUST!</span>}
            </div>
            <div className="cardHand">
              {playerHand.map((card, index) => renderCard(card, false, 'playerCard cardSlideIn'))}
            </div>
          </div>
        </div>

        {playerTurn && !gameEnded && playerValue < 21 && (
          <div className="blackjackControls">
            <button className="blackjackBtn hitBtn pixelBtn" onClick={hit}>HIT</button>
            <button className="blackjackBtn standBtn pixelBtn" onClick={stand}>STAND</button>
          </div>
        )}

        <div className="blackjackInstructions">
          {gameEnded ? 'GAME OVER!' : !playerTurn ? 'DEALER PLAYS...' : playerValue > 21 ? 'BUST!' : playerValue === 21 ? 'PERFECT 21!' : 'HIT OR STAND?'}
        </div>
      </div>
    </div>
  );
}
