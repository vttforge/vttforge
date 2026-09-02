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
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

console.log(`Assembled → ${out}`);
console.log(`  /               landing page`);
console.log(`  /docs/          documentation`);
console.log(`  /design-system/ styles preview`);
