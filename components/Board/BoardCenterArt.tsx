'use client';

import { useEffect, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import MinigameOverlay from '@/components/Minigames/MinigameOverlay';

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
      case 'paying-rent': {
        const rent = state.pendingRent?.amount || 0;
        const landlord = state.pendingRent ? state.players[state.pendingRent.toPlayer] : null;
        return `Pay $${rent} rent to ${landlord?.name || 'Bank'}`;
      }
      case 'minigame': {
        return state.activeMinigame ? `Playing ${state.activeMinigame.id}...` : 'Loading minigame...';
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
      {/* Casino crest */}
      <img
        src="/assets/misc/casino-crest.webp"
        alt="Casino Crest"
        className="casinoCrestImg"
        draggable={false}
      />

      {/* Turn indicator */}
      <div className="turnIndicator" style={{ '--player-accent': player.color } as React.CSSProperties}>
        <div className="turnAvatar" style={{ background: player.color, overflow: 'hidden' }}>
          {player.sprite ? (
            <img src={player.sprite} alt={player.name} style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' as const }} draggable={false} />
          ) : (
            player.name[0]
          )}
        </div>
        <span className="turnName">{player.name}</span>
        {state.dice[0] + state.dice[1] > 0 && !isRolling && (
          <span className="turnDice">
            [{state.dice[0]}][{state.dice[1]}]
          </span>
        )}
      </div>

      <img
        src="/assets/misc/community-chest-deck.webp"
        alt="Community Chest"
        className="deckImg deckCommunity"
        draggable={false}
      />

      <img
        src="/assets/misc/chance-deck.webp"
        alt="Chance"
        className="deckImg deckChance"
        draggable={false}
      />

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

      {/* Buy/Gamble/Decline buttons */}
      {state.phase === 'buying' && !isRolling ? (
        <div className="buyDeclineRow">
          <button className="rollButton buyButton" onClick={() => dispatch({ type: 'BUY' })} disabled={isAnimating}>
            Buy
          </button>
          {state.minigamesEnabled && (
            <button 
              className="rollButton gambleBtn" 
              onClick={() => dispatch({ type: 'GAMBLE', context: 'buying' })} 
              disabled={isAnimating || (player.money < (state.tiles[player.position] as any).price * 1.5)}
            >
              Gamble
            </button>
          )}
          <button className="rollButton declineButton" onClick={() => dispatch({ type: 'DECLINE' })} disabled={isAnimating}>
            Pass
          </button>
        </div>
      ) : state.phase === 'paying-rent' && !isRolling ? (
        <div className="payRentPhase">
          <div className="buyDeclineRow">
            <button className="rollButton buyButton" onClick={() => dispatch({ type: 'PAY_RENT' })} disabled={isAnimating}>
              Pay ${state.pendingRent?.amount || 0}
            </button>
            {state.minigamesEnabled && state.pendingRent && (
              <button 
                className="rollButton gambleBtn" 
                onClick={() => dispatch({ type: 'GAMBLE', context: 'rent' })} 
                disabled={isAnimating || (player.money < state.pendingRent.amount * 1.5)}
              >
                Gamble
              </button>
            )}
          </div>
        </div>
      ) : state.phase === 'minigame' && state.activeMinigame ? (
        <MinigameOverlay />
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
