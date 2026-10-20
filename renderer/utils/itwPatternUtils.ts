export interface ItwDaySlot {
  fzf: string; // '1' | '2' | '3' | ''
  maschinist: string; // '1' | '2' | '3' | ''
}

export function normalizeDeptCode(dept: string | number | undefined | null): string {
  if (!dept) return '';
  const d = String(dept).trim();
  if (d === '1' || d.startsWith('1')) return '1';
  if (d === '2' || d.startsWith('2')) return '2';
  if (d === '3' || d.startsWith('3')) return '3';
  return '';
}

export function deptCodeToLabel(code: string | number | undefined | null): string {
  const c = normalizeDeptCode(code);
  if (c === '1') return '1. Abteilung';
  if (c === '2') return '2. Abteilung';
  if (c === '3') return '3. Abteilung';
  return '';
}

export function parseItwDay(str: string): ItwDaySlot {
  if (!str) return { fzf: '', maschinist: '' };
  const s = String(str).trim();
  if (s.includes('/') || s.includes(':')) {
    const sep = s.includes('/') ? '/' : ':';
    const [f, m] = s.split(sep).map(x => normalizeDeptCode(x.trim()));
    return { fzf: f || '', maschinist: m || '' };
  }
  // Backward compatibility
  if (s === 'IW') return { fzf: '1', maschinist: '2' };
  if (['1', '2', '3'].includes(s)) return { fzf: s, maschinist: '' };
  return { fzf: '', maschinist: '' };
}

export function formatItwDay(slot: ItwDaySlot): string {
  if (!slot || (!slot.fzf && !slot.maschinist)) return '';
  const f = normalizeDeptCode(slot.fzf);
  const m = normalizeDeptCode(slot.maschinist);
  if (!f && !m) return '';
  return `${f}/${m}`;
}

export function parseItwPatternString(patternStr: string): ItwDaySlot[] {
  const rawParts = String(patternStr || '').split(',').map(s => s.trim());
  return (rawParts.slice(0, 21).concat(Array(21).fill(''))).slice(0, 21).map(x => parseItwDay(x));
}

export function serializeItwDaySlots(slots: ItwDaySlot[]): string {
  const norm = (slots || []).slice(0, 21).concat(Array(21).fill({ fzf: '', maschinist: '' })).slice(0, 21);
  return norm.map(formatItwDay).join(',');
}

export function getDefault3WeekRotation(): ItwDaySlot[] {
  const slots: ItwDaySlot[] = [];
  // Woche 1 (Tage 1-7): FzF = 1. Abt, Ma = 2. Abt
  for (let i = 0; i < 7; i++) slots.push({ fzf: '1', maschinist: '2' });
  // Woche 2 (Tage 8-14): FzF = 2. Abt, Ma = 3. Abt
  for (let i = 0; i < 7; i++) slots.push({ fzf: '2', maschinist: '3' });
  // Woche 3 (Tage 15-21): FzF = 3. Abt, Ma = 1. Abt
  for (let i = 0; i < 7; i++) slots.push({ fzf: '3', maschinist: '1' });
  return slots;
}

export function getDeptBadgeStyle(deptCode: string) {
  const c = normalizeDeptCode(deptCode);
  if (c === '1') {
    return { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' };
  }
  if (c === '2') {
    return { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #93c5fd' };
  }
  if (c === '3') {
    return { background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac' };
  }
  return { background: '#f9fafb', color: '#9ca3af', border: '1px solid #e5e7eb' };
}
