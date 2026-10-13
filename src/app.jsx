import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppIconField } from './app-icon-field.jsx';
import { headlineSize, iconFieldLayout } from './hero-layout.js';
import { heroAnimationStyle } from './hero-timing.js';
import { CatalogProvider, useCatalog } from './catalog-provider.jsx';

export const routes = ['', 'apps/', 'docs/', 'docs/getting-started/', 'docs/how-it-works/', 'docs/using-kubarr/',
  'docs/observability/unified-logging/', 'docs/observability/resource-tracking/', 'docs/observability/live-network-view/',
  'docs/isolation/containers/', 'docs/isolation/cilium-networking/', 'docs/isolation/storage/', 'docs/isolation/vpn/',
  'docs/apps/catalog/', 'docs/apps/details/', 'docs/apps/operations/'];
export const command = 'curl -fsSL https://kubarr.com/install.sh | bash';
const github = 'https://github.com/smokeythebandit/';
const mainMenu = [
  { label: 'Home', path: '', current: route => route === '' },
  { label: 'Documentation', path: 'docs/', current: route => route.startsWith('docs/') },
  { label: 'Apps', path: 'apps/', current: route => route === 'apps/' },
  { label: 'GitHub ↗', href: `${github}Kubarr`, className: 'nav-github' },
];

function Header({ route, base }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const escape = event => { if (event.key === 'Escape' && open) { setOpen(false); document.querySelector('[data-menu-toggle]')?.focus(); } };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open]);
  return <header className={route === '' ? 'site-header home-header' : 'site-header'} style={route === '' ? heroAnimationStyle : undefined}><div className="container header-inner">
    <a className="brand" href={base} aria-label="Kubarr home"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
      <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>
      <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/>
      <path d="M12 10v4"/>
      <path d="M12 2v3"/>
    </svg>Kubarr</a>
    <button className="menu-toggle" data-menu-toggle type="button" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen(!open)}>Menu</button>
    <nav className={`nav${open ? ' is-open' : ''}`} id="site-nav" aria-label="Main navigation" onClick={event => { if (event.target.closest('a')) setOpen(false); }}>
      {mainMenu.map(({ label, path, href, current, className }) => <a key={label} className={className} href={href ?? base + path} aria-current={current?.(route) ? 'page' : undefined}>{label}</a>)}
    </nav>
  </div></header>;
}

function InstallCommand() {
  const [status, setStatus] = useState('');
  const select = () => {
    const range = document.createRange();
    range.selectNodeContents(document.querySelector('[data-install-command]'));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  };
  const copy = async () => {
    select();
    let copied = false;
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(command); copied = true; } } catch { /* Try fallback. */ }
    if (!copied) {
      const field = document.createElement('textarea');
      field.value = command;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed'; field.style.opacity = '0';
      document.body.appendChild(field);
      try { field.select(); copied = document.execCommand('copy'); } catch { /* Clipboard denied. */ }
      finally { field.remove(); document.querySelector('[data-copy-command]').focus(); }
    }
    if (!copied) select();
    setStatus(copied ? 'Command copied to clipboard.' : 'Copy failed. Select the command to copy it manually.');
  };
  return <div className="hero-install" aria-label="Placeholder install command"><div className="hero-install-field" role="button" tabIndex="0" data-copy-command aria-label={status === 'Command copied to clipboard.' ? 'Install command copied' : 'Click to copy install command'} onClick={copy} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); copy(); } }}><pre><code data-install-command>{command}</code><span className={`copy-label${status === 'Command copied to clipboard.' ? ' is-copied' : ''}`}>{status === 'Command copied to clipboard.' ? 'Copied!' : 'Click to copy'}</span></pre></div><span className="copy-status" role="status" aria-live="polite">{status}</span></div>;
}

