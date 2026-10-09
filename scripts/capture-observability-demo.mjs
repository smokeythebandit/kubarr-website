// DEMO ONLY: Capture the Kubarr frontend with synthetic API data, never a live cluster.
// Usage: KUBARR_FRONTEND=/path/to/Kubarr/code/frontend node scripts/capture-observability-demo.mjs
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const frontend = resolve(process.env.KUBARR_FRONTEND ?? '../Kubarr/code/frontend');
const requireFrontend = createRequire(join(frontend, 'package.json'));
const load = name => import(pathToFileURL(requireFrontend.resolve(name)).href);
const [{ createServer }, { default: react }, { default: tailwindcss }] = await Promise.all([
  load('vite'), load('@vitejs/plugin-react'), load('@tailwindcss/vite'),
]);
const { chromium } = requireFrontend('@playwright/test');
const cacheDir = await mkdtemp(resolve('node_modules', '.kubarr-capture-'));
const server = await createServer({
  root: frontend,
  configFile: false,
  cacheDir,
  plugins: [tailwindcss(), react()],
  define: { __VERSION__: JSON.stringify('demo'), __COMMIT_HASH__: JSON.stringify('demo'), __BUILD_TIME__: JSON.stringify(''), __CHANNEL__: JSON.stringify('dev') },
  server: { host: '127.0.0.1', port: 0, strictPort: false },
});
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark', locale: 'en-US', timezoneId: 'UTC' });
  // ThemeProvider reads this key on first render; apply the class before styles paint.
  await context.addInitScript(() => {
    localStorage.setItem('kubarr-theme', 'dark');
    document.documentElement.classList.add('dark');
  });
  const page = await context.newPage();
  const metrics = {
    total_cpu_cores: 8, used_cpu_cores: 1.8, cpu_usage_percent: 22.5,
    total_memory_bytes: 17179869184, used_memory_bytes: 5905580032, memory_usage_percent: 34.4,
    network_receive_bytes_per_sec: 524288, network_transmit_bytes_per_sec: 131072,
    container_count: 14, pod_count: 12, total_storage_bytes: 107374182400, used_storage_bytes: 21474836480, storage_usage_percent: 20,
  };
  const apps = [
    { app_name: 'Jellyfin', namespace: 'jellyfin', cpu_usage_cores: 0.42, memory_usage_bytes: 805306368, network_receive_bytes_per_sec: 262144, network_transmit_bytes_per_sec: 65536 },
    { app_name: 'Sonarr', namespace: 'sonarr', cpu_usage_cores: 0.12, memory_usage_bytes: 402653184, network_receive_bytes_per_sec: 131072, network_transmit_bytes_per_sec: 32768 },
    { app_name: 'Radarr', namespace: 'radarr', cpu_usage_cores: 0.09, memory_usage_bytes: 301989888, network_receive_bytes_per_sec: 65536, network_transmit_bytes_per_sec: 16384 },
  ];
  const now = Math.floor(Date.now() / 1000);
  const series = (base, step) => Array.from({ length: 12 }, (_, i) => ({ timestamp: now - (11 - i) * 60, value: base + [0, 2, 1, 4, 3, 6, 5, 7, 4, 8, 6, 9][i] * step }));
  const nodes = [
    { id: 'external', name: 'Internet', type: 'external', rx_bytes_per_sec: 524288, tx_bytes_per_sec: 131072, pod_count: 0 },
    ...apps.map((app, i) => ({ id: app.namespace, name: app.app_name, type: 'app', rx_bytes_per_sec: app.network_receive_bytes_per_sec, tx_bytes_per_sec: app.network_transmit_bytes_per_sec, total_traffic: app.network_receive_bytes_per_sec + app.network_transmit_bytes_per_sec, pod_count: 1 })),
  ];
  nodes[0].total_traffic = 655360;
  const topology = { nodes, edges: apps.map(app => ({ source: 'external', target: app.namespace, type: 'traffic', label: '' })) };
  const stats = apps.map(app => ({ namespace: app.namespace, app_name: app.app_name, rx_bytes_per_sec: app.network_receive_bytes_per_sec, tx_bytes_per_sec: app.network_transmit_bytes_per_sec, rx_packets_per_sec: 85, tx_packets_per_sec: 40, rx_errors_per_sec: 0, tx_errors_per_sec: 0, rx_dropped_per_sec: 0, tx_dropped_per_sec: 0, pod_count: 1 }));
  const logs = [
    ['jellyfin', 'INFO', 'Media library scan completed'],
    ['sonarr', 'INFO', 'Indexing queue processed successfully'],
    ['radarr', 'WARN', 'Metadata lookup scheduled for retry'],
    ['jellyfin', 'INFO', 'Playback session ended normally'],
    ['sonarr', 'DEBUG', 'Background task started'],
    ['radarr', 'INFO', 'Library refresh completed'],
  ];
  const fixtures = {
    '/api/users/me': { id: 1, username: 'demo', email: 'demo@example.invalid', roles: [], permissions: ['monitoring.view', 'logs.view'], allowed_apps: [], preferences: { theme: 'dark' } },
    '/auth/accounts': [], '/api/notifications/unread-count': { count: 0 },
    '/api/apps/catalog': [], '/api/apps/installed': [], '/api/apps/states': [],
    '/api/monitoring/vm/available': { available: true, message: '' },
    '/api/monitoring/vm/cluster': metrics,
    '/api/monitoring/vm/apps': apps,
    '/api/monitoring/vm/gpus': { available: true, devices: [] },
    '/api/monitoring/vm/cluster/network-history': { rx_series: series(300000, 19000), tx_series: series(75000, 6000), combined_series: series(375000, 25000) },
    '/api/monitoring/vm/cluster/metrics-history': { cpu_series: series(18, 0.6), memory_series: series(30, 0.5), storage_series: series(19, 0.1), pod_series: series(12, 0), container_series: series(14, 0) },
    '/api/logs/loki/namespaces': apps.map(app => app.namespace),
    '/api/logs/loki/query': { total_entries: logs.length, streams: apps.map(app => ({ labels: { namespace: app.namespace }, entries: logs.flatMap(([namespace, level, line], i) => namespace === app.namespace ? [{ timestamp: new Date((now - i * 45) * 1000).toISOString(), level, line }] : []) })) },
    '/api/networking/topology': topology, '/api/networking/stats': stats,
    '/api/vpn/apps': { configs: [] },
  };
  // Every API/auth request is answered in-browser; nothing can reach a real backend.
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    const icon = /^\/api\/apps\/catalog\/(jellyfin|sonarr|radarr)\/icon$/.exec(url.pathname);
    if (icon) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: await readFile(resolve(`src/assets/apps/${icon[1]}.svg`)) });
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
      const data = fixtures[url.pathname];
      return route.fulfill({ status: data === undefined ? 404 : 200, contentType: 'application/json', body: JSON.stringify(data ?? { detail: 'No demo fixture' }) });
    }
    return route.continue();
  });
  const destination = resolve('src/assets/observability-demo');
  await mkdir(destination, { recursive: true });
  for (const [route, filename, ready] of [
    ['/logs', 'logs.jpg', () => page.getByText('6 log entries').waitFor()],
    ['/resources', 'resources.jpg', () => page.getByText('App Resource Usage').waitFor()],
    ['/networking', 'networking.jpg', () => page.locator('.react-flow__node').first().waitFor()],
  ]) {
    await page.setViewportSize({ width: 1440, height: route === '/networking' ? 1380 : route === '/resources' ? 960 : 580 });
    await page.goto(origin + route);
    await ready();
    await page.locator('html.dark').waitFor();
    if (route === '/resources') await page.getByText('Jellyfin').first().waitFor();
    if (route === '/networking') await page.getByText('Network Statistics').waitFor();
    await page.locator('img[alt*="icon" i]').first().waitFor();
    await page.screenshot({ path: join(destination, filename), type: 'jpeg', quality: 83, animations: 'disabled' });
    console.log(`Captured ${filename} from ${route}`);
  }
  await context.close();
} finally {
  await browser?.close();
  await server.close();
  await rm(cacheDir, { recursive: true, force: true });
}
