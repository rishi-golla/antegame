'use client';

import type { Tile, PropertyTile, Player, GameState } from '@/types/game';
import { useGame } from '@/context/GameContext';
import { useAudio } from '@/context/AudioContext';
import { COLOR_GROUPS } from '@/lib/gameData';
import { GROUP_COLORS, hasFullGroup, railroadCount, utilityCount } from './propertyCardUtils';
import { getTileImage } from '@/lib/assetMap';

interface PropertyCardProps {
  tileIndex: number;
  player: Player;
  readonly?: boolean;
  inDebt?: boolean;
}

export default function PropertyCard({ tileIndex, player, readonly, inDebt }: PropertyCardProps) {
  const { state, dispatch } = useGame();
  const { play } = useAudio();
  const tile = state.tiles[tileIndex];
  const isMortgaged = player.mortgaged.includes(tileIndex);
  const houses = player.houses[tileIndex] || 0;

  // Determine color bar
  let barColor = '#666';
  let groupKey = '';
  if (tile.type === 'property') {
    barColor = GROUP_COLORS[tile.colorGroup] || '#666';
    groupKey = tile.colorGroup;
  } else if (tile.type === 'railroad') {
    barColor = GROUP_COLORS.railroad;
    groupKey = 'railroad';
  } else if (tile.type === 'utility') {
    barColor = GROUP_COLORS.utility;
    groupKey = 'utility';
  }

  // Full set check
  const isFullSet = tile.type === 'property' && hasFullGroup(player, tile.colorGroup);
  const noMortgagedInGroup = tile.type === 'property' && isFullSet &&
    !COLOR_GROUPS[tile.colorGroup].some((idx) => player.mortgaged.includes(idx));

  // Action eligibility (only for current player, their turn)
  const isCurrentPlayer = player.id === state.currentPlayerIndex && !readonly;
  const canBuild = isCurrentPlayer && tile.type === 'property' && !isMortgaged && houses < 5 && noMortgagedInGroup && (() => {
    const group = COLOR_GROUPS[tile.colorGroup];
    const minH = Math.min(...group.map((i) => player.houses[i] || 0));
    return houses <= minH && player.money >= tile.houseCost;
  })();

  const canSell = isCurrentPlayer && tile.type === 'property' && houses > 0 && (() => {
    const group = COLOR_GROUPS[tile.colorGroup];
    const maxH = Math.max(...group.map((i) => player.houses[i] || 0));
    return houses >= maxH;
  })();

  const canMortgage = isCurrentPlayer && !isMortgaged && houses === 0 &&
    (tile.type !== 'property' || !COLOR_GROUPS[tile.colorGroup]?.some((i) => (player.houses[i] || 0) > 0));

  const canUnmortgage = isCurrentPlayer && isMortgaged &&
    'mortgageValue' in tile && player.money >= Math.ceil(tile.mortgageValue * 1.1);

  // Subtitle info
  let subtitle = '';
  if (tile.type === 'property') {
    subtitle = `$${tile.price}`;
  } else if (tile.type === 'railroad') {
    subtitle = `${railroadCount(player)}/4 owned`;
  } else if (tile.type === 'utility') {
    subtitle = `${utilityCount(player)}/2 owned`;
  }

  const cardClass = [
    'propCard',
    isMortgaged ? 'propCardMortgaged' : '',
    isFullSet && !isMortgaged ? 'propCardFullSet' : '',
  ].filter(Boolean).join(' ');

  const tileImage = getTileImage(tile as any);

  return (
    <div className={cardClass} title={tile.name}>
      <div className="propCardBar" style={{ background: barColor }} />
      {tileImage && (
        <img src={tileImage} alt="" className="propCardImage" draggable={false} />
      )}
      <div className="propCardBody">
        <div className="propCardName">{tile.name}</div>
        <div className="propCardSub">{subtitle}</div>
        {tile.type === 'property' && houses > 0 && (
          <div className="propCardHouses">
            {houses === 5 ? (
              <span className="propCardHotel">★</span>
            ) : (
              Array.from({ length: houses }, (_, i) => (
                <span key={i} className="propCardHouseDot">▪</span>
              ))
            )}
          </div>
        )}
        {isMortgaged && <div className="propCardMortBadge">M</div>}
      </div>
      {(canBuild || canSell || canMortgage || canUnmortgage) && (
        <div className={`propCardActions ${inDebt ? 'propCardActionsDebt' : ''}`}>
          {canBuild && (
            <button className="propCardActBtn propCardBuild" onClick={() => { play('sfx/build-house'); dispatch({ type: 'BUILD_HOUSE', tileIndex }); }} title="Build House">+</button>
          )}
          {canSell && (
            <button className="propCardActBtn propCardSellH" onClick={() => { play('sfx/sell-house'); dispatch({ type: 'SELL_HOUSE', tileIndex }); }} title="Sell House">−</button>
          )}
          {canMortgage && (
            <button className="propCardActBtn propCardMort" onClick={() => { play('sfx/mortgage'); dispatch({ type: 'MORTGAGE', tileIndex }); }} title="Mortgage">M</button>
          )}
          {canUnmortgage && (
            <button className="propCardActBtn propCardUnmort" onClick={() => { play('sfx/unmortgage'); dispatch({ type: 'UNMORTGAGE', tileIndex }); }} title="Unmortgage">U</button>
          )}
        </div>
      )}
    </div>
  );
}
