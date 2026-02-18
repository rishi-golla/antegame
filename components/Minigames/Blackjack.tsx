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

export default function Blackjack({ onResult, baseAmount, context, spectator = false }: BlackjackProps) {
  const { play } = useAudio();
  const [deck, setDeck] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [playerTurn, setPlayerTurn] = useState(true);
  const [gameEnded, setGameEnded] = useState(false);
  const [dealerHidden, setDealerHidden] = useState(true);
  const deckRef = useRef<Card[]>([]);

  const handleRemoteAction = useCallback((data: any) => {
    if (data.type === 'init') {
      const d = data.deck as Card[];
      deckRef.current = d.slice(4);
      setDeck(d.slice(4));
      setPlayerHand([d[0], d[1]]);
      setDealerHand([d[2], d[3]]);
      setGameStarted(true);
    } else if (data.type === 'hit') {
      doHit();
    } else if (data.type === 'stand') {
      doStand();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { emitAction } = useMinigameSync(spectator, handleRemoteAction);

  useEffect(() => {
    if (!spectator) {
      const d = createDeck();
      deckRef.current = d.slice(4);
      setDeck(d.slice(4));
      const ph = [d[0], d[1]];
      const dh = [d[2], d[3]];
      setPlayerHand(ph);
      setDealerHand(dh);
      setGameStarted(true);
      emitAction({ type: 'init', deck: d });
      if (calculateHandValue(ph) === 21) {
        setTimeout(() => doStand(), 1000);
      }
    }
    const timer = setTimeout(() => { if (!gameEnded) onResult('catastrophic'); }, 30000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doHit = () => {
    setPlayerHand(prev => {
      const card = deckRef.current[0];
      if (!card) return prev;
      deckRef.current = deckRef.current.slice(1);
      setDeck(deckRef.current);
      const newHand = [...prev, card];
      play('minigames/blackjack-hit');
      const hv = calculateHandValue(newHand);
      if (hv > 21) {
        setGameEnded(true); setDealerHidden(false);
        setTimeout(() => onResult('catastrophic'), 1000);
      } else if (hv === 21) {
        setTimeout(() => doStand(), 500);
      }
      return newHand;
    });
  };

  const doStand = () => {
    setPlayerTurn(false);
    setDealerHidden(false);
    play('minigames/card-flip');
    setTimeout(() => {
      setDealerHand(dh => {
        let currentDealerHand = [...dh];
        while (calculateHandValue(currentDealerHand) < 17 && deckRef.current.length > 0) {
          currentDealerHand.push(deckRef.current[0]);
          deckRef.current = deckRef.current.slice(1);
        }
        setDeck(deckRef.current);
        setTimeout(() => {
          setPlayerHand(ph => {
            const pv = calculateHandValue(ph);
            const dv = calculateHandValue(currentDealerHand);
            setGameEnded(true);
            if (pv === 21 && ph.length === 2) onResult('win');
            else if (dv > 21) onResult('close-win');
            else if (pv > dv) onResult('close-win');
            else if (pv === dv) onResult('close-loss');
            else onResult('loss');
            return ph;
          });
        }, 1000);
        return currentDealerHand;
      });
    }, 1000);
  };

  const hit = () => {
    if (!playerTurn || gameEnded || spectator) return;
    emitAction({ type: 'hit' });
    doHit();
  };

  const stand = () => {
    if (!playerTurn || gameEnded || spectator) return;
    emitAction({ type: 'stand' });
    doStand();
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
    <div className="blackjack pixelMinigame">
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
            <button className="blackjackBtn hitBtn pixelBtn" onClick={hit} disabled={spectator}>HIT</button>
            <button className="blackjackBtn standBtn pixelBtn" onClick={stand} disabled={spectator}>STAND</button>
          </div>
        )}

        <div className="blackjackInstructions">
          {gameEnded ? 'GAME OVER!' : !playerTurn ? 'DEALER PLAYS...' : playerValue > 21 ? 'BUST!' : playerValue === 21 ? 'PERFECT 21!' : 'HIT OR STAND?'}
        </div>
      </div>
    </div>
  );
}
