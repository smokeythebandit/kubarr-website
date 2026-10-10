import { describe, expect, it } from 'vitest';
import { headlineSize, iconLayout, iconFieldLayout } from './hero-layout.js';

describe('viewport hero geometry', () => {
  it('fits an unwrapped two-line title to both available width and short landscape height', () => {
    expect(headlineSize(320, 640, 64, 88, 400, 40)).toBeLessThan(40);
    expect(headlineSize(1920, 1080, 80, 92, 900, 160)).toBeGreaterThan(100);
    expect(headlineSize(844, 390, 80, 64, 720, 70)).toBeLessThan(40);
  });

  it('packs every icon in its available band and recenters incomplete rows on resize', () => {
    for (const [width, top, bottom, columns] of [[320, 70, 250, 3], [1440, 80, 340, 5], [844, 80, 155, 5]]) {
      const spots = iconLayout(width, top, bottom, 9, columns);
      expect(spots).toHaveLength(9);
      expect(new Set(spots.map(({ x, y }) => `${x},${y}`)).size).toBe(9);
      for (const { x, y, size } of spots) {
        expect(x - size / 2).toBeGreaterThan(0);
        expect(x + size / 2).toBeLessThan(width);
        expect(y - size / 2).toBeGreaterThan(top);
        expect(y + size / 2).toBeLessThan(bottom);
      }
      const lastRow = spots.slice(columns);
      expect((lastRow[0].x + lastRow.at(-1).x) / 2).toBe(width / 2);
    }
    expect(iconLayout(320, 0, 200, 0, 3)).toEqual([]);
  });

  it('keeps 18, 21 and 24 landscape icons inside the hero throughout their downward entrance', () => {
    const scene = { width: 844, height: 390, viewportHeight: 390, headerBottom: 81,
      titleLeft: 278, titleRight: 566, titleTop: 161, installTop: 247, installBottom: 311 };
    for (const count of [18, 21, 24]) {
      const { spots, fits } = iconFieldLayout({ ...scene, count });
      expect(fits).toBe(true);
      expect(spots).toHaveLength(count);
      expect(new Set(spots.map(({ x, y }) => `${x},${y}`)).size).toBe(count);
      for (const { x, y, size } of spots) {
        // Allow for scaled breathing, rotation and the full 24px entrance sweep.
        const radius = size * .7 + 2;
        expect(size).toBeGreaterThanOrEqual(20);
        expect(x - radius).toBeGreaterThan(0);
        expect(x + radius).toBeLessThan(scene.width);
        expect(y - radius).toBeGreaterThan(scene.headerBottom);
        expect(y + radius + 24).toBeLessThan(scene.height);
        if (y < scene.installTop) {
          expect(x + radius < scene.titleLeft || x - radius > scene.titleRight).toBe(true);
          expect(y + radius + 24).toBeLessThan(scene.installTop);
        } else {
          expect(y - radius).toBeGreaterThan(scene.installBottom + 12);
        }
      }
    }
  });

  it('reports an infeasible short band rather than placing 8px icons outside the hero', () => {
    const cramped = iconFieldLayout({ width: 844, height: 320, viewportHeight: 320,
      headerBottom: 81, titleLeft: 278, titleRight: 566, titleTop: 126,
      installTop: 193, installBottom: 257, count: 24 });
    expect(cramped.fits).toBe(false);
    const scrolled = iconFieldLayout({ width: 844, height: 416, viewportHeight: 320,
      headerBottom: 81, titleLeft: 278, titleRight: 566, titleTop: 174,
      installTop: 241, installBottom: 305, count: 24 });
    expect(scrolled.fits).toBe(true);
    expect(scrolled.spots.every(({ y, size }) => size >= 20 && y + size * .7 + 26 < 416)).toBe(true);
  });
});
