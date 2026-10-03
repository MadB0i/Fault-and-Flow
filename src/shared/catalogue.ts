import catalogue from '../data/earthquakes.json';

export const CATALOGUE_START_YEAR = Number(catalogue.start.slice(0, 4));
export const CATALOGUE_END_YEAR = Number(catalogue.cutoff.slice(0, 4));
export const CATALOGUE_CUTOFF = catalogue.cutoff;
export const CATALOGUE_RETRIEVED = catalogue.retrieved;
