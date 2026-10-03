import { useId } from 'react';
import type { AtlasPresentation, RiverSection } from '../shared/atlas.js';
import type { AtlasCopy } from '../shared/i18n/atlas.js';

type Props = {
  copy: AtlasCopy;
  atlas: AtlasPresentation;
  profile: RiverSection | null;
  onPosition: (position: number) => void;
};

/** Only renders the serialisable solver snapshot; never samples Three.js. */
export default function FlowSection({ copy, atlas, profile, onPosition }: Props) {
  const id = useId();
  const samples = profile?.samples ?? [];
  const valid = samples.filter((p) => p.depthM !== null && p.terrainM !== null);
  const deepest = valid.reduce<(typeof valid)[number] | null>(
    (a, b) => (!a || b.depthM! > a.depthM! ? b : a),
    null,
  );
  const depth = deepest?.depthM ?? 0;
  const centreHeight = deepest?.terrainM ?? 0;
  // A labelled vertical window keeps a few metres of water readable in a
  // landscape spanning kilometres. Paths are clipped, never flattened.
  const span = Math.max(16, depth * 3);
  const low = centreHeight - span * 0.3;
  const high = centreHeight + span * 0.7;
  const last = samples.at(-1)?.distanceM ?? 1;
  const x = (d: number) => 20 + (d / Math.max(1, last)) * 344;
  const y = (h: number) => 164 - ((h - low) / (high - low)) * 128;
  const segments: (typeof samples)[number][][] = [];
  for (const sample of samples) {
    if (sample.terrainM === null || sample.depthM === null) {
      segments.push([]);
      continue;
    }
    if (!segments.length) segments.push([]);
    segments.at(-1)!.push(sample);
  }
  const coord = (s: (typeof samples)[number], water: boolean) =>
    `${x(s.distanceM).toFixed(2)},${y(s.terrainM! + (water ? s.depthM! : 0)).toFixed(2)}`;
  return (
    <section
      className="flow-section"
      aria-label={copy.sectionToggle}
      data-testid="river-section"
      tabIndex={0}
    >
      <h2>{copy.sectionTitle}</h2>
      <label htmlFor="section-position">{copy.sectionPosition}</label>
      <input
        id="section-position"
        type="range"
        min="0.05"
        max="0.95"
        step="0.01"
        value={atlas.sectionPosition}
        onChange={(e) => onPosition(Number(e.target.value))}
      />
      {profile && deepest ? (
        <>
          <div className="section-location font-data">
            {profile.longitude.toFixed(3)}° E · {(last / 1000).toFixed(1)} km
          </div>
          <svg
            viewBox="0 0 384 208"
            role="img"
            aria-labelledby={`${id}-title ${id}-description`}
          >
            <title id={`${id}-title`}>{copy.sectionToggle}</title>
            <desc id={`${id}-description`}>
              {copy.sectionNote} {copy.columnDepth} {depth.toFixed(2)} m.
            </desc>
            <defs>
              <linearGradient id={`${id}-water`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" className="water-gradient-top" />
                <stop offset="1" className="water-gradient-bottom" />
              </linearGradient>
              <clipPath id={`${id}-clip`}>
                <rect x="20" y="32" width="344" height="132" />
              </clipPath>
            </defs>
            {[high, (high + low) / 2, low].map((h) => (
              <g key={h}>
                <line x1="20" x2="364" y1={y(h)} y2={y(h)} className="section-grid" />
                <text x="20" y={y(h) - 5} className="section-axis">
                  {h.toFixed(1)} m
                </text>
              </g>
            ))}
            <g clipPath={`url(#${id}-clip)`}>
              {segments
                .filter((s) => s.length > 1)
                .map((s, i) => (
                  <g key={i}>
                    <polygon
                      points={`${x(s[0]!.distanceM)},164 ${s.map((p) => coord(p, false)).join(' ')} ${x(s.at(-1)!.distanceM)},164`}
                      className="section-ground"
                    />
                    <polygon
                      points={`${s.map((p) => coord(p, true)).join(' ')} ${[...s]
                        .reverse()
                        .map((p) => coord(p, false))
                        .join(' ')}`}
                      fill={`url(#${id}-water)`}
                    />
                    <polyline
                      points={s.map((p) => coord(p, false)).join(' ')}
                      className="section-terrain-line"
                    />
                    <polyline
                      points={s.map((p) => coord(p, true)).join(' ')}
                      className="section-water-line"
                    />
                  </g>
                ))}
              <line
                x1={x(deepest.distanceM)}
                x2={x(deepest.distanceM)}
                y1={y(centreHeight)}
                y2={y(centreHeight + depth)}
                className="section-column"
              />
            </g>
            <text x="20" y="188" className="section-axis">
              {copy.sectionNorth}
            </text>
            <text x="364" y="188" textAnchor="end" className="section-axis">
              {copy.sectionSouth}
            </text>
          </svg>
          <dl className="section-values">
            <div>
              <dt>{copy.columnDepth}</dt>
              <dd data-testid="section-depth">{depth.toFixed(2)} m</dd>
            </div>
            <div>
              <dt>{copy.waterLabel}</dt>
              <dd>{(centreHeight + depth).toFixed(2)} m</dd>
            </div>
          </dl>
          <div className="section-key">
            <span>{copy.groundLabel}</span>
            <span>{copy.waterLabel}</span>
          </div>
          <p className="fine-print">{copy.sectionNote}</p>
        </>
      ) : (
        <p className="section-empty" role="status">
          {copy.sectionEmpty}
        </p>
      )}
      <p className="fine-print">{copy.sectionLimits}</p>
    </section>
  );
}
