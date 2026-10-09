# Kubarr website

Static landing page and starter documentation for [Kubarr](https://github.com/smokeythebandit/Kubarr). No npm dependencies or framework; Node.js 20+ builds and checks the site.

## Work locally

```sh
node --version # 20 or newer
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

Open `http://localhost:8000/` for that build. The build writes only to `dist/`. `npm run check` validates the generated pages, canonical URLs, local links/assets, and both preview and production builds (in temporary directories). No lockfile is needed because there are no external dependencies.

## Publish on GitHub Pages

1. Push to `main` in [kubarr-website](https://github.com/smokeythebandit/kubarr-website). In repository **Settings → Pages**, select **GitHub Actions** as the build/deployment source. The workflow builds and deploys `dist/` on pushes to `main` and can also be run manually. It needs the repository's Pages permission; no deploy token or branch write access is required.
2. Before the domain is attached, the default build is for `https://smokeythebandit.github.io/kubarr-website/`. Links, assets, and canonical tags use this preview address. Check the deployment at that URL first.
3. When ready for the custom domain, verify ownership of `kubarr.com` in GitHub Pages (under the account/org Pages domain settings) **before changing DNS**; follow GitHub's provided TXT verification instructions and wait for verification. In the website repository's Pages settings, set custom domain to `kubarr.com` only when ready for cutover. Keep the domain setting in GitHub Pages; this Actions-based publishing flow does not require a `CNAME` file in the artifact.
4. At TransIP DNS for `kubarr.com`, remove conflicting apex A/AAAA records only at cutover, then set apex (`@`) A records to GitHub Pages' published addresses: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`. Optionally set `www` CNAME to `smokeythebandit.github.io` (no path). Check [GitHub's current custom-domain DNS documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) before applying records. Avoid wildcard DNS records pointing at Pages. DNS and certificate provisioning may take time; enable **Enforce HTTPS** in Pages settings after the certificate is available.
5. Once GitHub Pages shows the domain active, change the workflow build step to `SITE_ORIGIN: https://kubarr.com`, then redeploy. This switches canonical tags and sitemap URLs to production and changes asset/page links to root-relative paths. Preview builds can still be made locally by omitting `SITE_ORIGIN`. Do not switch the workflow early: the project Pages preview needs its `/kubarr-website/` path.

There are no domain records or custom-domain binding in this repository yet. The production domain is the intended canonical destination; until activation the build correctly identifies the live Pages preview instead.

## Layout

- `src/` — handwritten HTML, CSS, JS and SVG artwork; pages live at `/` and `/docs/`.
- `scripts/build.mjs` — copies source to `dist/`, sets the base path and canonical URLs, writes a sitemap and robots.txt.
- `scripts/check.mjs` — checks output paths and references in both deployment modes.
- `.github/workflows/pages.yml` — build, check, and least-privilege GitHub Pages deployment.

For product changes, compare copy and commands to the current [app](https://github.com/smokeythebandit/Kubarr) and [charts](https://github.com/smokeythebandit/kubarr-charts) repositories first; some older app docs still reference a retired umbrella chart.
