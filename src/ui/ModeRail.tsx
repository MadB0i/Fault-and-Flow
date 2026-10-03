import { Activity, Waves } from 'lucide-react';
import type { Mode } from '../shared/types.js';
import type { AtlasCopy } from '../shared/i18n/atlas.js';
export default function ModeRail({
  mode,
  onMode,
  copy,
}: {
  mode: Mode;
  onMode: (mode: Mode) => void;
  copy: AtlasCopy;
}) {
  const entries = [
    { mode: 'flow', icon: Waves, code: '01' },
    { mode: 'fault', icon: Activity, code: '02' },
  ] as const;
  return (
    <nav className="mode-nav" aria-label={copy.modes} data-testid="mode-rail">
      {entries.map(({ mode: key, icon: Icon, code }) => (
        <button
          key={key}
          type="button"
          onClick={() => onMode(key)}
          aria-pressed={mode === key || (mode === 'plates' && key === 'fault')}
          data-testid={`mode-${key}`}
        >
          <span className="mode-code" aria-hidden="true">
            {code}
          </span>
          <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
          <span>{copy[key]}</span>
        </button>
      ))}
    </nav>
  );
}
