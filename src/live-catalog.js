import YAML from 'yaml';

export const repository = 'smokeythebandit/kubarr-charts';
export const treeURL = `https://api.github.com/repos/${repository}/git/trees/main?recursive=1`;
export const cacheKey = 'kubarr-website-catalog-v1';
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const sha = /^[a-f0-9]{40}$/;
const chartPath = /^([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/Chart\.yaml$/;
const raw = `https://raw.githubusercontent.com/${repository}/`;
const maxCharts = 100;

export function normalizeCatalog(apps, revision) {
  if (!sha.test(revision) || !Array.isArray(apps) || !apps.length || apps.length > maxCharts) throw new Error('Invalid catalog revision or size');
  const ids = new Set();
  const result = apps.map(app => {
    if (!app || !slug.test(app.id) || ids.has(app.id) || typeof app.name !== 'string' || !app.name.trim() || app.name.length > 100 || typeof app.category !== 'string' || !app.category.trim() || app.category.length > 80 || !slug.test(app.group) || typeof app.icon !== 'boolean') throw new Error('Invalid catalog entry');
    ids.add(app.id);
    const icon = app.icon === true ? `${raw}${revision}/${app.group}/${app.id}/icon.svg` : null;
    if (app.description !== undefined && (typeof app.description !== 'string' || app.description.length > 500)) throw new Error('Invalid catalog description');
    return { id: app.id, name: app.name.trim(), category: app.category.trim(), icon, group: app.group, ...(app.description?.trim() ? { description: app.description.trim() } : {}) };
  });
  return { revision, apps: result.sort((a, b) => a.id.localeCompare(b.id, 'en')) };
}

export function discoverCharts(tree) {
  if (!tree || !sha.test(tree.sha) || tree.truncated !== false || !Array.isArray(tree.tree) || tree.tree.length > 10000) throw new Error('Incomplete GitHub chart tree');
  const files = new Set(tree.tree.filter(item => item?.type === 'blob' && typeof item.path === 'string').map(item => item.path));
  const paths = [...files].filter(path => chartPath.test(path) && !path.startsWith('system/')).sort();
  if (!paths.length || paths.length > maxCharts) throw new Error('Invalid chart tree size');
  return paths.map(path => {
    const [, group, id] = path.match(chartPath);
    return { path, group, id, icon: files.has(`${group}/${id}/icon.svg`) };
  });
}

export function parseChart(text, { group, id, icon }) {
  if (text.length > 128 * 1024) throw new Error('Oversized Chart.yaml');
  const doc = YAML.parseDocument(text, { uniqueKeys: true, strict: true });
  if (doc.errors.length) throw new Error('Malformed Chart.yaml');
  const chart = doc.toJS();
  if (!chart || typeof chart !== 'object' || chart.name !== id) throw new Error('Invalid chart identity');
  const annotations = chart.annotations;
  if (!annotations || typeof annotations !== 'object') return null;
  const category = annotations['kubarr.io/category'];
  if (typeof category !== 'string' || !category.trim()) return null;
  const flag = key => String(annotations[`kubarr.io/${key}`] ?? '').toLowerCase();
  if (group === 'system' || category === 'system' || flag('system') === 'true' || flag('hidden') === 'true' || flag('browseable') === 'false') return null;
  const name = annotations['kubarr.io/display-name'] ?? id;
  return { id, group, name, category, icon, ...(typeof chart.description === 'string' && chart.description.trim() && chart.description.length <= 500 ? { description: chart.description } : {}) };
}

async function requestText(url, signal, fetcher, limit) {
  const response = await fetcher(url, { signal, headers: { Accept: url === treeURL ? 'application/vnd.github+json' : 'text/plain' } });
  if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
  const length = Number(response.headers?.get('content-length'));
  if (length > limit) throw new Error('Oversized catalog response');
  const text = await response.text();
  if (text.length > limit) throw new Error('Oversized catalog response');
  return text;
}

export async function fetchLiveCatalog({ fetcher = fetch, signal, timeout = 12000 } = {}) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const tree = JSON.parse(await requestText(treeURL, controller.signal, fetcher, 1024 * 1024));
    const charts = discoverCharts(tree);
    const apps = [];
    let cursor = 0;
    // Four workers cap simultaneous raw requests. No caller-controlled URLs.
    await Promise.all(Array.from({ length: Math.min(4, charts.length) }, async () => {
      while (cursor < charts.length) {
        const chart = charts[cursor++];
        const text = await requestText(`${raw}${tree.sha}/${chart.path}`, controller.signal, fetcher, 128 * 1024);
        const app = parseChart(text, chart);
        if (app) apps.push(app);
      }
    }));
    return normalizeCatalog(apps, tree.sha);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export function readCachedCatalog(storage) {
  try {
    const value = JSON.parse(storage.getItem(cacheKey));
    if (value?.version !== 1 || value.repository !== repository || !Number.isFinite(value.savedAt) || value.savedAt > Date.now() || Date.now() - value.savedAt > 7 * 86400000) return null;
    // Reconstruct icon URLs from fixed path segments; never trust stored URLs.
    return { ...normalizeCatalog(value.apps, value.revision), savedAt: value.savedAt };
  } catch { return null; }
}

export function writeCachedCatalog(storage, catalog) {
  try {
    const checked = normalizeCatalog(catalog.apps.map(app => ({ ...app, icon: !!app.icon })), catalog.revision);
    storage.setItem(cacheKey, JSON.stringify({ version: 1, repository, revision: checked.revision, savedAt: Date.now(), apps: checked.apps.map(({ id, group, name, category, icon, description }) => ({ id, group, name, category, icon: !!icon, ...(description ? { description } : {}) })) }));
  } catch { /* Storage may be blocked or full. */ }
}
