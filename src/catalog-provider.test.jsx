// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { App } from './app.jsx';
import { CatalogProvider, resetCatalogCacheForTests, useCatalog } from './catalog-provider.jsx';
import { newAppAnchors } from './app-icon-field.jsx';
import { curatedIds, entranceDelays, secondStart } from './hero-timing.js';
import { cacheKey, freshFor, repository, treeURL } from './live-catalog.js';

const revision = 'b'.repeat(40);
const response = (body, status = 200) => ({ ok: status === 200, status, headers: { get: () => null }, text: async () => body });
function mockGitHub(ids = ['novel']) {
  const tree = { sha: revision, truncated: false, tree: ids.flatMap(id => [
    { type: 'blob', path: `media-server/${id}/Chart.yaml` },
    ...(id === 'novel' ? [] : [{ type: 'blob', path: `media-server/${id}/icon.svg` }]),
  ]) };
  return vi.fn(async url => url === treeURL ? response(JSON.stringify(tree)) : response(`name: ${url.split('/').at(-2)}\nannotations:\n  kubarr.io/category: media-server\n  kubarr.io/display-name: Latest\n`));
}
afterEach(() => { cleanup(); resetCatalogCacheForTests(); window.localStorage.clear(); vi.unstubAllGlobals(); });

it('hydrates empty SSR, then renders fresh chart metadata and a missing-icon placeholder', async () => {
  let finish;
  const fetcher = mockGitHub();
  vi.stubGlobal('fetch', vi.fn((...args) => args[0] === treeURL ? new Promise(resolve => { finish = () => resolve(fetcher(...args)); }) : fetcher(...args)));
  const ssr = renderToString(<App route="" base="/kubarr-website/"/>);
  expect(ssr).toContain('data-catalog-source="pending"');
  expect(ssr).not.toContain('assets/apps/');
  expect(ssr).not.toContain('class="float-icon');
  expect(fetch).not.toHaveBeenCalled();
  const { container } = render(<App route="" base="/kubarr-website/"/>);
  expect(container.querySelectorAll('.float-icon')).toHaveLength(0);
  const field = container.querySelector('.hero-icons'); // Its first-paint fade must not remount when the network resolves.
  expect(container.querySelector('.hero').style.getPropertyValue('--hero-second-start')).toBe(`${secondStart}ms`);
  finish();
  await waitFor(() => expect(container.querySelector('.hero-icons').dataset.catalogSource).toBe('live'));
  expect(container.querySelector('.hero-icons')).toBe(field);
  expect(container.querySelectorAll('.float-icon')).toHaveLength(1);
  expect(container.querySelector('.missing-app-icon').textContent).toBe('?');
  expect(container.querySelector('.float-icon').getAttribute('title')).toBe('Latest · media-server');
  expect(container.querySelector('.hero').style.getPropertyValue('--hero-second-start')).toBe(`${secondStart}ms`);
  expect(container.querySelector('.hero-icons').dataset.catalogRevision).toBe(revision);
  expect(JSON.parse(localStorage.getItem(cacheKey)).apps[0].id).toBe('novel');
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('shows pinned GitHub URLs from cache, keeps them on a rate limit, and avoids duplicate fetches', async () => {
  const cached = { version: 1, repository, revision, savedAt: Date.now() - freshFor - 1, apps: [{ id: 'novel', group: 'media-server', name: 'Cached', category: 'media', icon: true }] };
  localStorage.setItem(cacheKey, JSON.stringify(cached));
  vi.stubGlobal('fetch', vi.fn(async () => response('', 429)));
  const { container } = render(<App route="" base="/kubarr-website/"/>);
  await waitFor(() => expect(container.querySelector('.hero-icons').dataset.catalogSource).toBe('cache'));
  await waitFor(() => expect(container.querySelector('.hero-icons').dataset.catalogError).toBe('true'));
  expect(container.querySelectorAll('.float-icon')).toHaveLength(1);
  expect(container.querySelector('.float-icon img').getAttribute('src')).toBe(`https://raw.githubusercontent.com/${repository}/${revision}/media-server/novel/icon.svg`);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(cacheKey)).toBe(JSON.stringify(cached));
});

it('keeps icons absent and the command usable when GitHub is unavailable without a cache', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response('', 503)));
  localStorage.setItem(cacheKey, 'malformed cache');
  const { container } = render(<App route="" base="/kubarr-website/"/>);
  await waitFor(() => expect(container.querySelector('.hero-icons').dataset.catalogError).toBe('true'));
  expect(container.querySelector('.hero-icons').dataset.catalogSource).toBe('pending');
  expect(container.querySelectorAll('.float-icon')).toHaveLength(0);
  expect(container.querySelector('[data-install-command]').textContent).toContain('curl -fsSL');
});

