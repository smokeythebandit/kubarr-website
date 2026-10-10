import React from 'react';
import { arrivalDelays } from './hero-timing.js';

// Stable initial centers while the catalog mounts; the homepage layout then
// measures the viewport and places every icon in the free space around the copy.
const anchors = {
  sonarr:       [12,  8, 18,  8], plex:         [31,  8, 50,  8],
  immich:       [50,  8, 82,  8], radarr:       [69,  8, 18, 19],
  jellyfin:     [88,  8, 50, 19], qbittorrent:  [20, 18, 82, 19],
  deluge:       [44, 20, 18, 30], sabnzbd:      [60, 18, 50, 30],
  frigate:      [80, 18, 82, 30], headlamp:     [12, 82, 18, 70],
  redmine:      [31, 82, 50, 70], jellyseerr:   [50, 82, 82, 70],
  jackett:      [69, 82, 18, 81], transmission: [88, 82, 50, 81],
  rutorrent:    [20, 92, 82, 81], jenkins:      [40, 92, 18, 92],
  'scm-manager': [60, 92, 50, 92], grafana:      [80, 92, 82, 92],
};

// Full endpoint-to-endpoint travel in pixels: wide / compact / phone. The
// measured layout scales these sweeps to the icon's available space.
const travel = {
  sonarr:       [[-30, 20], [-16, 22], [  0, 16]],
  plex:         [[ 32, 24], [ 22, 18], [ 12, 12]],
  immich:       [[ 36, -16], [ 20,-16], [ 14,-10]],
  radarr:       [[ 30, 28], [ 18, 22], [-12, 12]],
  jellyfin:     [[-34,-12], [-20,-14], [  0, 18]],
  qbittorrent:  [[ 24,-28], [ 16,-18], [ 12, 10]],
  deluge:       [[ 24, 32], [-18, 18], [-12, 12]],
  sabnzbd:      [[-24,-26], [-18,-18], [-12,-10]],
  frigate:      [[-26, 22], [ 20, 16], [ 12, 14]],
  headlamp:     [[-28, 30], [-14, 24], [  0, 18]],
  redmine:      [[ 28,-26], [ 20,-18], [ 14,-12]],
  jellyseerr:   [[-26, 28], [-14, 20], [  0, 18]],
  jackett:      [[ 26, 22], [ 18, 18], [-10, 12]],
  transmission: [[ 28,-24], [ 16,-18], [  0,-16]],
  rutorrent:    [[-38,-18], [-20,-16], [ 14,-10]],
  jenkins:      [[ 36, 22], [ 22, 18], [-14, 12]],
  'scm-manager': [[-32,-24], [-18,-18], [-12,-16]],
  grafana:      [[ 28,-26], [ 18,-18], [ 12,-12]],
};
const depths = {
  sonarr: 1, plex: 0, immich: 2, radarr: 0, jellyfin: 1, qbittorrent: 1,
  deluge: 0, sabnzbd: 2, frigate: 2, headlamp: 2, redmine: 1,
  jellyseerr: 2, jackett: 2, transmission: 2, rutorrent: 2,
  jenkins: 2, 'scm-manager': 2, grafana: 2,
};

// Unknown charts occupy successive slots around the perimeter rather than
// inheriting one overlapping anchor. Existing hand-placed compositions remain.
const candidates = [];
for (const y of [7, 17, 27, 38, 62, 73, 83, 93])
  for (const x of [8, 22, 36, 50, 64, 78, 92])
    if (y < 30 || y > 70 || x < 25 || x > 75) candidates.push([x, y]);

export function newAppAnchors(apps) {
  const unknown = apps.filter(app => !anchors[app.id]);
  const known = apps.filter(app => anchors[app.id]).map(app => app.id);
  const desktop = known.map(id => anchors[id].slice(0, 2));
  const mobile = known.map(id => anchors[id].slice(2));
  const select = used => {
    const result = [];
    for (let i = 0; i < unknown.length; i++) {
      const available = candidates.filter(([x, y]) => !used.some(([ux, uy]) => x === ux && y === uy));
      if (!available.length) break;
      const spot = available.reduce((best, candidate) => {
        const distance = point => Math.min(...used.map(([x, y]) => Math.hypot((point[0] - x) * .8, point[1] - y)));
        return distance(candidate) > distance(best) ? candidate : best;
      });
      result.push(spot);
      used.push(spot);
    }
    return result;
  };
  const wide = select(desktop);
  const narrow = select(mobile);
  return Object.fromEntries(unknown.map((app, i) => [app.id, [...(wide[i] ?? [8 + i % 80, 7]), ...(narrow[i] ?? [8 + i % 80, 93])] ]));
}

export function AppIconField({ catalog }) {
  const apps = catalog.apps;
  const fallback = newAppAnchors(apps);
  return <div className="hero-icons" aria-hidden="true" data-catalog-source={catalog.source} data-catalog-revision={catalog.revision} data-catalog-error={catalog.error ? 'true' : undefined}>
    {apps.map((app, index) => {
      const [x, y, mx, my] = anchors[app.id] ?? fallback[app.id];
      const [[dx, dy], [cdx, cdy], [sdx, sdy]] = travel[app.id] ?? [[28, 22], [18, 18], [12, 12]];
      const depth = depths[app.id] ?? 2;
      return <span className={`float-icon icon-depth-${depth}`} data-app={app.id} title={`${app.name} · ${app.category}`} key={app.id}
        style={{ '--x': `${x}%`, '--y': `${y}%`, '--mx': `${mx}%`, '--my': `${my}%`,
          '--dx': `${dx}px`, '--dy': `${dy}px`, '--cdx': `${cdx}px`, '--cdy': `${cdy}px`,
          '--sdx': `${sdx}px`, '--sdy': `${sdy}px`, '--time': `${18 + (index % 6) * 2.1}s`,
          '--phase': `${(index % 7) * -2.7}s`, '--jiggle-time': `${3 + (index % 5) * .47}s`,
          '--jiggle-phase': `${(index % 9) * .08}s` }}>
        <span className="icon-entrance" style={{ '--arrival-delay': `${arrivalDelays[app.id] ?? 0}ms` }}>
          <span className="icon-wobble">{app.icon ? <img src={app.icon} alt="" draggable="false"/> : <span className="missing-app-icon" title={`${app.name}: no chart icon`}>?</span>}</span>
        </span>
      </span>;
    })}
  </div>;
}
