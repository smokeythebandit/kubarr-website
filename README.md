# Kubarr website

React landing page, feature pages and starter documentation for [Kubarr](https://github.com/smokeythebandit/Kubarr). Node.js 20+ and npm are required. Shared React components render eight static HTML pages at build time, then hydrate the menu and install-command controls in the browser. Each directory has its own `index.html` for direct navigation on GitHub Pages; no client-side router or server rewrites are needed.

## Work locally

```sh
node --version # 20 or newer
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

## Publish on GitHub Pages

1. Push to `main` in [kubarr-website](https://github.com/smokeythebandit/kubarr-website). In repository **Settings → Pages**, select **GitHub Actions** as the build/deployment source. The workflow builds and deploys `dist/` on pushes to `main` and can also be run manually. It needs the repository's Pages permission; no deploy token or branch write access is required.
2. Before the domain is attached, the default build is for `https://smokeythebandit.github.io/kubarr-website/`. Links, assets, and canonical tags use this preview address. Check the deployment at that URL first.
3. When ready for the custom domain, verify ownership of `kubarr.com` in GitHub Pages (under the account/org Pages domain settings) **before changing DNS**; follow GitHub's provided TXT verification instructions and wait for verification. In the website repository's Pages settings, set custom domain to `kubarr.com` only when ready for cutover. Keep the domain setting in GitHub Pages; this Actions-based publishing flow does not require a `CNAME` file in the artifact.
4. At TransIP DNS for `kubarr.com`, remove conflicting apex A/AAAA records only at cutover, then set apex (`@`) A records to GitHub Pages' published addresses: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`. Optionally set `www` CNAME to `smokeythebandit.github.io` (no path). Check [GitHub's current custom-domain DNS documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) before applying records. Avoid wildcard DNS records pointing at Pages. DNS and certificate provisioning may take time; enable **Enforce HTTPS** in Pages settings after the certificate is available.
5. Once GitHub Pages shows the domain active, change the workflow build step to `SITE_ORIGIN: https://kubarr.com`, then redeploy. This switches canonical tags and sitemap URLs to production and changes asset/page links to root-relative paths. Preview builds can still be made locally by omitting `SITE_ORIGIN`. Do not switch the workflow early: the project Pages preview needs its `/kubarr-website/` path.

There are no domain records or custom-domain binding in this repository yet. The production domain is the intended canonical destination; until activation the build correctly identifies the live Pages preview instead.

## Layout

- `src/app.jsx` — shared React layout, page content and interactive controls. `src/client.jsx` hydrates each prerendered page. `src/assets/` retains the CSS, genuine SVG artwork, and synchronous pre-paint theme initializer.
- `scripts/build.mjs` — bundles the React client, prerenders all routes to `dist/`, sets the base path and canonical URLs, and writes a sitemap and robots.txt.
- `scripts/check.mjs` — checks output paths and references in both deployment modes.
- `.github/workflows/pages.yml` — build, check, and least-privilege GitHub Pages deployment.

## Design source

### Observability screenshots

`src/assets/observability/{logs,resources,networking}.jpg` are dark-mode Playwright captures of the real Kubarr UI, signed in via the browser to the local `kind-kubarr-local` cluster at `http://127.0.0.1:18080` on October 9, 2026. They show observed data from `/logs`, `/resources`, and `/networking`, **not production data**. Logs displayed 2,000 entries (the queried view), Resources showed cluster and app metrics with GPU telemetry unavailable, and Networking showed a populated live topology and statistics. Values are point-in-time observations. Each JPEG is 1440px wide; the feature page links to the full-size copy.

Before publication the raw PNGs in `/tmp/opencode/` were visually reviewed for exposed secrets, host addresses, domains, usernames, and session identifiers. The top 66 pixels of **each** image were cropped to remove the signed-in username in the account/navigation bar. Visible log rows include app status/setup messages (some mention an API key being configured, but show no key values). No log text was fabricated or replaced. Raw images and temporary capture/sanitization scripts remain outside the website directory. The capture session was logged out using the UI. Recheck every image manually on any new capture; log contents and graph labels can change at any time.