function Home({ base }) {
  const catalog = useCatalog();
  const heroRef = useRef(null);
  useLayoutEffect(() => {
    const hero = heroRef.current;
    const heading = hero.querySelector('h1');
    const command = hero.querySelector('.hero-install');
    const header = document.querySelector('.home-header');
    let frame = 0;
    let active = true;
    const layout = () => {
      frame = 0;
      // Recheck the natural viewport height on every resize, so a previously
      // needed scroll fallback can disappear when more room becomes available.
      hero.style.minHeight = '';
      const box = hero.getBoundingClientRect();
      if (!box.width || !box.height) return; // No layout engine (e.g. SSR or DOM-only tests).
      const currentSize = parseFloat(getComputedStyle(heading).fontSize);
      const lines = heading.querySelectorAll('.hero-line-first, .hero-line-second');
      const measuredWidth = Math.max(...[...lines].map(line => line.scrollWidth));
      const font = headlineSize(box.width, box.height, header.getBoundingClientRect().height,
        command.getBoundingClientRect().height, measuredWidth, currentSize);
      const value = `${font}px`;
      if (hero.style.getPropertyValue('--hero-font-size') !== value) hero.style.setProperty('--hero-font-size', value);
      const icons = [...hero.querySelectorAll('.float-icon')];
      let field;
      // At constrained heights enlarge only as much as needed for every icon.
      // No icons are hidden, and the command remains reachable by scrolling.
      for (let height = box.height; ; height += 24) {
        if (height > box.height) hero.style.minHeight = `${height}px`;
        const title = heading.getBoundingClientRect();
        field = iconFieldLayout({ width: box.width, height: hero.getBoundingClientRect().height,
          viewportHeight: box.height,
          // The homepage header is fixed; scrolling must not move its exclusion
          // zone down through the hero when the catalog arrives later.
          headerBottom: header.getBoundingClientRect().height,
          titleLeft: title.left - box.left, titleRight: title.right - box.left,
          titleTop: title.top - box.top, installTop: command.offsetTop,
          installBottom: command.offsetTop + command.offsetHeight, count: icons.length });
        if (field.fits || height > Math.max(5000, icons.length * 80)) break;
      }
      icons.forEach((icon, index) => {
        const spot = field.spots[index];
        icon.style.setProperty('--icon-x', `${spot.x}px`);
        icon.style.setProperty('--icon-y', `${spot.y}px`);
        icon.style.setProperty('--icon-size', `${spot.size}px`);
        icon.style.setProperty('--motion-scale', `${Math.min(1, spot.size / 160)}`);
      });
    };
    const schedule = () => { if (active && !frame) frame = requestAnimationFrame(layout); };
    layout();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    for (const element of [hero, heading, command, header]) observer?.observe(element);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    document.fonts?.ready.then(schedule);
    return () => {
      active = false;
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, [catalog.apps]);
  return <main id="main"><section ref={heroRef} className="hero" aria-labelledby="hero-title" style={heroAnimationStyle}><AppIconField catalog={catalog}/><div className="hero-content"><h1 id="hero-title"><span className="hero-line-first">Your media stack </span><span className="hero-line-second">on <span className="kubernetes-lockup"><span className="kubernetes-word">Kubernetes</span><img className="kubernetes-logo" src={`${base}assets/kubernetes-icon-color.svg`} alt="" aria-hidden="true"/></span></span></h1><InstallCommand/></div><a className="hero-scroll" href="#features">Explore Kubarr <span aria-hidden="true">↓</span></a></section><HomeFeatures base={base}/></main>;
}

function HomeFeatures({ base }) {
  const [screenshot, setScreenshot] = useState(null);
  const dialogRef = useRef(null);
  const openerRef = useRef(null);
  const sourceRef = useRef(null);
  const imageRef = useRef(null);
  const animationRef = useRef(null);
  const sequenceRef = useRef(0);
  const overflowRef = useRef(null);
  const closeTimerRef = useRef(null);
  const closeScrollRef = useRef(null);
  const stopAnimation = () => {
    animationRef.current?.cancel();
    animationRef.current = null;
  };
  const sourceRect = () => {
    const source = sourceRef.current;
    if (!source?.isConnected) return null;
    const rect = source.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth ? rect : null;
  };
  // Transform the actual fitted image, not the dialog/top-layer box. Each axis
  // gets its own scale so differing thumbnail and full-image ratios line up.
  const frames = (from, to) => ({
    transformOrigin: 'top left',
    transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`,
  });
  const motion = (image, keyframes, duration, done) => {
    try {
      const animation = image.animate(keyframes, { duration, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' });
      animationRef.current = animation;
      animation.finished.then(() => {
        if (animationRef.current !== animation) return;
        animationRef.current = null;
        animation.cancel();
        done?.();
      }).catch(() => {});
      return true;
    } catch { return false; }
  };
  const closeDialog = () => {
    const y = closeScrollRef.current ?? window.scrollY;
    dialogRef.current?.close();
    closeScrollRef.current = null;
    // The top layer's moving image can disturb scroll anchoring while closing.
    if (window.scrollY !== y) window.scrollTo({ top: y, behavior: 'instant' });
  };
  const finishClose = () => {
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    if (dialogRef.current?.open && dialogRef.current.dataset.state === 'closing') closeDialog();
  };
  const dismiss = () => {
    const dialog = dialogRef.current;
    if (!dialog?.open || dialog.dataset.state === 'closing') return;
    closeScrollRef.current = window.scrollY;
    ++sequenceRef.current;
    stopAnimation();
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      closeDialog();
      return;
    }
    if (dialog.dataset.state === 'pending') { closeDialog(); return; }
    dialog.dataset.state = 'closing';
    const image = imageRef.current;
    const from = sourceRect(); // Re-measure after scroll/resize, never use the opening snapshot.
    const to = image?.getBoundingClientRect();
    if (dialog.dataset.motion === 'shared' && from && to?.width && to.height && image?.animate) {
      if (motion(image, [{ transform: 'none', transformOrigin: 'top left' }, frames(from, to)], 260, finishClose)) {
        closeTimerRef.current = setTimeout(finishClose, 400);
        return;
      }
    }
    dialog.dataset.motion = 'fallback';
    // Keep the native modal/top layer (and its focus trap) until the exit finishes.
    // animationend may not fire when styles are unavailable or the tab is backgrounded.
    closeTimerRef.current = setTimeout(finishClose, 220);
  };
  const openScreenshot = (event, image) => {
    const dialog = dialogRef.current;
    // Keep the ordinary full-size image link working without JS or dialog support.
    if (!dialog?.showModal || !dialog.close || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (dialog.open) { event.preventDefault(); return; }
    closeScrollRef.current = null;
    openerRef.current = event.currentTarget;
    sourceRef.current = event.currentTarget.querySelector('img');
    dialog.dataset.state = 'pending';
    dialog.dataset.motion = 'fallback';
    overflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    try { dialog.showModal(); event.preventDefault(); setScreenshot(image); }
    catch {
      document.body.style.overflow = overflowRef.current;
      overflowRef.current = null;
      openerRef.current = null;
      sourceRef.current = null;
      delete dialog.dataset.state;
      setScreenshot(null);
      // Let the original anchor navigate if the browser could not open the modal.
    }
  };
  useLayoutEffect(() => {
    if (!screenshot) return;
    const dialog = dialogRef.current;
    const image = imageRef.current;
    const sequence = ++sequenceRef.current;
    const ready = () => {
      if (sequence !== sequenceRef.current || !dialog?.open || dialog.dataset.state !== 'pending') return;
      const from = sourceRect();
      const to = image.getBoundingClientRect();
      dialog.dataset.state = 'open';
      image.style.visibility = '';
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || !from || !to.width || !to.height || !image.animate) return;
      dialog.dataset.motion = 'shared';
      if (!motion(image, [frames(from, to), { transform: 'none', transformOrigin: 'top left' }], 320)) {
        dialog.dataset.motion = 'fallback';
      }
    };
    // decode() handles cached and uncached images without measuring a placeholder.
    // load/error are the fallback for browsers without decode().
    if (image.decode) image.decode().then(ready, ready);
    else if (image.complete) ready();
    else {
      image.addEventListener('load', ready);
      image.addEventListener('error', ready);
      return () => { image.removeEventListener('load', ready); image.removeEventListener('error', ready); };
    }
  }, [screenshot]);
  const restore = () => {
    ++sequenceRef.current;
    stopAnimation();
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    closeScrollRef.current = null;
    if (dialogRef.current) { delete dialogRef.current.dataset.state; delete dialogRef.current.dataset.motion; }
    sourceRef.current = null;
    if (overflowRef.current !== null) {
      document.body.style.overflow = overflowRef.current;
      overflowRef.current = null;
    }
    if (openerRef.current?.isConnected) openerRef.current.focus({ preventScroll: true });
    openerRef.current = null;
    setScreenshot(null);
  };
  useEffect(() => () => {
    ++sequenceRef.current;
    stopAnimation();
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    if (dialogRef.current?.open) dialogRef.current.close();
    if (overflowRef.current !== null) document.body.style.overflow = overflowRef.current;
    overflowRef.current = null;
  }, []);
  return <><section className="home-features" id="features" aria-label="Features"><div className="container">
    <FeatureGallery feature={features[0]} base={base} images={observabilityImages} onOpen={openScreenshot}/>
    <FeatureGallery feature={features[1]} base={base} images={isolationImages} onOpen={openScreenshot}/>
  </div></section><HomeApps base={base} onOpen={openScreenshot}/><dialog ref={dialogRef} className="screenshot-dialog" aria-label={screenshot ? `${screenshot.title} screenshot` : 'Screenshot'} onClose={restore} onCancel={event => { event.preventDefault(); dismiss(); }} onAnimationEnd={event => { if (event.target === event.currentTarget && event.animationName === 'screenshot-exit') finishClose(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dismiss();
  }}><div className="screenshot-dialog-content"><button type="button" className="screenshot-close" autoFocus onClick={dismiss} aria-label="Close screenshot"><svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg></button>{screenshot && <img ref={imageRef} src={screenshot.src} alt={screenshot.alt} width={screenshot.width} height={screenshot.height} style={{ visibility: 'hidden' }}/>}</div></dialog></>;
}

function FeatureGallery({ feature, base, images, onOpen }) {
  return <div className="home-chapter home-feature-gallery" id={feature.id} aria-labelledby={`${feature.id}-title`}>
    <h2 id={`${feature.id}-title`}>{feature.title}</h2>
    <div className="home-feature-gallery-cards">
      {feature.points.map(([title, description]) => {
        const docTitle = title === 'Networking' ? 'VPN networking' : title;
        const doc = featureDocs.find(page => page.title === docTitle);
        return <article className="home-feature-gallery-column" key={title}><h3>{title}</h3>{images[title] ? <FeatureImage title={title} base={base} images={images} folder={feature.folder ?? feature.id} hideCaption onOpen={onOpen}/> : <p>{description}</p>}{doc && <a className="feature-doc-link" href={`${base}${doc.route}`}>Learn more <span aria-hidden="true">→</span></a>}</article>;
      })}
    </div>
  </div>;
}

function HomeApps({ base, onOpen }) {
  return <section className="home-apps" id="apps" aria-labelledby="app-management-title"><div className="container">
    <FeatureGallery feature={appGallery} base={base} images={appImages} onOpen={onOpen}/>
    <a className="home-apps-cta" href={`${base}apps/`}>Browse supported apps <span aria-hidden="true">↗</span></a>
  </div></section>;
}

function Apps() {
  const { apps, revision, source, error, checking, retry } = useCatalog();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const categories = [...new Set(apps.map(app => app.category))].sort((a, b) => a.localeCompare(b));
  const selected = category === 'all' || categories.includes(category) ? category : 'all';
  const search = query.trim().toLocaleLowerCase();
  const matching = apps.filter(app => (selected === 'all' || app.category === selected) && (!search || `${app.name} ${app.description ?? ''}`.toLocaleLowerCase().includes(search)));
  return <main className="container apps-page" id="main">
    <span className="eyebrow">Chart catalog</span><h1>Apps</h1>
    <p className="apps-lede">Browse chart-backed apps from the <a href="https://github.com/smokeythebandit/kubarr-charts">Kubarr charts repository</a>. Availability and requirements depend on each chart and your cluster.</p>
    {source === 'pending' && !error ? <p role="status">Loading apps from GitHub…</p> : null}
    {source === 'cache' && <p className="apps-state" role="status">Showing cached GitHub catalog{error ? ' — the latest update could not be loaded.' : checking ? ' while checking for updates…' : ' (saved within the last hour).'}</p>}
    {source === 'live' && <p className="apps-state" role="status">Catalog up to date from GitHub.</p>}
    {!error && apps.length > 0 && <button type="button" onClick={retry} disabled={checking}>Refresh apps</button>}
    {error && <div className="apps-error" role="alert"><p>{source === 'cache' ? 'GitHub is unavailable right now. You can still browse the saved catalog.' : 'Could not load the app catalog from GitHub. Check your connection or try again later.'}</p><button type="button" onClick={retry}>Retry loading apps</button></div>}
    {apps.length > 0 && <>
      <div className="apps-controls"><label htmlFor="apps-search">Search apps</label><input id="apps-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search names and descriptions"/>
        <label htmlFor="apps-category">Category</label><select id="apps-category" value={selected} onChange={event => setCategory(event.target.value)}><option value="all">All apps ({apps.length})</option>{categories.map(name => <option key={name} value={name}>{name} ({apps.filter(app => app.category === name).length})</option>)}</select></div>
      <p className="apps-count" role="status">Showing {matching.length} of {apps.length} apps</p>
      {matching.length ? <ul className="apps-grid">{matching.map(app => <li className="apps-card" key={app.id}>
        <div className="apps-card-heading">{app.icon ? <img src={app.icon} alt="" width="56" height="56" loading="lazy"/> : <span className="apps-icon-placeholder" aria-hidden="true">◇</span>}<div><h2>{app.name}</h2><span className="apps-category">{app.category}</span></div></div>
        {app.description && <p>{app.description}</p>}
        <a href={`https://github.com/smokeythebandit/kubarr-charts/tree/${revision}/${app.group}/${app.id}`}>View {app.name} chart on GitHub ↗</a>
      </li>)}</ul> : <p className="apps-empty">No apps match your search or category. Try another search or choose All apps.</p>}
    </>}
  </main>;
}

