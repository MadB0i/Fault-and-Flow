import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import districts from '../src/data/districts.json';
import { INITIAL_ATLAS } from '../src/shared/atlas.js';
import { parseViewLink, createViewLink } from '../src/shared/view-link.js';
import { CATALOGUE_END_YEAR } from '../src/shared/catalogue.js';

describe('shareable atlas views', () => {
  it('restores a sourced district and dated history without carrying unrelated URL data', () => {
    const district = districts.districts.find((d) => d.name === 'Dibrugarh')!;
    const view = {
      ...INITIAL_ATLAS,
      locale: 'as' as const,
      mode: 'fault' as const,
      selectedDistrict: district.id,
      quakeYear: 1950,
    };
    const link = createViewLink('https://example.com/atlas/?sim=256#old', view);
    expect(new URL(link).pathname).toBe('/atlas/');
    expect(link).not.toContain('sim=');
    expect(link).not.toContain('#');
    const restored = parseViewLink(new URL(link).search);
    expect(restored).toMatchObject({
      mode: 'fault',
      locale: 'as',
      selectedDistrict: district.id,
      quakeYear: 1950,
    });
  });
  it('rejects unknown districts, events, invalid years and unknown modes', () => {
    for (const year of [
      'NaN',
      'Infinity',
      '-1',
      String(CATALOGUE_END_YEAR + 1),
      '1900.5',
    ]) {
      const view = parseViewLink(`?mode=bad&lang=bad&district=1&event=bad&year=${year}`);
      expect(view).toMatchObject({
        mode: 'flow',
        locale: 'en',
        selectedDistrict: null,
        selectedQuake: null,
        quakeYear: CATALOGUE_END_YEAR,
      });
    }
    expect(parseViewLink('?water=depth').flowView).toBe('depth');
  });
});

describe('historical catalogue refresh failure', () => {
  it.each([
    '({ok:false,status:503})',
    "({ok:true,text:async()=>JSON.stringify({type:'FeatureCollection',features:[]})})",
    "({ok:true,text:async()=>JSON.stringify({type:'FeatureCollection',features:[{id:'bad',geometry:{coordinates:[95,27,10]},properties:{mag:8,magType:'mw',time:0,url:'https://example.com'}}]})})",
  ])(
    'retains the exact last good catalogue for a failed or invalid response',
    (response) => {
      const before = readFileSync('src/data/earthquakes.json', 'utf8');
      const result = spawnSync(
        process.execPath,
        [
          '--input-type=module',
          '--eval',
          `globalThis.fetch=async()=>${response}; await import('./scripts/refresh-quakes.mjs');`,
        ],
        { encoding: 'utf8', timeout: 15000 },
      );
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('snapshot retained');
      expect(readFileSync('src/data/earthquakes.json', 'utf8')).toBe(before);
    },
  );
});
