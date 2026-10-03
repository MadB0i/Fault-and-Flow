import { useUiStore } from '../state/useUiStore.js';
import type { TerrainViewController } from './useTerrainView.js';
import type { AtlasCopy } from '../../shared/i18n/atlas.js';
export default function TerrainScene({
  view,
  copy,
}: {
  view: TerrainViewController;
  copy: AtlasCopy;
}) {
  const strings = useUiStore((s) => s.strings());
  const navigation = useUiStore((s) => s.atlas.navigation);
  const phase = view.state.status.phase;
  const loading = !view.fatal && (phase === 'idle' || phase === 'loading');
  const error = phase === 'error' || view.fatal !== null;
  return (
    <>
      <canvas
        ref={view.attachCanvas}
        tabIndex={0}
        role="img"
        aria-label={strings.terrainCanvasLabel}
        aria-describedby="map-keyboard-help"
        className="atlas-canvas"
        data-testid="terrain-canvas"
        data-navigation={navigation}
      />
      <span className="sr-only" id="map-keyboard-help">
        {strings.terrainCanvasHint}
      </span>
      <div className="scene-status" role="status" aria-live="polite">
        {loading && <p data-testid="terrain-loading">{copy.loading}</p>}
      </div>
      {error && (
        <div className="scene-error" role="alert" data-testid="terrain-error">
          <p>
            {view.fatal?.code === 'webgl2-unavailable'
              ? strings.terrainErrorWebgl
              : strings.terrainErrorLoad}
          </p>
          <button type="button" onClick={view.retry} data-testid="terrain-retry">
            {strings.terrainRetry}
          </button>
        </div>
      )}
    </>
  );
}
