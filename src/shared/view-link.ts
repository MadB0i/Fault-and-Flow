import { INITIAL_ATLAS, type AtlasPresentation } from './atlas.js';
import { CATALOGUE_START_YEAR, CATALOGUE_END_YEAR } from './catalogue.js';
import districts from '../data/districts.json';
import catalogue from '../data/earthquakes.json';

/** Chosen inputs only. Links never replay a computed flood footprint or auto-run. */
export interface SharedScenario {
  area: 'assam-overview' | 'majuli' | 'sadiya-dibrugarh';
  level: number;
  inflow: number;
}
export function parseScenarioLink(search: string): SharedScenario {
  const p = new URLSearchParams(search);
  const view = parseViewLink(search);
  const area = p.get('area');
  const chosen = (key: string, max: number, step: number, fallback: number) => {
    const value = Number(p.get(key));
    return p.has(key) &&
      p.get(key)?.trim() &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= max &&
      Number.isInteger(value / step)
      ? value
      : fallback;
  };
  return {
    area:
      view.mode === 'flow' &&
      !view.selectedDistrict &&
      (area === 'majuli' || area === 'sadiya-dibrugarh')
        ? area
        : 'assam-overview',
    level: chosen('level', 8, 0.5, 2),
    inflow: chosen('inflow', 20000, 250, 0),
  };
}

/** Only validated view choices enter the renderer. A shared link never starts water. */
export function parseViewLink(search: string): AtlasPresentation {
  const p = new URLSearchParams(search);
  const mode = p.get('mode');
  const district = Number(p.get('district'));
  const year = Number(p.get('year'));
  const event = p.get('event');
  const magnitude = Number(p.get('magnitude'));
  return {
    ...INITIAL_ATLAS,
    mode: mode === 'fault' || mode === 'plates' ? mode : 'flow',
    locale: p.get('lang') === 'as' ? 'as' : 'en',
    selectedDistrict: districts.districts.some((d) => d.id === district)
      ? district
      : null,
    quakeYear:
      p.has('year') &&
      Number.isInteger(year) &&
      year >= CATALOGUE_START_YEAR &&
      year <= CATALOGUE_END_YEAR
        ? year
        : CATALOGUE_END_YEAR,
    selectedQuake: catalogue.events.some((e) => e.id === event) ? event : null,
    flowView: p.get('water') === 'depth' ? 'depth' : 'surface',
    minimumMagnitude: magnitude === 6 || magnitude === 7 ? magnitude : 5,
  };
}

export function createViewLink(
  base: string,
  view: AtlasPresentation,
  scenario?: SharedScenario,
): string {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('mode', view.mode);
  url.searchParams.set('lang', view.locale);
  if (view.mode !== 'plates' && view.selectedDistrict !== null)
    url.searchParams.set('district', String(view.selectedDistrict));
  if (view.mode === 'fault') {
    url.searchParams.set('magnitude', String(view.minimumMagnitude));
    url.searchParams.set('year', String(view.quakeYear));
    if (view.selectedQuake) url.searchParams.set('event', view.selectedQuake);
  }
  if (view.mode === 'flow') {
    url.searchParams.set('water', view.flowView);
    if (scenario) {
      url.searchParams.set(
        'area',
        view.selectedDistrict ? 'assam-overview' : scenario.area,
      );
      url.searchParams.set('level', String(scenario.level));
      url.searchParams.set('inflow', String(scenario.inflow));
    }
  }
  return url.href;
}