it('handles 19 and 21+ charts with unique finite stagger and separated fallback anchors', () => {
  for (const count of [18, 19, 21, 26]) {
    const delays = entranceDelays(count);
    expect(new Set(delays).size).toBe(count);
    expect(delays.every(Number.isFinite)).toBe(true);
  }
  const apps = [...curatedIds, 'novel', 'another', 'third'].map(id => ({ id }));
  const positions = newAppAnchors(apps);
  const mobile = Object.values(positions).map(([, , x, y]) => [x, y]);
  expect(new Set(mobile.map(point => point.join(','))).size).toBe(3);
  expect(mobile.every(([x, y]) => Math.hypot(x - 85, y - 17) > 10)).toBe(true);
  expect(Object.values(positions).every(point => point.every(Number.isFinite))).toBe(true);
});

it('renders 21 live charts without restarting the existing entrance or headline', async () => {
  const ids = [...curatedIds, 'novel', 'another', 'third'];
  const fetcher = mockGitHub(ids);
  vi.stubGlobal('fetch', fetcher);
  const { container } = render(<App route="" base="/kubarr-website/"/>);
  expect(container.querySelector('[data-app="sonarr"]')).toBeNull();
  await waitFor(() => expect(container.querySelector('.hero-icons').dataset.catalogSource).toBe('live'));
  expect(container.querySelectorAll('.float-icon')).toHaveLength(21);
  expect(container.querySelector('[data-app="sonarr"] .icon-entrance').style.getPropertyValue('--arrival-delay')).not.toBe('0ms');
  expect([...container.querySelectorAll('.float-icon img')].every(img => img.src.startsWith(`https://raw.githubusercontent.com/${repository}/${revision}/`))).toBe(true);
  for (const id of ['novel', 'another', 'third'])
    expect(container.querySelector(`[data-app="${id}"] .icon-entrance`).style.getPropertyValue('--arrival-delay')).toBe('0ms');
  expect(container.querySelector('.hero').style.getPropertyValue('--hero-second-start')).toBe(`${secondStart}ms`);
});

it('deduplicates simultaneous provider requests and aborts when the last consumer unmounts', async () => {
  let requestSignal;
  const fetcher = vi.fn((_, { signal }) => { requestSignal = signal; return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })); });
  vi.stubGlobal('fetch', fetcher);
  function Status() { return <span>{useCatalog().source}</span>; }
  const first = render(<CatalogProvider><Status/></CatalogProvider>);
  const second = render(<CatalogProvider><Status/></CatalogProvider>);
  expect(fetcher).toHaveBeenCalledTimes(1);
  first.unmount();
  expect(requestSignal.aborted).toBe(false);
  second.unmount();
  await waitFor(() => expect(requestSignal.aborted).toBe(true));
});

it('uses a fresh local catalog without any GitHub calls across remounts', async () => {
  localStorage.setItem(cacheKey, JSON.stringify({ version: 1, repository, revision, savedAt: Date.now(), apps: [{ id: 'novel', group: 'media-server', name: 'Cached', category: 'Media', icon: true }] }));
  vi.stubGlobal('fetch', vi.fn());
  const first = render(<App route="apps/" base="/"/>);
  await waitFor(() => expect(first.container.querySelector('.apps-card img')).toBeTruthy());
  expect(first.container.textContent).toContain('saved within the last hour');
  first.unmount();
  render(<App route="apps/" base="/"/>);
  expect(fetch).not.toHaveBeenCalled();
});

