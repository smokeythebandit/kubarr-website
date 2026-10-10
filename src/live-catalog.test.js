import { afterEach, describe, expect, it, vi } from 'vitest';
import { cacheKey, discoverCharts, fetchLiveCatalog, freshFor, normalizeCatalog, parseChart, readCachedCatalog, repository, retainFor, treeURL, writeCachedCatalog } from './live-catalog.js';

const revision = 'a'.repeat(40);
const chart = (id, extra = '') => `name: ${id}\nannotations:\n  kubarr.io/category: media-server\n  kubarr.io/display-name: ${id.toUpperCase()}\n${extra}`;
const tree = { sha: revision, truncated: false, tree: [
  { type: 'blob', path: 'media-server/zeta/Chart.yaml' }, { type: 'blob', path: 'media-server/zeta/icon.svg' },
  { type: 'blob', path: 'media-server/alpha/Chart.yaml' }, { type: 'blob', path: 'monitoring/agent/Chart.yaml' },
  { type: 'blob', path: 'system/core/Chart.yaml' }, { type: 'blob', path: 'media-server/../escape/Chart.yaml' },
] };
const response = (body, status = 200) => ({ ok: status === 200, status, headers: { get: () => null }, text: async () => body });
const fetcher = vi.fn(async url => url === treeURL ? response(JSON.stringify(tree)) : response(chart(url.split('/').at(-2), url.includes('/agent/') ? '  kubarr.io/system: "true"\n' : '')));

afterEach(() => { vi.restoreAllMocks(); fetcher.mockClear(); });

describe('live GitHub catalog', () => {
  it('discovers safe chart paths, fetches metadata pinned to one revision, filters and sorts', async () => {
    const catalog = await fetchLiveCatalog({ fetcher });
    expect(catalog.apps.map(app => app.id)).toEqual(['alpha', 'zeta']);
    expect(catalog.apps[0].icon).toBeNull();
    expect(catalog.apps[1].icon).toBe(`https://raw.githubusercontent.com/${repository}/${revision}/media-server/zeta/icon.svg`);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(fetcher.mock.calls.slice(1).every(([url]) => url.startsWith(`https://raw.githubusercontent.com/${repository}/${revision}/`))).toBe(true);
    fetcher.mockClear();
    expect(await fetchLiveCatalog({ fetcher, cached: catalog })).toEqual(catalog);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects incomplete trees, malformed responses, rate limits and unavailable charts', async () => {
    expect(() => discoverCharts({ ...tree, truncated: true })).toThrow('Incomplete');
    expect(() => parseChart('name: a\nname: b', { group: 'media-server', id: 'a' })).toThrow();
    expect(() => normalizeCatalog([{ id: '../evil', name: 'bad', category: 'media', group: 'media', icon: true }], revision)).toThrow();
    expect(() => normalizeCatalog([{ id: 'safe', name: 'Safe', category: 'media', group: 'media', icon: 'https://evil.example' }], revision)).toThrow();
    for (const failed of [response('', 404), response('', 403), response('', 429)])
      await expect(fetchLiveCatalog({ fetcher: async () => failed })).rejects.toThrow(`(${failed.status})`);
    await expect(fetchLiveCatalog({ fetcher: async url => url === treeURL ? response(JSON.stringify(tree)) : response('', 404) })).rejects.toThrow('(404)');
  });

  it('bounds requests and aborts a stalled fetch', async () => {
    await expect(fetchLiveCatalog({ fetcher: (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })), timeout: 5 })).rejects.toThrow('aborted');
    await expect(fetchLiveCatalog({ fetcher: async () => response('x'.repeat(1024 * 1024 + 1)) })).rejects.toThrow('Oversized');
  });

  it('validates cached identities and rebuilds icon URLs instead of trusting stored links', () => {
    const storage = new Map();
    const store = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
    const catalog = normalizeCatalog([{ id: 'zeta', group: 'media-server', name: 'Zeta', category: 'media', icon: true }], revision);
    writeCachedCatalog(store, catalog);
    expect(readCachedCatalog(store).apps).toEqual(catalog.apps);
    const tampered = JSON.parse(storage.get(cacheKey));
    tampered.apps[0].icon = 'https://evil.example/icon.svg';
    store.setItem(cacheKey, JSON.stringify(tampered));
    expect(readCachedCatalog(store)).toBeNull();
    tampered.apps[0].id = '../bad';
    store.setItem(cacheKey, JSON.stringify(tampered));
    expect(readCachedCatalog(store)).toBeNull();
    store.setItem(cacheKey, 'not json');
    expect(readCachedCatalog(store)).toBeNull();
    store.setItem(cacheKey, JSON.stringify({ ...tampered, savedAt: Date.now() - 8 * 86400000 }));
    expect(readCachedCatalog(store)).toBeNull();
    writeCachedCatalog(store, catalog, Date.now() - freshFor);
    expect(readCachedCatalog(store)).not.toBeNull();
    writeCachedCatalog(store, catalog, Date.now() - retainFor - 1);
    expect(readCachedCatalog(store)).toBeNull();
    for (const savedAt of [Date.now() + 1000, 'today', null, Number.POSITIVE_INFINITY]) {
      writeCachedCatalog(store, catalog);
      store.setItem(cacheKey, JSON.stringify({ ...JSON.parse(storage.get(cacheKey)), savedAt }));
      expect(readCachedCatalog(store)).toBeNull();
    }
  });

  it('preserves optional chart descriptions through validation and cache without requiring them on older entries', () => {
    const parsed = parseChart('name: alpha\ndescription: Stream media\nannotations:\n  kubarr.io/category: Media\n', { id: 'alpha', group: 'media-server', icon: false });
    const catalog = normalizeCatalog([parsed, { id: 'beta', group: 'media-server', name: 'Beta', category: 'Media', icon: false }], revision);
    expect(catalog.apps[0].description).toBe('Stream media');
    const storage = new Map();
    const store = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
    writeCachedCatalog(store, catalog);
    expect(readCachedCatalog(store).apps).toEqual(catalog.apps);
    expect(() => normalizeCatalog([{ ...parsed, description: { unsafe: true } }], revision)).toThrow('Invalid catalog description');
  });
});
