/**
 * The architecture invariant, asserted rather than trusted.
 *
 * AGENTS.md section 3: the engine is framework-agnostic and runnable headless,
 * and eslint.config.js enforces the import rule at lint time. This test exists
 * because a lint rule can be disabled, deleted, or scoped wrongly by a future
 * edit, and the failure it protects against - an engine that can no longer run
 * in a bare Node process - is invisible until someone tries to unit test it.
 *
 * It also checks the corollary that is easy to break by accident: the shared
 * contract must stay free of Three.js as well as React.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Import specifiers, from both `import ... from '...'` and `import('...')`.
 * Comments are stripped first so the word "react" in a doc comment explaining
 * the rule does not trip the check that enforces it.
 */
function importsOf(source: string): string[] {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const specifiers: string[] = [];
  const fromRe = /(?:^|\n)\s*import[\s\S]*?from\s+['"]([^'"]+)['"]/g;
  const bareRe = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;
  const dynamicRe = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const re of [fromRe, bareRe, dynamicRe]) {
    for (const m of withoutComments.matchAll(re)) {
      if (m[1]) specifiers.push(m[1]);
    }
  }
  return specifiers;
}

describe('src/engine stays framework-free', () => {
  const files = sourceFiles(join(root, 'src/engine'));

  it('has files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('imports no React anywhere', () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const specifier of importsOf(readFileSync(file, 'utf8'))) {
        if (
          specifier === 'react' ||
          specifier.startsWith('react/') ||
          specifier.startsWith('react-dom')
        ) {
          offenders.push(`${file.replace(root, '.')} imports ${specifier}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('does not reach back into src/ui', () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const specifier of importsOf(readFileSync(file, 'utf8'))) {
        if (
          specifier.startsWith('@ui') ||
          /(^|\/)ui\//.test(specifier) ||
          specifier.startsWith('../ui')
        ) {
          offenders.push(`${file.replace(root, '.')} imports ${specifier}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('does not reach into the UI stylesheet either', () => {
    // tokens.css is the UI's business. The engine takes its colours through
    // options.palette precisely so that it never has to know they are CSS.
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      if (/\.css['"]/.test(source)) {
        offenders.push(file.replace(root, '.'));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('carries no hard-coded colour, only palette keys', () => {
    // AGENTS.md section 8: colours come from tokens. A hex literal in the
    // engine is a colour that bypasses DESIGN.md entirely, and one that will
    // not follow the palette when the palette changes.
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const withoutComments = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      for (const m of withoutComments.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
        offenders.push(`${file.replace(root, '.')} contains ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('src/shared stays free of both React and Three.js', () => {
  const files = sourceFiles(join(root, 'src/shared'));

  it('imports neither', () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const specifier of importsOf(readFileSync(file, 'utf8'))) {
        if (
          specifier === 'three' ||
          specifier.startsWith('three/') ||
          specifier === 'react' ||
          specifier.startsWith('react')
        ) {
          offenders.push(`${file.replace(root, '.')} imports ${specifier}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
