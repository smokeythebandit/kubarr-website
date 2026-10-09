import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { strict as assert } from 'node:assert';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import YAML from 'yaml';

// The published artifact must use the custom-domain base, regardless of local preview defaults.
const workflow = YAML.parse(await readFile('.github/workflows/pages.yml', 'utf8'));
const buildStep = workflow.jobs.deploy.steps.find(step => step.run === 'npm run build');
assert.equal(buildStep?.env?.SITE_ORIGIN, 'https://kubarr.com', 'Pages build must target the custom domain');

const pages = ['', 'features/', 'features/observability/', 'features/isolation/', 'features/modularity/', 'apps/', 'docs/', 'docs/getting-started/', 'docs/how-it-works/'];
const featurePages = [['observability', 'Observability', 'Logging'], ['isolation', 'Isolation', 'Keep app workloads organized'], ['modularity', 'Modularity', 'Chart-based apps are independent components']];
const featureDescriptions = {
  'features/': "Explore Kubarr's chart-backed app catalog, Kubernetes deployment, monitoring, access controls and shared storage.",
  'features/observability/': 'View application logs, track CPU and memory usage, and see network activity and connections live.',
  'features/isolation/': 'Explore Kubarr app containers, Cilium-compatible network policies, shared storage and per-app VPN options.',
  'features/modularity/': 'Install and manage independent chart-based applications with Kubarr.',
};
for (const [name, hash] of [
  // Kubarr/code/frontend/public/favicon.svg (the app's Ship icon).
  ['mark.svg', '27a54d49831ca76e15157453ed54970da78651fab96292e66d92542aed4baf91'],
  ['kubernetes-icon-color.svg', 'ff5427cfeeff39e82834ab1b4fe3ed61fc08596225a17eed56adc04f7cc1f712'],
]) assert.equal(createHash('sha256').update(await readFile(`src/assets/${name}`)).digest('hex'), hash);
const css = await readFile('src/assets/site.css', 'utf8');
assert.match(css, /:root\.dark\{/);
assert.match(css, /\.home \.hero-icons\{[^}]*pointer-events:none/);
assert.match(css, /\.home \.hero-icons\{[^}]*overflow:hidden/);
assert.match(css, /\.home \.float-icon\{[^}]*position:absolute/);
const mobile = css.match(/@media\(max-width:700px\)\{\s*\.home \.hero\{[\s\S]*?\n\}/)?.[0];
assert.ok(mobile && mobile.includes('grid-template-rows:minmax(220px,1fr)'));
for (const [depth, width] of [[0, 52], [1, 40], [2, 36]])
  assert.ok(mobile.includes(`.home .float-icon.icon-depth-${depth}{width:${width}px}`));
assert.ok(mobile.includes('--move-x:var(--sdx);--move-y:var(--sdy)'));
assert.match(css, /@keyframes icon-breathe\{0%\{transform:translate3d\(calc\(var\(--move-x\) \* -\.5\)/);
assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.home \.float-icon img,\.home \.icon-wobble\{animation:none\}\.icon-entrance-ready \.home \.hero-line-first,[^}]*\.hero-install,[^}]*\.icon-entrance\{visibility:visible;opacity:1;transform:none;animation:none\}\}/);
assert.doesNotMatch(css, /\.home \.float-icon:nth-child|\.home \.float-icon[^{}]*\{[^}]*display:none/);

// Pre-paint theme initialization stays synchronous and respects saved/system preferences.
const themeScript = await readFile('src/assets/theme.js', 'utf8');
function themeHarness(saved, systemDark, blocked = false) {
  const listeners = {};
  const media = { matches: systemDark, addEventListener: (_, callback) => { listeners.media = callback; } };
  const meta = { content: '#f9fafb' };
  const classes = new Set();
  const document = { documentElement: { classList: { toggle: (name, on) => on ? classes.add(name) : classes.delete(name) }, style: {} }, querySelector: () => meta };
  const localStorage = { getItem: () => { if (blocked) throw Error('blocked'); return saved; }, setItem: (_, value) => { if (blocked) throw Error('blocked'); saved = value; } };
  const window = { matchMedia: () => media, addEventListener: (_, callback) => { listeners.storage = callback; } };
  runInNewContext(themeScript, { window, document, localStorage });
  return { window, media, meta, classes, listeners, setSaved: value => { saved = value; } };
}
const theme = themeHarness('dark', false);
assert.ok(theme.classes.has('dark'));
assert.equal(theme.meta.content, '#111827');
theme.window.kubarrTheme.set('system');
assert.ok(!theme.classes.has('dark'));
theme.media.matches = true; theme.listeners.media();
assert.ok(theme.classes.has('dark'));
theme.window.kubarrTheme.set('light');
assert.ok(!theme.classes.has('dark'));
theme.setSaved('dark'); theme.listeners.storage({ key: 'kubarr-website-theme' });
assert.ok(theme.classes.has('dark'));
assert.ok(themeHarness(null, true, true).classes.has('dark'));

const tmp = await mkdtemp(join(tmpdir(), 'kubarr-site-'));
try {
  for (const [mode, origin, base] of [
    ['preview', 'https://smokeythebandit.github.io', '/kubarr-website/'],
    ['production', 'https://kubarr.com', '/'],
  ]) {
    const out = join(tmp, mode);
    const result = spawnSync(process.execPath, ['scripts/build.mjs'], { env: { ...process.env, SITE_ORIGIN: origin, OUT_DIR: out }, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout);
    const sitemap = await readFile(join(out, 'sitemap.xml'), 'utf8');
    const robots = await readFile(join(out, 'robots.txt'), 'utf8');
    assert.ok(robots.includes(`${origin}${base}sitemap.xml`));
    if (mode === 'production') {
      assert.doesNotMatch(sitemap + robots, /\/kubarr-website\//, 'production metadata must not use the project prefix');
    }
    const home = await readFile(join(out, 'index.html'), 'utf8');
    assert.match(home, /<h1 id="hero-title"><span class="hero-line-first">Your media stack <\/span><span class="hero-line-second">on <span class="kubernetes-word">Kubernetes<\/span><img class="kubernetes-logo"/);
    assert.doesNotMatch(home, /Your media stack,/);
    assert.match(home, /curl -fsSL https:\/\/kubarr\.com\/install\.sh \| sudo bash/);
    assert.match(home, /aria-label="Copy install command"/);
    assert.equal([...home.matchAll(/<section\b/g)].length, 1);
    assert.equal([...home.matchAll(/class="float-icon icon-depth-[012]"/g)].length, 0);
    assert.match(home, /class="hero-icons" aria-hidden="true"/);
    assert.ok(home.indexOf('classList.add("icon-entrance-ready")') < home.indexOf('assets/site.css'), `${mode}: pre-paint entrance flag`);
    assert.doesNotMatch(home, /is-entering/);
    assert.equal([...home.matchAll(/--arrival-delay:/g)].length, 0);
    assert.match(home, /data-catalog-source="pending"/);
    assert.doesNotMatch(home, /assets\/apps\/|raw\.githubusercontent\.com/);
    const assetFiles = await readdir(join(out, 'assets'), { recursive: true });
    assert.ok(!assetFiles.some(file => /(^|\/)apps(\/|$)/.test(file)), `${mode}: no bundled app icons`);
    const features = await readFile(join(out, 'features/index.html'), 'utf8');
    const apps = await readFile(join(out, 'apps/index.html'), 'utf8');
    assert.ok(apps.includes('<title>Apps · Kubarr</title>') && apps.includes('Browse the live Kubarr chart catalog'));
    assert.ok(apps.includes('Loading apps from GitHub') && apps.includes('href="' + base + 'apps/" aria-current="page">Apps</a>'));
    assert.doesNotMatch(apps, /class="apps-card"|raw\.githubusercontent\.com/);
    assert.match(features, /aria-label="Features"/);
    for (const [id, label, text] of featurePages) {
      assert.ok(features.includes(`href="${base}features/${id}/">${label}</a>`));
      assert.ok(features.includes(`href="${base}features/${id}/">${label}<!-- --> →</a>`));
      assert.ok(!features.includes(text));
    }
    assert.doesNotMatch(features, /feature-card|features-next|opt-in private config PVC/);
    const appJs = await readFile(join(out, 'assets/app.js'), 'utf8');
    assert.ok(appJs.includes('Copy failed') && appJs.includes('selectNodeContents') && appJs.includes('clipboard'));
    assert.doesNotMatch(appJs, /assets\/apps\/|catalog:sync|\.svg\?raw/);
    for (const file of assetFiles.filter(file => /\.(?:js|css)$/.test(file)))
      assert.doesNotMatch(await readFile(join(out, 'assets', file), 'utf8'), /(?:\/)?assets\/apps\//, `${mode}: local app icon reference in ${file}`);
    for (const page of pages) {
      const html = await readFile(join(out, page, 'index.html'), 'utf8');
      if (mode === 'production') assert.doesNotMatch(html, /\/kubarr-website\//, `${mode}/${page}: project prefix in markup`);
      assert.doesNotMatch(html, /(?:\/)?assets\/apps\//, `${mode}/${page}: local app icon reference`);
      const canonical = `${origin}${base}${page}`;
      assert.ok(html.includes(`<link rel="canonical" href="${canonical}">`) && sitemap.includes(`<loc>${canonical}</loc>`), `${mode}/${page}: canonical/sitemap`);
      if (page.startsWith('features/')) {
        const selected = featurePages.find(([id]) => page === `features/${id}/`);
        assert.ok(html.includes(`<title>${selected?.[1] ?? 'Features'} · Kubarr</title>`), `${mode}/${page}: title`);
        assert.ok(html.includes(`<meta name="description" content="${featureDescriptions[page]}">`), `${mode}/${page}: description`);
        assert.ok(html.includes(`href="${base}features/"${selected ? '' : ' aria-current="page"'}>Overview</a>`), `${mode}/${page}: overview link`);
        for (const [id, label, text] of featurePages) {
          assert.ok(html.includes(`href="${base}features/${id}/"${selected?.[0] === id ? ' aria-current="page"' : ''}>${label}</a>`), `${mode}/${page}: sidebar link`);
          assert.equal(html.includes(text), selected?.[0] === id, `${mode}/${page}: feature content ${id}`);
        }
        if (selected?.[0] === 'observability') {
          for (const point of ['Resource tracking', 'Track CPU and memory usage in monitoring.', 'Live network view', 'See network activity and connections live.']) assert.ok(html.includes(point), `${mode}/${page}: observability point ${point}`);
        }
        if (selected?.[0] === 'isolation') {
          for (const heading of ['Containers', 'Cilium networking', 'Storage', 'VPN']) assert.ok(html.includes(`<h2>${heading}</h2>`), `${mode}/${page}: isolation heading ${heading}`);
          assert.ok(html.includes(`href="${base}docs/how-it-works/"`) && html.includes('href="https://github.com/smokeythebandit/kubarr-charts"'), `${mode}/${page}: isolation links`);
          assert.ok(html.includes('observed traffic, not NetworkPolicy enforcement'));
          assert.doesNotMatch(html, /assets\/observability\//);
          assert.equal([...html.matchAll(/class="feature-screenshot"/g)].length, 3);
          for (const [name, width, height] of [['containers', 896, 587], ['storage', 1440, 984], ['vpn', 1440, 984]]) {
            const asset = `${base}assets/isolation/${name}.jpg`;
            assert.ok(html.includes(`href="${asset}"`) && html.includes(`src="${asset}"`) && html.includes(`width="${width}" height="${height}"`), `${mode}/${page}: isolation image ${name}`);
            const image = await readFile(join(out, `assets/isolation/${name}.jpg`));
            assert.ok(image.length > 10000 && image[0] === 0xff && image[1] === 0xd8, `${mode}/${page}: valid image ${name}`);
          }
        } else {
          assert.doesNotMatch(html, /assets\/isolation\//);
        }
        assert.ok(html.includes('href="' + base + 'features/" aria-current="page">Features</a>'), `${mode}/${page}: main menu`);
      }
      assert.ok(html.includes(`data-route="${page}" data-base="${base}"`), `${mode}/${page}: hydration route`);
      assert.ok(html.includes(`<script src="${base}assets/theme.js"></script>`) && html.indexOf('assets/theme.js') < html.indexOf('assets/site.css'), `${mode}/${page}: pre-paint theme`);
      assert.ok(html.includes(`src="${base}assets/app.js"`), `${mode}/${page}: hydration bundle`);
      for (const asset of html.matchAll(/(?:href|src)="([^"]*\/assets\/[^"]+)"/g)) {
        assert.ok(asset[1].startsWith(`${base}assets/`), `${mode}/${page}: wrong asset URL: ${asset[1]}`);
        await stat(join(out, asset[1].slice(base.length)));
      }
      for (const required of ['<html lang="en">', '<meta name="description"', '<title>', '<main ', 'id="main"', 'href="#main"', 'aria-label="Main navigation"', 'aria-expanded="false"']) assert.ok(html.includes(required), `${mode}/${page}: missing ${required}`);
      assert.doesNotMatch(html, /class="theme-control"|<option value="(?:system|light|dark)"/);
      assert.match(html, /<nav class="nav[\s\S]*?Home[\s\S]*?Features[\s\S]*?Apps[\s\S]*?GitHub ↗/);
      const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
      assert.equal(new Set(ids).size, ids.length, `${mode}/${page}: duplicate IDs`);
      for (const match of html.matchAll(/href="#([^"]+)"|aria-controls="([^"]+)"/g)) assert.ok(ids.includes(match[1] ?? match[2]));
      for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        const target = match[1];
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        assert.ok(target.startsWith(base), `${mode}/${page}: wrong base: ${target}`);
        const pathname = new URL(target, origin).pathname;
        const local = pathname.slice(base.length);
        const path = resolve(out, local, local.endsWith('/') || local === '' ? 'index.html' : '');
        assert.ok(path.startsWith(out));
        await stat(path);
      }
    }
    console.log(`${mode}: ${pages.length} direct HTML pages, metadata, assets, theme and routes OK`);
  }
} finally { await rm(tmp, { recursive: true, force: true }); }
