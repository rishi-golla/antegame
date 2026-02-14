import type { Player } from '@/types/game';

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

export default function Tile({ tile, activeTile, players, onTileClick }: TileProps) {
  // tile.index maps directly to game position (0-39)
  const tokensOnTile = players.filter((p) => !p.bankrupt && p.position === tile.index);
  const owner = players.find((p) => !p.bankrupt && p.properties.includes(tile.index));
  const isMortgaged = owner?.mortgaged.includes(tile.index);
  const houses = owner?.houses[tile.index] || 0;

  return (
    <div
      className={`tile tile-${tile.index % 4} tile-${tile.orientation} ${tile.isCorner ? 'tile-corner' : ''} ${activeTile === tile.index ? 'activeTile' : ''} ${isMortgaged ? 'tile-mortgaged' : ''}`}
      style={{
        gridRow: `${tile.row} / span ${tile.rowSpan}`,
        gridColumn: `${tile.col} / span ${tile.colSpan}`,
      }}
      title={tile.label}
      onClick={() => onTileClick?.(tile.index)}
    >
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
      <span>{tile.label}</span>
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
