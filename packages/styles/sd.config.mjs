/**
 * Style Dictionary 4 config for @vttforge/styles.
 *
 * Reads tokens.json (W3C DTCG format) and emits dist/tokens.css with three
 * selector blocks inside @layer vttforge.tokens:
 *
 *   :root                  — Forge default (dark, warm, ember accent)
 *   [data-theme="light"]   — Forge light overrides (color.light-mode group)
 *   [data-theme="foundry"] — Opt-in mapping to Foundry v13 Theme V2 vars
 *
 * The Foundry block is a static mapping table here (not in tokens.json) so the
 * design source stays clean and the integration layer stays reviewable.
 */

import StyleDictionary from 'style-dictionary';

const FOUNDRY_MAPPINGS = [
  ['--vttf-text', 'var(--color-text-primary, oklch(0.965 0.008 80))'],
  ['--vttf-text-muted', 'var(--color-text-secondary, oklch(0.745 0.012 70))'],
  ['--vttf-bg', 'var(--color-bg-primary, oklch(0.165 0.012 50))'],
  ['--vttf-bg-elevated', 'var(--color-bg-option, oklch(0.205 0.013 50))'],
  ['--vttf-border', 'var(--color-border-light-primary, oklch(0.320 0.014 50))'],
  ['--vttf-font-body', 'var(--font-primary, "Hanken Grotesk", system-ui, sans-serif)'],
  ['--vttf-font-mono', 'var(--font-monospace, "JetBrains Mono", ui-monospace, monospace)'],
];

const EXTRA_TOKENS = [
  [
    '--vttf-glow-ember',
    '0 0 0 1px oklch(0.715 0.170 48 / 0.5), 0 0 24px -4px oklch(0.715 0.170 48 / 0.35)',
  ],
  ['--vttf-focus-ring', '0 0 0 2px oklch(0.715 0.170 48 / 0.45)'],
];

function cssVarName(path) {
  if (path[0] === 'color') return `--vttf-${path.slice(2).join('-')}`;
  if (path[0] === 'type' && path[1] === 'family') return `--vttf-font-${path[2]}`;
  if (path[0] === 'type' && path[1] === 'size') return `--vttf-text-size-${path[2]}`;
  if (path[0] === 'type' && path[1] === 'weight') return `--vttf-text-weight-${path[2]}`;
  if (path[0] === 'motion' && path[1] === 'duration') return `--vttf-duration-${path[2]}`;
  if (path[0] === 'motion' && path[1] === 'ease') return `--vttf-ease-${path[2]}`;
  return `--vttf-${path.join('-')}`;
}

function cssValue(raw, type) {
  if (type === 'fontFamily') {
    return raw.map((f) => (/\s/.test(f) ? `"${f}"` : f)).join(', ');
  }
  if (type === 'cubicBezier') {
    return `cubic-bezier(${raw.join(', ')})`;
  }
  if (type === 'shadow') {
    const layers = Array.isArray(raw) ? raw : [raw];
    return layers
      .map((s) => `${s.offsetX} ${s.offsetY} ${s.blur} ${s.spread} ${s.color}`)
      .join(', ');
  }
  return String(raw);
}

function tokenValue(t) {
  return t.$value ?? t.value;
}

function tokenType(t) {
  return t.$type ?? t.type;
}

StyleDictionary.registerFormat({
  name: 'css/vttforge-tokens',
  format: ({ dictionary }) => {
    const all = dictionary.allTokens;
    const isLight = (t) => t.path[0] === 'color' && t.path[1] === 'light-mode';
    const root = all.filter((t) => !isLight(t));
    const light = all.filter(isLight);

    const out = [];
    out.push('/*!');
    out.push(' * @vttforge/styles — tokens.css');
    out.push(' * Auto-generated from tokens.json. Do not edit by hand.');
    out.push(' *');
    out.push(' * Token strategy:');
    out.push(' *   :root                  — Forge default (dark, warm, ember accent)');
    out.push(' *   [data-theme="light"]   — Forge light overrides');
    out.push(' *   [data-theme="foundry"] — Opt-in mapping to Foundry v13 Theme V2');
    out.push(' */');
    out.push('');
    out.push('@layer vttforge.tokens {');

    out.push('  :root {');
    for (const t of root) {
      out.push(`    ${cssVarName(t.path)}: ${cssValue(tokenValue(t), tokenType(t))};`);
    }
    for (const [name, val] of EXTRA_TOKENS) {
      out.push(`    ${name}: ${val};`);
    }
    out.push('  }');
    out.push('');

    out.push('  [data-theme="light"] {');
    for (const t of light) {
      out.push(`    ${cssVarName(t.path)}: ${cssValue(tokenValue(t), tokenType(t))};`);
    }
    out.push('  }');
    out.push('');

    out.push('  [data-theme="foundry"] {');
    for (const [name, val] of FOUNDRY_MAPPINGS) {
      out.push(`    ${name}: ${val};`);
    }
    out.push('  }');

    out.push('}');
    out.push('');
    return out.join('\n');
  },
});

export default {
  source: ['tokens.json'],
  log: {
    warnings: 'disabled',
  },
  platforms: {
    css: {
      buildPath: 'dist/',
      files: [{ destination: 'tokens.css', format: 'css/vttforge-tokens' }],
    },
  },
};
