import {readWatchAvailability, type WatchAvailability} from './watchAvailability';

export type WatchAccess = 'all' | 'subscription' | 'free' | 'rent_buy';
export type WatchFilters = {providers: string[]; access: WatchAccess};
export type WatchPlatformOption = {id: string; label: string};
export const EMPTY_WATCH_FILTERS: WatchFilters = {providers: [], access: 'all'};
export const WATCH_ACCESS_OPTIONS: {id: WatchAccess; label: string}[] = [
  {id: 'all', label: 'Tüm izleme seçenekleri'},
  {id: 'subscription', label: 'Aboneliğe dahil'},
  {id: 'free', label: 'Ücretsiz / reklamlı'},
  {id: 'rent_buy', label: 'Kirala / satın al'},
];

const platformLabels: Record<string, string> = {
  'Amazon Prime Video': 'Prime Video', 'Disney Plus': 'Disney+',
  'Amazon Video': 'Amazon Video · kirala / satın al',
};
const priority = ['Netflix', 'Amazon Prime Video', 'Disney Plus', 'Exxen', 'HBO Max', 'MUBI', 'TV+', 'TOD TV', 'tabii', 'puhutv'];
export const supportsWatchFilters = (kind: string) => kind === 'series' || kind === 'movie';
export const hasWatchFilters = (filters: WatchFilters) => filters.providers.length > 0 || filters.access !== 'all';
export const watchPlatformLabel = (name: string) => platformLabels[name] || name;

function matchesAccess(types: string[], access: WatchAccess) {
  if (access === 'all') return true;
  const allowed = access === 'subscription' ? ['FLATRATE', 'FLATRATE_AND_BUY'] : access === 'free' ? ['FREE', 'ADS'] : ['RENT', 'BUY', 'FLATRATE_AND_BUY'];
  return types.some(type => allowed.includes(type));
}

/** Platform and access must match the SAME offer; multiple platforms are ORed. */
export function matchesWatchFilters(value: unknown, filters: WatchFilters): boolean {
  if (!hasWatchFilters(filters)) return true;
  const availability = readWatchAvailability(value);
  return Boolean(availability?.providers.some(provider =>
    (!filters.providers.length || filters.providers.includes(provider.name)) && matchesAccess(provider.types, filters.access)
  ));
}

export function watchPlatformOptions(values: (WatchAvailability | null | undefined)[]): WatchPlatformOption[] {
  const names = new Set(values.flatMap(value => readWatchAvailability(value)?.providers.map(provider => provider.name) || []));
  const rank = (name: string) => priority.includes(name) ? priority.indexOf(name) : priority.length;
  return [...names].sort((a, b) => rank(a) - rank(b) || watchPlatformLabel(a).localeCompare(watchPlatformLabel(b), 'tr'))
    .map(name => ({id: name, label: watchPlatformLabel(name)}));
}
