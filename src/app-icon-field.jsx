import React from 'react';
import { supportedApps } from './supported-apps.js';
import { arrivalDelays } from './hero-timing.js';

// Hand-placed centers, in percentages of the hero. Mobile has its own composition:
// the narrow sides cannot safely hold logos beside the headline.
const anchors = {
  sonarr:       [14, 13, 13,  7], plex:         [81, 15, 72,  8],
  immich:       [34, 11, 44, 18], radarr:       [66, 18, 85, 17],
  jellyfin:     [49, 20, 12, 26], qbittorrent:  [ 9, 44, 53, 10],
  deluge:       [12, 58, 74, 28], sabnzbd:      [ 7, 70, 25, 18],
  frigate:      [18, 31, 48, 27], headlamp:     [91, 37, 90, 72],
  redmine:      [84, 55, 20, 76], jellyseerr:   [91, 69, 46, 76],
  jackett:      [76, 76, 75, 80], transmission: [13, 84,  9, 88],
  rutorrent:    [32, 92, 29, 87], jenkins:      [50, 83, 61, 94],
  'scm-manager': [69, 92, 87, 87], grafana:      [88, 85, 48, 89],
};

// Full endpoint-to-endpoint travel in pixels: wide / compact / phone. Keep the
// fixed centers above; the short, directional sweeps stay in the whitespace
// around each center rather than sending logos across the headline.
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

export function AppIconField({ base }) {
  return <div className="hero-icons" aria-hidden="true">
    {supportedApps.map((app, index) => {
      const [x, y, mx, my] = anchors[app.id];
      const [[dx, dy], [cdx, cdy], [sdx, sdy]] = travel[app.id];
      return <span className={`float-icon icon-depth-${app.depth}`} data-app={app.id} key={app.id}
        style={{ '--x': `${x}%`, '--y': `${y}%`, '--mx': `${mx}%`, '--my': `${my}%`,
          '--dx': `${dx}px`, '--dy': `${dy}px`, '--cdx': `${cdx}px`, '--cdy': `${cdy}px`,
          '--sdx': `${sdx}px`, '--sdy': `${sdy}px`, '--time': `${18 + (index % 6) * 2.1}s`,
          '--phase': `${(index % 7) * -2.7}s`, '--jiggle-time': `${3 + (index % 5) * .47}s`,
          '--jiggle-phase': `${(index % 9) * -.61}s` }}>
        <span className="icon-entrance" style={{ '--arrival-delay': `${arrivalDelays[index]}ms` }}>
          <span className="icon-wobble"><img src={`${base}assets/apps/${app.id}.svg`} alt="" draggable="false"/></span>
        </span>
      </span>;
    })}
  </div>;
}
