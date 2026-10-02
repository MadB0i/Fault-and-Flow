/**
 * Regression test for the fatal-retry bug (AUDIT_REPORT.md A3).
 *
 * When createTerrainView throws (no WebGL2 / no float textures), the hook
 * records a fatal error and keeps viewRef null. Retry must then build the
 * view before loading — previously it cleared the error and called loadArea
 * on nothing, so the retry button could never work.
 *
 * Runs the real hook in jsdom with a mocked engine module: the first
 * construction throws, the second succeeds.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';

import type { TerrainViewController } from '../src/ui/terrain/useTerrainView.js';
import { useTerrainView } from '../src/ui/terrain/useTerrainView.js';

const mockEngine = vi.hoisted(() => ({
  createCalls: 0,
  loadArea: vi.fn((): Promise<void> => Promise.resolve()),
}));

vi.mock('@engine/terrain', () => {
  class FakeTerrainViewError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'TerrainViewError';
      this.code = code;
    }
  }

  function makeView(): Record<string, unknown> {
    const listeners = new Set<(s: unknown) => void>();
    return {
      loadArea: mockEngine.loadArea,
      setVerticalExaggeration: () => undefined,
      setContours: () => undefined,
      probe: () => null,
      getState: () => ({
        status: { phase: 'loading', areaId: 'majuli' },
        verticalExaggeration: 6,
        contours: false,
        contourIntervalM: null,
        probe: null,
      }),
      subscribe: (listener: (s: unknown) => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      resetCamera: () => undefined,
      dispose: () => undefined,
    };
  }

  return {
    MAX_EXAGGERATION: 30,
    MIN_EXAGGERATION: 1,
    TerrainViewError: FakeTerrainViewError,
    areaDefinitionOrFirst: () => ({ defaultVerticalExaggeration: 6 }),
    clampExaggeration: (value: number) => value,
    createTerrainView: () => {
      mockEngine.createCalls += 1;
      if (mockEngine.createCalls === 1) {
        throw new FakeTerrainViewError('webgl2-unavailable', 'no WebGL2 here');
      }
      return makeView();
    },
    isAreaId: () => true,
  };
});

let controls: TerrainViewController | null = null;

function Probe(): null {
  controls = useTerrainView();
  return null;
}

function getControls(): TerrainViewController {
  if (!controls) throw new Error('hook controls were not captured');
  return controls;
}

describe('fatal retry rebuilds the view', () => {
  it('creates the view on retry after a construction failure, then loads', () => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    mockEngine.createCalls = 0;
    mockEngine.loadArea.mockClear();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(createElement(Probe));
    });

    // The mount effect ran with no canvas attached, so nothing built yet.
    expect(mockEngine.createCalls).toBe(0);

    const canvas = document.createElement('canvas');
    act(() => {
      getControls().attachCanvas(canvas);
    });

    // First retry: construction throws, fatal is recorded, no load attempted.
    act(() => {
      getControls().retry();
    });
    expect(mockEngine.createCalls).toBe(1);
    expect(getControls().fatal?.code).toBe('webgl2-unavailable');
    expect(mockEngine.loadArea).not.toHaveBeenCalled();

    // Second retry: the view is built and the area load is attempted.
    act(() => {
      getControls().retry();
    });
    expect(mockEngine.createCalls).toBe(2);
    expect(mockEngine.loadArea).toHaveBeenCalledWith('majuli');
    expect(getControls().fatal).toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
