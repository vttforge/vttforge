/**
 * The comment mask keeps every offset, so a rule that matches on the masked
 * text still reports the right line.
 */
import { describe, expect, it } from 'vitest';
import { MASK, maskComments } from '../../audit/mask.js';

const maskedAll = (s: string) =>
  maskComments(s, { strings: true }).replace(new RegExp(MASK, 'g'), '#');

const masked = (s: string) => maskComments(s).replace(new RegExp(MASK, 'g'), '#');

describe('maskComments', () => {
  it('blanks line and block comments and keeps the length and the newlines', () => {
    const src = 'a(); // call b()\n/* c()\n d() */ e();\n';
    const out = maskComments(src);
    expect(out).toHaveLength(src.length);
    expect(masked(src)).toBe('a(); ###########\n######\n####### e();\n');
  });

  it('does not start a comment inside a string or a template literal', () => {
    expect(masked('const u = "http://x"; f();')).toBe('const u = "http://x"; f();');
    expect(masked('const t = `a // b`; f();')).toBe('const t = `a // b`; f();');
    expect(masked("const s = 'it\\'s // fine'; f();")).toBe("const s = 'it\\'s // fine'; f();");
  });

  it('does not start a comment inside a regex literal, but still sees a division', () => {
    expect(masked('const r = /https?:\\/\\//g; f();')).toBe('const r = /https?:\\/\\//g; f();');
    expect(masked('const r = /[/]/; f();')).toBe('const r = /[/]/; f();');
    expect(masked('const n = a / b // half\n')).toBe('const n = a / b #######\n');
  });

  it('blanks a JSDoc block with a code fence in it', () => {
    const src = '/**\n * ```js\n * mergeObject(a, b)\n * ```\n */\nexport const x = 1;\n';
    expect(maskComments(src)).not.toContain('mergeObject');
    expect(maskComments(src)).toContain('export const x = 1;');
  });

  it('blanks the inside of strings on request, quotes kept', () => {
    expect(maskedAll('a("Token", \'x\'); // c')).toBe('a("#####", \'#\'); ####');
    expect(maskedAll('const t = `a ${b} c`;')).toBe('const t = `########`;');
  });
});
