// @vitest-environment jsdom
import React from 'react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { App, command, routes } from './app.jsx';
import { arrivalDelays, curatedIds, heroTiming, lastIconEnd, secondStart, installStart } from './hero-timing.js';
import { normalizeCatalog } from './live-catalog.js';
import { AppIconField } from './app-icon-field.jsx';
const css = readFileSync('src/assets/site.css', 'utf8');
function jpegSize(path) {
  const jpeg = readFileSync(path);
  expect(jpeg.readUInt16BE(0)).toBe(0xffd8);
  for (let i = 2; i < jpeg.length;) {
    expect(jpeg[i++]).toBe(0xff);
    const marker = jpeg[i++];
    if ([0xc0, 0xc1, 0xc2, 0xc3].includes(marker))
      return [jpeg.readUInt16BE(i + 5), jpeg.readUInt16BE(i + 3)];
    i += jpeg.readUInt16BE(i);
  }
  throw new Error(`JPEG dimensions missing: ${path}`);
}
const shipPaths = [
  'M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1',
  'M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76',
  'M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6',
  'M12 10v4',
  'M12 2v3',
]; // Kubarr/code/frontend/public/favicon.svg; same lucide Ship as frontend/src/App.tsx.

const execCommand = document.execCommand;
beforeEach(() => {
  window.kubarrTheme = { get: () => 'system', set: () => {} };
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (execCommand === undefined) delete document.execCommand;
  else document.execCommand = execCommand;
  window.getSelection().removeAllRanges();
});

const home = () => render(<App route="" base="/kubarr-website/"/>);

