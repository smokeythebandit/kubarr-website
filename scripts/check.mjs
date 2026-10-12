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
const cliWorkflow = YAML.parse(await readFile('.github/workflows/cli-release.yml', 'utf8'));
assert.equal(cliWorkflow.jobs.build.strategy.matrix.include.length, 2, 'prebuilt CLI must target two Linux architectures');
assert.deepEqual(cliWorkflow.jobs.build.strategy.matrix.include.map(target => target.arch), ['x86_64', 'aarch64']);
assert.equal(cliWorkflow.jobs.publish.permissions.contents, 'write', 'CLI release publishing needs contents write permission');
const installerSource = await readFile('src/install.sh', 'utf8');
const installerSyntax = spawnSync('bash', ['-n', 'src/install.sh'], { encoding: 'utf8' });
assert.equal(installerSyntax.status, 0, `install.sh syntax: ${installerSyntax.stderr}`);
assert.match(installerSource, /releases\/download\/kubarr-cli-latest/);
assert.match(installerSource, /sha256sum --check/);
assert.match(installerSource, /\/usr\/local\/bin\/kubarr bootstrap/);

const pages = ['', 'apps/', 'docs/', 'docs/getting-started/', 'docs/how-it-works/', 'docs/using-kubarr/', 'docs/observability/unified-logging/', 'docs/observability/resource-tracking/', 'docs/observability/live-network-view/', 'docs/isolation/containers/', 'docs/isolation/cilium-networking/', 'docs/isolation/storage/', 'docs/isolation/vpn/', 'docs/apps/catalog/', 'docs/apps/details/', 'docs/apps/operations/'];
const redirects = { 'features/': 'features', 'features/observability/': 'observability', 'features/isolation/': 'isolation', 'features/modularity/': 'apps' };
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
const mobile = css.match(/@media\(max-width:700px\)\{\s*\.home \.hero-install[\s\S]*?\n\}/)?.[0];
assert.ok(mobile && mobile.includes('flex:1 1 auto;overflow-wrap:anywhere'));
assert.match(css, /height:100vh;height:100svh;height:100dvh/);
assert.doesNotMatch(css, /min-height:1[68]00px/);
assert.ok(mobile.includes('--move-x:var(--sdx);--move-y:var(--sdy)'));
assert.match(css, /@keyframes icon-breathe\{0%\{transform:translate3d\(calc\(var\(--move-x\) \* var\(--motion-scale,\.5\)/);
assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.home \.float-icon img,\.home \.icon-wobble\{animation:none\}\.icon-entrance-ready \.home \.hero-line-first,[^}]*\.hero-install,[^}]*\.icon-entrance\{visibility:visible;opacity:1;transform:none;animation:none\}\.icon-entrance-ready \.home \.home-header\{visibility:visible;opacity:1;animation:none\}\.icon-entrance-ready \.home \.hero-icons\{visibility:visible;opacity:\.6;animation:none\}\.icon-entrance-ready \.home \.hero-scroll\{visibility:visible;opacity:1;animation:none\}\}/);
assert.match(css, /\.icon-entrance-ready \.home \.hero-icons\{animation:icons-dim var\(--hero-install-duration\) ease-out var\(--hero-final-start\) both\}/);
assert.match(css, /\.icon-entrance-ready \.home \.home-header\{animation:header-arrive var\(--hero-install-duration\) ease-out var\(--hero-final-start\) both\}/);
assert.match(css, /@keyframes header-arrive\{0%\{visibility:hidden;opacity:0\}\.01%\{visibility:visible;opacity:0\}100%\{visibility:visible;opacity:1\}\}/);
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
    assert.equal(await readFile(join(out, 'install.sh'), 'utf8'), installerSource, `${mode}: root install.sh published`);
    assert.ok(robots.includes(`${origin}${base}sitemap.xml`));
    if (mode === 'production') {
      assert.doesNotMatch(sitemap + robots, /\/kubarr-website\//, 'production metadata must not use the project prefix');
    }
    const home = await readFile(join(out, 'index.html'), 'utf8');
    assert.match(home, /<h1 id="hero-title"><span class="hero-line-first">Your media stack <\/span><span class="hero-line-second">on <span class="kubernetes-lockup"><span class="kubernetes-word">Kubernetes<\/span><img class="kubernetes-logo"/);
    assert.doesNotMatch(home, /Your media stack,/);
    assert.match(home, /curl -fsSL https:\/\/kubarr\.com\/install\.sh \| sudo bash/);
    assert.match(home, /aria-label="Click to copy install command"/);
    assert.doesNotMatch(home, /03 \/ GET STARTED|Make it yours\.|Bring your cluster\. Choose your apps\./);
    assert.equal([...home.matchAll(/<section\b/g)].length, 3);
    for (const anchor of ['features', 'observability', 'isolation', 'apps']) assert.ok(home.includes(`id="${anchor}"`), `${mode}: homepage anchor ${anchor}`);
    assert.doesNotMatch(home, /03 — MODULARITY|Only the apps you need\.|Build your own stack\.|Workloads|Services|APP CHARTS \/ COMPONENTS/);
    for (const image of ['observability/logs.jpg', 'observability/resources.jpg', 'observability/networking.jpg', 'isolation/containers.jpg', 'isolation/storage.jpg', 'isolation/vpn.jpg', 'app-management/catalog.jpg', 'app-management/details.jpg', 'app-management/operations.jpg']) {
      assert.ok(home.includes(`src="${base}assets/${image}"`), `${mode}: story screenshot ${image}`);
      const bytes = await readFile(join(out, 'assets', image));
      assert.ok(bytes.length > 10000 && bytes[0] === 0xff && bytes[1] === 0xd8, `${mode}: valid screenshot ${image}`);
    }
    const appsStart = home.indexOf('<section class="home-apps"');
    const appsEnd = home.indexOf('</section>', appsStart) + '</section>'.length;
    assert.ok(appsStart !== -1 && appsEnd > appsStart, `${mode}: complete apps gallery`);
    const appsGallery = home.slice(appsStart, appsEnd);
    assert.ok(appsGallery.includes('<h2 id="app-management-title">Apps</h2>'));
    assert.equal([...appsGallery.matchAll(/class="home-feature-gallery-column"/g)].length, 3);
    assert.doesNotMatch(appsGallery, /<p\b|<figcaption>|02 \/ THE CATALOG|class="home-app-list"/);
    for (const image of ['catalog.jpg', 'details.jpg', 'operations.jpg'])
      assert.ok(appsGallery.includes(`href="${base}assets/app-management/${image}" aria-label="Open full-size`));
    assert.ok(appsGallery.includes(`href="${base}apps/"`));
    for (const [id, title, images] of [
      ['observability', 'Observability', ['logs.jpg', 'resources.jpg', 'networking.jpg']],
      ['isolation', 'Isolation', ['containers.jpg', 'storage.jpg', 'vpn.jpg']],
    ]) {
      const start = home.indexOf(`<div class="home-chapter home-feature-gallery" id="${id}"`);
      assert.ok(start !== -1, `${mode}: ${id} gallery`);
      const end = id === 'observability' ? home.indexOf('<div class="home-chapter home-feature-gallery" id="isolation"', start) : home.indexOf('</section>', start);
      const chapter = home.slice(start, end);
      assert.ok(chapter.includes(`<h2 id="${id}-title">${title}</h2>`));
      assert.equal([...chapter.matchAll(/class="home-feature-gallery-column"/g)].length, id === 'isolation' ? 4 : 3);
      if (id === 'observability') assert.doesNotMatch(chapter, /<p\b/);
      assert.doesNotMatch(chapter, /<figcaption>|class="home-chapter-row/);
      assert.equal([...chapter.matchAll(/class="feature-doc-link" href="[^"]+docs\//g)].length, id === 'isolation' ? 4 : 3);
      for (const image of images)
        assert.ok(chapter.includes(`href="${base}assets/${id}/${image}" aria-label="Open full-size`), `${mode}: linked ${id} screenshot ${image}`);
    }
    assert.equal([...home.matchAll(/class="home-chapter-row(?: home-row-reverse)?"/g)].length, 0);
    assert.doesNotMatch(home, /02 — ISOLATION|Space for every app/);
    assert.equal([...home.matchAll(/class="float-icon icon-depth-[012]"/g)].length, 0);
    assert.match(home, /class="hero-icons" aria-hidden="true"/);
    assert.ok(home.indexOf('classList.add("icon-entrance-ready")') < home.indexOf('assets/site.css'), `${mode}: pre-paint entrance flag`);
    assert.match(home, /<header class="site-header home-header" style="[^"]*--hero-final-start:[^;"]+;[^"]*--hero-install-duration:[^;"]+"/);
    assert.doesNotMatch(home, /<header[^>]*visibility:hidden/);
    assert.doesNotMatch(home, /is-entering/);
    assert.equal([...home.matchAll(/--arrival-delay:/g)].length, 0);
    assert.match(home, /data-catalog-source="pending"/);
    assert.doesNotMatch(home, /assets\/apps\/|raw\.githubusercontent\.com/);
    const assetFiles = await readdir(join(out, 'assets'), { recursive: true });
    assert.ok(!assetFiles.some(file => /(^|\/)apps(\/|$)/.test(file)), `${mode}: no bundled app icons`);
    const apps = await readFile(join(out, 'apps/index.html'), 'utf8');
    assert.match(apps, /<header class="site-header"><div/);
    assert.doesNotMatch(apps, /class="site-header home-header"|classList.add\("icon-entrance-ready"\)/);
    assert.ok(apps.includes('<title>Apps · Kubarr</title>') && apps.includes('Browse the live Kubarr chart catalog'));
    assert.ok(apps.includes('Loading apps from GitHub') && apps.includes('href="' + base + 'apps/" aria-current="page">Apps</a>'));
    assert.doesNotMatch(apps, /class="apps-card"|raw\.githubusercontent\.com/);
    for (const [oldPath, anchor] of Object.entries(redirects)) {
      const html = await readFile(join(out, oldPath, 'index.html'), 'utf8');
      assert.ok(html.includes(`content="0;url=${base}#${anchor}"`) && html.includes(`href="${base}#${anchor}"`), `${mode}: old URL ${oldPath} redirect`);
      assert.ok(html.includes(`<link rel="canonical" href="${origin}${base}#${anchor}">`), `${mode}: canonical redirect`);
      assert.ok(!sitemap.includes(`<loc>${origin}${base}${oldPath}</loc>`), `${mode}: redirect not in sitemap`);
      assert.doesNotMatch(html, /<main|<nav|class="feature-tile/);
    }
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
      assert.ok(new RegExp(`href="${base}apps/"(?: aria-current="page")?>Apps</a>`).test(html), `${mode}/${page}: main menu`);
      assert.ok(html.includes(`data-route="${page}" data-base="${base}"`), `${mode}/${page}: hydration route`);
      assert.ok(html.includes(`<script src="${base}assets/theme.js"></script>`) && html.indexOf('assets/theme.js') < html.indexOf('assets/site.css'), `${mode}/${page}: pre-paint theme`);
      assert.ok(html.includes(`src="${base}assets/app.js"`), `${mode}/${page}: hydration bundle`);
      for (const asset of html.matchAll(/(?:href|src)="([^"]*\/assets\/[^"]+)"/g)) {
        assert.ok(asset[1].startsWith(`${base}assets/`), `${mode}/${page}: wrong asset URL: ${asset[1]}`);
        await stat(join(out, asset[1].slice(base.length)));
      }
      for (const required of ['<html lang="en">', '<meta name="description"', '<title>', '<main ', 'id="main"', 'href="#main"', 'aria-label="Main navigation"', 'aria-expanded="false"']) assert.ok(html.includes(required), `${mode}/${page}: missing ${required}`);
      assert.doesNotMatch(html, /class="theme-control"|<option value="(?:system|light|dark)"/);
      assert.match(html, /<nav class="nav[\s\S]*?Home[\s\S]*?Apps[\s\S]*?GitHub ↗/);
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
