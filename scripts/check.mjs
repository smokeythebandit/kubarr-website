import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const pages = ['', 'docs/', 'docs/getting-started/', 'docs/how-it-works/'];
const tmp = await mkdtemp(join(tmpdir(), 'kubarr-site-'));
try {
  for (const [mode, origin, base] of [
    ['preview', 'https://smokeythebandit.github.io', '/kubarr-website/'],
    ['production', 'https://kubarr.com', '/'],
  ]) {
    const out = join(tmp, mode);
    const result = spawnSync(process.execPath, ['scripts/build.mjs'], {
      env: { ...process.env, SITE_ORIGIN: origin, OUT_DIR: out }, encoding: 'utf8',
    });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout);
    const sitemap = await readFile(join(out, 'sitemap.xml'), 'utf8');
    for (const page of pages) {
      const html = await readFile(join(out, page, 'index.html'), 'utf8');
      const canonical = `${origin}${base}${page}`;
      if (!html.includes(`<link rel="canonical" href="${canonical}">`) || !sitemap.includes(`<loc>${canonical}</loc>`)) {
        throw new Error(`${mode}/${page}: missing canonical or sitemap entry`);
      }
      if (html.includes('__BASE__') || html.includes('__CANONICAL__')) throw new Error(`${mode}/${page}: unresolved template`);
      for (const required of ['<html lang="en">', '<meta name="viewport"', '<meta name="description"', '<title>', '<main ', 'id="main"', 'href="#main"', 'aria-label="Main navigation"', 'aria-expanded="false"']) {
        if (!html.includes(required)) throw new Error(`${mode}/${page}: missing ${required}`);
      }
      const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
      if (new Set(ids).size !== ids.length) throw new Error(`${mode}/${page}: duplicate IDs`);
      for (const match of html.matchAll(/href="#([^"]+)"|aria-controls="([^"]+)"/g)) {
        if (!ids.includes(match[1] ?? match[2])) throw new Error(`${mode}/${page}: missing fragment or control target`);
      }
      for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        const target = match[1];
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        if (!target.startsWith(base)) throw new Error(`${mode}/${page}: unexpected base ${target}`);
        const pathname = new URL(target, origin).pathname;
        const local = pathname.slice(base.length);
        const path = resolve(out, local, local.endsWith('/') || local === '' ? 'index.html' : '');
        if (!path.startsWith(out)) throw new Error(`link escapes output: ${target}`);
        try { await stat(path); } catch { throw new Error(`${mode}/${page}: missing ${target}`); }
      }
    }
    console.log(`${mode}: ${pages.length} pages, canonical URLs, sitemap and local links OK`);
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}
