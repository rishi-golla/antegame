'use client';

import { useEffect, useRef } from 'react';
import { useGame } from '@/context/GameContext';

interface BoardCenterArtProps {
  isRolling: boolean;
  isAnimating: boolean;
}

export default function BoardCenterArt({ isRolling, isAnimating }: BoardCenterArtProps) {
  const { state, dispatch } = useGame();

  // Auto-resolve card effect after overlay dismisses
  const resolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (state.phase === 'applying-card' && !isAnimating) {
      resolveTimerRef.current = setTimeout(() => {
        dispatch({ type: 'RESOLVE_CARD' });
      }, 400); // brief pause after card overlay fades
    }
    return () => {
      if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current);
    };
  }, [state.phase, isAnimating, dispatch]);
  const player = state.players[state.currentPlayerIndex];
  const disabled = isRolling || isAnimating || state.phase === 'game-over';

  const handleMainAction = () => {
    if (disabled) return;

    if (state.phase === 'in-jail') {
      dispatch({ type: 'JAIL_ESCAPE', method: 'roll' });
    } else if (state.phase === 'rolling') {
      dispatch({ type: 'ROLL' });
    } else if (state.phase === 'drawing-card' && !state.drawnCard) {
      dispatch({ type: 'DRAW_CARD' });
    } else if (state.phase === 'drawing-card' && state.drawnCard) {
      dispatch({ type: 'APPLY_CARD' });
    } else if (state.phase === 'turn-end') {
      dispatch({ type: 'END_TURN' });
    }
  };

  const getButtonLabel = () => {
    if (isRolling) return 'Rolling...';
    if (isAnimating) return 'Moving...';
    switch (state.phase) {
      case 'rolling':
        return `Roll Dice`;
      case 'in-jail':
        return 'Roll for Doubles';
      case 'buying':
        return 'Buy / Decline';
      case 'drawing-card':
        return state.drawnCard ? 'Continue' : 'Draw Card';
      case 'applying-card':
        return 'Applying...';
      case 'turn-end':
        return state.doublesCount > 0 ? 'Doubles! Roll Again' : 'End Turn';
      case 'game-over':
        return 'Game Over';
      default:
        return 'Wait...';
    }
  };

  const getHint = () => {
    if (isRolling) return 'Dice In Motion';
    if (isAnimating) return 'Token Moving...';
    switch (state.phase) {
      case 'rolling':
        return `${player.name}'s Turn`;
      case 'in-jail':
        return 'Roll Doubles To Escape';
      case 'buying': {
        const tile = state.tiles[player.position];
        const price = 'price' in tile ? tile.price : 0;
        return `${tile.name} - $${price}`;
      }
      case 'drawing-card':
        return state.drawnCard ? state.drawnCard.text : 'Press To Draw';
      case 'applying-card':
        return 'Card effect resolving...';
      case 'turn-end':
        return state.doublesCount > 0 ? `${player.name} rolled doubles!` : `${player.name}'s turn is over`;
      case 'game-over':
        return 'Thanks For Playing';
      default:
        return '';
    }
  };

  return (
    <div className="boardCenterArt">
      {/* Turn indicator */}
      <div className="turnIndicator" style={{ '--player-accent': player.color } as React.CSSProperties}>
        <div className="turnAvatar" style={{ background: player.color }}>
          {player.name[0]}
        </div>
        <span className="turnName">{player.name}</span>
        {state.dice[0] + state.dice[1] > 0 && !isRolling && (
          <span className="turnDice">
            [{state.dice[0]}][{state.dice[1]}]
          </span>
        )}
      </div>

      <div className="deck deckCommunity" role="button" aria-label="Community Chest deck">
        <div className="deckCard back" />
        <div className="deckCard mid" />
        <div className="deckCard face">
          <span>Community</span>
          <strong>Chest</strong>
        </div>
      </div>

      <div className="deck deckChance" role="button" aria-label="Chance deck">
        <div className="deckCard back" />
        <div className="deckCard mid" />
        <div className="deckCard face">
          <span>Chance</span>
          <strong>Card</strong>
        </div>
      </div>

      {/* Drawn card overlay */}
      {state.drawnCard && !isRolling && (
        <div className="drawnCardOverlay">
          <div className={`drawnCard ${state.drawnCard.deckType === 'chance' ? 'drawnCardChance' : 'drawnCardChest'}`}>
            <span className="drawnCardType">
              {state.drawnCard.deckType === 'chance' ? 'Chance' : 'Community Chest'}
            </span>
            <p className="drawnCardText">{state.drawnCard.text}</p>
          </div>
        </div>
      )}

      {/* Buy/Decline buttons */}
      {state.phase === 'buying' && !isRolling ? (
        <div className="buyDeclineRow">
          <button className="rollButton buyButton" onClick={() => dispatch({ type: 'BUY' })} disabled={isAnimating}>
            Buy
          </button>
          <button className="rollButton declineButton" onClick={() => dispatch({ type: 'DECLINE' })} disabled={isAnimating}>
            Pass
          </button>
        </div>
      ) : (
        <button
          className="rollButton"
          onClick={handleMainAction}
          disabled={disabled}
        >
          {getButtonLabel()}
        </button>
      )}
      <p className="rollHint">{getHint()}</p>

      {/* Jail escape options */}
      {state.phase === 'in-jail' && !isRolling && !isAnimating && (
        <div className="jailActions">
          <button className="jailBtn" onClick={() => dispatch({ type: 'JAIL_ESCAPE', method: 'bail' })}>
            Pay $50 Bail
          </button>
          {player.getOutOfJailCards > 0 && (
            <button className="jailBtn" onClick={() => dispatch({ type: 'JAIL_ESCAPE', method: 'card' })}>
              Use Card
            </button>
          )}
        </div>
      )}
    </div>
  );
}
