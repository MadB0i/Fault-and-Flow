/**
 * DESIGN.md section 2 and src/ui/styles/tokens.css must not drift apart.
 *
 * DESIGN.md claims to be a verbatim copy of the stylesheet: "The single source
 * of truth lives in src/ui/styles/tokens.css. Everything below is copied from
 * there verbatim." That claim is only worth anything while something checks it,
 * because the two files are edited by different people for different reasons
 * and nothing else in the build compares them.
 *
 * The failure this catches is quiet. Change --water in the stylesheet to try
 * something out, and the app changes colour while DESIGN.md section 2 and the
 * contrast tables built from it keep describing the old one. Nothing breaks,
 * no test fails, and the document that people treat as canonical is simply out
 * of date - which for a palette is the same category of problem as a licence
 * quoted from memory.
 *
 * Values are compared case-insensitively, because hex letter-case is a
 * presentation choice and DESIGN.md section 4 quotes tool output that prints
 * uppercase. What must be identical is the value itself.
 *
 * See AGENTS.md section 8 (colours come from tokens only) and section 11.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

const DESIGN_MD = resolve(repoRoot, 'DESIGN.md');
const TOKENS_CSS = resolve(repoRoot, 'src/ui/styles/tokens.css');

/**
 * Tokens that exist in tokens.css on purpose and are deliberately absent from
 * DESIGN.md, with the reason each one is exempt.
 *
 * This is an allowlist, not a loophole. It is asserted in both directions: a
 * token added to tokens.css without a reason here fails the test, and a token
 * listed here that no longer exists in tokens.css also fails, so the list
 * cannot quietly become a place where undocumented tokens go to hide.
 */
const UNDOCUMENTED_TOKENS: Readonly<Record<string, string>> = {
  '--font-assamese-weight':
    'A test sentinel, not a design decision. tokens.css carries it so that ' +
    'tests/fonts.test.ts can detect a new font weight being loaded without ' +
    'the glyph-coverage assertions being told about it. Documenting it as a ' +
    'design token would imply the weight is a deliberate part of the type scale.',
};

/** Remove CSS block comments, including the multi-line ones. */
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Parse `--name: value;` declarations into a name -> value map.
 *
 * Comments are stripped first, because DESIGN.md annotates most of its
 * declarations with a trailing `/* role *\/` that tokens.css does not carry.
 * Internal whitespace is collapsed so a value that Prettier wraps across lines
 * compares equal to one that does not.
 */
