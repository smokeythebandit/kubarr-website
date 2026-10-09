import React, { useEffect, useState } from 'react';
import { AppIconField } from './app-icon-field.jsx';
import { heroAnimationStyle } from './hero-timing.js';
import { CatalogProvider, useCatalog } from './catalog-provider.jsx';

export const routes = ['', 'features/', 'features/observability/', 'features/isolation/', 'features/modularity/', 'apps/', 'docs/', 'docs/getting-started/', 'docs/how-it-works/'];
export const command = 'curl -fsSL https://kubarr.com/install.sh | sudo bash';
const github = 'https://github.com/smokeythebandit/';
const mainMenu = [
  { label: 'Home', path: '', current: route => route === '' },
  { label: 'Features', path: 'features/', current: route => route.startsWith('features/') },
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
  return <header className="site-header"><div className="container header-inner">
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
  return <div className="hero-install" aria-label="Placeholder install command"><pre><code tabIndex="0" aria-label="Install command; click or press Enter to select all" data-install-command onClick={select} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } }}>{command}</code><button type="button" data-copy-command aria-label={status === 'Command copied to clipboard.' ? 'Install command copied' : 'Copy install command'} onClick={copy}>{status === 'Command copied to clipboard.' ? 'Copied' : 'Copy'}</button></pre><span className="copy-status" role="status" aria-live="polite">{status}</span></div>;
}

function Home({ base }) {
  const catalog = useCatalog();
  return <main id="main"><section className="hero" aria-labelledby="hero-title" style={heroAnimationStyle}><AppIconField catalog={catalog}/><div className="hero-content"><h1 id="hero-title"><span className="hero-line-first">Your media stack </span><span className="hero-line-second">on <span className="kubernetes-word">Kubernetes</span><img className="kubernetes-logo" src={`${base}assets/kubernetes-icon-color.svg`} alt="" aria-hidden="true"/></span></h1><InstallCommand/></div></section></main>;
}

