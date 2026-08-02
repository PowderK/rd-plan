/** Settings-Keys für monatsweise Dienstplan-Freigabe (pro Abteilung) – gleiche Logik wie main/roster-release-keys.ts */

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
