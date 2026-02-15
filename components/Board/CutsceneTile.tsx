'use client';

import type { Tile } from '@/types/game';

interface CutsceneTileProps {
  tile: Tile;
  isLanding: boolean;
  isGoPassing: boolean;
}

const GROUP_VAR_MAP: Record<string, string> = {
  brown: 'var(--group-brown)',
  'light-blue': 'var(--group-light-blue)',
  pink: 'var(--group-pink)',
  orange: 'var(--group-orange)',
  red: 'var(--group-red)',
  yellow: 'var(--group-yellow)',
  green: 'var(--group-green)',
  'dark-blue': 'var(--group-dark-blue)',
};

function getBuildingContent(tile: Tile) {
  switch (tile.type) {
    case 'property':
      return {
        color: GROUP_VAR_MAP[tile.colorGroup] || 'var(--muted)',
        label: tile.name,
        icon: null,
        height: 60 + (tile.price / 10),
      };
    case 'railroad':
      return { color: '#555', label: tile.name, icon: '=', height: 50 };
    case 'utility':
      return {
        color: '#666',
        label: tile.name,
        icon: tile.name.includes('Electric') ? '\u26A1' : '\u{1F4A7}',
        height: 55,
      };
    case 'tax':
      return { color: '#444', label: tile.name, icon: '$', height: 45 };
    case 'chance':
      return { color: '#c06020', label: '?', icon: '?', height: 40 };
    case 'community-chest':
      return { color: '#2060a0', label: 'C.C.', icon: '\u{1F4E6}', height: 40 };
    case 'corner': {
      const kind = tile.cornerKind;
      if (kind === 'go') return { color: 'var(--success)', label: 'GO', icon: '\u2192', height: 70 };
      if (kind === 'jail') return { color: '#888', label: 'JAIL', icon: '\u{1F6C3}', height: 65 };
      if (kind === 'free-parking') return { color: 'var(--accent)', label: 'FREE\nPARKING', icon: 'P', height: 65 };
      if (kind === 'go-to-jail') return { color: 'var(--danger)', label: 'GO TO\nJAIL', icon: '\u{1F6A8}', height: 70 };
      return { color: '#888', label: tile.name, icon: null, height: 60 };
    }
    default:
      return { color: '#555', label: '', icon: null, height: 50 };
  }
}

export default function CutsceneTile({ tile, isLanding, isGoPassing }: CutsceneTileProps) {
  const building = getBuildingContent(tile);

  return (
    <div className={`cutsceneTile ${isLanding ? 'cutsceneTileLanding' : ''} ${isGoPassing ? 'cutsceneTileGoFlash' : ''}`}>
      {/* Building */}
      <div
        className="cutsceneBuilding"
        style={{
          backgroundColor: building.color,
          height: `${building.height}px`,
        }}
      >
        {building.icon && <span className="cutsceneBuildingIcon">{building.icon}</span>}
        <span className="cutsceneBuildingLabel">{building.label}</span>
      </div>
      {/* Ground */}
      <div className="cutsceneGround" />
    </div>
  );
}
