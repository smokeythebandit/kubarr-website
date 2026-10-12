# Kubarr website

React one-page landing experience, app catalog and documentation for [Kubarr](https://github.com/smokeythebandit/Kubarr). The main menu jumps to the Features and Apps sections of the homepage; Observability and Isolation are anchored chapters there. Sixteen static HTML pages are prerendered, including separate docs for each homepage feature grouped under Observability, Isolation and Apps, plus small redirects from the four former feature URLs to their homepage sections (the former Modularity URL redirects to Apps). Node.js 20.10+ and npm are required. Each directory has its own `index.html` for direct navigation on GitHub Pages; no client-side router or server rewrites are needed.

## Work locally

```sh
node --version # 20.10 or newer
npm ci
npm run build
npm run check
npm run dev
```

Open `http://localhost:8000/kubarr-website/`. `dev` serves the built site; rebuild after editing `src/`. To inspect the production-domain output locally:

```sh
SITE_ORIGIN=https://kubarr.com npm run build
npm run check
npm run dev
```

Open `http://localhost:8000/` for that build. The build writes only to `dist/`. `npm run check` validates prerendered pages, canonical URLs, local links/assets, theme initialization and both preview and production builds (in temporary directories). The local server reads `dist/` for each request; rebuild after editing source. Restart the server if you change `SITE_ORIGIN`.

## Chart catalog

The homepage and Apps page load their chart catalog from the public [kubarr-charts](https://github.com/smokeythebandit/kubarr-charts) repository. When a refresh is needed, `CatalogProvider` requests the [GitHub tree for `main`](https://api.github.com/repos/smokeythebandit/kubarr-charts/git/trees/main?recursive=1) once, then fetches each discovered `*/<chart>/Chart.yaml` from `raw.githubusercontent.com` at the returned commit SHA (up to four parallel requests). If the tree revision matches the validated saved catalog, no Chart.yaml requests are needed. There is no published machine-readable catalog index in the charts repository: Kubarr's own API also discovers the directories and reads chart annotations. The site uses `kubarr.io/category`, `system`, `hidden` and `browseable` annotations to select user-facing apps, and loads adjacent `icon.svg` files as pinned, external `<img>` URLs. New charts appear without a website deploy; missing icons get a `?` placeholder. The provider exposes `source` (`pending`, `cache` or `live`), revision and error state, also visible as `data-catalog-*` on the icon field.

SSR and no-JavaScript visitors see the complete headline and install command without app icons. Hydration initially matches that HTML, then displays a validated localStorage cache if present. A catalog saved less than **one hour** ago is fresh: reloads and provider remounts make **zero** GitHub catalog requests. After one hour, the saved catalog stays visible while one shared refresh runs; concurrent providers share its request. A successful refresh updates the timestamp (including when the tree revision is unchanged). On failure or rate limits, the stale catalog remains visible and automatic remount attempts pause for **one minute**; the Apps page Retry button bypasses this cooldown, and Refresh apps can explicitly check even a fresh catalog. Cache entries older than **seven days** are discarded; without a valid cache and with GitHub unavailable, no apps appear. Successful results also remain in memory across navigation when localStorage is blocked. Cache icon URLs are reconstructed from a fixed GitHub repository, validated chart paths and the cached commit SHA; stored URLs are never used directly. Requests have a 12-second overall timeout, a limit of 100 charts, and no credentials. GitHub's API quota and cache headers can delay updates or leave the icons absent; the homepage and Apps page are the only routes that request the catalog. The headline and install control follow a fixed, bounded introduction independent of catalog arrival; icons start their own stagger on insertion without replaying the headline. No supported app SVGs are bundled or requested locally.

The website does not contact an authenticated Kubarr installation or expose an API token.

## Publish on GitHub Pages

1. Push to `main` in [kubarr-website](https://github.com/smokeythebandit/kubarr-website). In repository **Settings → Pages**, select **GitHub Actions** as the build/deployment source. The workflow builds and deploys `dist/` on pushes to `main` and can also be run manually. It needs the repository's Pages permission; no deploy token or branch write access is required.
2. The default *local* build is for `https://smokeythebandit.github.io/kubarr-website/`, with prefixed links and assets. Once the custom domain is attached, do not use that build as the Pages artifact.
3. The repository's Pages custom domain is `kubarr.com`. Keep that binding in GitHub Pages settings; this Actions-based publishing flow does not require a `CNAME` file in the artifact. Check [GitHub's current custom-domain DNS documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) before changing DNS. Allow time for certificate provisioning, then enable **Enforce HTTPS** in Pages settings once available.
4. The workflow sets `SITE_ORIGIN: https://kubarr.com` on the published build so canonical tags, sitemap and all local links/assets use the domain root (`/assets/...`, not `/kubarr-website/assets/...`). Redeploy after changing this workflow. Local preview builds still default to `https://smokeythebandit.github.io/kubarr-website/`; they do not represent the custom-domain artifact.

## Layout

- `src/app.jsx` — shared React layout, page content and interactive controls. `src/client.jsx` hydrates each prerendered page. `src/assets/` retains the CSS, genuine SVG artwork, and synchronous pre-paint theme initializer.
- `scripts/build.mjs` — bundles the React client, prerenders all routes to `dist/`, sets the base path and canonical URLs, and writes a sitemap and robots.txt.
- `scripts/check.mjs` — checks output paths and references in both deployment modes.
- `.github/workflows/pages.yml` — build, check, and least-privilege GitHub Pages deployment.

## Design source

### Apps screenshots

`src/assets/app-management/{catalog,details,operations}.jpg` are dark-mode captures of the live local `kind-kubarr-local` Kubarr `/apps` page at `http://127.0.0.1:18080` on October 10, 2026. The views show the populated catalog with Sonarr selected, the Installed filter with Immich's read-only detail panel, and the Operations tab showing real worker counts and history. The cluster had no available-to-install apps, so its empty Available filter was not used. Counts and health are point-in-time observations. Each image is **1440 × 1214** from a 1440 × 1280 viewport with the same top 66px crop as Observability and Isolation. The homepage links to full-size copies in the shared dialog; the searchable GitHub chart catalog remains on the website's `/apps/` page.

Capture script: `/tmp/opencode/capture-kubarr-app-management.mjs`; sanitization script: `/tmp/opencode/sanitize-kubarr-app-management.py`. A fresh isolated browser context signed in with the private password read inside the process, navigated only through read-only UI, and logged out via the UI. Raw PNGs remain in `/tmp/opencode/`. Raw and final images were visually reviewed: all account bars were cropped, internal service endpoint boxes were covered with opaque rectangles in Catalog/Details, and the worker error detail and visible retried operation IDs were covered in Operations. No app or cluster operations were triggered. Review new captures again before publishing because app state and operation logs change.

### Observability screenshots

`src/assets/observability/{logs,resources,networking}.jpg` are dark-mode Playwright captures of the real Kubarr UI, signed in via the browser to the local `kind-kubarr-local` cluster at `http://127.0.0.1:18080` on October 10, 2026. They show observed data from `/logs`, `/resources`, and `/networking`, **not production data**. Logs was filtered through the UI to Sabnzbd (1,635 queried entries), Resources showed cluster and app metrics with GPU telemetry unavailable, and Networking showed a populated live topology and statistics. Values are point-in-time observations. All three JPEGs are **1440 × 1214**, from the same 1440 × 1280 browser viewport and the same top crop; the homepage links to the full-size copies. The viewport capture shows the top of each page rather than its entire scrollable content.

Before publication the raw PNGs and final JPEGs were visually reviewed for exposed secrets, host addresses, domains, usernames, and session identifiers. The top 66 pixels of **each** image were cropped to remove the signed-in username in the account/navigation bar. Filtering Logs to Sabnzbd excluded a recent authentication event; the visible rows include app setup messages (some mention an API key being configured, but show no key values). No log text was fabricated or replaced. Raw images and temporary capture/sanitization scripts remain outside the website directory. The capture session was logged out using the UI. Recheck every image manually on any new capture; log contents and graph labels can change at any time.

For another *live* capture, only with explicit authorization for the target cluster and its credentials: use a fresh isolated Playwright browser context, navigate to the cluster's login page, fill credentials from a private file read **inside** the capture process (never command-line arguments, logs, or website assets), sign in through the UI, set browser-local `kubarr-theme` to `dark` with a dark color scheme, visit `/logs`, `/resources`, and `/networking` without intercepting API responses, save raw images outside the repository, inspect each image, crop/redact identifying text, then copy only reviewed images to `src/assets/observability/` and log out through the UI. Do not update the server-side theme preference just to take screenshots. The local one-off browser and crop scripts for this retake are `/tmp/opencode/recapture-kubarr-observability.mjs` and `/tmp/opencode/sanitize-kubarr-observability-retake.py`; the password file is private, separate, and is not part of this website.

For **synthetic demonstration captures only**, install dependencies in a separate checkout of `Kubarr/code/frontend` and run from this website directory:

```sh
KUBARR_FRONTEND=/absolute/path/to/Kubarr/code/frontend node scripts/capture-observability-demo.mjs
```

The demo script starts only a loopback Vite frontend with no backend proxy, intercepts every API/auth request in the browser and blocks non-local requests. Its synthetic output goes to `src/assets/observability-demo/`, never the published live image paths; it uses a temporary Vite cache under `node_modules/`. Review new live images before publishing, then run `npm test && npm run build && npm run check`.

### Isolation screenshots

`src/assets/isolation/{containers,storage,vpn}.jpg` are dark-mode Playwright captures of the actual Kubarr UI on the local `kind-kubarr-local` cluster at `http://127.0.0.1:18080` on October 10, 2026. Containers shows the Immich pod details on `/resources` (four running pods, container readiness and restarts); Storage is the populated NFS root browser on `/storage` (10 app/system directories at the root, no personal subfolder opened); VPN is the read-only overview under Settings → VPN, showing an existing WireGuard provider and two app assignments with kill switches on. These are point-in-time UI states, not a demonstration of pod isolation, storage access control, VPN tunnel verification, or Cilium policy enforcement. No dedicated Cilium/NetworkPolicy UI was available; `/networking` shows observed traffic only and is not reused as policy evidence. Each JPEG is **1440 × 1214**, from a 1440 × 1280 browser viewport with the same top 66px crop as the Observability screenshots; the homepage links to the full-size files.

Retake script: `/tmp/opencode/recapture-kubarr-isolation-1214.mjs`; sanitization script: `/tmp/opencode/sanitize-kubarr-isolation-1214.py`. The capture used a fresh isolated Playwright context and browser login with the private password read inside the process; it made only UI reads and logged out through the UI. All raw PNGs remain in `/tmp/opencode/` and were visually inspected alongside all three published JPEGs for usernames, personal paths, addresses/domains and secrets. The full top 66px account bar was cropped from every screenshot, including the Containers dialog over the real Resources page. Four internal pod IP lines were removed with opaque rectangles before JPEG encoding. No VPN credential forms were opened, no credentials or session data were published, and no cluster settings or workloads were changed. For recaptures, inspect each new raw and sanitized image before publishing: directory names and provider labels can change.

The site uses the app's `Kubarr/code/frontend/src/index.css` typography and class-based light/dark convention, with gray/blue Tailwind colors and compact controls from the app UI. The header uses the exact lucide Ship paths from `Kubarr/code/frontend/public/favicon.svg`, matching the app's `Ship` header in `src/App.tsx` (28px, stroke 2, blue-500 in light mode and blue-400 in dark mode). `src/assets/mark.svg` is an exact copy of that app favicon, not `public/kubarr-icon.svg`. The site follows the OS theme by default; the small synchronous head script applies the theme before the stylesheet paints. No theme picker is displayed. No fonts or scripts are fetched externally at runtime.

The headline's `src/assets/kubernetes-icon-color.svg` is the exact [CNCF Kubernetes color icon](https://raw.githubusercontent.com/cncf/artwork/main/projects/kubernetes/icon/color/kubernetes-icon-color.svg). Its upstream SHA-256 is `ff5427cfeeff39e82834ab1b4fe3ed61fc08596225a17eed56adc04f7cc1f712`, verified by `npm run check` to catch incomplete or altered artwork.

For product changes, compare copy and commands to the current [app](https://github.com/smokeythebandit/Kubarr) and [charts](https://github.com/smokeythebandit/kubarr-charts) repositories first; some older app docs still reference a retired umbrella chart.