const features = [
  { id: 'observability', title: 'Observability', points: [
    ['Unified logging', 'View application logs in the dashboard.'],
    ['Resource tracking', 'Track CPU and memory usage in monitoring.'],
    ['Live network view', 'See network activity and connections live.'],
  ], description: 'Available observability data depends on the monitoring services deployed.' },
  { id: 'isolation', title: 'Isolation', lede: 'Keep app workloads organized and choose how they share network access and storage.', points: [
    ['Containers', 'Kubarr runs chart-backed apps in Kubernetes pods, usually in an app-specific namespace. Containers in the same pod share its network; separate app pods and namespaces make workloads easier to manage, but they are not separate virtual machines or an absolute security boundary.'],
    ['Cilium networking', 'App charts enable Kubernetes NetworkPolicies by default for selected ingress and egress paths, including gateway access, DNS and public-network egress. Cilium can enforce these policies if you install and configure it as your cluster’s CNI; Kubarr does not install Cilium. Another NetworkPolicy-capable CNI can also enforce them. Check chart rules and your CNI: namespaces alone do not block traffic, and the gateway’s app permissions do not protect direct service access inside the cluster.'],
    ['Storage', 'Media libraries and downloads can use a shared NFS volume across apps. By default, many media charts also put each app’s config in a subdirectory of that same share; opt-in split storage puts config on a separate app PVC instead. A shared volume is accessible to apps that mount it, even in different namespaces, and a separate config claim does not isolate shared media. Check each chart’s storage layout and backups.'],
    ['Networking', 'For VPN-enabled app charts, assign a VPN provider to an app and redeploy it to add a Gluetun sidecar in the app’s pod. Kubarr supports WireGuard and OpenVPN credentials; the sidecar routes that pod’s traffic through the configured VPN. Its firewall kill switch is enabled by default and can be overridden per app. VPN is off until configured, requires a working provider and /dev/net/tun on the node, and any allowed outbound subnets can bypass the tunnel.'],
  ] },
];
const observabilityImages = {
  'Unified logging': { file: 'logs.jpg', width: 1440, height: 1214, alt: 'Dark Kubarr Logs screen filtered to real Sabnzbd setup messages from a local kind cluster', caption: 'Logs: filter and search application messages.' },
  'Resource tracking': { file: 'resources.jpg', width: 1440, height: 1214, alt: 'Dark Kubarr Resources screen with live CPU, memory and network metrics, GPU telemetry unavailable, and per-app usage from a local kind cluster', caption: 'Resources: cluster overview and per-app CPU, memory, and network usage.' },
  'Live network view': { file: 'networking.jpg', width: 1440, height: 1214, alt: 'Dark Kubarr Networking screen with a live local kind cluster topology, bandwidth totals and network statistics', caption: 'Networking: observed traffic flow and per-app statistics.' },
};
const isolationImages = {
  Containers: { file: 'containers.jpg', width: 1440, height: 1214, alt: 'Dark Kubarr pod details for Immich with four running pods and their container readiness and restart counts', caption: 'Immich pod details: containers and readiness.' },
  Storage: { file: 'storage.jpg', width: 1440, height: 1214, alt: 'Dark Kubarr Storage browser listing directories at the root of the NFS volume', caption: 'Storage browser: directories on the NFS volume.' },
  Networking: { file: 'vpn.jpg', width: 1440, height: 1214, alt: 'Dark Kubarr VPN settings listing a WireGuard provider and two app assignments with kill switches on', caption: 'VPN settings: provider and app assignments.' },
};
const appGallery = { id: 'app-management', folder: 'app-management', title: 'Apps', points: [
  ['App catalog'], ['App details'], ['Operations'],
] };
const appImages = {
  'App catalog': { file: 'catalog.jpg', width: 1440, height: 1214, alt: 'Dark Kubarr Apps catalog with chart-backed app categories, health indicators and the Sonarr detail panel on a local kind cluster' },
  'App details': { file: 'details.jpg', width: 1440, height: 1214, alt: 'Dark Kubarr Apps screen with the Installed filter and Immich detail panel showing its running status, category and storage information' },
  Operations: { file: 'operations.jpg', width: 1440, height: 1214, alt: 'Dark Kubarr Apps Operations view showing worker activity, waiting queue and real completed and failed operation counts' },
};
function FeatureImage({ title, base, images, folder, onOpen, hideCaption = false }) {
  const { file, width = 1440, height, alt, caption } = images[title];
  const src = `${base}assets/${folder}/${file}`;
  return <figure className="feature-screenshot"><a href={src} aria-label={`Open full-size ${title} screenshot`} onClick={event => onOpen(event, { src, alt, title, width, height })}><img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async"/></a>{!hideCaption && <figcaption>{caption}</figcaption>}</figure>;
}

