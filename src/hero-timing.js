// Curated anchor order preserves the original 18-icon stagger when catalog data arrives.
export const curatedIds = ['sonarr', 'plex', 'immich', 'radarr', 'jellyfin', 'qbittorrent',
  'deluge', 'sabnzbd', 'frigate', 'headlamp', 'redmine', 'jellyseerr', 'jackett',
  'transmission', 'rutorrent', 'jenkins', 'scm-manager', 'grafana'];

// Uneven, shuffled starts overlap the fades from each icon's mount time.
export function entranceDelays(count) {
  const order = Array.from({ length: count }, (_, index) => index);
  // Seeded Fisher-Yates is a permutation for every count (including multiples of 7).
  let seed = (count + 1) * 2654435761 >>> 0;
  for (let index = count - 1; index > 0; index--) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const other = (seed >>> 0) % (index + 1);
    [order[index], order[other]] = [order[other], order[index]];
  }
  const delays = Array(count);
  let elapsed = 0;
  for (const [position, index] of order.entries()) {
    delays[index] = elapsed;
    elapsed += 80 + (position * 37) % 81;
  }
  return delays;
}

const curatedDelays = entranceDelays(curatedIds.length);
export const arrivalDelays = Object.fromEntries(curatedIds.map((id, index) => [id, curatedDelays[index]]));
export const heroTiming = Object.freeze({
  headlineDuration: 800,
  iconDuration: 1000,
  breathingPause: 200,
});
export const lastIconEnd = Math.max(...Object.values(arrivalDelays)) + heroTiming.iconDuration;
export const secondStart = lastIconEnd + heroTiming.breathingPause;
export const installStart = secondStart;

// Shared by SSR and hydration; CSS consumes the same durations used above.
export const heroAnimationStyle = {
  '--hero-second-start': `${secondStart}ms`,
  '--hero-final-start': `${installStart}ms`,
  '--hero-headline-duration': `${heroTiming.headlineDuration}ms`,
  '--hero-icon-duration': `${heroTiming.iconDuration}ms`,
  '--hero-install-duration': `${heroTiming.headlineDuration}ms`,
};
