// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { App } from './app.jsx';
import { resetCatalogCacheForTests } from './catalog-provider.jsx';
import { cacheKey, freshFor, repository, treeURL } from './live-catalog.js';

const revision = 'c'.repeat(40);
const response = (body, status = 200) => ({ ok: status === 200, status, headers: { get: () => null }, text: async () => body });
const entries = [
  { id: 'alpha', group: 'media-server', name: 'Alpha', category: 'Media', description: 'Stream your library', icon: true },
  { id: 'beta', group: 'download-client', name: 'Beta', category: 'Downloads', icon: false },
  { id: 'gamma', group: 'media-server', name: 'Gamma', category: 'Media', icon: false },
];
function github() {
  const tree = { sha: revision, truncated: false, tree: entries.flatMap(({ id, group, icon }) => [
    { type: 'blob', path: `${group}/${id}/Chart.yaml` },
    ...(icon ? [{ type: 'blob', path: `${group}/${id}/icon.svg` }] : []),
  ]) };
  return vi.fn(async url => {
    if (url === treeURL) return response(JSON.stringify(tree));
    const app = entries.find(({ id }) => url.endsWith(`/${id}/Chart.yaml`));
    return response(`name: ${app.id}\ndescription: ${app.description ?? ''}\nannotations:\n  kubarr.io/category: ${app.category}\n  kubarr.io/display-name: ${app.name}\n`);
  });
}
afterEach(() => { cleanup(); resetCatalogCacheForTests(); localStorage.clear(); vi.unstubAllGlobals(); });

it('uses real GitHub chart entries only for the homepage hero, not the screenshot gallery', async () => {
  const fetcher = github();
  vi.stubGlobal('fetch', fetcher);
  expect(renderToString(<App route="" base="/kubarr-website/"/>)).not.toContain('home-app-list');
  const { container } = render(<App route="" base="/kubarr-website/"/>);
  await waitFor(() => expect(container.querySelectorAll('.hero-icons .float-icon')).toHaveLength(3));
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(container.querySelector('.hero-icons img').getAttribute('src')).toBe(`https://raw.githubusercontent.com/${repository}/${revision}/media-server/alpha/icon.svg`);
  expect(container.querySelector('#apps .home-feature-gallery-column')).toBeTruthy();
  expect(container.querySelector('.home-app-list')).toBeNull();
});

it('prerenders an empty loading shell, then searches names/descriptions and filters categories without extra requests', async () => {
  const fetcher = github();
  let release;
  vi.stubGlobal('fetch', vi.fn((...args) => args[0] === treeURL ? new Promise(resolve => { release = () => resolve(fetcher(...args)); }) : fetcher(...args)));
  const ssr = renderToString(<App route="apps/" base="/kubarr-website/"/>);
  expect(ssr).toContain('Loading apps from GitHub');
  expect(ssr).not.toContain('apps-card');
  expect(fetch).not.toHaveBeenCalled();
  const { container } = render(<App route="apps/" base="/kubarr-website/"/>);
  expect(screen.getByRole('status').textContent).toContain('Loading apps');
  release();
  await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(3));
  expect(fetch).toHaveBeenCalledTimes(4);
  expect(screen.getByText('Showing 3 of 3 apps')).toBeTruthy();
  expect(container.querySelector('.apps-card img').getAttribute('src')).toBe(`https://raw.githubusercontent.com/${repository}/${revision}/media-server/alpha/icon.svg`);
  expect(screen.getByRole('link', { name: /View Alpha chart/ }).getAttribute('href')).toBe(`https://github.com/${repository}/tree/${revision}/media-server/alpha`);
  expect(screen.getByRole('combobox', { name: 'Category' }).textContent).toContain('Media (2)');
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search apps' }), { target: { value: 'library' } });
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  expect(screen.getByRole('heading', { name: 'Alpha' })).toBeTruthy();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search apps' }), { target: { value: '' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Category' }), { target: { value: 'Downloads' } });
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  expect(screen.getByRole('heading', { name: 'Beta' })).toBeTruthy();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search apps' }), { target: { value: 'nothing' } });
  expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  expect(screen.getByText(/No apps match/)).toBeTruthy();
  expect(fetch).toHaveBeenCalledTimes(4);
});

it('keeps saved GitHub catalog on failure and retries successfully', async () => {
  localStorage.setItem(cacheKey, JSON.stringify({ version: 1, repository, revision, savedAt: Date.now() - freshFor - 1, apps: entries.map(({ id, group, name, category, description, icon }) => ({ id, group, name, category, description, icon })) }));
  const fetcher = github();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response('', 429)).mockImplementation(fetcher));
  render(<App route="apps/" base="/"/>);
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('saved catalog'));
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
  expect(screen.getByText(/Showing cached GitHub catalog/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading apps' }));
  await waitFor(() => expect(screen.getByText('Catalog up to date from GitHub.')).toBeTruthy());
  expect(screen.queryByRole('alert')).toBeNull();
});

it('explains initial failure and allows retry without inventing apps', async () => {
  const fetcher = github();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response('', 503)).mockImplementation(fetcher));
  render(<App route="apps/" base="/"/>);
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Could not load'));
  expect(screen.queryByRole('listitem')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading apps' }));
  await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(3));
});
