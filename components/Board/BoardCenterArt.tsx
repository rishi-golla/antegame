'use client';

import { useEffect, useRef, useState } from 'react';
import { useGame } from '@/context/GameContext';
import { useAudio } from '@/context/AudioContext';
import { useMultiplayerTurn } from '@/hooks/useMultiplayerTurn';
import { useSocket } from '@/context/SocketContext';
import { getRentMultiplier, FINAL_ROUNDS_END } from '@/lib/gameData';
import MinigameOverlay, { preloadAllMinigameBackgrounds } from '@/components/Minigames/MinigameOverlay';
import CardDrawOverlay from '@/components/Board/CardDrawOverlay';
import CountdownTimer from '@/components/Board/CountdownTimer';

interface BoardCenterArtProps {
  isRolling: boolean;
  isAnimating: boolean;
}

export default function BoardCenterArt({ isRolling, isAnimating }: BoardCenterArtProps) {
  const { state, dispatch } = useGame();
  const { play } = useAudio();
  const { isMyTurn } = useMultiplayerTurn();
  const { roomState } = useSocket();
  const isMultiplayer = !!roomState;

  // Block actions while turn announcement is playing
  const [turnAnnouncing, setTurnAnnouncing] = useState(false);
  const announceIndexRef = useRef(state.currentPlayerIndex);
  const announceMountRef = useRef(false);
  useEffect(() => {
    if (!announceMountRef.current) { announceMountRef.current = true; announceIndexRef.current = state.currentPlayerIndex; return; }
    if (announceIndexRef.current !== state.currentPlayerIndex) {
      setTurnAnnouncing(true);
      const t = setTimeout(() => setTurnAnnouncing(false), 1800);
      announceIndexRef.current = state.currentPlayerIndex;
      return () => clearTimeout(t);
    }
  }, [state.currentPlayerIndex]);

  // Eagerly preload all minigame backgrounds on game start
  useEffect(() => {
    preloadAllMinigameBackgrounds();
  }, []);

  // Auto-apply drawn card after 2 seconds (dismisses the full-screen overlay)
  const applyCardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (state.phase === 'drawing-card' && state.drawnCard && isMyTurn) {
      // Play card draw sound based on effect type
      const effect = state.drawnCard.effect.kind;
      if (effect === 'go-to-jail') play('sfx/card-jail');
      else if (effect === 'pay' || effect === 'pay-each-player' || effect === 'repairs') play('sfx/card-bad');
      else play('sfx/card-good');

      // Let CardDrawOverlay handle dismiss via its own timer + progress bar
      // applyCardTimerRef removed to avoid racing with overlay's onDismiss
    }
    return () => {
      if (applyCardTimerRef.current) clearTimeout(applyCardTimerRef.current);
    };
  }, [state.phase, state.drawnCard, isMyTurn, dispatch]);

  // Auto-resolve card effect after applying
  const resolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (state.phase === 'applying-card' && !isAnimating) {
      resolveTimerRef.current = setTimeout(() => {
        dispatch({ type: 'RESOLVE_CARD' });
      }, 400);
    }
    return () => {
      if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current);
    };
  }, [state.phase, isAnimating, dispatch]);

  // Auto-advance turn-end (server handles this for multiplayer;
  // for free-play/local, auto-advance after 2.5s — or instantly if idle-chaining)
  const turnEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleAutoPlayingRef = useRef(false);
  useEffect(() => {
    if (state.phase === 'turn-end' && !isMultiplayer) {
      const delay = idleAutoPlayingRef.current ? 200 : 2500;
      turnEndTimerRef.current = setTimeout(() => {
        if (!idleAutoPlayingRef.current) play('sfx/turn-start');
        dispatch({ type: 'END_TURN' });
      }, delay);
    }
    return () => {
      if (turnEndTimerRef.current) clearTimeout(turnEndTimerRef.current);
    };
  }, [state.phase, dispatch, play, isMultiplayer]);
  const player = state.players[state.currentPlayerIndex];
  const disabled = isRolling || isAnimating || turnAnnouncing || state.phase === 'game-over' || idleAutoPlayingRef.current;

  // Countdown timer config per phase
  // Timer resets each time the player or phase changes
  const timerDuration = (state.phase !== 'game-over' && state.phase !== 'minigame') ? 45 : 0;
  const showTimer = timerDuration > 0 && !isRolling && !isAnimating && !turnAnnouncing;
  const timerResetKey = `${state.currentPlayerIndex}-${state.phase}-${state.roundNumber}`;

  // === FREE PLAY IDLE SYSTEM ===
  // Timestamp-based: tracks when the current phase started, fires after deadline.
  // Once a player gets a warning, subsequent phases auto-play instantly
  // so the entire turn resolves quickly instead of dragging across multiple timeouts.
  const MAX_IDLE_WARNINGS = 3;
  const IDLE_TIMEOUT_MS = 45_000;
  const idleWarningsRef = useRef<number[]>([]);  // warnings[playerIndex] = count
  const idleDeadlineRef = useRef(Date.now() + IDLE_TIMEOUT_MS);
  const idlePhaseKeyRef = useRef('');
  // idleAutoPlayingRef is declared above (near turnEndTimerRef) so turn-end can use it
  const [idleWarningBanner, setIdleWarningBanner] = useState<string | null>(null);

  // Reset idle deadline whenever the game phase or player changes
  useEffect(() => {
    const key = `${state.currentPlayerIndex}:${state.phase}`;
    if (idlePhaseKeyRef.current !== key) {
      const prevPlayer = idlePhaseKeyRef.current.split(':')[0];
      const newPlayer = String(state.currentPlayerIndex);
      idlePhaseKeyRef.current = key;

      if (prevPlayer !== newPlayer) {
        // Player changed — stop auto-chain, give full 45s
        idleAutoPlayingRef.current = false;
        idleDeadlineRef.current = Date.now() + IDLE_TIMEOUT_MS;
      } else if (idleAutoPlayingRef.current) {
        // Same player, mid-auto-chain — instant deadline so next interval tick auto-plays
        idleDeadlineRef.current = 0;
      } else {
        // Same player, new phase, not auto-chaining — full 45s
        idleDeadlineRef.current = Date.now() + IDLE_TIMEOUT_MS;
      }
    }
  }, [state.currentPlayerIndex, state.phase]);

  // Refs for stable access inside the interval
  const stateRef = useRef(state);
  stateRef.current = state;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  useEffect(() => {
    if (isMultiplayer) return;

    // Initialize warning array for all players
    const s = stateRef.current;
    if (idleWarningsRef.current.length !== s.players.length) {
      idleWarningsRef.current = new Array(s.players.length).fill(0);
    }

    const interval = setInterval(() => {
      const s = stateRef.current;
      const skippedPhases = ['game-over', 'turn-end', 'minigame', 'trading'];
      if (skippedPhases.includes(s.phase)) return;

      if (Date.now() < idleDeadlineRef.current) return;

      // Deadline reached — player is idle
      const playerIdx = s.currentPlayerIndex;
      const p = s.players[playerIdx];
      if (p.bankrupt) return;

      // Ensure array is big enough
      while (idleWarningsRef.current.length <= playerIdx) {
        idleWarningsRef.current.push(0);
      }

      // Only increment the warning counter on the FIRST timeout of this idle stretch
      // (when not already auto-chaining). Follow-up auto-plays in the same turn don't
      // count as additional warnings — they're just finishing the turn.
      const isChaining = idleAutoPlayingRef.current;
      let newCount = idleWarningsRef.current[playerIdx];
      if (!isChaining) {
        newCount += 1;
        idleWarningsRef.current[playerIdx] = newCount;
      }

      // Mark that we're auto-playing this player's turn
      idleAutoPlayingRef.current = true;

      // Push deadline to 0 so the next interval tick auto-plays the next phase instantly
      idleDeadlineRef.current = 0;

      if (!isChaining) {
        console.warn(`[idle] ${p.name} timed out in "${s.phase}" — strike ${newCount}/${MAX_IDLE_WARNINGS}`);
      }

      if (newCount > MAX_IDLE_WARNINGS) {
        // Strike 4+: forced bankruptcy
        idleWarningsRef.current[playerIdx] = 0;
        idleAutoPlayingRef.current = false;
        dispatchRef.current({ type: 'SYSTEM_LOG', message: `${p.name} was bankrupted for being idle! (${MAX_IDLE_WARNINGS} warnings exceeded)`, playerIndex: playerIdx });
        setIdleWarningBanner(`${p.name} was bankrupted for being idle!`);
        setTimeout(() => setIdleWarningBanner(null), 3000);
        dispatchRef.current({ type: 'BANKRUPTCY' });
        return;
      }

      // Auto-play the current phase
      const phase = s.phase;
      switch (phase) {
        case 'rolling':
          dispatchRef.current({ type: 'ROLL' });
          break;
        case 'buying':
          dispatchRef.current({ type: 'DECLINE' });
          break;
        case 'paying-rent':
          dispatchRef.current({ type: 'PAY_RENT' });
          break;
        case 'drawing-card':
          // Card flow is 3 steps: DRAW_CARD → APPLY_CARD → RESOLVE_CARD
          // drawCard() keeps phase as 'drawing-card' but sets drawnCard
          if (s.drawnCard) {
            dispatchRef.current({ type: 'APPLY_CARD' });
          } else {
            dispatchRef.current({ type: 'DRAW_CARD' });
          }
          break;
        case 'applying-card':
          dispatchRef.current({ type: 'RESOLVE_CARD' });
          break;
        case 'in-jail':
          dispatchRef.current({ type: 'JAIL_ESCAPE', method: 'roll' });
          break;
        case 'in-debt':
          dispatchRef.current({ type: 'BANKRUPTCY' });
          break;
        default:
          break;
      }

      // Only show warning banner/log on the initial timeout, not on follow-up chain actions
      if (!isChaining) {
        const bannerMsg = newCount === MAX_IDLE_WARNINGS
          ? `FINAL WARNING for ${p.name}! Next idle timeout = bankruptcy.`
          : `${p.name} was idle — auto-action taken. Warning ${newCount}/${MAX_IDLE_WARNINGS}.`;
        const logMsg = newCount === MAX_IDLE_WARNINGS
          ? `FINAL WARNING: ${p.name} was idle (${newCount}/${MAX_IDLE_WARNINGS}). Next timeout = forced bankruptcy!`
          : `${p.name} was idle — auto-action taken. Warning ${newCount}/${MAX_IDLE_WARNINGS}.`;

        dispatchRef.current({ type: 'SYSTEM_LOG', message: logMsg, playerIndex: playerIdx });
        setIdleWarningBanner(bannerMsg);
        setTimeout(() => setIdleWarningBanner(null), 4000);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isMultiplayer]);

  const handleTimerExpire = () => {
    // Timer expiry is handled by the idle system above — this is just visual
  };

  const handleMainAction = () => {
    if (disabled) return;

    if (state.phase === 'in-jail') {
      play('sfx/button-click');
      dispatch({ type: 'JAIL_ESCAPE', method: 'roll' });
    } else if (state.phase === 'rolling') {
      play('sfx/button-click');
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
      {/* Ante logo */}
      <img
        src="/assets/misc/ante-logo.webp"
        alt="Ante"
        className="casinoCrestImg"
        draggable={false}
      />

      {/* Turn indicator — Casino Dealer Plaque */}
      <div key={state.currentPlayerIndex} className="turnIndicator" style={{ '--player-accent': player.color } as React.CSSProperties}>
        <div className="turnAvatar" style={{ background: player.color, overflow: 'hidden' }}>
          {player.sprite ? (
            <img src={player.sprite} alt={player.name} style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' as const }} draggable={false} />
          ) : (
            player.name[0]
          )}
        </div>
        <div className="turnIndicatorContent">
          <span className="turnName">{player.name}</span>
          <span className="turnPhase">
            {({
              'pre-roll': 'ROLLING',
              'rolling': 'ROLLING',
              'buying': 'BUYING',
              'paying-rent': 'PAYING RENT',
              'drawing-card': 'CARD DRAW',
              'applying-card': 'CARD DRAW',
              'minigame': 'GAMBLING',
              'in-jail': 'IN JAIL',
              'in-debt': 'IN DEBT',
              'turn-end': 'END TURN',
              'game-over': 'GAME OVER',
            } as Record<string, string>)[state.phase] || state.phase.toUpperCase().replace(/-/g, ' ')}
          </span>
        </div>
        {state.dice[0] + state.dice[1] > 0 && !isRolling && (
          <span className="turnDice">
            <span className="turnDie">{state.dice[0]}</span>
            <span className="turnDie">{state.dice[1]}</span>
          </span>
        )}
      </div>

      {/* Round & Economy indicator */}
      <div className="roundIndicator">
        <span>Round {state.roundNumber}</span>
        {getRentMultiplier(state.roundNumber, state.finalRounds) > 1 && (
          <span className="rentMultiplier">
            {state.finalRounds ? '▲ FINAL' : `${getRentMultiplier(state.roundNumber, state.finalRounds)}x rent`}
          </span>
        )}
        {state.finalRounds && (
          <span className="finalRoundsTimer">
            {Math.max(0, FINAL_ROUNDS_END - state.roundNumber)} left
          </span>
        )}
        {(state.globalHouses < 10 || state.globalHotels < 4) && (
          <span className="housingSupply">
            H:{state.globalHouses} ★:{state.globalHotels}
          </span>
        )}
      </div>

      <div className="deckStack deckCommunity">
        <img
          src="/assets/misc/community-chest-deck.webp"
          alt="Blind Chest"
          className="deckImg"
          draggable={false}
        />
      </div>

      <div className="deckStack deckChance">
        <img
          src="/assets/misc/chance-deck.webp"
          alt="Risk"
          className="deckImg"
          draggable={false}
        />
      </div>

      {/* Full-screen card overlay (renders via portal-style positioning) */}
      {state.drawnCard && !isRolling && (
        <CardDrawOverlay
          card={state.drawnCard}
          onDismiss={() => dispatch({ type: 'APPLY_CARD' })}
        />
      )}

      {/* Buy/Gamble/Decline buttons */}
      {state.phase === 'buying' && !isRolling ? (
        isMyTurn ? (
          <div className="buyDeclineRow">
            {player.money >= (state.tiles[player.position] as any).price && (
              <button className="buyButton" onClick={() => { play('sfx/buy-property'); dispatch({ type: 'BUY' }); }} disabled={isAnimating}>
                Buy ${(state.tiles[player.position] as any).price}
              </button>
            )}
            {state.minigamesEnabled && (
              <button 
                className="gambleBtn" 
                onClick={() => { play('minigames/minigame-intro'); dispatch({ type: 'GAMBLE', context: 'buying' }); }} 
                disabled={isAnimating}
              >
                <span className="gambleSuit gambleSuitTL">♠</span>
                <span className="gambleSuit gambleSuitTR">♥</span>
                <span className="gambleSuit gambleSuitBL">♦</span>
                <span className="gambleSuit gambleSuitBR">♣</span>
                Gamble
                <span className="gambleSub">RISK IT ALL</span>
              </button>
            )}
            <button className="declineButton" onClick={() => { play('sfx/decline-property'); dispatch({ type: 'DECLINE' }); }} disabled={isAnimating}>
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
              <button className="buyButton" onClick={() => { play('sfx/pay-rent'); dispatch({ type: 'PAY_RENT' }); }} disabled={isAnimating}>
                Pay ${state.pendingRent?.amount || 0}
              </button>
              {state.minigamesEnabled && state.pendingRent && (
                <button 
                  className="gambleBtn" 
                  onClick={() => { play('minigames/minigame-intro'); dispatch({ type: 'GAMBLE', context: 'rent' }); }} 
                  disabled={isAnimating}
                >
                  <span className="gambleSuit gambleSuitTL">♠</span>
                  <span className="gambleSuit gambleSuitTR">♥</span>
                  <span className="gambleSuit gambleSuitBL">♦</span>
                  <span className="gambleSuit gambleSuitBR">♣</span>
                  Gamble
                  <span className="gambleSub">RISK IT ALL</span>
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
      {showTimer && (
        <CountdownTimer
          duration={timerDuration}
          onExpire={handleTimerExpire}
          resetKey={timerResetKey}
        />
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
          <button className="jailBtn" onClick={() => { play('sfx/collect-money'); dispatch({ type: 'JAIL_ESCAPE', method: 'bail' }); }}>
            Pay $50 Bail
          </button>
          {player.getOutOfJailCards > 0 && (
            <button className="jailBtn" onClick={() => { play('sfx/card-good'); dispatch({ type: 'JAIL_ESCAPE', method: 'card' }); }}>
              Use Card
            </button>
          )}
        </div>
      )}

      {/* Idle warning banner */}
      {idleWarningBanner && (
        <div style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          background: idleWarningBanner.includes('bankrupted') ? 'rgba(220,38,38,0.95)' : 'rgba(245,158,11,0.95)',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: 8,
          fontSize: '0.75rem',
          fontWeight: 700,
          fontFamily: 'Nunito, sans-serif',
          textAlign: 'center',
          zIndex: 100,
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          animation: 'idleBannerIn 0.3s ease-out',
        }}>
          {idleWarningBanner}
        </div>
      )}
      <style>{`
        @keyframes idleBannerIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
