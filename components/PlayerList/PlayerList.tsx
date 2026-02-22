'use client';

import { useState, useEffect, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import { useAudio } from '@/context/AudioContext';
import { getNetWorth } from '@/lib/gameEngine';
import { getPlayerBuff } from '@/lib/buffs';
import { GROUP_COLORS, GROUP_ORDER } from '@/components/PropertyCard/propertyCardUtils';
import { COLOR_GROUPS, RAILROAD_INDICES, UTILITY_INDICES } from '@/lib/gameData';
import AssetsModal from '@/components/PropertyCard/AssetsModal';

const TOTAL_PURCHASABLE = 28; // 22 properties + 4 railroads + 2 utilities
const SUIT_SYMBOLS = ['♠', '♥', '♣', '♦'];

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
  const [moneyDiffs, setMoneyDiffs] = useState<Record<number, number>>({});
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

    // Money change flash
    const diffs: Record<number, number> = {};
    state.players.forEach((player, i) => {
      const prev = prevMoneyRef.current[i] ?? 0;
      const diff = player.money - prev;
      if (diff !== 0 && !isFirstRender) diffs[i] = diff;
    });
    if (Object.keys(diffs).length > 0) {
      setMoneyDiffs(diffs);
      setTimeout(() => setMoneyDiffs({}), 1500);
    }

    prevMoneyRef.current = currentMoney;
    prevPhaseRef.current = state.phase;
    prevPlayerRef.current = state.currentPlayerIndex;
  }, [state.players, state.phase, state.currentPlayerIndex, state.activeMinigame]);

  // Compute net worths for bar proportions
  const allWorths = state.players.map(p => getNetWorth(state, p.id));
  const maxWorth = Math.max(...allWorths, 1);

  // Helper: money color
  const getMoneyColor = (amount: number) => {
    if (amount > 1000) return '#d4af37';
    if (amount >= 500) return '#fff8e7';
    if (amount >= 200) return '#f59e0b';
    return '#ff1744';
  };

  const currentRound = state.roundNumber ?? 1;

  return (
    <>
      {/* Phase 3: Screen flash and vignette effects */}
      {screenFlash && <div className="bankruptcy-screen-flash" />}
      {redVignette && <div className="bankruptcy-red-vignette" />}
      
      <aside className="leftPanel panel">
        <h2>
          Players
          <span className="vipRoundBadge">RD {currentRound}</span>
        </h2>

      {offer && (
        <TradeNotification
          state={state}
          isRecipient={myPlayerIndex === null ? true : offer.toPlayer === myPlayerIndex}
          onAccept={() => dispatch({ type: 'ACCEPT_TRADE' })}
          onReject={() => dispatch({ type: 'REJECT_TRADE' })}
        />
      )}

      <ul>
        {(() => {
          // Compute ranks by net worth
          const worths = state.players.map(p => ({ id: p.id, worth: getNetWorth(state, p.id), bankrupt: p.bankrupt }));
          const sorted = [...worths].sort((a, b) => (a.bankrupt ? 1 : 0) - (b.bankrupt ? 1 : 0) || b.worth - a.worth);
          const rankMap: Record<number, number> = {};
          sorted.forEach((w, i) => { rankMap[w.id] = i + 1; });
          return state.players.map((player) => {
          const isActive = state.currentPlayerIndex === player.id;
          const isMe = myPlayerIndex === null || myPlayerIndex === player.id;
          const worth = getNetWorth(state, player.id);
          const rank = rankMap[player.id];
          const canTrade = player.id !== state.currentPlayerIndex &&
            !player.bankrupt &&
            !state.activeTradeOffer &&
            state.phase !== 'game-over';
          // Danger classes based on money
          let dangerClass = '';
          if (!player.bankrupt) {
            if (player.money < 50) {
              dangerClass = 'player-critical-phase3';
            } else if (player.money < 100) {
              dangerClass = 'player-danger-phase3';
            }
          }

          const worthPct = maxWorth > 0 ? (worth / maxWorth) * 100 : 0;

          return (
            <li
              key={player.id}
              data-suit={SUIT_SYMBOLS[player.id % 4]}
              className={`vipBadge ${isActive ? 'activePlayer vipActive' : ''} ${player.bankrupt ? 'bankruptPlayer vipBankrupt' : ''} ${!player.bankrupt ? 'clickablePlayer' : ''} ${dangerClass}`}
              style={{
                background: `radial-gradient(circle at 15% 15%, ${player.color}0F, transparent 70%), linear-gradient(135deg, #1a0f0f, #2a0f1f)`,
              }}
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
              {/* Bankrupt overlay */}
              {player.bankrupt && <span className="vipBankruptLabel">BANKRUPT</span>}

              <div
                className={`avatar casinoChip ${player.sprite ? 'spriteAvatar' : ''} ${player.bankrupt ? 'vipChipBankrupt' : ''}`}
                style={{
                  background: player.color,
                  borderColor: isActive ? '#d4af37' : player.color,
                  boxShadow: isActive ? '0 0 12px rgba(212,175,55,0.4)' : undefined,
                }}
              >
                <span className="chipInnerRing" style={{ borderColor: `${player.color}88` }} />
                {player.sprite ? (
                  <img src={player.sprite} alt={player.name} className="avatarSprite" draggable={false} />
                ) : (
                  <span className="chipLetter">{player.name[0]}</span>
                )}
              </div>
              <div className="playerInfo">
                <strong className={`vipName ${isActive ? 'vipNameActive' : ''} ${player.bankrupt ? 'vipNameBankrupt' : ''}`}>
                  {player.name}
                  {rank === 1 && !player.bankrupt && <span className="plRankStar"> ★</span>}
                  {rank > 1 && !player.bankrupt && <span className="plRankBadge">{rank === 2 ? '2nd' : rank === 3 ? '3rd' : '4th'}</span>}
                </strong>
                <p className="playerMoney vipMoney" style={{ color: getMoneyColor(player.money) }}>
                  ${player.money.toLocaleString()}
                  {moneyDiffs[player.id] != null && (
                    <span className={`vipMoneyArrow ${moneyDiffs[player.id]! > 0 ? 'vipMoneyUp' : 'vipMoneyDown'}`}>
                      {moneyDiffs[player.id]! > 0 ? '▲' : '▼'}
                    </span>
                  )}
                  {moneyDiffs[player.id] != null && (
                    <span className={`moneyFlash ${moneyDiffs[player.id]! > 0 ? 'moneyFlashGain' : 'moneyFlashLoss'}`}>
                      {moneyDiffs[player.id]! > 0 ? '+' : '−'}${Math.abs(moneyDiffs[player.id]!).toLocaleString()}
                    </span>
                  )}
                </p>
                {/* Property dots */}
                <div className="vipPropDots">
                  {GROUP_ORDER.map((g) => {
                    const groupIndices = g === 'railroad' ? RAILROAD_INDICES : g === 'utility' ? UTILITY_INDICES : COLOR_GROUPS[g as keyof typeof COLOR_GROUPS];
                    if (!groupIndices) return null;
                    const owned = groupIndices.filter(i => player.properties.includes(i)).length;
                    if (owned === 0) return null;
                    return (
                      <span
                        key={g}
                        className="vipPropDot"
                        style={{ background: GROUP_COLORS[g] }}
                        title={`${g}: ${owned}/${groupIndices.length}`}
                      />
                    );
                  })}
                </div>
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
              {/* Net worth bar */}
              <div className="vipNetBar">
                <div className="vipNetBarFill" style={{ width: `${worthPct}%` }} />
              </div>
            </li>
          );
        });
        })()}
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