it('prefers a newer validated storage catalog over stale memory from an earlier mount', async () => {
  const oldRevision = 'a'.repeat(40);
  localStorage.setItem(cacheKey, JSON.stringify({ version: 1, repository, revision: oldRevision, savedAt: Date.now() - freshFor - 1000, apps: [{ id: 'novel', group: 'media-server', name: 'Old', category: 'Media', icon: false }] }));
  vi.stubGlobal('fetch', vi.fn((_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))));
  const first = render(<App route="apps/" base="/"/>);
  await waitFor(() => expect(first.container.querySelector('.apps-card h2')?.textContent).toBe('Old'));
  expect(fetch).toHaveBeenCalledTimes(1);
  first.unmount();
  await waitFor(() => expect(fetch.mock.calls[0][1].signal.aborted).toBe(true));

  localStorage.setItem(cacheKey, JSON.stringify({ version: 1, repository, revision, savedAt: Date.now(), apps: [{ id: 'new-app', group: 'media-server', name: 'New', category: 'Media', icon: true }] }));
  const second = render(<App route="apps/" base="/"/>);
  await waitFor(() => expect(second.container.querySelector('.apps-card h2')?.textContent).toBe('New'));
  expect(second.container.querySelector('.apps-card img').src).toBe(`https://raw.githubusercontent.com/${repository}/${revision}/media-server/new-app/icon.svg`);
  expect(second.container.textContent).toContain('saved within the last hour');
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('allows an explicit refresh of a fresh catalog and keeps it visible while checking', async () => {
  localStorage.setItem(cacheKey, JSON.stringify({ version: 1, repository, revision, savedAt: Date.now(), apps: [{ id: 'novel', group: 'media-server', name: 'Cached', category: 'Media', icon: false }] }));
  let finish;
  vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => {
    finish = () => resolve(response(JSON.stringify({ sha: revision, truncated: false, tree: [{ type: 'blob', path: 'media-server/novel/Chart.yaml' }] })));
  })));
  const { container } = render(<App route="apps/" base="/"/>);
  await waitFor(() => expect(container.querySelector('.apps-card')).toBeTruthy());
  expect(fetch).not.toHaveBeenCalled();
  [...container.querySelectorAll('button')].find(button => button.textContent === 'Refresh apps').click();
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  expect(container.textContent).toContain('while checking for updates');
  expect(container.querySelector('.apps-card')).toBeTruthy();
  finish();
  await waitFor(() => expect(container.textContent).toContain('Catalog up to date'));
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('keeps one request across StrictMode effect replay', async () => {
  let signal;
  vi.stubGlobal('fetch', vi.fn((_, options) => { signal = options.signal; return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })); }));
  function Status() { return <span>{useCatalog().source}</span>; }
  const view = render(<React.StrictMode><CatalogProvider><Status/></CatalogProvider></React.StrictMode>);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(signal.aborted).toBe(false);
  view.unmount();
  await waitFor(() => expect(signal.aborted).toBe(true));
});

it('refreshes a stale revision once for concurrent providers without re-fetching Chart.yaml', async () => {
  localStorage.setItem(cacheKey, JSON.stringify({ version: 1, repository, revision, savedAt: Date.now() - freshFor - 1, apps: [{ id: 'novel', group: 'media-server', name: 'Cached', category: 'Media', icon: false }] }));
  const fetcher = mockGitHub();
  vi.stubGlobal('fetch', fetcher);
  function Status() { const catalog = useCatalog(); return <span>{catalog.source}</span>; }
  const first = render(<CatalogProvider><Status/></CatalogProvider>);
  const second = render(<CatalogProvider><Status/></CatalogProvider>);
  await waitFor(() => expect(first.container.textContent).toBe('live'));
  await waitFor(() => expect(second.container.textContent).toBe('live'));
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(JSON.parse(localStorage.getItem(cacheKey)).savedAt).toBeGreaterThan(Date.now() - freshFor);
});

it('keeps successful results in memory if localStorage is blocked and skips remount requests', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  const fetcher = mockGitHub();
  vi.stubGlobal('fetch', fetcher);
  const first = render(<App route="apps/" base="/"/>);
  await waitFor(() => expect(first.container.querySelector('.apps-card')).toBeTruthy());
  first.unmount();
  const second = render(<App route="apps/" base="/"/>);
  await waitFor(() => expect(second.container.querySelector('.apps-card')).toBeTruthy());
  expect(fetcher).toHaveBeenCalledTimes(2);
  vi.restoreAllMocks();
});

it('does not stampede a failed stale refresh on navigation, but manual retry bypasses cooldown', async () => {
  localStorage.setItem(cacheKey, JSON.stringify({ version: 1, repository, revision, savedAt: Date.now() - freshFor - 1, apps: [{ id: 'novel', group: 'media-server', name: 'Cached', category: 'Media', icon: false }] }));
  const fetcher = vi.fn().mockResolvedValueOnce(response('', 429)).mockImplementation(mockGitHub());
  vi.stubGlobal('fetch', fetcher);
  const first = render(<App route="apps/" base="/"/>);
  await waitFor(() => expect(first.container.querySelector('[role="alert"]')).toBeTruthy());
  first.unmount();
  const second = render(<App route="apps/" base="/"/>);
  await waitFor(() => expect(second.container.querySelector('[role="alert"]')).toBeTruthy());
  expect(fetcher).toHaveBeenCalledTimes(1);
  second.container.querySelector('[role="alert"] button').click();
  await waitFor(() => expect(second.container.textContent).toContain('Catalog up to date'));
  expect(fetcher).toHaveBeenCalledTimes(2);
});
