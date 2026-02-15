import type { Player, Tile as TileType } from '@/types/game';
import { TILES } from '@/lib/gameData';

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
  onTileClick?: (tileIndex: number) => void;
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
  go: 'GO',
  jail: 'JAIL',
  'free-parking': 'FREE',
  'go-to-jail': 'GO TO JAIL',
};

export default function Tile({ tile, activeTile, players, onTileClick }: TileProps) {
  const tokensOnTile = players.filter((p) => !p.bankrupt && p.position === tile.index);
  const owner = players.find((p) => !p.bankrupt && p.properties.includes(tile.index));
  const isMortgaged = owner?.mortgaged.includes(tile.index);
  const houses = owner?.houses[tile.index] || 0;
  const tileData = TILES[tile.index];
  const groupColor = tileData.type === 'property' ? GROUP_COLORS[tileData.colorGroup] : null;
  const isCornerTile = tileData.type === 'corner';
  const cornerLabel = isCornerTile ? CORNER_ICONS[tileData.cornerKind] : null;

  // Determine color strip position based on tile orientation
  const stripClass = groupColor
    ? `tile-strip tile-strip-${tile.orientation}`
    : '';

  return (
    <div
      className={`tile tile-${tile.index % 4} tile-${tile.orientation} ${tile.isCorner ? 'tile-corner' : ''} ${activeTile === tile.index ? 'activeTile' : ''} ${isMortgaged ? 'tile-mortgaged' : ''} ${isCornerTile ? `tile-corner-${tileData.cornerKind}` : ''}`}
      data-tile-index={tile.index}
      style={{
        gridRow: `${tile.row} / span ${tile.rowSpan}`,
        gridColumn: `${tile.col} / span ${tile.colSpan}`,
      }}
      title={tile.label}
      onClick={() => onTileClick?.(tile.index)}
    >
      {groupColor && (
        <div
          className={stripClass}
          style={{ '--strip-color': groupColor } as React.CSSProperties}
        />
      )}

      {owner && (
        <div className="tileOwnerDot" style={{ background: owner.color }} />
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

      <span>{cornerLabel ?? tile.label}</span>

      {tokensOnTile.length > 0 && (
        <div className="tokenStack">
          {tokensOnTile.map((player) => (
            <div key={player.id} className="token" style={{ background: player.color }}>
              {player.name[0]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type { BoardTile };
