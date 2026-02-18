'use client';

import { useEffect, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import { useAudio } from '@/context/AudioContext';
import { useMultiplayerTurn } from '@/hooks/useMultiplayerTurn';
import { getRentMultiplier, FINAL_ROUNDS_END } from '@/lib/gameData';
import MinigameOverlay from '@/components/Minigames/MinigameOverlay';

interface BoardCenterArtProps {
  isRolling: boolean;
  isAnimating: boolean;
}

export default function BoardCenterArt({ isRolling, isAnimating }: BoardCenterArtProps) {
  const { state, dispatch } = useGame();
  const { play } = useAudio();
  const { isMyTurn } = useMultiplayerTurn();

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

  // Auto-advance turn-end (server handles this for multiplayer;
  // for free-play/local, auto-click after 1s)
  const turnEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (state.phase === 'turn-end') {
      turnEndTimerRef.current = setTimeout(() => {
        play('sfx/turn-start');
        dispatch({ type: 'END_TURN' });
      }, 1000);
    }
    return () => {
      if (turnEndTimerRef.current) clearTimeout(turnEndTimerRef.current);
    };
  }, [state.phase, dispatch, play]);
  const player = state.players[state.currentPlayerIndex];
  const disabled = isRolling || isAnimating || state.phase === 'game-over';

  const handleMainAction = () => {
    if (disabled) return;

    if (state.phase === 'in-jail') {
      play('sfx/dice-shake');
      dispatch({ type: 'JAIL_ESCAPE', method: 'roll' });
    } else if (state.phase === 'rolling') {
      play('sfx/dice-shake');
      dispatch({ type: 'ROLL' });
    } else if (state.phase === 'drawing-card' && !state.drawnCard) {
      dispatch({ type: 'DRAW_CARD' });
    } else if (state.phase === 'drawing-card' && state.drawnCard) {
      dispatch({ type: 'APPLY_CARD' });
    } else if (state.phase === 'turn-end') {
      play('sfx/turn-start');
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
        return state.doublesCount > 0 ? 'Doubles! Roll Again' : 'Next Player...';
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
      case 'in-debt': {
        const owed = state.debt?.amount ?? 0;
        const shortBy = owed - player.money;
        return `Need $${shortBy} more — sell or mortgage!`;
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

      {/* Round & Economy indicator */}
      <div className="roundIndicator">
        <span>Round {state.roundNumber}</span>
        {getRentMultiplier(state.roundNumber, state.finalRounds) > 1 && (
          <span className="rentMultiplier">
            {state.finalRounds ? '⚠️ FINAL' : `${getRentMultiplier(state.roundNumber, state.finalRounds)}x rent`}
          </span>
        )}
        {state.finalRounds && (
          <span className="finalRoundsTimer">
            {Math.max(0, FINAL_ROUNDS_END - state.roundNumber)} left
          </span>
        )}
        {(state.globalHouses < 10 || state.globalHotels < 4) && (
          <span className="housingSupply">
            🏠{state.globalHouses} 🏨{state.globalHotels}
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

      {/* Full-screen card overlay (renders via portal-style positioning) */}
      {state.drawnCard && !isRolling && (
        <div className="cardOverlayFullscreen">
          <div className="cardOverlayBackdrop" />
          <div className={`cardOverlayCard ${state.drawnCard.deckType === 'chance' ? 'cardRisk' : 'cardBlind'}`}>
            <div className="cardOverlayCorner cardCornerTL" />
            <div className="cardOverlayCorner cardCornerTR" />
            <div className="cardOverlayCorner cardCornerBL" />
            <div className="cardOverlayCorner cardCornerBR" />
            <div className="cardOverlayDeckLabel">
              {state.drawnCard.deckType === 'chance' ? '⚡ RISK' : '📦 BLIND CHEST'}
            </div>
            <div className="cardOverlayDivider" />
            <p className="cardOverlayText">{state.drawnCard.text}</p>
            <div className="cardOverlayDivider" />
            <div className="cardOverlayFooter">
              {state.drawnCard.effect.kind === 'collect' && `+$${state.drawnCard.effect.amount}`}
              {state.drawnCard.effect.kind === 'pay' && `-$${state.drawnCard.effect.amount}`}
              {state.drawnCard.effect.kind === 'move-to' && 'MOVE'}
              {state.drawnCard.effect.kind === 'go-to-jail' && 'JAIL'}
              {state.drawnCard.effect.kind === 'get-out-of-jail' && 'FREE'}
              {state.drawnCard.effect.kind === 'collect-from-each' && `+$${state.drawnCard.effect.amount} EACH`}
              {state.drawnCard.effect.kind === 'pay-each-player' && `-$${state.drawnCard.effect.amount} EACH`}
              {state.drawnCard.effect.kind === 'repairs' && 'REPAIRS'}
            </div>
          </div>
        </div>
      )}

      {/* Buy/Gamble/Decline buttons */}
      {state.phase === 'buying' && !isRolling ? (
        isMyTurn ? (
          <div className="buyDeclineRow">
            {player.money >= (state.tiles[player.position] as any).price && (
              <button className="rollButton buyButton" onClick={() => { play('sfx/buy-property'); dispatch({ type: 'BUY' }); }} disabled={isAnimating}>
                Buy ${(state.tiles[player.position] as any).price}
              </button>
            )}
            {state.minigamesEnabled && (
              <button 
                className="rollButton gambleBtn" 
                onClick={() => { play('minigames/minigame-intro'); dispatch({ type: 'GAMBLE', context: 'buying' }); }} 
                disabled={isAnimating}
              >
                Gamble
              </button>
            )}
            <button className="rollButton declineButton" onClick={() => { play('sfx/decline-property'); dispatch({ type: 'DECLINE' }); }} disabled={isAnimating}>
              Pass
            </button>
          </div>
        ) : (
          <div className="waitingLabel">{player.name} is deciding...</div>
        )
      ) : state.phase === 'paying-rent' && !isRolling ? (
        isMyTurn ? (
          <div className="payRentPhase">
            <div className="buyDeclineRow">
              <button className="rollButton buyButton" onClick={() => { play('sfx/pay-rent'); dispatch({ type: 'PAY_RENT' }); }} disabled={isAnimating}>
                Pay ${state.pendingRent?.amount || 0}
              </button>
              {state.minigamesEnabled && state.pendingRent && (
                <button 
                  className="rollButton gambleBtn" 
                  onClick={() => { play('minigames/minigame-intro'); dispatch({ type: 'GAMBLE', context: 'rent' }); }} 
                  disabled={isAnimating}
                >
                  Gamble
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="waitingLabel">{player.name} owes rent...</div>
        )
      ) : state.phase === 'minigame' && state.activeMinigame ? (
        <MinigameOverlay />
      ) : isMyTurn ? (
        <button
          className="rollButton"
          onClick={handleMainAction}
          disabled={disabled}
        >
          {getButtonLabel()}
        </button>
      ) : (
        <div className="waitingLabel">{player.name}&apos;s turn</div>
      )}
      <p className="rollHint">{getHint()}</p>

      {/* Debt resolution - must sell/mortgage to raise funds */}
      {state.phase === 'in-debt' && !isRolling && !isAnimating && (
        <div className="debtActions" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <p style={{ color: '#ff4444', fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center' }}>
            You owe ${state.debt?.amount ?? 0} — You have ${player.money}
          </p>
          <button
            className="rollButton buyButton"
            onClick={() => { play('sfx/collect-money'); dispatch({ type: 'RESOLVE_DEBT' }); }}
            disabled={player.money < (state.debt?.amount ?? 0)}
            style={player.money >= (state.debt?.amount ?? 0) ? { background: '#22c55e' } : {}}
          >
            {player.money >= (state.debt?.amount ?? 0) ? 'Pay Debt' : 'Sell/Mortgage Properties ↓'}
          </button>
          <button
            className="jailBtn"
            onClick={() => { play('sfx/bankruptcy'); dispatch({ type: 'BANKRUPTCY' }); }}
            style={{ color: '#ff4444', fontSize: '0.7rem' }}
          >
            Declare Bankruptcy
          </button>
        </div>
      )}

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
