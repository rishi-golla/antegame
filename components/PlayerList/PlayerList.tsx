'use client';

import { useGame } from '@/context/GameContext';
import { getNetWorth } from '@/lib/gameEngine';

interface PlayerListProps {
  onTrade?: (playerIndex: number) => void;
}

export default function PlayerList({ onTrade }: PlayerListProps) {
  const { state, dispatch } = useGame();
  const offer = state.activeTradeOffer;

  return (
    <aside className="leftPanel panel">
      <h2>Players</h2>

      {offer && (
        <TradeNotification
          state={state}
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
            state.phase !== 'game-over' &&
            state.phase !== 'auction';

          return (
            <li
              key={player.id}
              className={`${isActive ? 'activePlayer' : ''} ${player.bankrupt ? 'bankruptPlayer' : ''}`}
            >
              <div className="avatar" style={{ background: player.color }}>
                {player.name[0]}
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
    </aside>
  );
}

function TradeNotification({
  state,
  onAccept,
  onReject,
}: {
  state: ReturnType<typeof useGame>['state'];
  onAccept: () => void;
  onReject: () => void;
}) {
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

      <div className="tradeNotifActions">
        <button className="tradeNotifAccept" onClick={onAccept}>Accept</button>
        <button className="tradeNotifReject" onClick={onReject}>Reject</button>
      </div>
    </div>
  );
}
