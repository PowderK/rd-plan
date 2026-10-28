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

export interface DeptColorScheme {
  deptCode: string;
  deptLabel: string;
  badgeBg: string;
  badgeColor: string;
  badgeBorder: string;
  slotBg: string;
  slotBorder: string;
  selectBg: string;
  selectColor: string;
  selectBorder: string;
  accent: string;
  dotEmoji: string;
}

export function getDeptColorScheme(deptCode: string | number | undefined | null): DeptColorScheme {
  const c = normalizeDeptCode(deptCode);
  if (c === '1') {
    return {
      deptCode: '1',
      deptLabel: '1. Abteilung',
      badgeBg: '#fee2e2',
      badgeColor: '#b91c1c',
      badgeBorder: '#fca5a5',
      slotBg: '#fef2f2',
      slotBorder: '1px dashed #fca5a5',
      selectBg: '#fef2f2',
      selectColor: '#b91c1c',
      selectBorder: '1.5px dashed #f87171',
      accent: '#ef4444',
      dotEmoji: '🔴'
    };
  }
  if (c === '2') {
    return {
      deptCode: '2',
      deptLabel: '2. Abteilung',
      badgeBg: '#dbeafe',
      badgeColor: '#1d4ed8',
      badgeBorder: '#93c5fd',
      slotBg: '#eff6ff',
      slotBorder: '1px dashed #93c5fd',
      selectBg: '#eff6ff',
      selectColor: '#1d4ed8',
      selectBorder: '1.5px dashed #60a5fa',
      accent: '#2563eb',
      dotEmoji: '🔵'
    };
  }
  if (c === '3') {
    return {
      deptCode: '3',
      deptLabel: '3. Abteilung',
      badgeBg: '#dcfce7',
      badgeColor: '#15803d',
      badgeBorder: '#86efac',
      slotBg: '#f0fdf4',
      slotBorder: '1px dashed #86efac',
      selectBg: '#f0fdf4',
      selectColor: '#15803d',
      selectBorder: '1.5px dashed #4ade80',
      accent: '#16a34a',
      dotEmoji: '🟢'
    };
  }
  return {
    deptCode: '',
    deptLabel: 'Ohne Abt.',
    badgeBg: '#f1f5f9',
    badgeColor: '#475569',
    badgeBorder: '#cbd5e1',
    slotBg: '#f8fafc',
    slotBorder: '1px dashed #cbd5e1',
    selectBg: '#f8fafc',
    selectColor: '#334155',
    selectBorder: '1.5px dashed #94a3b8',
    accent: '#64748b',
    dotEmoji: '⚪'
  };
}

export function getDeptBadgeStyle(deptCode: string) {
  const scheme = getDeptColorScheme(deptCode);
  return { background: scheme.badgeBg, color: scheme.badgeColor, border: `1px solid ${scheme.badgeBorder}` };
}

