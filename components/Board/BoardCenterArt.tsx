'use client';

import { useGame } from '@/context/GameContext';

export default function BoardCenterArt({ isRolling }: { isRolling: boolean }) {
  const { state, dispatch } = useGame();
  const player = state.players[state.currentPlayerIndex];

  const handleMainAction = () => {
    if (isRolling) return;

    if (state.phase === 'in-jail') {
      dispatch({ type: 'JAIL_ESCAPE', method: 'roll' });
    } else if (state.phase === 'rolling') {
      dispatch({ type: 'ROLL' });
    } else if (state.phase === 'buying') {
      // Handled by buy/decline buttons
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
    switch (state.phase) {
      case 'rolling':
        return `${player.name} Roll`;
      case 'in-jail':
        return `${player.name} (Jail)`;
      case 'buying':
        return 'Buy / Decline';
      case 'drawing-card':
        return state.drawnCard ? 'Continue' : 'Draw Card';
      case 'turn-end':
        return 'End Turn';
      case 'game-over':
        return state.winner !== null
          ? `${state.players[state.winner].name} Wins!`
          : 'Game Over';
      default:
        return 'Wait...';
    }
  };

  const getHint = () => {
    if (isRolling) return 'Dice In Motion';
    switch (state.phase) {
      case 'rolling':
        return 'Press Roll To Throw';
      case 'in-jail':
        return 'Roll Doubles To Escape';
      case 'buying': {
        const tile = state.tiles[player.position];
        const price = 'price' in tile ? tile.price : 0;
        return `${tile.name} - $${price}`;
      }
      case 'drawing-card':
        return state.drawnCard ? state.drawnCard.text : 'Press To Draw';
      case 'turn-end':
        return 'Press To Continue';
      case 'game-over':
        return 'Thanks For Playing';
      default:
        return '';
    }
  };

  return (
    <div className="boardCenterArt">
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

      {state.phase === 'buying' && !isRolling ? (
        <div className="buyDeclineRow">
          <button className="rollButton buyButton" onClick={() => dispatch({ type: 'BUY' })}>
            Buy
          </button>
          <button className="rollButton declineButton" onClick={() => dispatch({ type: 'DECLINE' })}>
            Pass
          </button>
        </div>
      ) : (
        <button
          className="rollButton"
          onClick={handleMainAction}
          disabled={isRolling || state.phase === 'game-over'}
        >
          {getButtonLabel()}
        </button>
      )}
      <p className="rollHint">{getHint()}</p>

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

      {state.phase === 'in-jail' && !isRolling && (
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
