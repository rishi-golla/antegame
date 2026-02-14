'use client';

import { useState } from 'react';
import { useGame } from '@/context/GameContext';
import { getNetWorth } from '@/lib/gameEngine';
import TradeModal from '@/components/Board/TradeModal';

export default function PlayerList() {
  const { state } = useGame();
  const [tradeTarget, setTradeTarget] = useState<number | null>(null);

  return (
    <aside className="leftPanel panel">
      <h2>Players</h2>
      <ul>
        {state.players.map((player) => {
          const isActive = state.currentPlayerIndex === player.id;
          const worth = getNetWorth(state, player.id);
          const canTrade = state.phase === 'turn-end' &&
            player.id !== state.currentPlayerIndex &&
            !player.bankrupt;

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
                {canTrade && (
                  <button
                    className="tradeBtn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTradeTarget(player.id);
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
      {tradeTarget !== null && (
        <TradeModal targetPlayer={tradeTarget} onClose={() => setTradeTarget(null)} />
      )}
    </aside>
  );
}
