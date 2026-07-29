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
