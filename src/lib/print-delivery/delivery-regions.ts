import subdivisionNames from './subdivisions.json';

const subdivisions: Record<string, Record<string, string[]>> = subdivisionNames;
const languages = ['en', 'pt', 'es', 'fr', 'de'];

export function subdivisionOptions(country: string, locale: string) {
  const language = languages.indexOf(locale.split('-')[0]);
  // Unicode CLDR 48 subdivision display names (Unicode License v3).
  return Object.entries(subdivisions[country] ?? {})
    .map(([value, names]) => ({ value, label: names[language] ?? names[0] }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}

export function subdivisionLabel(country: string) {
  switch (country) {
    case 'CA':
      return 'provinceTerritory';
    case 'ES':
    case 'IT':
      return 'province';
    case 'AU':
    case 'BR':
    case 'MX':
    case 'US':
      return 'state';
    default:
      return 'region';
  }
}
