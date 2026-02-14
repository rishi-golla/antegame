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
}

export default function Tile({ tile, activeTile, players }: TileProps) {
  // tile.index maps directly to game position (0-39)
  const tokensOnTile = players.filter((p) => !p.bankrupt && p.position === tile.index);

  return (
    <div
      className={`tile tile-${tile.index % 4} tile-${tile.orientation} ${tile.isCorner ? 'tile-corner' : ''} ${activeTile === tile.index ? 'activeTile' : ''}`}
      style={{
        gridRow: `${tile.row} / span ${tile.rowSpan}`,
        gridColumn: `${tile.col} / span ${tile.colSpan}`,
      }}
      title={tile.label}
    >
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