function Apps() {
  const { apps, revision, source, error, retry } = useCatalog();
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
    {source === 'cache' && <p className="apps-state" role="status">Showing cached GitHub catalog{error ? ' — the latest update could not be loaded.' : ' while checking for updates…'}</p>}
    {source === 'live' && <p className="apps-state" role="status">Catalog up to date from GitHub.</p>}
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
    ['Logging', 'View application logs in the dashboard.'],
    ['Resource tracking', 'Track CPU and memory usage in monitoring.'],
    ['Live network view', 'See network activity and connections live.'],
  ], description: 'Available observability data depends on the monitoring services deployed.' },
  { id: 'isolation', title: 'Isolation', lede: 'Keep app workloads organized and choose how they share network access and storage.', points: [
    ['Containers', 'Kubarr runs chart-backed apps in Kubernetes pods, usually in an app-specific namespace. Containers in the same pod share its network; separate app pods and namespaces make workloads easier to manage, but they are not separate virtual machines or an absolute security boundary.'],
    ['Cilium networking', 'App charts enable Kubernetes NetworkPolicies by default for selected ingress and egress paths, including gateway access, DNS and public-network egress. Cilium can enforce these policies if you install and configure it as your cluster’s CNI; Kubarr does not install Cilium. Another NetworkPolicy-capable CNI can also enforce them. Check chart rules and your CNI: namespaces alone do not block traffic, and the gateway’s app permissions do not protect direct service access inside the cluster.'],
    ['Storage', 'Media libraries and downloads can use a shared NFS volume across apps. By default, many media charts also put each app’s config in a subdirectory of that same share; opt-in split storage puts config on a separate app PVC instead. A shared volume is accessible to apps that mount it, even in different namespaces, and a separate config claim does not isolate shared media. Check each chart’s storage layout and backups.'],
    ['VPN', 'For VPN-enabled app charts, assign a VPN provider to an app and redeploy it to add a Gluetun sidecar in the app’s pod. Kubarr supports WireGuard and OpenVPN credentials; the sidecar routes that pod’s traffic through the configured VPN. Its firewall kill switch is enabled by default and can be overridden per app. VPN is off until configured, requires a working provider and /dev/net/tun on the node, and any allowed outbound subnets can bypass the tunnel.'],
  ] },
  { id: 'modularity', title: 'Modularity', description: 'Chart-based apps are independent components you can install and manage individually. Each chart defines its own workloads, services and storage requirements.' },
];
const observabilityImages = {
  Logging: { file: 'logs.jpg', height: 634, alt: 'Dark Kubarr Logs screen with filters and real application log entries from a local kind cluster', caption: 'Logs: filter and search application messages.' },
  'Resource tracking': { file: 'resources.jpg', height: 1074, alt: 'Dark Kubarr Resources screen with live CPU, memory and network metrics, GPU telemetry unavailable, and per-app usage from a local kind cluster', caption: 'Resources: cluster overview and per-app CPU, memory, and network usage.' },
  'Live network view': { file: 'networking.jpg', height: 1314, alt: 'Dark Kubarr Networking screen with a live local kind cluster topology, bandwidth totals and network statistics', caption: 'Networking: observed traffic flow and per-app statistics.' },
};
const isolationImages = {
  Containers: { file: 'containers.jpg', width: 896, height: 587, alt: 'Dark Kubarr pod details for Immich with four running pods and their container readiness and restart counts', caption: 'Immich pod details: containers and readiness.' },
  Storage: { file: 'storage.jpg', width: 1440, height: 984, alt: 'Dark Kubarr Storage browser listing directories at the root of the NFS volume', caption: 'Storage browser: directories on the NFS volume.' },
  VPN: { file: 'vpn.jpg', width: 1440, height: 984, alt: 'Dark Kubarr VPN settings listing a WireGuard provider and two app assignments with kill switches on', caption: 'VPN settings: provider and app assignments.' },
};
function FeatureImage({ title, base, images, folder }) {
  const { file, width = 1440, height, alt, caption } = images[title];
  const src = `${base}assets/${folder}/${file}`;
  return <figure className="feature-screenshot"><a href={src} aria-label={`Open full-size ${title} screenshot`}><img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async"/></a><figcaption>{caption}</figcaption></figure>;
}
function Features({ route, base }) {
  const feature = features.find(({ id }) => route === `features/${id}/`);
  return <main className="container features-layout" id="main"><nav className="features-nav" aria-label="Features"><p className="eyebrow">Features</p><a href={`${base}features/`} aria-current={route === 'features/' ? 'page' : undefined}>Overview</a>{features.map(({ id, title }) => <a key={id} href={`${base}features/${id}/`} aria-current={feature?.id === id ? 'page' : undefined}>{title}</a>)}</nav><div className="features-content">{feature ? <><h1>{feature.title}</h1>{(feature.lede || feature.id === 'observability') && <p className="features-lede">{feature.lede ?? 'Explore Kubarr’s Logs, Resources, and Networking screens.'}</p>}{feature.points?.map(([title, description]) => <section key={title}><h2>{title}</h2><p>{feature.id === 'isolation' && title === 'Cilium networking' ? <>{description} The Networking screen shows observed traffic, not NetworkPolicy enforcement.</> : description}</p>{feature.id === 'observability' && <FeatureImage title={title} base={base} images={observabilityImages} folder="observability"/>}{feature.id === 'isolation' && isolationImages[title] && <FeatureImage title={title} base={base} images={isolationImages} folder="isolation"/>}</section>)}{feature.id === 'isolation' && <div className="feature-note"><p>For chart-specific storage, network and VPN settings, see the <a href={`${github}kubarr-charts`}>charts repository</a>, or read <a href={`${base}docs/how-it-works/`}>how Kubarr works</a>.</p></div>}{feature.description && <p>{feature.description}</p>}</> : <><h1>Features</h1><p className="features-lede">The essentials for managing apps on your Kubernetes cluster.</p><div className="feature-links">{features.map(({ id, title }) => <a key={id} href={`${base}features/${id}/`}>{title} →</a>)}</div></>}</div></main>;
}

