'use client';

import { useGame } from '@/context/GameContext';
import type { Tile } from '@/types/game';

interface PropertyPopupProps {
  tileIndex: number;
  onClose: () => void;
}

export default function PropertyPopup({ tileIndex, onClose }: PropertyPopupProps) {
  const { state } = useGame();
  const tile = state.tiles[tileIndex];

  const owner = state.players.find((p) => p.properties.includes(tileIndex));
  const isMortgaged = owner?.mortgaged.includes(tileIndex);
  const houses = owner?.houses[tileIndex] || 0;

  return (
    <div className="popupOverlay" onClick={onClose}>
      <div className="popupCard" onClick={(e) => e.stopPropagation()}>
        {tile.type === 'property' && (
          <div className="popupColorBar" style={{ background: getGroupColor(tile.colorGroup) }} />
        )}

        <h3 className="popupTitle">{tile.name}</h3>

        {(tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility') && (
          <>
            <p className="popupPrice">Price: ${tile.price}</p>

            {tile.type === 'property' && (
              <div className="popupRentTable">
                <div className="popupRentRow"><span>Base Rent</span><span>${tile.rent[0]}</span></div>
                <div className="popupRentRow"><span>Color Set</span><span>${tile.rent[1]}</span></div>
                <div className="popupRentRow"><span>1 House</span><span>${tile.rent[2]}</span></div>
                <div className="popupRentRow"><span>2 Houses</span><span>${tile.rent[3]}</span></div>
                <div className="popupRentRow"><span>3 Houses</span><span>${tile.rent[4]}</span></div>
                <div className="popupRentRow"><span>4 Houses / Hotel</span><span>${tile.rent[5]}</span></div>
                <div className="popupRentRow"><span>House Cost</span><span>${tile.houseCost}</span></div>
                <div className="popupRentRow"><span>Mortgage</span><span>${tile.mortgageValue}</span></div>
              </div>
            )}

            {tile.type === 'railroad' && (
              <div className="popupRentTable">
                <div className="popupRentRow"><span>1 Railroad</span><span>$25</span></div>
                <div className="popupRentRow"><span>2 Railroads</span><span>$50</span></div>
                <div className="popupRentRow"><span>3 Railroads</span><span>$100</span></div>
                <div className="popupRentRow"><span>4 Railroads</span><span>$200</span></div>
              </div>
            )}

            {tile.type === 'utility' && (
              <div className="popupRentTable">
                <div className="popupRentRow"><span>1 Utility</span><span>4x Dice</span></div>
                <div className="popupRentRow"><span>2 Utilities</span><span>10x Dice</span></div>
              </div>
            )}

            <div className="popupOwner">
              {owner ? (
                <>
                  <span>Owned by</span>
                  <div className="popupOwnerBadge" style={{ background: owner.color }}>
                    {owner.name}
                  </div>
                  {isMortgaged && <span className="popupMortgaged">MORTGAGED</span>}
                  {houses > 0 && houses < 5 && <span className="popupHouses">{houses} House{houses > 1 ? 's' : ''}</span>}
                  {houses === 5 && <span className="popupHouses">Hotel</span>}
                </>
              ) : (
                <span className="popupUnowned">Unowned</span>
              )}
            </div>
          </>
        )}

        {tile.type === 'tax' && (
          <p className="popupPrice">Tax: ${tile.amount}</p>
        )}

        {tile.type === 'corner' && (
          <p className="popupPrice">{getCornerDesc(tile.cornerKind)}</p>
        )}

        <button className="popupClose" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function getGroupColor(group: string): string {
  const colors: Record<string, string> = {
    brown: '#8B4513',
    'light-blue': '#87CEEB',
    pink: '#FF69B4',
    orange: '#FF8C00',
    red: '#DC143C',
    yellow: '#FFD700',
    green: '#228B22',
    'dark-blue': '#00008B',
  };
  return colors[group] || '#666';
}

function getCornerDesc(kind: string): string {
  switch (kind) {
    case 'go': return 'Collect $200 when you pass';
    case 'jail': return 'Just Visiting / In Jail';
    case 'free-parking': return 'Take a breather';
    case 'go-to-jail': return 'Go directly to Jail';
    default: return '';
  }
}
