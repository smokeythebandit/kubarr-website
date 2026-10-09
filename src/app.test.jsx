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
    expect(css).toContain('@keyframes hero-first-shift{from{transform:translateY(.54em)}to{transform:translateY(0)}}');
    expect(css).not.toContain('hero-first-arrive');
    expect(css).toContain('.home .hero h1{font-size:clamp(1.9rem,8vw,4.3rem)}');
    expect(css).toContain('.icon-entrance-ready .home .hero-line-second{animation:hero-arrive var(--hero-headline-duration) ease-out var(--hero-second-start) both}');
    expect(css).toContain('.icon-entrance-ready .home .hero-install{animation:install-arrive var(--hero-install-duration) ease-out var(--hero-final-start) both}');
    expect(hero.style.getPropertyValue('--hero-install-duration')).toBe(hero.style.getPropertyValue('--hero-headline-duration'));
    expect(css).toContain('.icon-entrance-ready .home .icon-entrance{animation:icon-arrive var(--hero-icon-duration) cubic-bezier(.16,1,.3,1) var(--arrival-delay) both}');
    expect(css).toContain('@keyframes hero-arrive{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}');
    expect(css).toContain('@keyframes install-arrive{0%{visibility:hidden;opacity:0;transform:translateY(12px)}.01%{visibility:visible;opacity:0}100%{visibility:visible;opacity:1;transform:translateY(0)}}');
    expect(css).not.toMatch(/\.home \.hero-install\{[^}]*visibility:hidden/);
    expect(css).toContain('.icon-entrance-ready .home .hero-line-first,.icon-entrance-ready .home .hero-line-second,.icon-entrance-ready .home .hero-install,.icon-entrance-ready .home .icon-entrance{visibility:visible;opacity:1;transform:none;animation:none}');
    expect(css).toContain('@keyframes icon-arrive{from{opacity:0;transform:translate(0,var(--enter-y))}to{opacity:1;transform:translate(0,0)}}');
    expect(css).toContain('.home .icon-entrance{--enter-y:24px}');
    expect(css).toContain('.home .icon-entrance{--enter-y:14px}');
    expect(css).not.toMatch(/--enter-x|data-app=[^}]+icon-entrance\{--enter-/);
    expect(css).toMatch(/\.home \.float-icon img\{[^}]*animation:icon-breathe/);
    expect(css).toMatch(/@keyframes icon-breathe\{0%\{transform:translate3d/);
    expect(css).toContain('.home .icon-wobble{display:block;animation:icon-rock var(--jiggle-time) ease-in-out var(--jiggle-phase) infinite}');
    expect(css).toContain('@keyframes icon-rock{0%,100%{transform:rotate(-4deg)}25%{transform:rotate(2deg)}50%{transform:rotate(6deg)}75%{transform:rotate(-1deg)}}');
    expect(css).toMatch(/@media\(prefers-reduced-motion:reduce\)\{\.home \.float-icon img,\.home \.icon-wobble\{animation:none\}/);
    expect(css).toMatch(/\.home \.float-icon\{[^}]*transform:translate\(-50%,-50%\);opacity:var\(--alpha,\.7\)/);
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
    expect(screen.getByRole('code', { name: /Install command/ }).textContent).toBe(command);
    expect(screen.getByRole('button', { name: 'Copy install command' })).toBeTruthy();
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
    ['Features', '/kubarr-website/features/'],
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
      const active = route === '' ? 'Home' : route.startsWith('features/') ? 'Features' : route === 'apps/' ? 'Apps' : undefined;
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

describe('features page', () => {
  const entries = [
    ['observability', 'Observability', 'Logging'],
    ['isolation', 'Isolation', 'Keep app workloads organized'],
    ['modularity', 'Modularity', 'Chart-based apps are independent components'],
  ];
  for (const route of ['features/', ...entries.map(([id]) => `features/${id}/`)]) {
    it(`has real sidebar routes and only the selected content on ${route}`, () => {
      const { container } = render(<App route={route} base="/kubarr-website/"/>);
      const nav = screen.getByRole('navigation', { name: 'Features' });
      const links = Array.from(nav.querySelectorAll('a'));
      expect(links.map(link => [link.textContent, link.getAttribute('href')])).toEqual([
        ['Overview', '/kubarr-website/features/'],
        ...entries.map(([id, label]) => [label, `/kubarr-website/features/${id}/`]),
      ]);
      expect(links.filter(link => link.hasAttribute('aria-current')).map(link => [link.textContent, link.getAttribute('aria-current')])).toEqual([[route === 'features/' ? 'Overview' : entries.find(([id]) => route === `features/${id}/`)[1], 'page']]);
      const selected = entries.find(([id]) => route === `features/${id}/`);
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(selected?.[1] ?? 'Features');
      if (selected) {
        expect(screen.getByText(new RegExp(selected[2]))).toBeTruthy();
        if (selected[0] === 'observability') {
          expect(screen.getByRole('heading', { name: 'Resource tracking', level: 2 })).toBeTruthy();
          expect(screen.getByText('Track CPU and memory usage in monitoring.')).toBeTruthy();
          expect(screen.getByRole('heading', { name: 'Live network view', level: 2 })).toBeTruthy();
          expect(screen.getByText('See network activity and connections live.')).toBeTruthy();
        }
        for (const [id, , text] of entries) if (id !== selected[0]) expect(container.querySelector('.features-content').textContent).not.toContain(text);
        expect(container.querySelector('.feature-links')).toBeNull();
      } else {
        expect(Array.from(container.querySelectorAll('.feature-links a')).map(link => link.getAttribute('href'))).toEqual(entries.map(([id]) => `/kubarr-website/features/${id}/`));
        for (const [, , text] of entries) expect(container.querySelector('.features-content').textContent).not.toContain(text);
      }
      expect(container.querySelector('.feature-card, .features-next, .actions')).toBeNull();
    });
  }
});

describe('isolation content', () => {
  it('shows only relevant isolation screenshots and explains the distinct boundaries', () => {
    const { container } = render(<App route="features/isolation/" base="/kubarr-website/"/>);
    expect(Array.from(container.querySelectorAll('.features-content h2'), heading => heading.textContent)).toEqual([
      'Containers', 'Cilium networking', 'Storage', 'VPN',
    ]);
    expect(screen.getByText(/not separate virtual machines or an absolute security boundary/)).toBeTruthy();
    expect(screen.getByText(/Kubarr does not install Cilium/)).toBeTruthy();
    expect(screen.getByText(/a separate config claim does not isolate shared media/)).toBeTruthy();
    expect(screen.getByText(/Its firewall kill switch is enabled by default/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'charts repository' }).getAttribute('href')).toBe('https://github.com/smokeythebandit/kubarr-charts');
    expect(screen.getByRole('link', { name: 'how Kubarr works' }).getAttribute('href')).toBe('/kubarr-website/docs/how-it-works/');
    expect(screen.getByText(/observed traffic, not NetworkPolicy enforcement/)).toBeTruthy();
    const sections = Array.from(container.querySelectorAll('.features-content section'));
    expect(sections.map(section => Array.from(section.querySelectorAll('img'), img => img.getAttribute('src')))).toEqual([
      ['/kubarr-website/assets/isolation/containers.jpg'], [],
      ['/kubarr-website/assets/isolation/storage.jpg'], ['/kubarr-website/assets/isolation/vpn.jpg'],
    ]);
    for (const figure of container.querySelectorAll('.feature-screenshot')) {
      const img = figure.querySelector('img');
      expect(img.getAttribute('alt')).toBeTruthy();
      expect(img.getAttribute('width')).toBeTruthy();
      expect(img.getAttribute('height')).toBeTruthy();
      expect(figure.querySelector('a').getAttribute('href')).toBe(img.getAttribute('src'));
      expect(figure.querySelector('figcaption').textContent).toBeTruthy();
    }
    expect(container.querySelector('[src*="observability/"]')).toBeNull();
  });
});

describe('menu keyboard handling', () => {
  it('leaves focus alone on Escape while closed', () => {
    home();
    const menu = screen.getByRole('button', { name: 'Menu' });
    const code = screen.getByRole('code', { name: /Install command/ });
    code.focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(code);
    expect(menu.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes an open menu and returns focus to its button', () => {
    home();
    const menu = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(menu);
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    screen.getByRole('code', { name: /Install command/ }).focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(menu);
  });
});

describe('install command copy', () => {
  it('uses the clipboard when available and confirms success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const fallback = vi.fn().mockReturnValue(true);
    document.execCommand = fallback;
    home();
    fireEvent.click(screen.getByRole('button', { name: 'Copy install command' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Command copied to clipboard.'));
    expect(writeText).toHaveBeenCalledWith(command);
    expect(fallback).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Install command copied' }).textContent).toBe('Copied');
  });

  it('selects the visible command when clipboard and fallback both fail', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    const fallback = vi.fn().mockReturnValue(false);
    document.execCommand = fallback;
    home();
    const button = screen.getByRole('button', { name: 'Copy install command' });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Copy failed. Select the command to copy it manually.'));
    expect(fallback).toHaveBeenCalledWith('copy');
    expect(window.getSelection().toString()).toBe(command);
    expect(window.getSelection().getRangeAt(0).commonAncestorContainer).toBe(screen.getByRole('code', { name: /Install command/ }));
    expect(document.activeElement).toBe(button);
    expect(button.textContent).toBe('Copy');
    expect(document.querySelector('textarea')).toBeNull();
  });
});
