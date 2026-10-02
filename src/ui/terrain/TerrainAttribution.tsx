/**
 * Attribution and limitations, rendered from the sidecar.
 *
 * The credit string is read out of the JSON the pipeline wrote and never retyped
 * here. That is not tidiness: DATA.md section 10 rule 1 is that paraphrase voids
 * a mandatory attribution, and a hand-copied string in a component is exactly how
 * a licence requirement quietly stops matching its source. If the upstream terms
 * change, this changes with them, because it is the same bytes.
 *
 * The same reasoning applies to the limitations list, which is the product's own
 * honesty mechanism: a DSM with no riverbed bathymetry and roughly 1.5 m of
 * vertical error is not survey output, and the sidecar is where that is recorded.
 */

import type { TerrainSidecar } from '@engine/terrain';
import { useUiStore } from '../state/useUiStore.js';

type Props = {
  sidecar: TerrainSidecar | null;
};

export default function TerrainAttribution({ sidecar }: Props) {
  const strings = useUiStore((s) => s.strings());

  if (!sidecar) return null;

  return (
    <section
      aria-label={strings.attributionLabel}
      className="rounded-[var(--radius)] border-[length:1px] border-[color:var(--hairline)]
                 bg-[color:var(--surface)] p-[var(--space-s)] backdrop-blur-[var(--blur-panel)]"
      data-testid="terrain-attribution"
    >
      <h2
        className="font-data text-[length:var(--step--2)] uppercase tracking-[0.14em]
                   text-[color:var(--text-muted)]"
      >
        {strings.attributionLabel}
      </h2>

      {/*
        The mandatory Article 6(b) credit, verbatim from the sidecar. Small and
        quiet on purpose: DESIGN.md section 10 rule 4 keeps attributions out of
        the scene so they do not compete with the terrain.
      */}
      <p
        className="mt-[var(--space-2xs)] text-[length:var(--step--2)] text-[color:var(--text-muted)]"
        data-testid="attribution-text"
      >
        {sidecar.attribution}
      </p>

      <p className="mt-[var(--space-2xs)] text-[length:var(--step--2)] text-[color:var(--text-muted)]">
        <a
          href={sidecar.licenceUrl}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-[color:var(--hairline)] underline-offset-2
                     hover:decoration-[color:var(--water)]"
        >
          {sidecar.licence}
        </a>
      </p>

      <div className="mt-[var(--space-s)] border-t-[length:1px] border-[color:var(--hairline)] pt-[var(--space-xs)]">
        <h3
          className="font-data text-[length:var(--step--2)] uppercase tracking-[0.14em]
                     text-[color:var(--text-muted)]"
        >
          {strings.attributionLimitationsLabel}
        </h3>
        <ul
          className="mt-[var(--space-2xs)] space-y-[var(--space-2xs)]
                     text-[length:var(--step--2)] text-[color:var(--text-muted)]"
        >
          {sidecar.limitations.map((limitation) => (
            <li key={limitation} className="flex gap-[var(--space-xs)]">
              <span
                aria-hidden="true"
                className="shrink-0 text-[color:var(--seismic-amber)]"
              >
                —
              </span>
              <span>{limitation}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
