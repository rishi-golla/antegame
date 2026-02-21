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

  // All game state in refs to avoid race conditions
  const deckRef = useRef<Card[]>([]);
  const playerHandRef = useRef<Card[]>([]);
  const dealerHandRef = useRef<Card[]>([]);
  const playerTurnRef = useRef(true);
  const gameEndedRef = useRef(false);
  const initRef = useRef(false);

  // Render state (only for display)
  const [, forceRender] = useState(0);
  const rerender = () => forceRender(n => n + 1);

  const [dealerHidden, setDealerHidden] = useState(true);

  const resolveGame = useCallback(() => {
    if (gameEndedRef.current) return;
    gameEndedRef.current = true;

    const pv = calculateHandValue(playerHandRef.current);
    const dv = calculateHandValue(dealerHandRef.current);

    let tier: MinigameTier;
    if (pv > 21) {
      tier = 'catastrophic';
    } else if (pv === 21 && playerHandRef.current.length === 2) {
      tier = 'win'; // natural blackjack
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
      // Dealer draws to 17+
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
      // Bust — reveal dealer, resolve
      setDealerHidden(false);
      gameEndedRef.current = true;
      rerender();
      setTimeout(() => onResult('catastrophic'), 1000);
    } else if (hv === 21) {
      // Auto-stand on 21
      setTimeout(() => doDealerPlay(), 500);
    }
    // Otherwise: player keeps their turn, buttons stay visible
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

  // Init deal
  useEffect(() => {
    if (initRef.current || spectator) return;
    initRef.current = true;

    const d = createDeck();
    deckRef.current = d.slice(4);
    playerHandRef.current = [d[0], d[1]];
    dealerHandRef.current = [d[2], d[3]];
    rerender();

    emitAction({ type: 'init', deck: d });

    // Natural blackjack → auto stand
    if (calculateHandValue(playerHandRef.current) === 21) {
      setTimeout(() => doDealerPlay(), 1000);
    }

    return () => {};
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Safety timeout (60s, generous)
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

  const playerValue = calculateHandValue(playerHandRef.current);
  const dealerValue = calculateHandValue(dealerHandRef.current);
  const gameEnded = gameEndedRef.current;
  const playerTurn = playerTurnRef.current;
  const showControls = playerTurn && !gameEnded && playerValue < 21 && playerHandRef.current.length >= 2;

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
              {dealerHandRef.current.map((card, index) => renderCard(card, index === 1 && dealerHidden && !gameEnded, 'dealerCard'))}
            </div>
          </div>

          <div className="handSection player">
            <div className="handLabel">
              YOU ({playerValue})
              {playerValue === 21 && playerHandRef.current.length === 2 && <span className="blackjackBadge">BLACKJACK!</span>}
              {playerValue > 21 && <span className="bustBadge">BUST!</span>}
            </div>
            <div className="cardHand">
              {playerHandRef.current.map((card, index) => renderCard(card, false, 'playerCard cardSlideIn'))}
            </div>
          </div>
        </div>

        {showControls && (
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
