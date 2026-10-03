import { INITIAL_ATLAS, type AtlasPresentation } from './atlas.js';
import { CATALOGUE_START_YEAR, CATALOGUE_END_YEAR } from './catalogue.js';
import districts from '../data/districts.json';
import catalogue from '../data/earthquakes.json';

/** Only validated view choices enter the renderer. A shared link never starts water. */
export function parseViewLink(search: string): AtlasPresentation {
  const p = new URLSearchParams(search);
  const mode = p.get('mode');
  const district = Number(p.get('district'));
  const year = Number(p.get('year'));
  const event = p.get('event');
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
  };
}

export function createViewLink(base: string, view: AtlasPresentation): string {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('mode', view.mode);
  url.searchParams.set('lang', view.locale);
  if (view.mode !== 'plates' && view.selectedDistrict !== null)
    url.searchParams.set('district', String(view.selectedDistrict));
  if (view.mode === 'fault') {
    url.searchParams.set('year', String(view.quakeYear));
    if (view.selectedQuake) url.searchParams.set('event', view.selectedQuake);
  }
  if (view.mode === 'flow') url.searchParams.set('water', view.flowView);
  return url.href;
}
