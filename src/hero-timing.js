import { supportedApps } from './supported-apps.js';

// Uneven, shuffled starts overlap the fades without waiting for hydration.
function entranceDelays(count) {
  const order = Array.from({ length: count }, (_, index) => (index * 7 + 3) % count);
  const delays = Array(count);
  let elapsed = 0;
  for (const [position, index] of order.entries()) {
    delays[index] = elapsed;
    elapsed += 80 + (position * 37) % 81;
  }
  return delays;
}

export const arrivalDelays = entranceDelays(supportedApps.length);
export const heroTiming = Object.freeze({
  headlineDuration: 800,
  iconDuration: 1000,
  breathingPause: 200,
});
export const lastIconEnd = Math.max(...arrivalDelays) + heroTiming.iconDuration;
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
