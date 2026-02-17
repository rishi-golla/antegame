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

interface Card {
  rank: Rank;
  suit: Suit;
  value: number;
}

const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      let value = parseInt(rank);
      if (rank === 'A') value = 11; // Aces high initially
      if (['J', 'Q', 'K'].includes(rank)) value = 10;
      
      deck.push({ rank, suit, value });
    }
  }
  return deck.sort(() => Math.random() - 0.5); // Shuffle
};

const calculateHandValue = (hand: Card[]): number => {
  let value = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.rank === 'A') {
      aces++;
      value += 11;
    } else {
      value += card.value;
    }
  }

  // Adjust for aces
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }

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
    // Deal initial cards
    if (deck.length >= 4) {
      const newPlayerHand = [deck[0], deck[1]];
      const newDealerHand = [deck[2], deck[3]];
      
      setPlayerHand(newPlayerHand);
      setDealerHand(newDealerHand);
      setDeck(prev => prev.slice(4));
      setGameStarted(true);

      // Check for player blackjack
      if (calculateHandValue(newPlayerHand) === 21) {
        setTimeout(() => {
          stand();
        }, 1000);
      }
    }

    // 15-second timeout
    const timer = setTimeout(() => {
      if (!gameEnded) {
        onResult('catastrophic');
      }
    }, 15000);

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
      // Player busts
      setGameEnded(true);
      setDealerHidden(false);
      setTimeout(() => {
        onResult('catastrophic');
      }, 1000);
    } else if (handValue === 21) {
      // Player gets 21, automatically stand
      setTimeout(() => {
        stand();
      }, 500);
    }
  };

  const stand = () => {
    if (!playerTurn || gameEnded) return;

    setPlayerTurn(false);
    setDealerHidden(false);
    
    // Dealer must hit on 16 and stand on 17
    const playDealerTurn = () => {
      let currentDealerHand = [...dealerHand];
      
      while (calculateHandValue(currentDealerHand) < 17 && deck.length > 0) {
        const newCard = deck[0];
        currentDealerHand.push(newCard);
        setDeck(prev => prev.slice(1));
        setDealerHand(currentDealerHand);
      }

      setTimeout(() => {
        resolveGame(currentDealerHand);
      }, 1000);
    };

    setTimeout(playDealerTurn, 1000);
  };

  const resolveGame = (finalDealerHand: Card[]) => {
    const playerValue = calculateHandValue(playerHand);
    const dealerValue = calculateHandValue(finalDealerHand);

    setGameEnded(true);

    if (playerValue === 21 && playerHand.length === 2) {
      // Player blackjack
      onResult('win');
    } else if (dealerValue > 21) {
      // Dealer busts, player wins
      onResult('close-win');
    } else if (playerValue > dealerValue) {
      // Player beats dealer
      onResult('close-win');
    } else if (playerValue === dealerValue) {
      // Push/tie
      onResult('close-loss');
    } else {
      // Dealer wins
      onResult('loss');
    }
  };

  const getCardColor = (suit: Suit): string => {
    return suit === '♥' || suit === '♦' ? '#ef4444' : '#1f2937';
  };

  const renderCard = (card: Card | null, hidden = false, className = '') => {
    if (!card) return null;

    return (
      <div className={`blackjackCard ${className}`}>
        {hidden ? (
          <div className="cardBack">🎲</div>
        ) : (
          <>
            <div className="cardRank" style={{ color: getCardColor(card.suit) }}>
              {card.rank}
            </div>
            <div className="cardSuit" style={{ color: getCardColor(card.suit) }}>
              {card.suit}
            </div>
            <div className="cardCenter" style={{ color: getCardColor(card.suit) }}>
              {card.suit}
            </div>
          </>
        )}
      </div>
    );
  };

  const playerValue = calculateHandValue(playerHand);
  const dealerValue = calculateHandValue(dealerHand);

  return (
    <div className="blackjack">
      <div className="blackjackHeader">
        <h2 className="blackjackTitle">BLACKJACK</h2>
      </div>

      <div className="blackjackTable">
        {/* Dealer's hand */}
        <div className="handSection dealer">
          <div className="handLabel">
            Dealer {!dealerHidden || gameEnded ? `(${dealerValue})` : '(??)'}
          </div>
          <div className="cardHand">
            {dealerHand.map((card, index) => 
              renderCard(
                card, 
                index === 1 && dealerHidden && !gameEnded, 
                'dealerCard'
              )
            )}
          </div>
        </div>

        {/* Player's hand */}
        <div className="handSection player">
          <div className="handLabel">
            You ({playerValue})
            {playerValue === 21 && playerHand.length === 2 && (
              <span className="blackjackBadge">BLACKJACK!</span>
            )}
            {playerValue > 21 && (
              <span className="bustBadge">BUST!</span>
            )}
          </div>
          <div className="cardHand">
            {playerHand.map((card, index) => 
              renderCard(card, false, 'playerCard animate-slide-in')
            )}
          </div>
        </div>
      </div>

      {/* Game controls */}
      {playerTurn && !gameEnded && playerValue < 21 && (
        <div className="blackjackControls">
          <button className="blackjackBtn hitBtn" onClick={hit}>
            HIT
          </button>
          <button className="blackjackBtn standBtn" onClick={stand}>
            STAND
          </button>
        </div>
      )}

      <div className="blackjackInstructions">
        {gameEnded ? (
          'Game Over!'
        ) : !playerTurn ? (
          'Dealer is playing...'
        ) : playerValue > 21 ? (
          'You busted!'
        ) : playerValue === 21 ? (
          'Perfect 21!'
        ) : (
          'Hit or Stand?'
        )}
      </div>

      <div className="blackjackPaytable">
        <div className="paytableRow">Blackjack (21 in 2 cards) = WIN</div>
        <div className="paytableRow">Beat dealer / Dealer busts = CLOSE WIN</div>
        <div className="paytableRow">Push (tie) = CLOSE LOSS</div>
        <div className="paytableRow">Dealer wins = LOSS</div>
        <div className="paytableRow">You bust = CATASTROPHIC</div>
      </div>
    </div>
  );
}