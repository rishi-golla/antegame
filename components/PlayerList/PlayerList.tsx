'use client';

import { useGame } from '@/context/GameContext';
import { getNetWorth } from '@/lib/gameEngine';

export default function PlayerList() {
  const { state } = useGame();

  return (
    <aside className="leftPanel panel">
      <h2>Players</h2>
      <ul>
        {state.players.map((player) => {
          const isActive = state.currentPlayerIndex === player.id;
          const worth = getNetWorth(state, player.id);

          return (
            <li
              key={player.id}
              className={`${isActive ? 'activePlayer' : ''} ${player.bankrupt ? 'bankruptPlayer' : ''}`}
            >
              <div className="avatar" style={{ background: player.color }}>
                {player.name[0]}
              </div>
              <div>
                <strong>{player.name}</strong>
                <p>${player.money.toLocaleString()}</p>
                {player.properties.length > 0 && (
                  <p className="propCount">{player.properties.length} properties</p>
                )}
                {player.inJail && <p className="jailBadge">In Jail</p>}
                {player.bankrupt && <p className="bankruptBadge">Bankrupt</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
