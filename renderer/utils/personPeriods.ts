/** Hilfsfunktionen für Qualifikations- und Abteilungszeiträume in Monatslogik. */

export function yearMonthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

export function normalizeDepartmentName(dept?: string): string {
  const d = String(dept || '').trim();
  if (!d || d === 'all') return '1. Abteilung';
  if (/^\d+$/.test(d)) return `${d}. Abteilung`;
  return d;
}

/** Qualifikation gilt im Monat YYYY-MM (Endmonat inklusive). */
export function qualificationAppliesInMonth(
  period: { startYM?: string; endYM?: string | null; active?: boolean | number },
  ym: string
): boolean {
  if (period.active === false || (period.active as any) === 0 || (period.active as any) === '0') return false;
  const start = String(period.startYM || '').trim();
  if (!start) return false;
  const end = period.endYM != null ? String(period.endYM).trim() : '';
  return start <= ym && (!end || end >= ym);
}

/** Abteilungszugehörigkeit im Kalendermonat (Enddatum = letzter aktiver Tag). */
export function departmentAppliesInMonth(
  period: { department?: string; startDate?: string; endDate?: string | null },
  departmentName: string | undefined,
  year: number,
  monthIndex: number
): boolean {
  const targetDept = normalizeDepartmentName(departmentName);
  if (normalizeDepartmentName(period.department) !== targetDept) return false;

  const start = String(period.startDate || '').slice(0, 10);
  if (!start) return false;

  const m = monthIndex + 1;
  const monthStart = `${year}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(year, m, 0).getDate();
  const monthEnd = `${year}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const end = period.endDate ? String(period.endDate).slice(0, 10) : '';

  return start <= monthEnd && (!end || end >= monthStart);
}

export type DepartmentPeriodRow = {
  person_id?: number;
  personId?: number;
  department?: string;
  startDate?: string;
  endDate?: string | null;
};

export function indexDepartmentPeriodsByPerson(
  rows: DepartmentPeriodRow[]
): Record<number, DepartmentPeriodRow[]> {
  const map: Record<number, DepartmentPeriodRow[]> = {};
  for (const row of rows || []) {
    const id = Number(row.person_id ?? row.personId);
    if (!id) continue;
    if (!map[id]) map[id] = [];
    map[id].push(row);
  }
  return map;
}

/** Pro Monat: in Abteilung laut Zeiträumen (ohne Zeiträume: überall true). */
export function buildDepartmentActiveMonthly(
  personId: number,
  year: number,
  periodsByPerson: Record<number, DepartmentPeriodRow[]>,
  departmentName?: string
): boolean[] {
  const periods = periodsByPerson[personId] || [];
  if (periods.length === 0) {
    return Array(12).fill(true);
  }
  return Array.from({ length: 12 }, (_, monthIndex) =>
    periods.some(p => departmentAppliesInMonth(p, departmentName, year, monthIndex))
  );
}

/** Berechnet das Datum des 50. Geburtstags taggenau aus dem Geburtsdatum (YYYY-MM-DD). */
export function getFiftiethBirthday(birthDate?: string | null): Date | null {
  if (!birthDate) return null;
  const parts = String(birthDate).trim().slice(0, 10).split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return new Date(Date.UTC(y + 50, m - 1, d));
}

export function getFiftiethBirthdayISO(birthDate?: string | null): string | null {
  const bday = getFiftiethBirthday(birthDate);
  if (!bday) return null;
  return bday.toISOString().slice(0, 10);
}

export function getFiftiethBirthdayYM(birthDate?: string | null): string | null {
  const iso = getFiftiethBirthdayISO(birthDate);
  if (!iso) return null;
  return iso.slice(0, 7);
}

/** Prüft, ob die Person an einem bestimmten Tag (YYYY-MM-DD) bereits 50 Jahre alt ist. */
export function isTurnedFiftyOnDate(birthDate: string | undefined | null, dateStr: string): boolean {
  const bdayISO = getFiftiethBirthdayISO(birthDate);
  if (!bdayISO) return false;
  return String(dateStr).slice(0, 10) >= bdayISO;
}

/** Prüft, ob der Monat (YYYY-MM) NACH dem Monat des 50. Geburtstags liegt. */
export function isMonthAfterFiftiethBirthday(birthDate: string | undefined | null, ym: string): boolean {
  const bdayYM = getFiftiethBirthdayYM(birthDate);
  if (!bdayYM) return false;
  return ym > bdayYM;
}

/**
 * Prüft, ob der 50. Geburtstag ca. 1 Monat vorher bevorsteht (oder vor kurzem stattgefunden hat,
 * um Planer bei anstehendem oder frischem 50. Geburtstag zu informieren).
 */
export function isApproachingFiftiethBirthday(
  birthDate: string | undefined | null,
  referenceDate: Date = new Date()
): { isApproaching: boolean; birthdayISO: string; birthdayDate: Date; daysRemaining: number } | null {
  const bday = getFiftiethBirthday(birthDate);
  if (!bday) return null;
  const birthdayISO = bday.toISOString().slice(0, 10);

  const refUTC = Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const bdayUTC = bday.getTime();
  const diffMs = bdayUTC - refUTC;
  const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));

  // 1 Monat vorher (bis zu 35 Tage im Voraus, bis zu 90 Tage nach Geburtstag falls unentschieden)
  const isApproaching = daysRemaining <= 35 && daysRemaining >= -90;

  return {
    isApproaching,
    birthdayISO,
    birthdayDate: bday,
    daysRemaining
  };
}