const featureDocs = [
  { section: 'Observability', route: 'docs/observability/unified-logging/', title: 'Unified logging', summary: 'Find and inspect application log messages.', body: 'Use the Logs view to search and filter application messages while investigating startup or runtime behavior. Logs provide context for troubleshooting, but availability and retention depend on the logging components and cluster configuration. Compare messages with Kubernetes pod status and the application’s own health indicators.', how: 'Applications write messages as they run. Kubarr presents the log data made available by the configured logging stack, so you can narrow it by app or search terms instead of connecting to every pod separately. Logs are historical evidence, not a live health check; use workload status alongside them.' },
  { section: 'Observability', route: 'docs/observability/resource-tracking/', title: 'Resource tracking', summary: 'Review cluster and app resource telemetry.', body: 'The Resources view presents cluster and app telemetry such as CPU and memory when metrics are available. Per-app readings help compare workload consumption; they are observations, not resource limits or a promise of future capacity. Some telemetry, including GPU data, may be unavailable depending on hardware and monitoring setup.', how: 'Kubernetes and the installed metrics components periodically report usage. Kubarr organizes available measurements at cluster and app level, letting you compare current consumption and spot changes. Because metrics are sampled and may lag, use them for visibility and diagnosis rather than as exact instantaneous measurements or configured limits.' },
  { section: 'Observability', route: 'docs/observability/live-network-view/', title: 'Live network view', summary: 'Explore observed traffic and connections.', body: 'The Networking view visualizes network activity and connections reported by the cluster’s networking and observability components. Use it to understand traffic patterns and investigate connectivity. This is an observation tool, not a policy editor, and a displayed topology does not prove that unwanted traffic is blocked.', how: 'The cluster’s network observability component reports flow events, which Kubarr groups into a view of communicating workloads and traffic. The picture reflects what the component observed during its available window. It does not create firewall rules or demonstrate that traffic outside the observed sample is denied.' },
  { section: 'Isolation', route: 'docs/isolation/containers/', title: 'Containers', summary: 'Inspect app pods, container readiness and restarts.', body: 'Kubarr-managed apps run as Kubernetes workloads, commonly in app-specific namespaces. Inspect pod state, container readiness and restart counts to see whether a workload is running and where it may be failing. Containers in one pod share that pod’s network; namespaces are organizational boundaries, not virtual machines or a complete security boundary.', how: 'Kubernetes schedules chart-defined pods and containers onto cluster nodes. The dashboard reports their observed phase, readiness and restart information from Kubernetes, helping you locate a failing pod or container. Containers in the same pod share its network namespace and can communicate over localhost; a namespace boundary by itself does not isolate network traffic.' },
  { section: 'Isolation', route: 'docs/isolation/cilium-networking/', title: 'Cilium networking', summary: 'Understand network policy and CNI enforcement.', body: 'Some app charts define Kubernetes NetworkPolicies for selected ingress and egress paths. Policies only take effect when the cluster’s CNI supports and enforces them. Kubarr does not install Cilium; Cilium is one possible policy-capable CNI, and another compatible CNI may also enforce policies. Review chart rules and verify enforcement in your cluster. Namespace separation and dashboard app permissions do not automatically block direct in-cluster service traffic.', how: 'A chart can create NetworkPolicy resources that describe which pod-to-pod and ingress or egress connections should be allowed. Kubernetes stores those rules, but the cluster CNI is responsible for enforcing them. Cilium can provide that enforcement when installed and configured as the CNI; Kubarr does not install or configure it. Check both the generated policy and CNI behavior rather than assuming the policy object alone blocks packets.' },
  { section: 'Isolation', route: 'docs/isolation/storage/', title: 'Storage', summary: 'Plan shared media and app configuration storage.', body: 'Apps may use shared NFS storage for media and separate persistent volumes for application configuration. The exact layout is chart-specific. A shared volume is accessible to every workload that mounts it, even across namespaces; a separate config claim does not isolate shared media. Review each chart’s storage notes and plan backups. Some databases require local or block storage rather than shared NFS.', how: 'Charts declare persistent volume claims and mount points; Kubernetes binds claims to storage supplied by the cluster. Multiple apps can mount a shared NFS export for common media, while app-specific configuration may use its own claim when the chart supports it. Access follows the mounts and permissions configured for those workloads—not just their namespace—so review each chart’s paths and backup requirements.' },
  { section: 'Isolation', route: 'docs/isolation/vpn/', title: 'VPN networking', summary: 'Configure a VPN provider for supported apps.', body: 'For charts that support VPN routing, configure a provider and assign it to an app in VPN settings. The supported setup can use WireGuard or OpenVPN credentials and adds a Gluetun sidecar to the app’s pod when enabled. VPN routing requires a working provider and /dev/net/tun on the node. The firewall kill switch is enabled by default and can be overridden per app; explicitly allowed outbound subnets may bypass the tunnel. VPN is off until configured.', how: 'When enabled for a supported app, the chart runs Gluetun beside the app in the same pod. The sidecar establishes the configured tunnel and provides the pod’s VPN egress path; the firewall kill switch is intended to prevent ordinary outbound traffic if the tunnel is unavailable. Confirm the provider, node TUN support, allowed subnet exceptions and resulting connectivity for your own setup.' },
  { section: 'Apps', route: 'docs/apps/catalog/', title: 'App catalog', summary: 'Browse chart-backed apps and categories.', body: 'The catalog lists supported charts from the Kubarr charts repository. Search names and descriptions or browse by category. The public website catalog is for discovery; the apps available in an installed Kubarr instance depend on its configuration and the charts it can access. Catalog presence alone does not guarantee an app can run on every cluster.', how: 'Kubarr reads chart metadata to build the catalog and organize apps into categories. On this website the catalog is fetched from the public charts repository; in an installation, the catalog and installable state reflect that instance’s configured chart sources and cluster. The chart remains the source for deployment defaults and requirements.' },
  { section: 'Apps', route: 'docs/apps/details/', title: 'App details', summary: 'Review an app before installing or managing it.', body: 'Open an app’s detail view to review its information and the controls available for its current state. Before deploying, read the app chart’s documentation for storage, credentials, network access and other requirements. Values and available actions vary by chart and installed app state.', how: 'Selecting a catalog entry opens its details in the context of that app and its current installation state. The details help you review what the chart provides and which actions are available; they do not replace the chart’s full values documentation. Confirm storage, credentials and network requirements before submitting changes.' },
  { section: 'Apps', route: 'docs/apps/operations/', title: 'Operations', summary: 'Follow queued, completed and failed app work.', body: 'The Operations view shows queued work and operation history, including completed and failed work. Operations are processed by the worker using Helm and Kubernetes and may take time. If work fails, review its reported details and the relevant app and cluster logs before retrying. Verify resulting app and pod status; a submitted operation alone does not confirm that a workload is healthy.', how: 'The API queues an app action so it can run outside the browser request. A worker picks up the operation, invokes the required Helm and Kubernetes work, then records its outcome for the dashboard to display. Queueing separates long-running cluster changes from the UI, but does not guarantee success; inspect the final operation result and resulting workload state.' },
];
const docGroups = ['Observability', 'Isolation', 'Apps'];
function Docs({ route, base }) {
  const links = [['docs/', 'Overview'], ['docs/getting-started/', 'Getting started'], ['docs/how-it-works/', 'How it works'], ['docs/using-kubarr/', 'Using Kubarr']];
  const feature = featureDocs.find(page => page.route === route);
  return <main className="container docs-layout" id="main"><nav className="sidebar" aria-label="Documentation"><p className="eyebrow">Documentation</p>{links.map(([path, name]) => <a key={path} href={base + path} aria-current={route === path ? 'page' : undefined}>{name}</a>)}{docGroups.map(group => <div className="sidebar-group" key={group}><p>{group}</p>{featureDocs.filter(page => page.section === group).map(page => <a key={page.route} href={`${base}${page.route}`} aria-current={route === page.route ? 'page' : undefined}>{page.title}</a>)}</div>)}</nav><article className="prose">{route === 'docs/' ? <Overview base={base}/> : route === 'docs/getting-started/' ? <GettingStarted base={base}/> : route === 'docs/how-it-works/' ? <HowItWorks base={base}/> : route === 'docs/using-kubarr/' ? <UsingKubarr base={base}/> : <FeatureDoc page={feature} base={base}/>}</article></main>;
}
function DocDiagram({ label, flows }) {
  return <div className="docs-diagram" role="img" aria-label={label}>{flows.map((flow, index) => <div className="docs-diagram-flow" key={index}>{flow.map((node, position) => <React.Fragment key={node}>{position > 0 && <span className="docs-diagram-arrow" aria-hidden="true">→</span>}<span className="docs-diagram-node">{node}</span></React.Fragment>)}</div>)}</div>;
}
function Overview({ base }) {
  return <><span className="eyebrow">The field guide</span><h1>Documentation</h1><p>Kubarr is a dashboard and installer for managing self-hosted applications on Kubernetes. Start with setup and architecture, then browse feature documentation grouped by the sections on the homepage.</p><div className="doc-links"><a href={`${base}docs/getting-started/`}><strong>Getting started →</strong><span>Prerequisites, CLI build, bootstrap and access.</span></a><a href={`${base}docs/how-it-works/`}><strong>How it works →</strong><span>Gateway, API, worker and the app catalog.</span></a><a href={`${base}docs/using-kubarr/`}><strong>Using Kubarr →</strong><span>Feature guides grouped by Observability, Isolation and Apps.</span></a></div><h2>Source of truth</h2><p>The <a href={`${github}Kubarr`}>application repository</a> contains the dashboard, API and worker. The <a href={`${github}kubarr-cli`}>CLI repository</a> contains the browser installer and its releases. The <a href={`${github}kubarr-charts`}>charts repository</a> contains platform components and supported app charts. For deeper configuration and chart-specific storage or networking notes, consult those repositories.</p><div className="callout"><p><strong>Important:</strong> Some older Kubarr guides mention a single <code>kubarr</code> umbrella Helm chart. The current charts repository does not have one; use the browser bootstrap described here.</p></div></>;
}
function GettingStarted({ base }) {
  return <><span className="eyebrow">01 / Install</span><h1>Getting started</h1><p>Bootstrap Kubarr with the standalone <a href={`${github}kubarr-cli`}>Kubarr CLI</a>. Its browser wizard installs the platform components and sets up initial access. The separate <a href={`${github}kubarr-charts`}>charts repository</a> holds component and application charts; there is no umbrella <code>kubarr</code> Helm chart.</p>
    <h2>Before you begin</h2><ul><li>A Kubernetes cluster reachable with <code>kubectl</code>. The project's Helm 4.3 target supports Kubernetes 1.34–1.37; check your cluster version and current context.</li><li><strong>Helm 4</strong> (target 4.3.0). The CLI uses OCI chart references for platform components. Rust 1.88+ and Cargo are needed only if you choose to build the CLI manually.</li><li>Storage planned for the platform and apps. The CLI offers managed NFS or an external NFS export. Review the <a href={`${github}kubarr-charts#first-installs-and-persistent-credentials`}>charts storage notes</a> before deploying persistent apps; some databases require local/block storage.</li><li>Permission to create cluster and namespace resources. Check that your kubeconfig points at the intended cluster before running bootstrap.</li></ul>
    <h2>Install with the website command</h2><pre><code>{command}</code></pre><p>On Linux x86_64 or aarch64, this downloads the matching prebuilt CLI release, verifies its SHA-256 checksum, installs it at <code>~/.local/bin/kubarr</code> and starts the browser wizard as your current user, using your home directory and kubeconfig. Installing the CLI and hosting the wizard do not require administrator privileges. You need curl, tar, awk, sha256sum and install, plus the Kubernetes and Helm prerequisites above; Rust and Cargo are only needed for a source build.</p><p>For later commands, put your user-local binary directory first on your shell's PATH:</p><pre><code>{'export PATH="$HOME/.local/bin:$PATH"'}</code></pre>
    <h2>Build the CLI manually</h2><pre><code>{`git clone https://github.com/smokeythebandit/kubarr-cli.git
cd kubarr-cli
cargo build --locked
./target/debug/kubarr --help
./target/debug/kubarr bootstrap`}</code></pre><p>These commands run from the standalone CLI checkout. The CLI needs access to published OCI charts and container images during installation.</p>
    <h2>Check and bootstrap</h2><pre><code>{`kubectl config current-context
kubectl get nodes
helm version
kubarr bootstrap`}</code></pre><p>Open the invitation URL printed by the CLI and configure installation in your browser. Select a context or upload a kubeconfig, then choose storage, dashboard access and initial admin details. Review the plan before confirming. Creating a new local k3s cluster is a host-administration operation and still requires administrative privileges.</p><div className="callout"><p><strong>Access:</strong> Follow the wizard's dashboard access instructions for your selected cluster and network setup. Do not assume a public endpoint is configured automatically.</p></div>
    <h2>After installation</h2><p>Check the application and gateway workloads:</p><pre><code>{`kubectl get pods,svc -n kubarr-backend
kubectl get pods,svc -n kubarr-frontend
kubectl get pods,svc -n kubarr-worker
kubectl get pods,svc -n openresty`}</code></pre><p>Open the dashboard using the wizard's access instructions, sign in with the admin account created during bootstrap, and browse the application catalog. Check each app chart's requirements before deploying it, especially persistent storage, network access and credentials.</p><h2>Need a closer look?</h2><p>Read <a href={`${base}docs/how-it-works/`}>how Kubarr works</a>, inspect the <a href={`${github}kubarr-cli`}>CLI source</a> or browse the <a href={`${github}kubarr-charts`}>charts documentation</a>. For problems, use <a href={`${github}Kubarr/issues`}>app issues</a>.</p></>;
}
function HowItWorks({ base }) {
  return <><span className="eyebrow">02 / Architecture</span><h1>How Kubarr works</h1><p>Kubarr is a control plane for self-hosted applications running on your Kubernetes cluster. The dashboard is one part of a set of components with distinct jobs.</p><h2>From browser to cluster</h2><table><thead><tr><th scope="col">Component</th><th scope="col">Job</th></tr></thead><tbody>{[
    ['Gateway', 'OpenResty routes dashboard, API and app requests; it checks authorization before proxying an installed app.'],
    ['Frontend', 'A React interface for catalog, status, settings and app operations.'],
    ['API', 'A Rust/Axum service for authentication, application state and control-plane requests.'],
    ['Worker', 'Processes queued app operations using Helm and Kubernetes, separately from browser requests.'],
    ['Database & storage', 'PostgreSQL stores Kubarr state. The platform can provide shared NFS media storage; chart-specific storage needs vary.'],
  ].map(([name, job]) => <tr key={name}><td>{name}</td><td>{job}</td></tr>)}</tbody></table><h2>Applications are chart-backed</h2><p>The <a href={`${github}kubarr-charts`}>charts repository</a> groups supported apps into media servers, media managers, indexers, download clients and other categories. Examples include Jellyfin, Plex, Sonarr, Radarr, Jackett and qBittorrent. Apps generally run in separate namespaces with chart-defined services, volumes and network policies. Deployment behavior depends on the chart and your cluster configuration.</p><h2>Storage and access are deliberate choices</h2><p>Shared media and individual application configuration do not always have the same storage needs. Some chart configurations use a shared NFS claim, while certain databases require local/block storage. Check the chart's README and <a href={`${github}kubarr-charts#first-installs-and-persistent-credentials`}>storage notes</a> before enabling an app. Plan backup and network access for your own cluster; namespace separation alone is not a substitute for verifying network policy enforcement.</p><div className="callout"><p>For the detailed request flow, see the <a href={`${github}Kubarr/blob/main/docs/architecture.md`}>application architecture guide</a>. To set up the platform, continue to <a href={`${base}docs/getting-started/`}>getting started</a>.</p></div></>;
}

