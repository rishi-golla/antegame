'use client';

import { useState, useEffect, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import { useAudio } from '@/context/AudioContext';
import { getNetWorth } from '@/lib/gameEngine';
import { getPlayerBuff } from '@/lib/buffs';
import AssetsModal from '@/components/PropertyCard/AssetsModal';

interface PlayerListProps {
  onTrade?: (playerIndex: number) => void;
  myPlayerIndex?: number | null;
}

export default function PlayerList({ onTrade, myPlayerIndex = null }: PlayerListProps) {
  const { state, dispatch } = useGame();
  const { play } = useAudio();
  const [assetsPlayer, setAssetsPlayer] = useState<number | null>(null);
  const [viewingPlayer, setViewingPlayer] = useState<number | null>(null);
  const [screenFlash, setScreenFlash] = useState(false);
  const [redVignette, setRedVignette] = useState(false);
  const offer = state.activeTradeOffer;
  const prevMoneyRef = useRef<number[]>([]);
  const prevPhaseRef = useRef(state.phase);
  const prevPlayerRef = useRef(state.currentPlayerIndex);

  // Auto-open assets modal when entering debt phase
  useEffect(() => {
    if (state.phase === 'in-debt') {
      setAssetsPlayer(state.currentPlayerIndex);
    }
  }, [state.phase, state.currentPlayerIndex]);

  // Track win streaks and bankruptcy danger - Phase 3: AGGRESSIVE warnings
  useEffect(() => {
    const currentMoney = state.players.map(p => p.money);
    const isFirstRender = prevMoneyRef.current.length === 0;
    
    if (isFirstRender) {
      prevMoneyRef.current = currentMoney;
      prevPhaseRef.current = state.phase;
      return;
    }

    // Phase 3: Check for bankruptcy danger transitions
    state.players.forEach((player, i) => {
      const prevMoney = prevMoneyRef.current[i] || 0;
      const currentMoney = player.money;
      
      // Player just dropped below $100 - screen flash
      if (prevMoney >= 100 && currentMoney < 100 && !player.bankrupt) {
        setScreenFlash(true);
        play('sfx/danger-alert', { volume: 0.35 });
        setTimeout(() => setScreenFlash(false), 200);
      }
      
      // Player just dropped below $50 - red vignette for everyone
      if (prevMoney >= 50 && currentMoney < 50 && !player.bankrupt) {
        setRedVignette(true);
        play('sfx/critical-alert', { volume: 0.4 });
      }
      
      // Check if anyone is still below $50 for continuous vignette
      const anyPlayerCritical = state.players.some(p => p.money < 50 && !p.bankrupt);
      if (!anyPlayerCritical && redVignette) {
        setRedVignette(false);
      } else if (anyPlayerCritical && !redVignette) {
        setRedVignette(true);
      }
    });

    prevMoneyRef.current = currentMoney;
    prevPhaseRef.current = state.phase;
    prevPlayerRef.current = state.currentPlayerIndex;
  }, [state.players, state.phase, state.currentPlayerIndex, state.activeMinigame]);

  return (
    <>
      {/* Phase 3: Screen flash and vignette effects */}
      {screenFlash && <div className="bankruptcy-screen-flash" />}
      {redVignette && <div className="bankruptcy-red-vignette" />}
      
      <aside className="leftPanel panel">
        <h2>Players</h2>

      {offer && (
        <TradeNotification
          state={state}
          isRecipient={myPlayerIndex === null ? true : offer.toPlayer === myPlayerIndex}
          onAccept={() => dispatch({ type: 'ACCEPT_TRADE' })}
          onReject={() => dispatch({ type: 'REJECT_TRADE' })}
        />
      )}

      <ul>
        {state.players.map((player) => {
          const isActive = state.currentPlayerIndex === player.id;
          const isMe = myPlayerIndex === null || myPlayerIndex === player.id;
          const worth = getNetWorth(state, player.id);
          const canTrade = player.id !== state.currentPlayerIndex &&
            !player.bankrupt &&
            !state.activeTradeOffer &&
            state.phase !== 'game-over';
          // Danger classes based on money
          let dangerClass = '';
          let shouldFlashScreen = false;
          if (!player.bankrupt) {
            if (player.money < 50) {
              dangerClass = 'player-critical-phase3';
              shouldFlashScreen = true; // Red vignette for everyone
            } else if (player.money < 100) {
              dangerClass = 'player-danger-phase3';
            }
          }

          return (
            <li
              key={player.id}
              className={`${isActive ? 'activePlayer' : ''} ${player.bankrupt ? 'bankruptPlayer' : ''} ${!player.bankrupt ? 'clickablePlayer' : ''} ${dangerClass}`}
              onClick={() => {
                if (!player.bankrupt) {
                  if (isMe) {
                    setAssetsPlayer(player.id);
                  } else {
                    setViewingPlayer(player.id);
                  }
                }
              }}
            >
              <div className={`avatar ${player.sprite ? 'spriteAvatar' : ''}`} style={{ background: player.color }}>
                {player.sprite ? (
                  <img src={player.sprite} alt={player.name} className="avatarSprite" draggable={false} />
                ) : (
                  player.name[0]
                )}
              </div>
              <div className="playerInfo">
                <strong>
                  {player.name}
                </strong>
                <p className="playerMoney">${player.money.toLocaleString()}</p>
                {(() => { const buff = getPlayerBuff(player); return buff ? (
                  <span className="playerBuff" title={buff.description}>⚡ {buff.name}</span>
                ) : null; })()}
                <div className="playerMeta">
                  {player.properties.length > 0 && (
                    <span className="propCount">{player.properties.length} props</span>
                  )}
                  {worth > player.money && (
                    <span className="netWorth">Net: ${worth.toLocaleString()}</span>
                  )}
                </div>
                {isMe && player.properties.length > 0 && (
                  <span className="assetsHint">{player.properties.length} assets — tap to view</span>
                )}
                {player.inJail && <span className="jailBadge">In Jail</span>}
                {player.bankrupt && <span className="bankruptBadge">Bankrupt</span>}
                {canTrade && onTrade && (
                  <button
                    className="tradeBtn"
                    onClick={(e) => {
                      e.stopPropagation();
                      play('sfx/trade-offer');
                      onTrade(player.id);
                    }}
                  >
                    Trade
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {state.phase === 'in-debt' && (
        <button
          className="viewAssetsBtn viewAssetsPulse"
          onClick={() => setAssetsPlayer(state.currentPlayerIndex)}
        >
          MANAGE ASSETS
        </button>
      )}

      {assetsPlayer !== null && (
        <AssetsModal playerIndex={assetsPlayer} onClose={() => setAssetsPlayer(null)} />
      )}

      {viewingPlayer !== null && (
        <AssetsModal playerIndex={viewingPlayer} onClose={() => setViewingPlayer(null)} />
      )}
    </aside>
  </>
  );
}

function TradeNotification({
  state,
  isRecipient,
  onAccept,
  onReject,
}: {
  state: ReturnType<typeof useGame>['state'];
  isRecipient: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const { play } = useAudio();
  const offer = state.activeTradeOffer!;
  const from = state.players[offer.fromPlayer];
  const to = state.players[offer.toPlayer];

  return (
    <div className="tradeNotification">
      <div className="tradeNotifHeader">
        <span className="tradeNotifIcon">Trade Offer</span>
      </div>
      <p className="tradeNotifFromTo">
        <span style={{ color: from.color, fontWeight: 700 }}>{from.name}</span>
        {' -> '}
        <span style={{ color: to.color, fontWeight: 700 }}>{to.name}</span>
      </p>

      <div className="tradeNotifDetails">
        {(offer.offerProperties.length > 0 || offer.offerMoney > 0) && (
          <div className="tradeNotifSection">
            <span className="tradeNotifLabel">Offering:</span>
            {offer.offerProperties.map((idx) => (
              <span key={idx} className="tradeNotifProp">{state.tiles[idx].name}</span>
            ))}
            {offer.offerMoney > 0 && <span className="tradeNotifProp">${offer.offerMoney}</span>}
          </div>
        )}
        {(offer.requestProperties.length > 0 || offer.requestMoney > 0) && (
          <div className="tradeNotifSection">
            <span className="tradeNotifLabel">Requesting:</span>
            {offer.requestProperties.map((idx) => (
              <span key={idx} className="tradeNotifProp">{state.tiles[idx].name}</span>
            ))}
            {offer.requestMoney > 0 && <span className="tradeNotifProp">${offer.requestMoney}</span>}
          </div>
        )}
      </div>

      {isRecipient && (
        <p style={{ color: to.color, fontSize: '0.75rem', fontWeight: 700, textAlign: 'center', margin: '4px 0' }}>
          {to.name}&apos;s decision:
        </p>
      )}
      <div className="tradeNotifActions">
        {isRecipient ? (
          <>
            <button className="tradeNotifAccept" onClick={() => { play('sfx/trade-accept'); onAccept(); }}>Accept</button>
            <button className="tradeNotifReject" onClick={() => { play('sfx/trade-reject'); onReject(); }}>Reject</button>
          </>
        ) : (
          <span style={{ color: 'var(--muted)', fontSize: '0.75rem', fontStyle: 'italic' }}>Waiting for {to.name} to respond...</span>
        )}
      </div>
    </div>
  );
}