function parseTokens(css: string): Map<string, string> {
  const found = new Map<string, string>();
  const body = stripComments(css);

  for (const match of body.matchAll(/--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) {
    const [, rawName, rawValue] = match;
    // Both capture groups are required by the pattern, so this cannot fire in
    // practice; the guard is here because the regex is the thing most likely to
    // be edited later, and a silently skipped declaration would look exactly
    // like a passing sync check.
    if (rawName === undefined || rawValue === undefined) continue;

    const name = `--${rawName}`;
    const value = rawValue.trim().replace(/\s+/g, ' ');
    // A later duplicate would mean the stylesheet redefines a token, which is
    // its own bug; keep the first so the report names the original.
    if (!found.has(name)) found.set(name, value);
  }

  return found;
}

/**
 * The fenced ```css block under DESIGN.md's "## 2. Tokens" heading.
 *
 * Throws rather than asserting: this runs at module scope, where a failing
 * `expect` has no test to attach itself to and surfaces as an opaque import
 * failure rather than as the missing heading it actually is.
 */
function designMdTokenBlock(): string {
  const md = readFileSync(DESIGN_MD, 'utf8');

  const section = /##\s*2\.\s*Tokens/.exec(md);
  if (!section) throw new Error('DESIGN.md has no "## 2. Tokens" heading');

  const block = /```css\r?\n([\s\S]*?)```/.exec(md.slice(section.index));
  if (!block) throw new Error('DESIGN.md section 2 has no ```css block');

  const css = block[1];
  if (css === undefined) throw new Error('the section 2 ```css block captured nothing');

  return css;
}

const cssTokens = parseTokens(readFileSync(TOKENS_CSS, 'utf8'));
const docTokens = parseTokens(designMdTokenBlock());

describe('DESIGN.md section 2 mirrors tokens.css', () => {
  it('parses both files and finds the tokens', () => {
    // Guard against the assertions below passing because a parser matched
    // nothing. A silently empty parse is the failure mode that makes a
    // comparison test worthless.
    expect(cssTokens.size).toBeGreaterThan(30);
    expect(docTokens.size).toBeGreaterThan(30);
    expect(cssTokens.has('--bg')).toBe(true);
    expect(docTokens.has('--bg')).toBe(true);
  });

  it('declares the same token names in both files', () => {
    const cssNames = [...cssTokens.keys()].filter((n) => !(n in UNDOCUMENTED_TOKENS));
    const docNames = [...docTokens.keys()];

    expect(
      [...docNames].sort(),
      'tokens in DESIGN.md section 2 that are not in tokens.css',
    ).toEqual([...cssNames].sort());

    expect(
      [...cssNames].sort(),
      'tokens in tokens.css that are not in DESIGN.md section 2',
    ).toEqual([...docNames].sort());
  });

  it('gives every shared token the same value, case-insensitively', () => {
    const mismatches: string[] = [];

    for (const [name, cssValue] of cssTokens) {
      const docValue = docTokens.get(name);
      if (docValue === undefined) continue; // covered by the name test above

      if (cssValue.toLowerCase() !== docValue.toLowerCase()) {
        mismatches.push(`${name}: tokens.css has ${cssValue}, DESIGN.md has ${docValue}`);
      }
    }

    expect(mismatches, 'token values drifted between tokens.css and DESIGN.md').toEqual(
      [],
    );
  });

  it('has no undocumented tokens hiding in the exemption list', () => {
    // An exemption earns its place only while the token is still in tokens.css
    // and still absent from DESIGN.md. It goes stale in two ways, and both fail
    // here so the allowlist cannot become a dumping ground for undocumented
    // tokens: the token gets documented, or the token disappears entirely.
    const stale = Object.keys(UNDOCUMENTED_TOKENS).filter(
      (name) => docTokens.has(name) || !cssTokens.has(name),
    );

    expect(
      stale,
      'these exemptions are no longer needed: the token is now in DESIGN.md, ' +
        'or is no longer in tokens.css',
    ).toEqual([]);
  });

  it('writes every hex colour in DESIGN.md section 2 in lowercase', () => {
    // The value comparison above is case-insensitive on purpose, so nothing
    // else would notice DESIGN.md drifting back to uppercase hex. Lowercase is
    // the convention tokens.css follows, and this is what keeps the two files
    // comparable by eye as well as by script.
    const block = designMdTokenBlock();
    const uppercase = [...stripComments(block).matchAll(/#[0-9A-Fa-f]{3,8}/g)]
      .map((m) => m[0])
      .filter((hex) => hex !== hex.toLowerCase());

    expect(
      [...new Set(uppercase)],
      'uppercase hex in DESIGN.md section 2; tokens.css is lowercase and DESIGN.md should match',
    ).toEqual([]);
  });

  it('has no raw hex outside the token block in section 2', () => {
    // Section 2's job is to name tokens. A bare hex here would be a colour with
    // no name, which AGENTS.md section 8 forbids in components and which would
    // be invisible drift here.
    const stray = [...docTokens.entries()].filter(
      ([, value]) => !/^#[0-9a-f]{3,8}$/i.test(value) && value.includes('#'),
    );

    expect(
      stray.map(([name, value]) => `${name}: ${value}`),
      'a token value in DESIGN.md section 2 embeds a hex colour directly',
    ).toEqual([]);
  });
});
