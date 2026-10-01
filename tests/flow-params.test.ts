/**
 * Guards on the FLOW input contract.
 *
 * `FlowParams.dischargeM3s` was renamed to `scenarioInflowM3s` because the old
 * name implied an instrument reading. This project holds no observed discharge
 * data, so a field named `dischargeM3s` is a claim the type system cannot catch
 * and a reader would reasonably believe. See docs/DECISIONS.md sections 3 and 7.
 *
 * These assertions are deliberately about the *source text*, not just the type.
 * The compiler already guarantees the field exists; what it cannot guarantee is
 * that nobody reintroduces the misleading name.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { DEFAULT_FLOW_PARAMS } from '@shared/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const typesSource = readFileSync(
  resolve(here, '../src/shared/types.ts'),
  'utf8',
);

/**
 * The doc comment immediately preceding `field`, or '' if there is none.
 *
 * Done with index arithmetic rather than a regex: a greedy pattern silently
 * swallows the code between a comment and the field it documents, which is
 * exactly the failure these assertions exist to catch.
 */
function docCommentFor(field: string): string {
  const at = typesSource.indexOf(field);
  if (at === -1) return '';

  const open = typesSource.lastIndexOf('/**', at);
  if (open === -1) return '';

  const close = typesSource.indexOf('*/', open);
  // Anything between the comment and the field means this is not its comment.
  if (close === -1 || close > at) return '';

  return typesSource.slice(open + 3, close);
}

/** The body of a named interface declaration. */
function interfaceBody(name: string): string {
  const start = typesSource.indexOf(`export interface ${name} {`);
  if (start === -1) return '';

  const end = typesSource.indexOf('\n}', start);
  return end === -1 ? '' : typesSource.slice(start, end + 2);
}

/**
 * Strip block and line comments, leaving only code.
 *
 * Needed because the FlowParams doc comment deliberately mentions the old name
 * in order to explain the rename. Searching raw text would then flag the very
 * explanation that makes the rename safe.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('FLOW input contract', () => {
  it('names the FLOW input as a user-chosen scenario', () => {
    expect(DEFAULT_FLOW_PARAMS.scenarioInflowM3s).toBeTypeOf('number');
    expect(DEFAULT_FLOW_PARAMS.scenarioInflowM3s).toBeGreaterThan(0);
  });

  it('documents scenarioInflowM3s as NOT an observed discharge', () => {
    const comment = docCommentFor('scenarioInflowM3s: number;');

    expect(comment, 'scenarioInflowM3s has no doc comment').not.toBe('');
    expect(comment).toMatch(/NOT an observed discharge/i);
    expect(comment).toMatch(/DECISIONS\.md/);
  });

  it('FlowParams does not reintroduce the bare name dischargeM3s', () => {
    // The only legitimate remaining use of that exact identifier is
    // TerrainSample.dischargeM3s, which is a scenario-derived *flux* at a
    // location rather than an inflow control, and is documented as such.
    // Comments are stripped first, because the doc comment names the old
    // identifier precisely to explain the rename.
    const code = stripComments(interfaceBody('FlowParams'));

    expect(code).not.toBe('');
    expect(code).not.toMatch(/dischargeM3s/);
    expect(code).toContain('scenarioInflowM3s');
  });

  it('the default inflow is documented as arbitrary, not gauged', () => {
    const comment = docCommentFor('DEFAULT_FLOW_PARAMS: FlowParams = {');

    expect(comment, 'DEFAULT_FLOW_PARAMS has no doc comment').not.toBe('');
    expect(comment).toMatch(/not tuned to match any real gauged event/i);
  });

  it('TerrainSample flux is documented as scenario-derived, never measured', () => {
    const comment = docCommentFor('dischargeM3s: number | null;');

    expect(comment, 'TerrainSample.dischargeM3s has no doc comment').not.toBe('');
    expect(comment).toMatch(/scenario-derived/i);
    // Checked in two parts: the phrase is split across a line break and the
    // comment's own `*` continuation prefix, so one pattern cannot span it.
    expect(comment).toMatch(/never be/i);
    expect(comment).toMatch(/kind: 'measured'/);
  });
});