describe('one-page homepage', () => {
  it('places homepage features in image-led columns with links to their docs', () => {
    const { container } = home();
    expect([...container.querySelectorAll('main > section')].map(section => section.id)).toEqual(['', 'features', 'apps']);
    expect([...container.querySelectorAll('main h1')].map(node => node.textContent)).toEqual(['Your media stack on Kubernetes']);
    expect([...container.querySelectorAll('#features .home-feature-gallery h2')].map(node => node.textContent)).toEqual(['Observability', 'Isolation']);
    expect(container.querySelector('#apps .home-feature-gallery h2').textContent).toBe('Apps');
    expect([...container.querySelectorAll('#apps .home-feature-gallery-column h3')].map(node => node.textContent)).toEqual(['App catalog', 'App details', 'Operations']);
    expect(container.querySelectorAll('#apps .feature-screenshot')).toHaveLength(3);
    expect([...container.querySelectorAll('#apps .feature-doc-link')].map(link => link.getAttribute('href'))).toEqual(['/kubarr-website/docs/apps/catalog/', '/kubarr-website/docs/apps/details/', '/kubarr-website/docs/apps/operations/']);
    expect(container.querySelector('#apps p, #apps figcaption, #apps .home-app-list')).toBeNull();
    expect(container.textContent).not.toContain('02 / THE CATALOG');
    expect([...container.querySelectorAll('#features .home-chapter h3')].map(node => node.textContent)).toEqual(['Unified logging', 'Resource tracking', 'Live network view', 'Containers', 'Storage', 'Networking']);
    expect(container.textContent).not.toMatch(/03 — MODULARITY|Only the apps you need\.|Build your own stack\.|Workloads|APP CHARTS \/ COMPONENTS/);
    expect(container.textContent).not.toContain('01 — OBSERVABILITY');
    expect(container.textContent).not.toContain('Know what’s happening.');
    expect(container.textContent).not.toContain('01 / THE PLATFORM');
    expect(container.textContent).not.toContain('Everything in its place.');
    expect(container.textContent).not.toContain('Everything in view.');
    expect(container.textContent).not.toMatch(/03 \/ GET STARTED|Make it yours\.|Bring your cluster\. Choose your apps\./);
    expect(container.querySelector('#features').getAttribute('aria-label')).toBe('Features');
    expect(container.querySelector('#apps').matches('section.home-apps')).toBe(true);
    expect(container.querySelector('#apps .home-feature-gallery').closest('section')).toBe(container.querySelector('#apps'));
    expect(container.querySelector('#observability')).toBeTruthy();
    const galleries = [['observability', ['Unified logging', 'Resource tracking', 'Live network view']], ['isolation', ['Containers', 'Storage', 'Networking']]];
    for (const [id, titles] of galleries) {
      const chapter = container.querySelector(`#${id}`);
      expect(chapter.getAttribute('aria-labelledby')).toBe(`${id}-title`);
      const columns = [...chapter.querySelectorAll('.home-feature-gallery-column')];
      expect(columns).toHaveLength(titles.length);
      expect(columns.map(column => column.querySelector('h3').textContent)).toEqual(titles);
      expect(chapter.querySelectorAll('.home-chapter-row, figcaption')).toHaveLength(0);
      expect(chapter.querySelectorAll('.feature-screenshot')).toHaveLength(3);
      for (const column of columns) {
        const learnMore = column.querySelector('.feature-doc-link');
        expect(learnMore.textContent.trim()).toBe('Learn more →');
        expect(learnMore.getAttribute('href')).toMatch(/^\/kubarr-website\/docs\//);
        if (column.querySelector('img')) expect(column.querySelector('.feature-screenshot a').getAttribute('href')).toBe(column.querySelector('img').getAttribute('src'));
      }
    }
    expect(container.querySelector('#isolation').textContent).not.toMatch(/02 — ISOLATION|Space for every app|Keep app workloads|For chart-specific storage/);
    expect([...container.querySelectorAll('#features .home-chapter')].map(node => node.id)).toEqual(['observability', 'isolation']);
    expect(container.querySelectorAll('.home-chapter-row')).toHaveLength(0);
    expect([...container.querySelectorAll('#features .home-chapter img')].map(node => node.getAttribute('src'))).toEqual(['logs.jpg', 'resources.jpg', 'networking.jpg'].map(name => `/kubarr-website/assets/observability/${name}`).concat(['containers.jpg', 'storage.jpg', 'vpn.jpg'].map(name => `/kubarr-website/assets/isolation/${name}`)));
    for (const figure of container.querySelectorAll('#features .home-chapter .feature-screenshot')) {
      const img = figure.querySelector('img');
      expect(img.getAttribute('alt')).toBeTruthy();
      expect(img.getAttribute('width')).toBeTruthy();
      expect(img.getAttribute('height')).toBeTruthy();
      expect(figure.querySelector('a').getAttribute('href')).toBe(img.getAttribute('src'));
      expect(figure.querySelector('figcaption')).toBeNull();
    }
    const columns = [...container.querySelectorAll('#observability .home-feature-gallery-column')];
    expect(columns.map(column => column.querySelector('img').getAttribute('src'))).toEqual(['logs.jpg', 'resources.jpg', 'networking.jpg'].map(name => `/kubarr-website/assets/observability/${name}`));
    for (const column of columns) {
      const img = column.querySelector('img');
      expect([Number(img.getAttribute('width')), Number(img.getAttribute('height'))]).toEqual([1440, 1214]);
      expect(jpegSize(`src/assets/observability/${img.getAttribute('src').split('/').at(-1)}`)).toEqual([1440, 1214]);
    }
    const isolationSizes = Array.from({ length: 3 }, () => [1440, 1214]);
    [...container.querySelectorAll('#isolation .home-feature-gallery-column img')].forEach((img, index) => {
      expect([Number(img.getAttribute('width')), Number(img.getAttribute('height'))]).toEqual(isolationSizes[index]);
      expect(jpegSize(`src/assets/isolation/${img.getAttribute('src').split('/').at(-1)}`)).toEqual(isolationSizes[index]);
    });
    for (const img of container.querySelectorAll('#apps .home-feature-gallery-column img')) {
      expect([Number(img.getAttribute('width')), Number(img.getAttribute('height'))]).toEqual([1440, 1214]);
      expect(jpegSize(`src/assets/app-management/${img.getAttribute('src').split('/').at(-1)}`)).toEqual([1440, 1214]);
      expect(img.alt).toBeTruthy();
      expect(img.closest('a').getAttribute('href')).toBe(img.getAttribute('src'));
    }
    expect(css).toContain('.feature-screenshot img{display:block;width:100%;height:auto}');
    expect(routes).toEqual(['', 'apps/', 'docs/', 'docs/getting-started/', 'docs/how-it-works/', 'docs/using-kubarr/', 'docs/observability/unified-logging/', 'docs/observability/resource-tracking/', 'docs/observability/live-network-view/', 'docs/isolation/containers/', 'docs/isolation/cilium-networking/', 'docs/isolation/storage/', 'docs/isolation/vpn/', 'docs/apps/catalog/', 'docs/apps/details/', 'docs/apps/operations/']);
    expect(screen.getByRole('link', { name: /Browse supported apps/ }).getAttribute('href')).toBe('/kubarr-website/apps/');
    expect(container.querySelector('.home-app-list')).toBeNull(); // Catalog data is never baked into SSR.
  });

  it('keeps the below-hero galleries plain, compact, and clear of the fixed header', () => {
    expect(css).toContain('.home-features{padding:48px 0 0}');
    expect(css).toContain('.home-features>.container{display:grid;gap:56px}');
    expect(css).toContain('.home-apps{padding:56px 0 64px;background:var(--home-gallery)}');
    expect(css).toContain('.home-feature-gallery-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}');
    expect(css).toContain('.home-feature-gallery-column .feature-screenshot a{border:0;border-radius:10px;background:none;box-shadow:none}');
    expect(css).toContain('.home #features{scroll-margin-top:81px}');
    expect(css).toContain('.home #observability,.home #isolation{scroll-margin-top:80px}');
    expect(css).toContain('.home #features{scroll-margin-top:65px}');
    expect(css).toContain('.home-feature-gallery-cards{grid-template-columns:1fr;gap:32px}');
    expect(css).toContain('--home-gallery:#fff');
    expect(css).toContain('--home-gallery:#182230');
    expect(css).toContain('.home-features{background:var(--home-gallery)}');
    expect(css).not.toMatch(/\.home-(?:features|apps|chapter)\{[^}]*border-top:/);
    expect(css).not.toMatch(/\.home-(?:features|apps|chapter)\{[^}]*padding:[^;}]*1(?:00|20|50|80|95|60|10)px/);
    for (const obsolete of ['home-section-intro', 'home-chapter-reverse', 'home-apps-intro', 'home-chapter-heading'])
      expect(css).not.toContain(obsolete);
  });
});

