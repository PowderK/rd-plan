
export function computeDeptShiftsPerMonth(year: number, department: number, seqs: { startDate: string; pattern: string[] }[]) {
    const counts: number[] = Array(12).fill(0);
    for (let m = 0; m < 12; m++) {
        const daysInMonth = new Date(year, m + 1, 0).getDate();
        let cnt = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(Date.UTC(year, m, d));
            const iso = dateObj.toISOString().slice(0, 10);

            // Find active pattern
            const sortedSeqs = [...(seqs || [])].sort((a, b) => a.startDate.localeCompare(b.startDate));
            let active = sortedSeqs[0];
            for (const s of sortedSeqs) {
                if (s.startDate <= iso) active = s;
                else break;
            }

            const start = new Date((active?.startDate || '1970-01-01') + 'T00:00:00Z');
            const cur = new Date(iso + 'T00:00:00Z');
            const diffDays = Math.floor((cur.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            const pat = active?.pattern || [];
            const depDay = pat.length ? pat[((diffDays % 21) + 21) % 21] : '';

            if (depDay && String(department) === depDay) cnt++;
        }
        counts[m] = cnt;
    }
    return counts;
}

export function computeItwShiftsPerMonth(roster: any[], auswertungByType: Record<string, string>, personnel?: { id: number }[]) {
    const sums = Array(12).fill(0);
    const activeIds = personnel ? new Set(personnel.map(p => p.id)) : null;

    for (const row of (roster || [])) {
        try {
            // Filter: Only 'person' type (no doctors, no azubis)
            if (String(row.personType) !== 'person') continue;

            // Filter: Only active personnel if list provided
            const pid = Number(row.personId);
            if (activeIds && !activeIds.has(pid)) continue;

            const iso = String(row.date);
            if (!iso) continue;
            const m = new Date(iso + 'T00:00:00Z').getUTCMonth();
            const t = String(row.type || '');
            const code = String(row.value || '').trim();
            if (t.startsWith('itw_') || (code && auswertungByType[code] === 'itw')) {
                sums[m] += 1;
            }
        } catch { }
    }
    return sums;
}

export function computePositionsPerMonth(
    deptShifts: number[],
    itwShifts: number[],
    vehicles: { rtw: { id: number }[]; nef: { id: number; occupancyMode?: '24h' | 'tag' }[] },
    acts: { rtwActs: Record<number, boolean[]>; nefActs: Record<number, boolean[]> }
) {
    const positions: number[] = Array(12).fill(0);
    for (let m = 0; m < 12; m++) {
        const rtwCount = (vehicles.rtw || []).filter(v => (acts.rtwActs[v.id] ?? Array(12).fill(true))[m] !== false).length;

        // Calculate NEF shifts based on occupancy mode
        let nefShifts = 0;
        (vehicles.nef || []).forEach(v => {
            if ((acts.nefActs[v.id] ?? Array(12).fill(true))[m] !== false) {
                nefShifts += (v.occupancyMode === 'tag' ? 1 : 2);
            }
        });

        const base = deptShifts[m] * (rtwCount * 4 + nefShifts);
        positions[m] = base + (itwShifts[m] || 0);
    }
    return positions;
}

export function computeAzubiMaschinistShifts(roster: any[], azubis: { id: number }[]) {
    const countsByMonth = Array(12).fill(0);
    const reMasch = /^rtw\d+_(tag|nacht)_2$/;
    for (const row of (roster || [])) {
        try {
            if (String(row.personType) !== 'azubi') continue;
            const t = String(row.type || '');
            if (!reMasch.test(t)) continue;
            const iso = String(row.date);
            const m = new Date(iso + 'T00:00:00Z').getUTCMonth();
            countsByMonth[m] += 1;
        } catch { }
    }
    return countsByMonth;
}

export function computeUe50Shifts(roster: any[], ue50Ids: Set<number>, nefVehicles?: { id: number; occupancyMode?: '24h' | 'tag' }[]) {
    const sums = Array(12).fill(0);
    const reSlot = /^(rtw\d+_(tag|nacht)_[12]|nef(\d+)?_(arzt|assist|azubi)|itw_row_[123])$/;

    const getNefMode = (idStr?: string) => {
        if (!idStr) {
            if (nefVehicles && nefVehicles.length > 0) return nefVehicles[0].occupancyMode || '24h';
            return '24h';
        }
        const vid = Number(idStr);
        const v = nefVehicles?.find(n => n.id === vid);
        return v?.occupancyMode || '24h';
    };

    for (const row of (roster || [])) {
        try {
            if (String(row.personType) !== 'person') continue;
            const pid = Number(row.personId);
            if (!ue50Ids.has(pid)) continue;
            const t = String(row.type || '');
            if (!reSlot.test(t)) continue;
            const iso = String(row.date);
            const m = new Date(iso + 'T00:00:00Z').getUTCMonth();

            // NEF Assistenz zählt doppelt bei 24h-Besetzung
            const nefMatch = t.match(/^nef(\d+)?_assist$/);
            if (nefMatch) {
                const mode = getNefMode(nefMatch[1]);
                if (mode === 'tag') sums[m] += 1;
                else sums[m] += 2; // 24h
            } else {
                sums[m] += 1;
            }
        } catch { }
    }
    return sums;
}

export function computeWeightedPresence(
    year: number,
    roster: any[],
    personnel: { id: number; fahrzeugfuehrerHLFB?: boolean | number }[],
    ue50Ids: Set<number>,
    auswertungByType: Record<string, string>,
    hlfbPeriodsByPerson?: Record<number, Array<{ startYM: string; endYM?: string }>>
) {
    const countsByPerson: Record<number, number[]> = {};
    const ensure = (pid: number) => (countsByPerson[pid] ||= Array(12).fill(0));

    for (const row of (roster || [])) {
        try {
            if (String(row.personType) !== 'person') continue;
            const pid = Number(row.personId);
            if (ue50Ids.has(pid)) continue; // Ü50 ausschließen
            const code = String(row.value || '').trim();
            if (!code) continue;
            if ((auswertungByType[code] || 'off') === 'off') continue;
            const iso = String(row.date);
            const month = new Date(iso + 'T00:00:00Z').getUTCMonth();
            ensure(pid)[month] += 1;
        } catch { }
    }

    return (personnel || []).map(p => {
        const rawCounts = countsByPerson[p.id] || Array(12).fill(0);

        // Determine HLF-B status per month
        const hlfbStatus = Array(12).fill(false);

        // 1. Check periods if available
        const periods = hlfbPeriodsByPerson?.[p.id];
        if (periods && periods.length > 0) {
            for (let m = 0; m < 12; m++) {
                const ym = `${year}-${String(m + 1).padStart(2, '0')}`;
                hlfbStatus[m] = periods.some(per => per.startYM <= ym && (!per.endYM || per.endYM >= ym));
            }
        } else {
            // 2. Fallback to static flag
            if (p.fahrzeugfuehrerHLFB) {
                hlfbStatus.fill(true);
            }
        }

        const weightedCounts = rawCounts.map((v, i) => hlfbStatus[i] ? Math.round(v * 0.75) : v);
        return { id: p.id, counts: weightedCounts };
    });
}


export interface ShiftTransfer {
    id: number;
    from_person_id: number;
    to_person_id: number;
    shift_count: number;
    position_type: string;
    month: string; // YYYY-MM
    reason?: string;
}


export function calculateTargets(
    year: number,
    roster: any[], // Flattened roster array or similar structure? ValuesPage uses flattened. MonthTabs uses nested. We need to standardize.
    personnel: { id: number; fahrzeugfuehrerHLFB?: boolean | number }[],
    azubis: { id: number }[],
    ue50Ids: Set<number>,
    auswertungByType: Record<string, string>,
    vehicles: { rtw: { id: number }[]; nef: { id: number; occupancyMode?: '24h' | 'tag' }[] },
    activations: { rtwActs: Record<number, boolean[]>; nefActs: Record<number, boolean[]> },
    department: number,
    deptPatternSeqs: { startDate: string; pattern: string[] }[],
    hlfbPeriodsByPerson?: Record<number, Array<{ startYM: string; endYM?: string }>>,
    shiftTransfers: ShiftTransfer[] = [] // Optional for backward compatibility
) {
    // 1. Dept Shifts
    const deptShifts = computeDeptShiftsPerMonth(year, department, deptPatternSeqs);

    // 2. ITW Shifts
    const itwShifts = computeItwShiftsPerMonth(roster, auswertungByType, personnel);

    // 3. Positions Total
    const positions = computePositionsPerMonth(deptShifts, itwShifts, vehicles, activations);

    // 4. Deductions (Azubi Maschinist + Ü50)
    const azubiShifts = computeAzubiMaschinistShifts(roster, azubis);
    const ue50Shifts = computeUe50Shifts(roster, ue50Ids, vehicles.nef);

    const positionsAdj = positions.map((p, i) => Math.max(0, p - azubiShifts[i] - ue50Shifts[i]));

    // 5. Weighted Presence
    const presence = computeWeightedPresence(year, roster, personnel, ue50Ids, auswertungByType, hlfbPeriodsByPerson);

    // 6. Hamilton Allocation
    const targetsById: Record<number, number[]> = {};
    personnel.forEach(p => targetsById[p.id] = Array(12).fill(0));

    // Gruppierung der Übernahmen pro Monat für Hamilton-Integration
    const transfersByMonth: Record<number, ShiftTransfer[]> = {};
    for (const t of shiftTransfers) {
        if (!t.to_person_id || !t.month) continue;
        const [tYear, tMonth] = t.month.split('-').map(Number);
        if (tYear !== year) continue;
        const mIdx = tMonth - 1;
        if (mIdx < 0 || mIdx > 11) continue;
        (transfersByMonth[mIdx] ||= []).push(t);
    }

    for (let m = 0; m < 12; m++) {
        const required = positionsAdj[m];
        if (required <= 0) continue;

        const weights = presence.map(p => ({ id: p.id, w: p.counts[m] }));
        const active = weights.filter(x => x.w > 0);
        const totalW = active.reduce((a, b) => a + b.w, 0);

        if (totalW <= 0) continue;

        // Basis-Berechnung der exakten Anteile
        const parts: Record<number, number> = {};
        for (const a of active) {
            parts[a.id] = (required * a.w) / totalW;
        }

        // Integration von Schichtübernahmen auf Exakt-Ebene
        const monthTransfers = transfersByMonth[m];
        if (monthTransfers && monthTransfers.length > 0) {
            let totalTransferred = 0;
            const excludedIds = new Set<number>();

            for (const t of monthTransfers) {
                totalTransferred += t.shift_count;
                if (t.from_person_id) excludedIds.add(t.from_person_id);
                excludedIds.add(t.to_person_id);

                // Empfänger erhält die Schichten direkt
                parts[t.to_person_id] = (parts[t.to_person_id] || 0) + t.shift_count;
            }

            // Pool für die Reduzierung (alle Aktiven außer Geber und Empfänger)
            const pool = active.filter(a => !excludedIds.has(a.id));
            const poolWeight = pool.reduce((sum, a) => sum + a.w, 0);

            if (poolWeight > 0 && totalTransferred > 0) {
                for (const p of pool) {
                    const reduction = (totalTransferred * p.w) / poolWeight;
                    parts[p.id] = Math.max(0, (parts[p.id] || 0) - reduction);
                }
            }
        }

        // Hamilton-Rundung auf Basis der (ggf. durch Übernahmen modifizierten) exakten Anteile
        const targetIds = Object.keys(parts).map(Number);
        const floors = targetIds.map(pid => {
            const exact = parts[pid];
            return {
                id: pid,
                v: Math.floor(exact),
                frac: exact - Math.floor(exact)
            };
        });

        let assigned = floors.reduce((s, f) => s + f.v, 0);
        let rest = required - assigned;

        // Falls die Summe durch Rundung nicht stimmt, Reste verteilen
        floors.sort((a, b) => b.frac - a.frac);
        for (let i = 0; i < floors.length && rest > 0; i++, rest--) {
            floors[i].v += 1;
        }

        for (const f of floors) {
            targetsById[f.id][m] = f.v;
        }
    }

    return targetsById;
}

