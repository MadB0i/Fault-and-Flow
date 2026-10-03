import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AtlasPresentation } from '../shared/atlas.js';
import type { AtlasCopy } from '../shared/i18n/atlas.js';
import catalogue from '../data/earthquakes.json';
import { GEOLOGY_SOURCE } from '../shared/flood-history.js';
import type { TerrainViewController } from './terrain/useTerrainView.js';
import { useUiStore } from './state/useUiStore.js';

const major = catalogue.events.reduce((a, b) => (a.magnitude > b.magnitude ? a : b));
type Props = {
  copy: AtlasCopy;
  view: TerrainViewController;
  atlas: AtlasPresentation;
  setAtlas: Dispatch<SetStateAction<AtlasPresentation>>;
  level: number;
  setLevel: (n: number) => void;
  historyPlaying: boolean;
  setHistoryPlaying: Dispatch<SetStateAction<boolean>>;
  collisionPlaying: boolean;
  setCollisionPlaying: Dispatch<SetStateAction<boolean>>;
  onHistory: () => void;
  onRiver: () => void;
};
export default function AtlasDock({
  copy,
  view,
  atlas,
  setAtlas,
  level,
  setLevel,
  historyPlaying,
  setHistoryPlaying,
  collisionPlaying,
  setCollisionPlaying,
  onHistory,
  onRiver,
}: Props) {
  const strings = useUiStore((s) => s.strings());
  const [inflow, setInflow] = useState(0);
  const ready = view.state.status.phase === 'ready';
  const bbox =
    view.state.status.phase === 'ready' ? view.state.status.sidecar.bbox : null;
  const events = catalogue.events.filter(
    (e) =>
      Number(e.time.slice(0, 4)) <= atlas.quakeYear &&
      (!bbox ||
        (e.longitude >= bbox.west &&
          e.longitude <= bbox.east &&
          e.latitude >= bbox.south &&
          e.latitude <= bbox.north)),
  );
  const selected = events.find((e) => e.id === atlas.selectedQuake);
  const icon = { size: 18, strokeWidth: 1.5, 'aria-hidden': true as const };
  const run = () => {
    if (view.water?.playing) {
      view.setWaterPlaying(false);
      return;
    }
    if (!view.waterOn) {
      view.setWaterLevel(level);
      view.setWaterDischarge(inflow);
      view.setWaterOn(true);
    }
    view.setWaterPlaying(true);
  };
  return (
    <section className="experience-dock" aria-label={copy[atlas.mode]}>
      {atlas.mode === 'flow' && (
        <>
          <div className="dock-description">
            <p className="eyebrow">01 / FLOW</p>
            <h2>{copy.scenario}</h2>
            <p>{copy.scenarioNote}</p>
            <div
              className="water-view-controls"
              role="group"
              aria-label={copy.waterViews}
            >
              {(['surface', 'depth'] as const).map((flowView) => (
                <button
                  type="button"
                  key={flowView}
                  aria-pressed={atlas.flowView === flowView}
                  onClick={() => setAtlas((a) => ({ ...a, flowView }))}
                >
                  {atlas.flowView === flowView && <Check {...icon} />}
                  {flowView === 'surface' ? copy.surfaceView : copy.depthView}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={atlas.sectionOpen}
                onClick={() => setAtlas((a) => ({ ...a, sectionOpen: !a.sectionOpen }))}
              >
                {atlas.sectionOpen && <Check {...icon} />}
                {copy.sectionToggle}
              </button>
            </div>
          </div>
          <div className="scenario-controls">
            <label htmlFor="scenario-depth">
              {copy.level}
              <output>{level.toFixed(1)} m</output>
            </label>
            <input
              id="scenario-depth"
              type="range"
              min="0"
              max="8"
              step="0.5"
              value={level}
              disabled={!ready}
              aria-describedby="scenario-hint"
              onChange={(e) => {
                setLevel(Number(e.target.value));
                view.setWaterLevel(Number(e.target.value));
              }}
            />
            <p className="fine-print" id="scenario-hint">
              {copy.levelHint}
            </p>
            <div className="inline-controls">
              <button
                type="button"
                className="primary-button"
                onClick={run}
                disabled={!ready || view.water?.reason === 'unstable'}
                data-testid="scenario-play"
              >
                {view.water?.playing ? <Pause {...icon} /> : <Play {...icon} />}{' '}
                {view.water?.playing ? copy.pause : copy.run}
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={view.resetWater}
                disabled={!view.waterOn}
                aria-label={copy.reset}
              >
                <RotateCcw {...icon} />
              </button>
              <select
                aria-label={strings.waterSpeedLabel}
                value={view.water?.speed ?? 60}
                onChange={(e) => view.setWaterSpeed(Number(e.target.value))}
                disabled={!view.waterOn}
              >
                <option value="1">1×</option>
                <option value="10">10×</option>
                <option value="60">60×</option>
                <option value="300">300×</option>
              </select>
            </div>
            <details className="scenario-inflow">
              <summary>{copy.inflowSettings}</summary>
              <label htmlFor="scenario-inflow">
                {strings.waterDischargeLabel}
                <output>{inflow.toLocaleString()} m³/s</output>
              </label>
              <input
                id="scenario-inflow"
                type="range"
                min="0"
                max="20000"
                step="250"
                value={inflow}
                disabled={!ready}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setInflow(n);
                  view.setWaterDischarge(n);
                }}
              />
              <p className="fine-print">{strings.waterDischargeHint}</p>
              <p className="fine-print">{copy.headNote}</p>
            </details>
          </div>
          <div className="scenario-results">
            <div>
              <span>{copy.wet}</span>
              <strong data-testid="scenario-wet">
                {view.water?.wetAreaKm2?.toFixed(2) ?? '—'} <small>km²</small>
              </strong>
            </div>
            <div>
              <span>{copy.depth}</span>
              <strong>
                {view.water?.maxDepthM?.toFixed(1) ?? '—'} <small>m</small>
              </strong>
            </div>
            <button className="text-button" type="button" onClick={onHistory}>
              {copy.floodHistory}
              <ArrowUpRight {...icon} />
            </button>
          </div>
          <p className="simulation-message" role="status">
            {view.water?.reason === 'unstable'
              ? copy.unstable
              : view.waterOn && view.water && !view.water.supported
                ? view.water.reason === 'channel-failed'
                  ? strings.waterUnsupportedChannel
                  : strings.waterUnsupportedFloat
                : ''}
          </p>
        </>
      )}
      {atlas.mode === 'fault' && (
        <>
          <div className="dock-description">
            <p className="eyebrow">02 / FAULT</p>
            <h2>{copy.catalogue}</h2>
            <p>{copy.catalogueNote}</p>
          </div>
          <div className="history-controls">
            <label htmlFor="quake-year">
              {copy.year}
              <output>{atlas.quakeYear}</output>
            </label>
            <div className="event-bars" aria-hidden="true">
              {Array.from({ length: 64 }, (_, i) => {
                const year = 1900 + i * 2;
                const count = catalogue.events.filter(
                  (e) =>
                    Number(e.time.slice(0, 4)) >= year &&
                    Number(e.time.slice(0, 4)) < year + 2,
                ).length;
                return (
                  <span
                    key={year}
                    style={{ height: `${Math.min(100, 6 + count * 4)}%` }}
                    className={year <= atlas.quakeYear ? 'is-past' : ''}
                  />
                );
              })}
            </div>
            <input
              id="quake-year"
              type="range"
              min="1900"
              max="2026"
              value={atlas.quakeYear}
              onChange={(e) => {
                setHistoryPlaying(false);
                setAtlas((a) => ({
                  ...a,
                  quakeYear: Number(e.target.value),
                  selectedQuake: null,
                }));
              }}
            />
            <div className="timeline-ends">
              <span>1900</span>
              <span>
                {events.length} {copy.events}
              </span>
              <span>2026</span>
            </div>
            <div className="inline-controls">
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  if (!historyPlaying && atlas.quakeYear >= 2026)
                    setAtlas((a) => ({ ...a, quakeYear: 1900, selectedQuake: null }));
                  setHistoryPlaying((v) => !v);
                }}
              >
                {historyPlaying ? <Pause {...icon} /> : <Play {...icon} />}{' '}
                {historyPlaying ? copy.pauseHistory : copy.playHistory}
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  view.setArea('assam-overview');
                  setAtlas((a) => ({ ...a, quakeYear: 1950, selectedQuake: major.id }));
                  setHistoryPlaying(false);
                }}
              >
                {copy.majorEvent}
              </button>
              <button
                type="button"
                className="text-button"
                disabled={!selected || !ready}
                onClick={() =>
                  setAtlas((a) => ({
                    ...a,
                    motionIllustration: a.motionIllustration + 1,
                  }))
                }
              >
                {copy.illustrateMotion}
              </button>
            </div>
          </div>
          <p className="motion-note">{copy.motionNote}</p>
          <div className="quake-record">
            <label htmlFor="quake-record">{copy.records}</label>
            <select
              id="quake-record"
              value={selected?.id ?? ''}
              onChange={(e) => setAtlas((a) => ({ ...a, selectedQuake: e.target.value }))}
            >
              <option value="">{events.length ? copy.event : copy.noEvents}</option>
              {[...events].reverse().map((e) => (
                <option key={e.id} value={e.id}>
                  {e.time.slice(0, 10)} · M {e.magnitude} {e.magnitudeType}
                </option>
              ))}
            </select>
            {selected && (
              <>
                <strong className="quake-magnitude">
                  M {selected.magnitude} <small>{selected.magnitudeType}</small>
                </strong>
                <p>
                  {selected.time.slice(0, 10)} · {copy.depthKm} {selected.depthKm ?? '—'}{' '}
                  km
                </p>
                <a href={selected.url} target="_blank" rel="noreferrer">
                  {copy.eventSource}
                  <ArrowUpRight {...icon} />
                </a>
              </>
            )}
          </div>
        </>
      )}
      {atlas.mode === 'plates' && (
        <>
          <div className="dock-description">
            <p className="eyebrow">03 / PLATES</p>
            <h2>{copy.collision}</h2>
            <p>{copy.platesNote}</p>
          </div>
          <div className="collision-controls">
            <label htmlFor="collision">
              {copy.collisionProgress}
              <output>{Math.round(atlas.collision * 100)}%</output>
            </label>
            <input
              id="collision"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={atlas.collision}
              onChange={(e) => {
                setCollisionPlaying(false);
                setAtlas((a) => ({ ...a, collision: Number(e.target.value) }));
              }}
            />
            <div className="inline-controls">
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  if (atlas.collision >= 1) setAtlas((a) => ({ ...a, collision: 0 }));
                  setCollisionPlaying((v) => !v);
                }}
              >
                {collisionPlaying ? <Pause {...icon} /> : <Play {...icon} />}
                {collisionPlaying ? copy.pauseCollision : copy.playCollision}
              </button>
              <button type="button" className="text-button" onClick={onRiver}>
                {copy.returnRiver}
                <ArrowDownRight {...icon} />
              </button>
            </div>
          </div>
          <div className="collision-description">
            <p>{copy.collisionText}</p>
            <a href={GEOLOGY_SOURCE} target="_blank" rel="noreferrer">
              {copy.geologySource}
              <ArrowUpRight {...icon} />
            </a>
          </div>
        </>
      )}
    </section>
  );
}
