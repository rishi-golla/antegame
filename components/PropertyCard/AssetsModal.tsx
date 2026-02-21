'use client';

import { useEffect } from 'react';
import { useGame } from '@/context/GameContext';
import { useAudio } from '@/context/AudioContext';
import { getNetWorth } from '@/lib/gameEngine';
import { COLOR_GROUPS } from '@/lib/gameData';
import PropertyCard from './PropertyCard';
import { getGroupedProperties, GROUP_LABELS, GROUP_COLORS } from './propertyCardUtils';

interface AssetsModalProps {
  playerIndex: number;
  onClose: () => void;
}

export default function AssetsModal({ playerIndex, onClose }: AssetsModalProps) {
  const { state, dispatch } = useGame();
  const { play } = useAudio();
  const player = state.players[playerIndex];

  // Sound on open/close
  useEffect(() => {
    play('sfx/modal-open');
    return () => { play('sfx/modal-close'); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!player) return null;

  const groups = getGroupedProperties(player, state.tiles);
  const worth = getNetWorth(state, playerIndex);
  const isOwn = playerIndex === state.currentPlayerIndex;
  const inDebt = state.phase === 'in-debt' && isOwn;
  const debtAmount = state.debt?.amount ?? 0;
  const shortfall = Math.max(0, debtAmount - player.money);
  const canPayDebt = inDebt && player.money >= debtAmount;

  // Sell all houses in a color group evenly (from highest count down)
  function handleSellAllHouses(colorGroup: string) {
    const indices = COLOR_GROUPS[colorGroup as keyof typeof COLOR_GROUPS];
    if (!indices) return;
    const owned = indices.filter((i) => player.properties.includes(i));
    let houseCounts = Object.fromEntries(owned.map((i) => [i, player.houses[i] || 0]));
    const total = Object.values(houseCounts).reduce((a, b) => a + b, 0);
    // Sell one at a time from highest
    for (let sold = 0; sold < total; sold++) {
      let maxIdx = -1;
      let maxH = 0;
      for (const idx of owned) {
        if (houseCounts[idx] > maxH) {
          maxH = houseCounts[idx];
          maxIdx = idx;
        }
      }
      if (maxIdx === -1 || maxH === 0) break;
      dispatch({ type: 'SELL_HOUSE', tileIndex: maxIdx });
      houseCounts[maxIdx]--;
    }
  }

  // Mortgage all unmortgaged properties with 0 houses
  function handleMortgageAll() {
    for (const idx of player.properties) {
      if (!player.mortgaged.includes(idx) && (player.houses[idx] || 0) === 0) {
        dispatch({ type: 'MORTGAGE', tileIndex: idx });
      }
    }
  }

  // Find color groups that have houses
  const groupsWithHouses = inDebt
    ? groups.filter(({ indices }) => indices.some((i) => (player.houses[i] || 0) > 0))
    : [];

  // Check if there are unmortgaged props with 0 houses
  const hasMortgageable = inDebt && player.properties.some(
    (idx) => !player.mortgaged.includes(idx) && (player.houses[idx] || 0) === 0
  );

  return (
    <div className="assetsOverlay" onClick={onClose}>
      <div className={`assetsModal ${inDebt ? 'assetsModalDebt' : ''}`} onClick={(e) => e.stopPropagation()}>
        <button className="assetsClose" onClick={onClose}>✕</button>

        {inDebt && (
          <div className="debtHeader">
            <div className="debtHeaderTitle">RAISE FUNDS</div>
            <div className="debtHeaderStats">
              Need: ${debtAmount.toLocaleString()} | Have: ${player.money.toLocaleString()} | Shortfall: ${shortfall.toLocaleString()}
            </div>
            {canPayDebt && (
              <button className="debtPayBtn" onClick={() => { play('sfx/collect-money'); dispatch({ type: 'RESOLVE_DEBT' }); }}>
                Pay Debt (${debtAmount.toLocaleString()})
              </button>
            )}
          </div>
        )}

        {inDebt && (
          <div className="debtQuickActions">
            {groupsWithHouses.map(({ group }) => (
              <button
                key={group}
                className="debtSellHousesBtn"
                onClick={() => handleSellAllHouses(group)}
              >
                Sell All Houses — {GROUP_LABELS[group] || group}
              </button>
            ))}
            {hasMortgageable && (
              <button className="debtMortgageAllBtn" onClick={handleMortgageAll}>
                Mortgage All (no houses)
              </button>
            )}
          </div>
        )}

        <div className="assetsHeader">
          <div className="assetsPlayerBadge" style={{ background: player.color }}>
            {player.sprite ? (
              <img src={player.sprite} alt={player.name} className="assetsAvatarSprite" draggable={false} />
            ) : (
              player.name[0]
            )}
          </div>
          <div className="assetsHeaderInfo">
            <h2 className="assetsPlayerName">{player.name}</h2>
            <p className="assetsStats">
              Cash: ${player.money.toLocaleString()}<br />
              Net Worth: ${worth.toLocaleString()}
            </p>
          </div>
        </div>

        {player.getOutOfJailCards > 0 && (
          <div className="assetsJailCards">
            <div className="assetsGroupLabel">
              <span className="assetsGroupDot" style={{ background: '#ffd700' }} />
              Special Cards
            </div>
            <div className="assetsJailCardItem">
              <span className="assetsJailCardIcon">✦</span>
              <span className="assetsJailCardText">
                Get Out of Jail Free × {player.getOutOfJailCards}
              </span>
            </div>
          </div>
        )}

        {groups.length === 0 && player.getOutOfJailCards === 0 ? (
          <p className="assetsEmpty">No properties yet</p>
        ) : groups.length === 0 ? null : (
          <div className="assetsGroups">
            {groups.map(({ group, indices }) => (
              <div key={group} className="assetsGroup">
                <div className="assetsGroupLabel">
                  <span className="assetsGroupDot" style={{ background: GROUP_COLORS[group] }} />
                  {GROUP_LABELS[group] || group}
                </div>
                <div className="assetsGroupCards">
                  {indices.map((idx) => (
                    <PropertyCard key={idx} tileIndex={idx} player={player} readonly={!isOwn} inDebt={inDebt} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {inDebt && (
          <div className="debtFooter">
            <button className="debtBankruptBtn" onClick={() => { play('sfx/bankruptcy'); dispatch({ type: 'BANKRUPTCY' }); }}>
              Declare Bankruptcy
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
