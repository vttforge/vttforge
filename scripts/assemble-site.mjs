#!/usr/bin/env node
/**
 * Assemble everything vttforge.dev serves into one directory.
 *
 * GitHub Pages publishes a single artifact per repository and allows a single
 * custom domain, so the three things this repo has to serve share one tree
 * rather than one host each:
 *
 *   /                 the landing page      (apps/web)
 *   /docs/            the documentation     (apps/docs, built with base '/docs/')
 *   /design-system/   the styles preview    (packages/styles/preview)
 *
 * The preview is the awkward one. It is authored to sit inside the styles
 * package and reach `../index.css`, which pulls in five siblings through
 * `@import`. Copying it alone gives an unstyled page; copying the graph to
 * where the page expects it would scatter `reset.css`, `components.css` and a
 * `dist/` directory across the site root. So the stylesheet graph is copied
 * beside the page and the one reference is rewritten to match.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(repoRoot, 'site');

/** The domain Pages serves this from. Written as a file, which is what Pages reads. */
const DOMAIN = 'vttforge.dev';

/** Everything `packages/styles/index.css` reaches, relative to the package root. */
const STYLE_GRAPH = [
  'index.css',
  'reset.css',
  'base.css',
  'components.css',
  'styles.layer.css',
  'themes/forge.css',
  'dist/tokens.css',
];

function requireBuilt(path, what) {
  if (!existsSync(path)) {
    console.error(`Missing ${what}: ${path}`);
    console.error('Run `pnpm build` first — this script assembles, it does not build.');
    process.exit(1);
  }
}

const webDist = join(repoRoot, 'apps/web/dist');
const docsDist = join(repoRoot, 'apps/docs/.vitepress/dist');
const stylesRoot = join(repoRoot, 'packages/styles');

requireBuilt(webDist, 'landing page build');
requireBuilt(docsDist, 'docs build');
requireBuilt(join(stylesRoot, 'dist/tokens.css'), 'compiled design tokens');
requireBuilt(join(repoRoot, 'brand/social-card.png'), 'share card');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// Landing page at the root.
cpSync(webDist, out, { recursive: true });

// Docs under /docs/. VitePress already built every internal path with that
// prefix, so this is a plain copy.
cpSync(docsDist, join(out, 'docs'), { recursive: true });

// Styles preview under /design-system/, with its stylesheet graph beside it.
const preview = join(out, 'design-system');
mkdirSync(preview, { recursive: true });
cpSync(join(stylesRoot, 'preview/preview.js'), join(preview, 'preview.js'));
for (const file of STYLE_GRAPH) {
  const from = join(stylesRoot, file);
  if (!existsSync(from)) continue;
  const to = join(preview, file);
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
}

// The one rewrite: the page reaches up a directory for its stylesheet because
// of where it lives in the repo, and here it does not live there.
const previewHtml = readFileSync(join(stylesRoot, 'preview/index.html'), 'utf8').replace(
  '../index.css',
  './index.css',
);
writeFileSync(join(preview, 'index.html'), previewHtml);

// The share card. One copy at the root, from `brand/`, because both the
// landing page and the docs name the same absolute URL in their `og:image`.
// Committing it into two `public/` directories would be the same 100 kB
// twice, drifting apart the first time the card is redrawn.
cpSync(join(repoRoot, 'brand/social-card.png'), join(out, 'social-card.png'));

// Pages serves this from a custom domain; without the file it reverts to
// github.io on every deploy.
writeFileSync(join(out, 'CNAME'), `${DOMAIN}\n`);

// Jekyll would otherwise skip any path starting with an underscore, which is
// where VitePress puts its assets.
writeFileSync(join(out, '.nojekyll'), '');

/**
 * Every page in the assembled tree, as a site-relative URL.
 *
 * Walking the output rather than listing sources is what keeps this honest:
 * the docs alone are 200-odd generated pages, and a hand-kept list would be
 * wrong by the next release.
 */
function pageUrls(dir = out, urls = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === 'assets') continue;
      pageUrls(path, urls);
      continue;
    }
    if (!entry.endsWith('.html')) continue;
    // 404 is served, not indexed. README is a VitePress build artefact.
    if (entry === '404.html' || entry === 'README.html') continue;
    const rel = relative(out, path).split(sep).join('/');
    urls.push(`/${rel.replace(/index\.html$/, '').replace(/\.html$/, '')}`);
  }
  return urls;
}

const urls = pageUrls().sort();

// A sitemap so the crawler does not have to find 200-odd generated reference
// pages by following links from the landing page.
writeFileSync(
  join(out, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>https://${DOMAIN}${u}</loc></url>`)
    .join('\n')}\n</urlset>\n`,
);

// Absent, this file means the same thing as the version below: crawl
// everything. It exists to name the sitemap, which is the part a crawler
// cannot guess.
writeFileSync(
  join(out, 'robots.txt'),
  ['User-agent: *', 'Allow: /', '', `Sitemap: https://${DOMAIN}/sitemap.xml`, ''].join('\n'),
);

// llms.txt is a proposed convention for assistants reading a site directly.
// No search engine consumes it; it costs one file and answers the question
// "what is this project and where is the real documentation".
writeFileSync(
  join(out, 'llms.txt'),
  `# VTTForge

> An SDK and CLI for building Foundry VTT v13+ systems and modules. It holds the
> plumbing every module rewrites by hand: data models, sheet boilerplate,
> migrations, the build. A Foundry version bump then lands in one place instead
> of in every module.

Every package is below 1.0.0, where a minor may break you. See the stability
page before pinning.

## Start here

- [Getting started](https://${DOMAIN}/docs/guide/getting-started): scaffold a system or module and open it in Foundry.
- [The startup lifecycle](https://${DOMAIN}/docs/guide/lifecycle): the four stages Foundry boots through, and what belongs in each.
- [Data models](https://${DOMAIN}/docs/guide/data-models): typed schemas on \`TypeDataModel\`.
- [Sheets](https://${DOMAIN}/docs/guide/sheets): \`ApplicationV2\` sheets with tabs and drag-drop already wired.

## Reference

- [CLI reference](https://${DOMAIN}/docs/guide/cli): every command, and the ten audit rules.
- [Stability policy](https://${DOMAIN}/docs/stability): what each export promises, and what \`@experimental\` means here.
- [Error registry](https://${DOMAIN}/docs/errors/): every \`VTTF-NNNN\` code with its cause and fix.
- [API reference](https://${DOMAIN}/docs/reference/): generated from the source.

## About

- [Transparency](https://${DOMAIN}/docs/transparency): how this is built, and what every change has to pass.
- [Source](https://github.com/vttforge/vttforge): MIT.
`,
);

console.log(`Assembled → ${out}`);
console.log(`  /               landing page`);
console.log(`  /docs/          documentation`);
console.log(`  /design-system/ styles preview`);
