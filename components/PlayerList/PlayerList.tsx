'use client';

import { useState, useEffect } from 'react';
import { useGame } from '@/context/GameContext';
import { useAudio } from '@/context/AudioContext';
import { getNetWorth } from '@/lib/gameEngine';
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
  const offer = state.activeTradeOffer;

  // Auto-open assets modal when entering debt phase
  useEffect(() => {
    if (state.phase === 'in-debt') {
      setAssetsPlayer(state.currentPlayerIndex);
    }
  }, [state.phase, state.currentPlayerIndex]);

  return (
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
          const worth = getNetWorth(state, player.id);
          const canTrade = player.id !== state.currentPlayerIndex &&
            !player.bankrupt &&
            !state.activeTradeOffer &&
            state.phase !== 'game-over';

          return (
            <li
              key={player.id}
              className={`${isActive ? 'activePlayer' : ''} ${player.bankrupt ? 'bankruptPlayer' : ''} ${!isActive && !player.bankrupt ? 'clickablePlayer' : ''}`}
              onClick={() => {
                if (!isActive && !player.bankrupt) {
                  setViewingPlayer(player.id);
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
                <strong>{player.name}</strong>
                <p className="playerMoney">${player.money.toLocaleString()}</p>
                <div className="playerMeta">
                  {player.properties.length > 0 && (
                    <span className="propCount">{player.properties.length} props</span>
                  )}
                  {worth > player.money && (
                    <span className="netWorth">Net: ${worth.toLocaleString()}</span>
                  )}
                </div>
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

      <button
        className={`viewAssetsBtn ${state.phase === 'in-debt' ? 'viewAssetsPulse' : ''}`}
        onClick={() => setAssetsPlayer(state.currentPlayerIndex)}
      >
        {state.phase === 'in-debt' ? 'MANAGE ASSETS' : 'View Assets'}
        {(() => {
          const p = state.players[state.currentPlayerIndex];
          return p && p.properties.length > 0 ? ` (${p.properties.length})` : '';
        })()}
      </button>

      {assetsPlayer !== null && (
        <AssetsModal playerIndex={assetsPlayer} onClose={() => setAssetsPlayer(null)} />
      )}

      {viewingPlayer !== null && (
        <AssetsModal playerIndex={viewingPlayer} onClose={() => setViewingPlayer(null)} />
      )}
    </aside>
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
