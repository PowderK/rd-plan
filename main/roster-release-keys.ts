/** Settings-Keys für monatsweise Dienstplan-Freigabe (pro Abteilung). */

export const ROSTER_RELEASED_PREFIX = 'roster_released_';

export function departmentToSlug(department?: string): string {
  const slug = String(department || '1. Abteilung')
    .trim()
    .replace(/\./g, '')
    .replace(/\s+/g, '_')
    .replace(/[^\w-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return slug || '1_Abteilung';
}

export function rosterReleasedSettingKey(year: number, monthIndex: number, department?: string): string {
  return `${ROSTER_RELEASED_PREFIX}${year}_${monthIndex}_${departmentToSlug(department)}`;
}

/** Legacy: roster_released_{year}_{month} ohne Abteilungs-Slug. */
export function isLegacyRosterReleasedKey(key: string): boolean {
  if (!key.startsWith(ROSTER_RELEASED_PREFIX)) return false;
  const rest = key.slice(ROSTER_RELEASED_PREFIX.length);
  const parts = rest.split('_');
  return parts.length === 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1]);
}

export function parseLegacyRosterReleasedKey(key: string): { year: number; monthIndex: number } | null {
  if (!isLegacyRosterReleasedKey(key)) return null;
  const rest = key.slice(ROSTER_RELEASED_PREFIX.length);
  const [yearStr, monthStr] = rest.split('_');
  return { year: Number(yearStr), monthIndex: Number(monthStr) };
}
