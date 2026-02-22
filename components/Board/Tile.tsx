import type { Player, Tile as TileType } from '@/types/game';
import { TILES } from '@/lib/gameData';
import { getTileImage } from '@/lib/assetMap';

interface BoardTile {
  index: number;
  label: string;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  orientation: string;
  isCorner: boolean;
}

interface TileProps {
  tile: BoardTile;
  activeTile: number;
  players: Player[];
  currentPlayerIndex?: number;
  onTileClick?: (tileIndex: number) => void;
  isJustPurchased?: boolean;
  hotLevel?: number;
  isNearMiss?: boolean;
  isDeclineFlash?: boolean;
}

const GROUP_COLORS: Record<string, string> = {
  brown: 'var(--group-brown)',
  'light-blue': 'var(--group-light-blue)',
  pink: 'var(--group-pink)',
  orange: 'var(--group-orange)',
  red: 'var(--group-red)',
  yellow: 'var(--group-yellow)',
  green: 'var(--group-green)',
  'dark-blue': 'var(--group-dark-blue)',
};

const CORNER_ICONS: Record<string, string> = {
  go: 'GO \u2192',
  jail: '\u2687 JAIL',
  'free-parking': '\u2B22 FREE',
  'go-to-jail': '\u2190 JAIL',
};

/** Display labels for tiles — full name shown on two lines via CSS */
function getTileLabel(tileData: TileType): string {
  if (tileData.type === 'corner') return CORNER_ICONS[tileData.cornerKind] ?? tileData.name;
  if (tileData.type === 'chance') return 'RISK';
  if (tileData.type === 'community-chest') return 'BLIND CHEST';
  if (tileData.type === 'tax') return tileData.name;
  if (tileData.type === 'utility') return tileData.name;
  if (tileData.type === 'railroad') return tileData.name;
  return tileData.name;
}

/** No rotation — pixel art looks best upright regardless of tile edge */
function getImageRotation(_orientation: string): number {
  return 0;
}

export default function Tile({ tile, activeTile, players, currentPlayerIndex, onTileClick, isJustPurchased = false, hotLevel = 0, isNearMiss = false, isDeclineFlash = false }: TileProps) {
  const tokensOnTile = players.filter((p) => !p.bankrupt && p.position === tile.index);
  const owner = players.find((p) => !p.bankrupt && p.properties.includes(tile.index));
  const isMortgaged = owner?.mortgaged.includes(tile.index);
  const houses = owner?.houses[tile.index] || 0;
  const tileData = TILES[tile.index];
  const groupColor = tileData.type === 'property' ? GROUP_COLORS[tileData.colorGroup] : null;
  const isCornerTile = tileData.type === 'corner';
  const cornerLabel = isCornerTile ? CORNER_ICONS[tileData.cornerKind] : null;
  const tileLabel = getTileLabel(tileData);
  const tileImage = getTileImage(tileData);
  const imageRotation = getImageRotation(tile.orientation);

  // Determine color strip position based on tile orientation
  const stripClass = groupColor
    ? `tile-strip tile-strip-${tile.orientation}`
    : '';

  // Hot property classes based on landing frequency
  let hotClass = '';
  if (hotLevel >= 5) {
    hotClass = 'tile-hot-blazing'; // Golden aura
  } else if (hotLevel >= 3) {
    hotClass = 'tile-hot-warm'; // Warm glow
  }

  return (
    <div
      className={`tile tile-${tile.index % 4} tile-${tile.orientation} ${tile.isCorner ? 'tile-corner' : ''} ${activeTile === tile.index ? 'activeTile' : ''} ${isMortgaged ? 'tile-mortgaged' : ''} ${isCornerTile ? `tile-corner-${tileData.cornerKind}` : ''} ${tileData.type === 'chance' ? 'tile-risk' : ''} ${tileData.type === 'community-chest' ? 'tile-blind' : ''} ${isJustPurchased ? 'tile-just-purchased' : ''} ${hotClass} ${isNearMiss ? 'tile-near-miss' : ''} ${isDeclineFlash ? 'tile-decline-flash' : ''}`}
      data-tile-index={tile.index}
      style={{
        gridRow: `${tile.row} / span ${tile.rowSpan}`,
        gridColumn: `${tile.col} / span ${tile.colSpan}`,
      }}
      title={tile.label}
      onClick={() => onTileClick?.(tile.index)}
    >
      {tileImage && (
        <img
          src={tileImage}
          alt=""
          className="tileBackgroundImg"
          style={undefined}
          draggable={false}
        />
      )}

      {groupColor && (
        <div
          className={stripClass}
          style={{ '--strip-color': groupColor } as React.CSSProperties}
        />
      )}

      {owner && (
        <div className="tileOwnerBadge" style={{ '--owner-color': owner.color } as React.CSSProperties}>
          {owner.sprite ? (
            <img src={owner.sprite} alt={owner.name} className="tileOwnerSprite" draggable={false} />
          ) : (
            <span className="tileOwnerInitial" style={{ background: owner.color }}>{owner.name[0]}</span>
          )}
        </div>
      )}

      {houses > 0 && (
        <div className="tileHouses">
          {houses === 5 ? (
            <span className="tileHotel">H</span>
          ) : (
            Array.from({ length: houses }).map((_, i) => (
              <span key={i} className="tileHouse" />
            ))
          )}
        </div>
      )}

      {tileData.type !== 'chance' && tileData.type !== 'community-chest' && (
        <span className="tileLabelText">{isCornerTile ? cornerLabel : tileLabel}</span>
      )}

      {tokensOnTile.length > 0 && (
        <div className="tokenStack">
          {tokensOnTile.map((player) => {
            const isActive = currentPlayerIndex !== undefined && player.id === currentPlayerIndex;
            return (
              <div key={player.id} className={`token ${player.sprite ? 'spriteToken' : 'casinoChip'} ${isActive ? 'activePlayer' : ''}`} style={{ background: player.sprite ? undefined : player.color }}>
                {player.sprite ? (
                  <img
                    src={player.sprite}
                    alt={player.name}
                    className="tokenSprite"
                    draggable={false}
                  />
                ) : (
                  player.name[0]
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type { BoardTile };