describe('homepage app icon field', () => {
  it('keeps SSR and hydration empty while retaining a stable shuffled stagger for arriving icons', () => {
    const html = renderToString(<App route="" base="/kubarr-website/"/>);
    expect(html).toContain('data-catalog-source="pending"');
    expect(html).not.toContain('class="icon-entrance"');
    expect(html).not.toContain('assets/apps/');
    const random = vi.spyOn(Math, 'random');
    const { container } = home();
    const field = container.querySelector('.hero-icons');
    expect(field.classList.contains('is-entering')).toBe(false);
    expect(field.querySelectorAll('.float-icon')).toHaveLength(0);
    const delays = Object.values(arrivalDelays);
    expect(delays).toHaveLength(curatedIds.length);
    expect(new Set(delays).size).toBe(curatedIds.length);
    const sorted = [...delays].sort((a, b) => a - b);
    expect(sorted[0]).toBe(0);
    expect(sorted.at(-1)).toBeGreaterThanOrEqual((curatedIds.length - 1) * 80);
    expect(sorted.at(-1)).toBeLessThanOrEqual((curatedIds.length - 1) * 160);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(80);
      expect(sorted[i] - sorted[i - 1]).toBeLessThanOrEqual(160);
    }
    if (curatedIds.length > 2) expect(delays).not.toEqual(sorted);
    expect(random).not.toHaveBeenCalled(); // Nothing waits for a hydration effect to begin.
  });

  it('spaces the first-paint headline timeline while keeping icons independent, with no-JS and reduced-motion fallbacks', () => {
    const { container } = home();
    const hero = container.querySelector('.hero');
    const delays = Object.values(arrivalDelays);
    expect(Math.max(...delays) + heroTiming.iconDuration).toBe(lastIconEnd);
    expect(lastIconEnd).toBeLessThan(secondStart);
    expect(secondStart - lastIconEnd).toBe(heroTiming.breathingPause);
    expect(heroTiming.headlineDuration).toBeGreaterThanOrEqual(700);
    expect(heroTiming.headlineDuration).toBeLessThanOrEqual(900);
    expect(heroTiming.iconDuration).toBeGreaterThanOrEqual(1000);
    expect(installStart).toBe(secondStart);
    expect(heroTiming.headlineDuration).toBe(800);
    for (const [name, ms] of Object.entries({
      '--hero-second-start': secondStart,
      '--hero-final-start': installStart, '--hero-headline-duration': heroTiming.headlineDuration,
      '--hero-icon-duration': heroTiming.iconDuration, '--hero-install-duration': heroTiming.headlineDuration,
    })) expect(hero.style.getPropertyValue(name)).toBe(`${ms}ms`);
    expect(css).toContain('.icon-entrance-ready .home .hero-line-first{animation:hero-first-shift var(--hero-headline-duration) ease-in-out var(--hero-second-start) both}');
    expect(css).toContain('display:grid;grid-template-rows:repeat(2,1.08em)');
    expect(css).toContain('@keyframes hero-first-shift{from{transform:translateY(50%)}to{transform:translateY(0)}}');
    expect(css).not.toContain('hero-first-arrive');
    expect(css).toContain('height:100vh;height:100svh;height:100dvh');
    expect(css).toContain('top:50%;left:50%;transform:translate(-50%,-50%)');
    expect(css).not.toMatch(/min-height:1[68]00px/);
    expect(css).toContain('.home .hero h1 .hero-line-first,.home .hero h1 .hero-line-second{display:block;justify-self:center;white-space:nowrap');
    expect(css).toContain('.home .hero h1 .kubernetes-lockup{white-space:nowrap}');
    for (const tier of [0, 1, 2]) expect(css).toContain(`.home .float-icon.icon-depth-${tier}{width:`);
    expect(css).toContain('.icon-entrance-ready .home .hero-line-second{animation:hero-arrive var(--hero-headline-duration) ease-out var(--hero-second-start) both}');
    expect(css).toContain('.icon-entrance-ready .home .hero-install{animation:install-arrive var(--hero-install-duration) ease-out var(--hero-final-start) both}');
    expect(hero.style.getPropertyValue('--hero-install-duration')).toBe(hero.style.getPropertyValue('--hero-headline-duration'));
    expect(css).toContain('.icon-entrance-ready .home .icon-entrance{animation:icon-arrive var(--hero-icon-duration) cubic-bezier(.16,1,.3,1) var(--arrival-delay) both}');
    expect(css).toContain('.icon-entrance-ready .home .hero-icons{animation:icons-dim var(--hero-install-duration) ease-out var(--hero-final-start) both}');
    expect(css).toContain('@keyframes icons-dim{from{visibility:visible;opacity:1}to{visibility:visible;opacity:.6}}');
    expect(css).toContain('.icon-entrance-ready .home .hero-icons{visibility:visible;opacity:.6;animation:none}');
    expect(hero.querySelector('.hero-icons')).toBeTruthy(); // Present before async icons; uses the same first-paint origin as the headline.
    expect(hero.style.getPropertyValue('--hero-install-duration')).toBe(`${heroTiming.headlineDuration}ms`);
    expect(css).toContain('@keyframes hero-arrive{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}');
    expect(css).toContain('@keyframes install-arrive{0%{visibility:hidden;opacity:0;transform:translate(-50%,12px)}.01%{visibility:visible;opacity:0}100%{visibility:visible;opacity:1;transform:translate(-50%,0)}}');
    expect(css).not.toMatch(/\.home \.hero-install\{[^}]*visibility:hidden/);
    expect(css).toContain('.icon-entrance-ready .home .hero-line-first,.icon-entrance-ready .home .hero-line-second,.icon-entrance-ready .home .hero-install,.icon-entrance-ready .home .icon-entrance{visibility:visible;opacity:1;transform:none;animation:none}');
    expect(css).toContain('@keyframes icon-arrive{0%{visibility:hidden;transform:translate(0,var(--enter-y))}.01%{visibility:visible}100%{visibility:visible;transform:translate(0,0)}}');
    expect(css).not.toMatch(/@keyframes icon-arrive\{[^}]*opacity:/);
    expect(css).not.toMatch(/@keyframes icon-breathe\{[^}]*opacity:/);
    expect(css).toContain('.home .icon-entrance{--enter-y:24px}');
    expect(css).toContain('.home .icon-entrance{--enter-y:14px}');
    expect(css).not.toMatch(/--enter-x|data-app=[^}]+icon-entrance\{--enter-/);
    expect(css).toMatch(/\.home \.float-icon img\{[^}]*animation:icon-breathe/);
    expect(css).toMatch(/@keyframes icon-breathe\{0%\{transform:translate3d/);
    expect(css).toContain('.home .icon-wobble{display:block;animation:icon-rock var(--jiggle-time) ease-in-out calc(var(--hero-final-start) + var(--hero-install-duration) + var(--jiggle-phase)) infinite}');
    expect(css).toContain('@keyframes icon-rock{0%{transform:rotate(0)}25%{transform:rotate(2deg)}50%{transform:rotate(6deg)}75%{transform:rotate(-1deg)}100%{transform:rotate(0)}}');
    expect(css).not.toMatch(/icon-rock[^}]*var\(--jiggle-phase\) infinite/);
    expect(css).toMatch(/@media\(prefers-reduced-motion:reduce\)\{\.home \.float-icon img,\.home \.icon-wobble\{animation:none\}/);
    expect(css).toMatch(/\.home \.float-icon\{[^}]*transform:translate\(-50%,-50%\)\}/);
    expect(css).not.toContain('--alpha:');
    expect(css).not.toContain('is-entering');
    const html = renderToString(<App route="" base="/kubarr-website/"/>);
    expect(html).toContain('class="hero-line-first"');
    expect(html).toContain('class="hero-line-second"');
    expect(html).toContain('href="#main">Skip to content</a>');
    expect(html).toContain('data-copy-command');
    expect(html).not.toContain('visibility:hidden'); // Only the pre-paint CSS gates controls.
  });

  it('leaves the headline and install control interactive without a catalog', () => {
    const { container } = home();
    const field = container.querySelector('.hero-icons');
    expect(field.getAttribute('aria-hidden')).toBe('true');
    expect(field.querySelectorAll('img')).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Your media stack on Kubernetes');
    expect(screen.getByRole('heading', { name: 'Your media stack on Kubernetes' })).toBeTruthy();
    expect(container.querySelector('.hero-line-first').textContent).toBe('Your media stack ');
    expect(container.querySelector('.hero-line-second .kubernetes-logo').getAttribute('src')).toBe('/kubarr-website/assets/kubernetes-icon-color.svg');
    expect(container.querySelector('[data-install-command]').textContent).toBe(command);
    expect(screen.getByRole('button', { name: 'Click to copy install command' })).toBeTruthy();
  });

  it('gives each catalog logo stable desktop and mobile anchors without event-driven routes', () => {
    const catalog = { ...normalizeCatalog(curatedIds.map(id => ({ id, group: 'media', name: id, category: 'media', icon: true })), 'a'.repeat(40)), source: 'live', error: null };
    const { container } = render(<AppIconField catalog={catalog}/>);
    const icons = [...container.querySelectorAll('.float-icon')];
    expect(icons).toHaveLength(curatedIds.length);
    expect(new Set(icons.map(icon => icon.dataset.app)).size).toBe(curatedIds.length);
    expect([...container.querySelectorAll('.float-icon img')].every(img => img.src.startsWith('https://raw.githubusercontent.com/smokeythebandit/kubarr-charts/'))).toBe(true);
    for (const icon of icons) {
      for (const property of ['--x', '--y', '--mx', '--my'])
        expect(icon.style.getPropertyValue(property)).toMatch(/^\d+%$/);
      const distance = (x, y) => Math.hypot(
        parseFloat(icon.style.getPropertyValue(x)), parseFloat(icon.style.getPropertyValue(y)));
      expect(distance('--dx', '--dy')).toBeGreaterThanOrEqual(25);
      expect(distance('--dx', '--dy')).toBeLessThanOrEqual(60);
      expect(distance('--sdx', '--sdy')).toBeGreaterThanOrEqual(10);
      expect(distance('--sdx', '--sdy')).toBeLessThanOrEqual(25);
      expect(distance('--cdx', '--cdy')).toBeGreaterThanOrEqual(18);
      expect(parseFloat(icon.style.getPropertyValue('--time'))).toBeGreaterThanOrEqual(18);
      expect(parseFloat(icon.style.getPropertyValue('--time'))).toBeLessThanOrEqual(30);
      expect(icon.className).toMatch(/icon-depth-[012]/);
    }
    expect(container.querySelector('.hero-icons').style.pointerEvents).toBe('');
  });
});

