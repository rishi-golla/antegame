import { describe, it, expect } from 'vitest';
import { TILES, COLOR_GROUPS, CHANCE_CARDS, COMMUNITY_CHEST_CARDS, RAILROAD_INDICES, UTILITY_INDICES } from './gameData';

describe('gameData', () => {
  it('has exactly 40 tiles', () => {
    expect(TILES).toHaveLength(40);
  });

  it('tiles have sequential indices 0-39', () => {
    TILES.forEach((tile, i) => {
      expect(tile.index).toBe(i);
    });
  });

  it('corners are at positions 0, 10, 20, 30', () => {
    expect(TILES[0].type).toBe('corner');
    expect(TILES[10].type).toBe('corner');
    expect(TILES[20].type).toBe('corner');
    expect(TILES[30].type).toBe('corner');
  });

  it('brown group has 2 properties', () => {
    expect(COLOR_GROUPS.brown).toHaveLength(2);
  });

  it('dark-blue group has 2 properties', () => {
    expect(COLOR_GROUPS['dark-blue']).toHaveLength(2);
  });

  it('other color groups have 3 properties each', () => {
    const threeGroups = ['light-blue', 'pink', 'orange', 'red', 'yellow', 'green'] as const;
    for (const group of threeGroups) {
      expect(COLOR_GROUPS[group]).toHaveLength(3);
    }
  });

  it('all color group tile indices point to property tiles', () => {
    for (const [group, indices] of Object.entries(COLOR_GROUPS)) {
      for (const idx of indices) {
        const tile = TILES[idx];
        expect(tile.type).toBe('property');
        if (tile.type === 'property') {
          expect(tile.colorGroup).toBe(group);
        }
      }
    }
  });

  it('has 4 railroads', () => {
    expect(RAILROAD_INDICES).toHaveLength(4);
    for (const idx of RAILROAD_INDICES) {
      expect(TILES[idx].type).toBe('railroad');
    }
  });

  it('has 2 utilities', () => {
    expect(UTILITY_INDICES).toHaveLength(2);
    for (const idx of UTILITY_INDICES) {
      expect(TILES[idx].type).toBe('utility');
    }
  });

  it('has 16 chance cards with valid effects', () => {
    expect(CHANCE_CARDS).toHaveLength(16);
    for (const card of CHANCE_CARDS) {
      expect(card.deckType).toBe('chance');
      expect(card.effect.kind).toBeTruthy();
    }
  });

  it('has 16 community chest cards with valid effects', () => {
    expect(COMMUNITY_CHEST_CARDS).toHaveLength(16);
    for (const card of COMMUNITY_CHEST_CARDS) {
      expect(card.deckType).toBe('community-chest');
      expect(card.effect.kind).toBeTruthy();
    }
  });

  it('all property tiles have positive prices and rents', () => {
    for (const tile of TILES) {
      if (tile.type === 'property') {
        expect(tile.price).toBeGreaterThan(0);
        expect(tile.mortgageValue).toBe(tile.price / 2);
        for (const r of tile.rent) {
          expect(r).toBeGreaterThan(0);
        }
      }
    }
  });
});