For another *live* capture, only with explicit authorization for the target cluster and its credentials: use a fresh isolated Playwright browser context, navigate to the cluster's login page, fill credentials from a private file read **inside** the capture process (never command-line arguments, logs, or website assets), sign in through the UI, set browser-local `kubarr-theme` to `dark` with a dark color scheme, visit `/logs`, `/resources`, and `/networking` without intercepting API responses, save raw images outside the repository, inspect each image, crop/redact identifying text, then copy only reviewed images to `src/assets/observability/` and log out through the UI. Do not update the server-side theme preference just to take screenshots. The local one-off browser and crop scripts for this capture are `/tmp/opencode/capture-kubarr-live.mjs` and `/tmp/opencode/sanitize-kubarr-captures.py`; the password file is private, separate, and is not part of this website.

For **synthetic demonstration captures only**, install dependencies in a separate checkout of `Kubarr/code/frontend` and run from this website directory:

```sh
KUBARR_FRONTEND=/absolute/path/to/Kubarr/code/frontend node scripts/capture-observability-demo.mjs
```

The demo script starts only a loopback Vite frontend with no backend proxy, intercepts every API/auth request in the browser and blocks non-local requests. Its synthetic output goes to `src/assets/observability-demo/`, never the published live image paths; it uses a temporary Vite cache under `node_modules/`. Review new live images before publishing, then run `npm test && npm run build && npm run check`.

### Isolation screenshots

`src/assets/isolation/{containers,storage,vpn}.jpg` are dark-mode Playwright captures of the actual Kubarr UI on the local `kind-kubarr-local` cluster at `http://127.0.0.1:18080` on October 9, 2026. Containers is the Immich pod detail dialog on `/resources` (four running pods, container readiness and restarts); Storage is the populated NFS root browser on `/storage`; VPN is the read-only overview under Settings → VPN, showing an existing WireGuard provider and two app assignments with kill switches on. These are point-in-time UI states, not a demonstration of pod isolation, storage access control, VPN tunnel verification, or Cilium policy enforcement. No dedicated Cilium/NetworkPolicy UI was available; `/networking` shows observed traffic only and is not reused as policy evidence.

Capture script: `/tmp/opencode/capture-kubarr-isolation.mjs`; sanitization script: `/tmp/opencode/sanitize-kubarr-isolation.py`. The capture used a fresh isolated Playwright context and browser login with the private password read inside the process; it made only UI reads and logged out through the UI. Raw PNGs remain in `/tmp/opencode/` and were visually inspected alongside the published JPEGs for usernames, personal paths, addresses/domains and secrets. The full top 66px account bar was cropped from Storage and VPN. The Containers image is cropped to its dialog, and four internal pod IP lines are removed with opaque rectangles before JPEG encoding. No VPN credential forms were opened, no credentials or session data were published, and no cluster settings or workloads were changed. For recaptures, inspect each new raw and sanitized image before publishing: directory names and provider labels can change.

The site uses the app's `Kubarr/code/frontend/src/index.css` typography and class-based light/dark convention, with gray/blue Tailwind colors and compact controls from the app UI. The header uses the exact lucide Ship paths from `Kubarr/code/frontend/public/favicon.svg`, matching the app's `Ship` header in `src/App.tsx` (28px, stroke 2, blue-500 in light mode and blue-400 in dark mode). `src/assets/mark.svg` is an exact copy of that app favicon, not `public/kubarr-icon.svg`. The site follows the OS theme by default; the small synchronous head script applies the theme before the stylesheet paints. No theme picker is displayed. No fonts or scripts are fetched externally at runtime.

The headline's `src/assets/kubernetes-icon-color.svg` is the exact [CNCF Kubernetes color icon](https://raw.githubusercontent.com/cncf/artwork/main/projects/kubernetes/icon/color/kubernetes-icon-color.svg). Its upstream SHA-256 is `ff5427cfeeff39e82834ab1b4fe3ed61fc08596225a17eed56adc04f7cc1f712`, verified by `npm run check` to catch incomplete or altered artwork.

For product changes, compare copy and commands to the current [app](https://github.com/smokeythebandit/Kubarr) and [charts](https://github.com/smokeythebandit/kubarr-charts) repositories first; some older app docs still reference a retired umbrella chart.