function Docs({ route, base }) {
  const links = [['docs/', 'Overview'], ['docs/getting-started/', 'Getting started'], ['docs/how-it-works/', 'How it works']];
  return <main className="container docs-layout" id="main"><nav className="sidebar" aria-label="Documentation"><p className="eyebrow">Documentation</p>{links.map(([path, name]) => <a key={path} href={base + path} aria-current={route === path ? 'page' : undefined}>{name}</a>)}</nav><article className="prose">{route === 'docs/' ? <Overview base={base}/> : route === 'docs/getting-started/' ? <GettingStarted base={base}/> : <HowItWorks base={base}/>}</article></main>;
}
function Overview({ base }) {
  return <><span className="eyebrow">The field guide</span><h1>Documentation</h1><p>Kubarr is a dashboard and installer for managing self-hosted applications on Kubernetes. Start with the installer, then explore how the platform fits together.</p><div className="doc-links"><a href={`${base}docs/getting-started/`}><strong>01 / Getting started →</strong><span>Prerequisites, CLI build, bootstrap and access.</span></a><a href={`${base}docs/how-it-works/`}><strong>02 / How it works →</strong><span>Gateway, API, worker and the app catalog.</span></a></div><h2>Source of truth</h2><p>The <a href={`${github}Kubarr`}>application repository</a> contains the CLI and application code. The <a href={`${github}kubarr-charts`}>charts repository</a> contains platform components and supported app charts. These introductory pages reflect the current CLI bootstrap flow; for deeper configuration and chart-specific storage or networking notes, consult those repositories.</p><div className="callout"><p><strong>Important:</strong> Some older Kubarr guides mention a single <code>kubarr</code> umbrella Helm chart. The current charts repository does not have one; use the CLI bootstrap described here.</p></div></>;
}
function GettingStarted({ base }) {
  return <><span className="eyebrow">01 / Install</span><h1>Getting started</h1><p>Bootstrap Kubarr with the CLI in the <a href={`${github}Kubarr`}>application repository</a>. It installs the platform components and sets up initial access. The separate <a href={`${github}kubarr-charts`}>charts repository</a> holds component and application charts; there is no umbrella <code>kubarr</code> Helm chart.</p>
    <h2>Before you begin</h2><ul><li>A Kubernetes cluster reachable with <code>kubectl</code>. The project's Helm 4.3 target supports Kubernetes 1.34–1.37; check your cluster version and current context.</li><li><strong>Helm 4</strong> (target 4.3.0), Rust toolchain supporting <strong>Rust 1.88+</strong> and Cargo to build the CLI. The CLI uses OCI chart references for platform components.</li><li>Storage planned for the platform and apps. The CLI offers managed NFS or an external NFS export. Review the <a href={`${github}kubarr-charts#first-installs-and-persistent-credentials`}>charts storage notes</a> before deploying persistent apps; some databases require local/block storage.</li><li>Permission to create cluster and namespace resources. Check that your kubeconfig points at the intended cluster before running bootstrap.</li></ul>
    <h2>Build the installer</h2><pre><code>{`git clone https://github.com/smokeythebandit/Kubarr.git
cd Kubarr/code/cli
cargo build --locked
./target/debug/kubarr --help
./target/debug/kubarr bootstrap --help`}</code></pre><p>These commands run from the cloned application repository. The CLI may need access to published OCI charts and container images during installation.</p>
    <h2>Check and bootstrap</h2><pre><code>{`kubectl config current-context
kubectl get nodes
helm version
./target/debug/kubarr bootstrap`}</code></pre><p>Run <code>bootstrap</code> in an interactive terminal to open the install wizard. Choose an existing or single-node cluster, storage options and initial admin details. Review the plan before confirming. For non-interactive installs, inspect <code>kubarr bootstrap --help</code> for flags; avoid putting passwords in shared shell history. The installer defaults to the <code>kubarr-system</code> namespace.</p><div className="callout"><p><strong>Access:</strong> Follow the access instructions printed by the installer for your selected cluster and network setup. Do not assume a public endpoint is configured automatically.</p></div>
    <h2>After installation</h2><p>Check workloads and services in the selected namespace:</p><pre><code>kubectl get pods,svc -n kubarr-system</code></pre><p>Open the dashboard using the installer's access instructions, sign in with the admin account created during bootstrap, and browse the application catalog. Check each app chart's requirements before deploying it, especially persistent storage, network access and credentials.</p><h2>Need a closer look?</h2><p>Read <a href={`${base}docs/how-it-works/`}>how Kubarr works</a>, inspect the <a href={`${github}Kubarr/tree/main/code/cli`}>CLI source</a> or browse the <a href={`${github}kubarr-charts`}>charts documentation</a>. For problems, use <a href={`${github}Kubarr/issues`}>app issues</a>.</p></>;
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

export function App({ route, base }) {
  if (!routes.includes(route)) throw new Error(`Unknown page: ${route}`);
  return <><a className="skip" href="#main">Skip to content</a><Header route={route} base={base}/>{route === '' ? <CatalogProvider><Home base={base}/></CatalogProvider> : route === 'apps/' ? <CatalogProvider><Apps/></CatalogProvider> : route.startsWith('features/') ? <Features route={route} base={base}/> : <Docs route={route} base={base}/>}</>;
}
