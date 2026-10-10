import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const origin = process.env.SITE_ORIGIN ?? 'https://smokeythebandit.github.io';
const url = new URL(origin);
if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.origin !== origin) {
  throw new Error('SITE_ORIGIN must be an HTTPS origin without a path or trailing slash');
}
const base = origin === 'https://kubarr.com' ? '/' : '/kubarr-website/';
const destination = process.env.OUT_DIR ?? 'dist';
await rm(destination, { recursive: true, force: true });
await mkdir(join(destination, 'assets'), { recursive: true });
await cp('src/assets', join(destination, 'assets'), { recursive: true, filter: path => !path.replaceAll('\\', '/').endsWith('/assets/apps') });

await build({ entryPoints: ['src/client.jsx'], bundle: true, minify: true, format: 'esm', outfile: join(destination, 'assets/app.js'), jsx: 'automatic' });
// Keep the temporary SSR bundle beside this package so external React resolves
// even when OUT_DIR points at a separate temporary directory during checks.
const serverDirectory = await mkdtemp(resolve('node_modules', '.kubarr-render-'));
const server = join(serverDirectory, 'render.mjs');
try {
  await build({ entryPoints: ['src/app.jsx'], bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile: server, jsx: 'automatic' });
  const { App, routes } = await import(pathToFileURL(server).href);
  const { createElement } = await import('react');
  const { renderToString } = await import('react-dom/server');
  const metadata = {
    '': ['Kubarr — Your media stack on Kubernetes.', 'Kubarr is a Kubernetes-native dashboard for deploying and managing self-hosted media applications.'],
    'apps/': ['Apps · Kubarr', 'Browse the live Kubarr chart catalog, search apps and explore their GitHub chart sources.'],
    'docs/': ['Documentation · Kubarr', 'Start here for Kubarr installation and architecture documentation.'],
    'docs/getting-started/': ['Getting started · Kubarr', 'Prepare a Kubernetes cluster and bootstrap Kubarr with its CLI installer.'],
    'docs/how-it-works/': ['How it works · Kubarr', "Understand Kubarr's gateway, frontend, API, worker, Kubernetes workloads and storage."],
  };
  const escape = text => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  for (const route of routes) {
    const [title, description] = metadata[route];
    const canonical = `${origin}${base}${route}`;
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f9fafb"><meta name="description" content="${escape(description)}">${route === '' ? `<meta property="og:type" content="website"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="A Kubernetes-native home for your self-hosted media stack."><meta property="og:url" content="${canonical}">` : ''}<link rel="canonical" href="${canonical}"><link rel="icon" type="image/svg+xml" href="${base}assets/mark.svg"><script src="${base}assets/theme.js"></script>${route === '' ? '<script>if(!location.hash)document.documentElement.classList.add("icon-entrance-ready")</script>' : ''}<link rel="stylesheet" href="${base}assets/site.css"><title>${escape(title)}</title><script type="module" src="${base}assets/app.js"></script></head>
<body${route === '' ? ' class="home"' : ''}><div id="root" data-route="${route}" data-base="${base}">${renderToString(createElement(App, { route, base }))}</div></body></html>
`;
    const directory = join(destination, route);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'index.html'), html);
  }
  // Previously published feature URLs still lead directly to their new homepage sections.
  for (const [oldPath, anchor] of Object.entries({ 'features/': 'features', 'features/observability/': 'observability', 'features/isolation/': 'isolation', 'features/modularity/': 'apps' })) {
    const target = `${base}#${anchor}`;
    const directory = join(destination, oldPath);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0;url=${target}"><link rel="canonical" href="${origin}${target}"><title>Features · Kubarr</title></head><body><p>Features have moved to the <a href="${target}">Kubarr homepage</a>.</p></body></html>\n`);
  }
  await writeFile(join(destination, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map(route => `  <url><loc>${origin}${base}${route}</loc></url>`).join('\n')}\n</urlset>\n`);
  await writeFile(join(destination, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}${base}sitemap.xml\n`);
} finally {
  await rm(serverDirectory, { recursive: true, force: true });
}
console.log(`Built ${destination} for ${origin}${base}`);
