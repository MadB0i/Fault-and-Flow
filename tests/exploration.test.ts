import { describe, expect, it } from 'vitest';
import { distanceKm, nearestRecords, pickRecord } from '../src/shared/exploration.js';
import { INITIAL_ATLAS } from '../src/shared/atlas.js';
import { createViewLink, parseViewLink } from '../src/shared/view-link.js';

describe('catalogue exploration', () => {
  it('handles coincident anchors, date-line crossing and antipodes', () => {
    const origin = { longitude: 0, latitude: 0 };
    expect(distanceKm(origin, origin)).toBe(0);
    expect(distanceKm(origin, { longitude: 180, latitude: 0 })).toBeCloseTo(
      Math.PI * 6371,
    );
    expect(
      distanceKm({ longitude: 179.9, latitude: 0 }, { longitude: -179.9, latitude: 0 }),
    ).toBeCloseTo(22.239, 2);
  });
  it('orders original records by anchor distance without modifying source data', () => {
    const records = [
      { id: 'far', longitude: 94, latitude: 27 },
      { id: 'near', longitude: 93, latitude: 26 },
    ];
    expect(
      nearestRecords({ longitude: 93, latitude: 26 }, records, 1)[0]!.record.id,
    ).toBe('near');
    expect(records[0]!.id).toBe('far');
    expect(nearestRecords(records[0]!, records, 0)).toEqual([]);
  });
  it('picks only symbols inside the touch target and chooses the closest', () => {
    const records = [
      { id: 'a', x: 10, y: 10 },
      { id: 'b', x: 30, y: 10 },
    ];
    expect(pickRecord({ x: 25, y: 10 }, records)).toBe('b');
    expect(pickRecord({ x: 60, y: 10 }, records)).toBeNull();
    expect(pickRecord({ x: 0, y: 0 }, [])).toBeNull();
  });
  it('restores and validates magnitude filters in shared views', () => {
    const link = new URL(
      createViewLink('https://example.com', {
        ...INITIAL_ATLAS,
        mode: 'fault',
        minimumMagnitude: 7,
      }),
    );
    expect(parseViewLink(link.search).minimumMagnitude).toBe(7);
    for (const value of ['NaN', '8', '-1', ''])
      expect(parseViewLink(`?magnitude=${value}`).minimumMagnitude).toBe(5);
  });
});