function UsingKubarr({ base }) {
  return <><span className="eyebrow">Feature reference</span><h1>Using Kubarr</h1><p>Feature guides follow the same sections as the homepage. Choose a topic for its own walkthrough and notes about what to verify in your cluster.</p>{docGroups.map(group => <section className="docs-feature-group" key={group}><h2>{group}</h2><div className="doc-links">{featureDocs.filter(page => page.section === group).map(page => <a key={page.route} href={`${base}${page.route}`}><strong>{page.title} →</strong><span>{page.summary}</span></a>)}</div></section>)}<p>For initial setup, continue to <a href={`${base}docs/getting-started/`}>Getting started</a>. For component responsibilities, see <a href={`${base}docs/how-it-works/`}>How it works</a>.</p></>;
}

function FeatureDoc({ page, base }) {
  if (!page) return null;
  const flows = {
    'Unified logging': [['App workloads', 'Logs view', 'Search and filter', 'Investigate']],
    'Resource tracking': [['Cluster and app metrics', 'Resources view', 'Compare usage']],
    'Live network view': [['Observed cluster traffic', 'Networking view', 'Investigate connections']],
    Containers: [['Kubernetes workload', 'Pods and containers', 'Readiness and restarts']],
    'Cilium networking': [['Chart NetworkPolicies', 'Policy-capable CNI', 'Enforced traffic rules']],
    Storage: [['App chart', 'Persistent volume or shared NFS', 'Mounted app data']],
    'VPN networking': [['App pod', 'Gluetun sidecar', 'Configured VPN provider']],
    'App catalog': [['Kubarr charts repository', 'App catalog', 'Browse and search']],
    'App details': [['Choose an app', 'Review chart details', 'Check requirements']],
    Operations: [['Dashboard request', 'Operation queue', 'Worker, Helm and Kubernetes']],
  };
  return <><span className="eyebrow">{page.section} / Feature guide</span><h1>{page.title}</h1><p>{page.summary}</p><p>{page.body}</p><h2>How it works</h2><DocDiagram label={`${page.title} flow diagram`} flows={flows[page.title]}/><p>{page.how}</p>{page.section === 'Apps' && <p>App requirements and available behavior are defined by the app chart. Review its <a href={`${github}kubarr-charts`}>chart documentation</a> before deploying or changing an app.</p>}{page.section !== 'Apps' && <p>These views show or configure aspects of your Kubernetes cluster. Availability and behavior depend on your deployed components, cluster configuration and supported app charts.</p>}<div className="callout"><p><strong>Check the result:</strong> Use Kubernetes workload status and the relevant chart documentation to verify behavior. Observability views show reported state and do not themselves enforce network or storage boundaries.</p></div><p><a href={`${base}docs/using-kubarr/`}>← All feature guides</a></p></>;
}

export function App({ route, base }) {
  if (!routes.includes(route)) throw new Error(`Unknown page: ${route}`);
  return <><a className="skip" href="#main">Skip to content</a><Header route={route} base={base}/>{route === '' ? <CatalogProvider><Home base={base}/></CatalogProvider> : route === 'apps/' ? <CatalogProvider><Apps/></CatalogProvider> : <Docs route={route} base={base}/>}</>;
}
