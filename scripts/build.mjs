import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const origin = process.env.SITE_ORIGIN ?? 'https://smokeythebandit.github.io';
const url = new URL(origin);
if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.origin !== origin) {
  throw new Error('SITE_ORIGIN must be an HTTPS origin without a path or trailing slash');
}
const base = origin === 'https://kubarr.com' ? '/' : '/kubarr-website/';
const destination = process.env.OUT_DIR ?? 'dist';
const pages = ['index.html', 'docs/index.html', 'docs/getting-started/index.html', 'docs/how-it-works/index.html'];

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp('src', destination, { recursive: true });

async function visit(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await visit(path);
    else if (entry.name.endsWith('.html')) {
      const page = relative(destination, path);
      const canonical = `${origin}${base}${page === 'index.html' ? '' : page.replace(/index\.html$/, '')}`;
      const html = (await readFile(path, 'utf8'))
        .replaceAll('__BASE__', base)
        .replaceAll('__CANONICAL__', canonical);
      await writeFile(path, html);
    }
  }
}
await visit(destination);
await writeFile(join(destination, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(page => `  <url><loc>${origin}${base}${page === 'index.html' ? '' : page.replace(/index\.html$/, '')}</loc></url>`).join('\n')}\n</urlset>\n`);
await writeFile(join(destination, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}${base}sitemap.xml\n`);
console.log(`Built ${destination} for ${origin}${base}`);
