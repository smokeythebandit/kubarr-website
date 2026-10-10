// Layout the decorative catalog in the free bands around the centered statement.
// Positions and sizes are pixels so resizing, zoom and font changes use real space,
// rather than percentages of an assumed (and previously very tall) hero.
export function iconLayout(width, top, bottom, count, columns) {
  if (!count) return [];
  const rows = Math.ceil(count / columns);
  const height = Math.max(0, bottom - top);
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const size = Math.max(0, Math.min(180, cellWidth - 16, cellHeight - 10));
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const inRow = Math.min(columns, count - row * columns);
    const column = index % columns;
    return {
      x: width * (column + (columns - inRow) / 2 + .5) / columns,
      y: top + cellHeight * (row + .5),
      size,
    };
  });
}

// All coordinates are relative to the hero. Bands reserve the entrance's 24px
// downward sweep (14px on phones), plus room for the scaled drift and rotation.
// If the smallest tier would be illegible, the caller grows the hero and lets
// the page scroll rather than clipping icons or silently shrinking them to 8px.
export function iconFieldLayout({ width, height, viewportHeight = height, headerBottom, titleLeft, titleRight, titleTop,
  installTop, installBottom, count }) {
  if (!count) return { spots: [], fits: true };
  const enter = width <= 700 ? 14 : 24;
  const shortWide = viewportHeight < 500 && width > 700 && titleLeft > 124 && width - titleRight > 124;
  const split = shortWide ? Math.max(0, count - 4) : Math.ceil(count / 2);
  let upper;
  if (shortWide) {
    const leftCount = Math.ceil(split / 2);
    const top = headerBottom + 8;
    const bottom = installTop - enter - 8;
    upper = [...iconLayout(titleLeft - 16, top, bottom, leftCount, 3),
      ...iconLayout(width - titleRight - 16, top, bottom, split - leftCount, 3)
        .map(spot => ({ ...spot, x: spot.x + titleRight + 16 }))];
  } else {
    upper = iconLayout(width, headerBottom + 8, titleTop - enter - 8,
      split, width <= 700 ? 3 : 5);
  }
  const lower = iconLayout(width, installBottom + 16, height - enter - 8,
    count - split, shortWide ? 4 : width <= 700 ? 3 : 5);
  const spots = [...upper, ...lower];
  return { spots, fits: spots.every(({ size }) => size >= 20) };
}

export function headlineSize(width, height, headerHeight, commandHeight, measuredWidth, currentSize) {
  // measuredWidth is the wider unwrapped line at currentSize, including its logo.
  return Math.max(16, Math.min(176, width * .12, width * .94 * currentSize / measuredWidth,
    height < 500 ? (height - headerHeight - commandHeight - 96) / 4 :
      (height - headerHeight - commandHeight - 48) / 2.7));
}