describe('shared main navigation', () => {
  it('reveals the homepage header with the install phase, without making hidden links focusable or shifting the hero', () => {
    const { container } = home();
    const header = container.querySelector('.site-header');
    const hero = container.querySelector('.hero');
    expect(header.classList.contains('home-header')).toBe(true);
    expect(hero.style.getPropertyValue('--hero-final-start')).toBe(`${installStart}ms`);
    for (const property of ['--hero-final-start', '--hero-install-duration'])
      expect(header.style.getPropertyValue(property)).toBe(hero.style.getPropertyValue(property));
    expect(css).toContain('.icon-entrance-ready .home .home-header{animation:header-arrive var(--hero-install-duration) ease-out var(--hero-final-start) both}');
    expect(css).toContain('@keyframes header-arrive{0%{visibility:hidden;opacity:0}.01%{visibility:visible;opacity:0}100%{visibility:visible;opacity:1}}');
    expect(css).not.toMatch(/@keyframes header-arrive\{[^}]*transform/);
    expect(css).not.toMatch(/\.home \.home-header\{[^}]*visibility:hidden/); // No JS means a visible, operable header.
    expect(css).toContain('.site-header{border-bottom:1px solid var(--line);background:var(--header);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);position:sticky;top:0;z-index:20}');
    expect(css).toContain('.header-inner{min-height:80px;');
    expect(css).toContain('.header-inner{min-height:64px;');
    expect(css).toContain('.icon-entrance-ready .home .home-header{visibility:visible;opacity:1;animation:none}');
    const html = renderToString(<App route="" base="/kubarr-website/"/>);
    expect(html).toContain('class="site-header home-header"');
    expect(html).toContain(`--hero-final-start:${installStart}ms`);
    expect(html).not.toContain('visibility:hidden');
  });

  it('does not gate headers on other routes or retain the home animation after navigation', () => {
    const { container, rerender } = home();
    rerender(<App route="docs/" base="/kubarr-website/"/>);
    const header = container.querySelector('.site-header');
    expect(header.className).toBe('site-header');
    expect(header.style.getPropertyValue('--hero-final-start')).toBe('');
    expect(header.style.getPropertyValue('--hero-install-duration')).toBe('');
    for (const route of ['apps/', 'docs/', 'docs/getting-started/']) {
      const html = renderToString(<App route={route} base="/kubarr-website/"/>);
      expect(html).toContain('class="site-header"');
      expect(html).not.toContain('home-header');
    }
    expect(css).not.toMatch(/\.icon-entrance-ready \.site-header\{/);
  });

  it('uses the app Ship outline in the brand and favicon, with accessible theme-aware header colors', () => {
    const { container } = home();
    const brand = screen.getByRole('link', { name: 'Kubarr home' });
    expect(brand.getAttribute('href')).toBe('/kubarr-website/');
    expect(brand.textContent).toBe('Kubarr');
    expect(brand.querySelector('img')).toBeNull();
    const icon = brand.querySelector('svg');
    expect(icon).toBeTruthy();
    for (const [name, value] of Object.entries({ width: '28', height: '28', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' }))
      expect(icon.getAttribute(name)).toBe(value);
    expect([...icon.querySelectorAll('path')].map(path => path.getAttribute('d'))).toEqual(shipPaths);
    expect(css).toContain('.brand svg{flex:none;color:#3b82f6}:root.dark .brand svg{color:#60a5fa}');
    const favicon = new DOMParser().parseFromString(readFileSync('src/assets/mark.svg', 'utf8'), 'image/svg+xml').documentElement;
    expect(favicon.getAttribute('stroke')).toBe('#3b82f6');
    expect(favicon.getAttribute('stroke-width')).toBe('2');
    expect([...favicon.querySelectorAll('path')].map(path => path.getAttribute('d'))).toEqual(shipPaths);
    expect(container.querySelector('.kubernetes-logo')).toBeTruthy();
  });
  const expected = [
    ['Home', '/kubarr-website/'],
    ['Documentation', '/kubarr-website/docs/'],
    ['Apps', '/kubarr-website/apps/'],
    ['GitHub ↗', 'https://github.com/smokeythebandit/Kubarr'],
  ];

  for (const route of routes) {
    it(`renders the same menu with the correct active link on ${route || 'home'}`, () => {
      const { container } = render(<App route={route} base="/kubarr-website/"/>);
      expect(container.querySelector('footer')).toBeNull();
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      const links = Array.from(nav.querySelectorAll('a'));
      expect(links.map(link => [link.textContent, link.getAttribute('href')])).toEqual(expected);
      const active = route === '' ? 'Home' : route === 'apps/' ? 'Apps' : route.startsWith('docs/') ? 'Documentation' : undefined;
      expect(links.filter(link => link.hasAttribute('aria-current')).map(link => [link.textContent, link.getAttribute('aria-current')])).toEqual(active ? [[active, 'page']] : []);
      expect(nav.querySelector('.nav-github')).toBe(links[3]);
      expect(screen.queryByLabelText('Theme')).toBeNull();
    });

    it(`uses the same responsive menu behavior on ${route || 'home'}`, () => {
      render(<App route={route} base="/kubarr-website/"/>);
      const menu = screen.getByRole('button', { name: 'Menu' });
      const nav = screen.getByRole('navigation', { name: 'Main navigation' });
      expect(menu.getAttribute('aria-controls')).toBe(nav.id);
      expect(menu.getAttribute('aria-expanded')).toBe('false');
      fireEvent.click(menu);
      expect(menu.getAttribute('aria-expanded')).toBe('true');
      expect(nav.classList.contains('is-open')).toBe(true);
      nav.querySelector('a').focus();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(menu.getAttribute('aria-expanded')).toBe('false');
      expect(nav.classList.contains('is-open')).toBe(false);
      expect(document.activeElement).toBe(menu);
      fireEvent.click(menu);
      nav.querySelector('a').addEventListener('click', event => event.preventDefault()); // jsdom cannot follow page links.
      fireEvent.click(nav.querySelector('a'));
      expect(menu.getAttribute('aria-expanded')).toBe('false');
      expect(nav.classList.contains('is-open')).toBe(false);
    });
  }
});

describe('menu keyboard handling', () => {
  it('leaves focus alone on Escape while closed', () => {
    const { container } = home();
    const menu = screen.getByRole('button', { name: 'Menu' });
    const code = container.querySelector('[data-copy-command]');
    code.focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(code);
    expect(menu.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes an open menu and returns focus to its button', () => {
    const { container } = home();
    const menu = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(menu);
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    container.querySelector('[data-copy-command]').focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(menu);
  });
});

describe('documentation diagrams', () => {
  it('puts a labeled diagram and a how-it-works explanation on every feature page', () => {
    const features = [
      ['docs/observability/unified-logging/', 'Unified logging'],
      ['docs/observability/resource-tracking/', 'Resource tracking'],
      ['docs/observability/live-network-view/', 'Live network view'],
      ['docs/isolation/containers/', 'Containers'],
      ['docs/isolation/cilium-networking/', 'Cilium networking'],
      ['docs/isolation/storage/', 'Storage'],
      ['docs/isolation/vpn/', 'VPN networking'],
      ['docs/apps/catalog/', 'App catalog'],
      ['docs/apps/details/', 'App details'],
      ['docs/apps/operations/', 'Operations'],
    ];
    const view = render(<App route={features[0][0]} base="/kubarr-website/"/>);
    for (const [route, title] of features) {
      view.rerender(<App route={route} base="/kubarr-website/"/>);
      expect(screen.getByRole('img', { name: `${title} flow diagram` })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'How it works' })).toBeTruthy();
      expect(view.container.querySelectorAll('.docs-diagram-node').length).toBeGreaterThanOrEqual(3);
      expect(view.container.querySelector('.prose h2 + .docs-diagram + p').textContent.length).toBeGreaterThan(100);
    }
  });
});

describe('install command copy', () => {
  it('uses the clipboard when available and confirms success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const fallback = vi.fn().mockReturnValue(true);
    document.execCommand = fallback;
    home();
    fireEvent.click(screen.getByRole('button', { name: 'Click to copy install command' }));
    await waitFor(() => expect(document.querySelector('.copy-status').textContent).toBe('Command copied to clipboard.'));
    expect(writeText).toHaveBeenCalledWith(command);
    expect(fallback).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Install command copied' }).querySelector('.copy-label').textContent).toBe('Copied!');
  });

  it('selects the visible command when clipboard and fallback both fail', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    const fallback = vi.fn().mockReturnValue(false);
    document.execCommand = fallback;
    home();
    const button = screen.getByRole('button', { name: 'Click to copy install command' });
    fireEvent.click(button);
    await waitFor(() => expect(document.querySelector('.copy-status').textContent).toBe('Copy failed. Select the command to copy it manually.'));
    expect(fallback).toHaveBeenCalledWith('copy');
    expect(window.getSelection().toString()).toBe(command);
    expect(window.getSelection().getRangeAt(0).commonAncestorContainer).toBe(document.querySelector('[data-install-command]'));
    expect(document.activeElement).toBe(button);
    expect(button.querySelector('.copy-label').textContent).toBe('Click to copy');
    expect(document.querySelector('textarea')).toBeNull();
  });
});
