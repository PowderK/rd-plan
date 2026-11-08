/**
 * replacementFinder.ts
 * Intelligente Nachrücker-Suche bei RTW-Ausfall („Wer ist dran?“-Button, Issue 025 / GitHub #47).
 *
 * Stufe 1: Harte Filter (Nur Kollegen mit 'V' am Schichttag, Qualifikation FzF/Ma, keine Doppelbelegung, 11h ArbZG).
 * Stufe 2: Ausgewogenes Punktesystem (0-100 Pkt.) über 5 Dimensionen:
 *   - Schichtsaldo / Auslastung (max 25)
 *   - Tag/Nacht-Balance zur Schichtart (max 25)
 *   - Vorschicht-Belastung / Kettenvermeidung (max 20)
 *   - RTW-Abstinenz / Rotation (max 15)
 *   - Wochenend-Ausgleich (max 15)
 */

export interface ReplacementBadge {
    type: 'bonus' | 'penalty' | 'neutral';
    text: string;
}

export interface ReplacementWeights {
    shiftBalance: number; // default: 25
    shiftTypeFit: number; // default: 25
    previousDuty: number; // default: 20
    abstinence: number;   // default: 15
    weekend: number;      // default: 15
}

export interface PersonalBalanceInfo {
    soll: number;
    ist: number;
    deficit: number; // Soll - Ist (positiv = Minusschichten / Nachholbedarf; negativ = Plusschichten / Überschuss)
    yearSoll?: number;
    yearIst?: number;
    yearRest?: number;
}

export interface ReplacementCandidate {
    personId: number;
    displayName: string;
    totalScore: number;
    breakdown: {
        shiftBalance: number;
        shiftTypeFit: number;
        previousDuty: number;
        abstinence: number;
        weekend: number;
    };
    badges: ReplacementBadge[];
    metrics: {
        personalSoll: number;
        personalIst: number;
        personalDeficit: number;
        rdTagYear: number;
        rdNachtYear: number;
        rdTotalYear: number;
        daysSinceLastRd: number;
        lastRdDate?: string;
        prevDutyDate?: string;
        prevDutyRdType?: string;
        weekendShiftsCount: number;
        rtwTagYear: number;
        rtwNachtYear: number;
        rtwTotalYear: number;
        daysSinceLastRtw: number;
    };
}

export interface ExcludedCandidate {
    personId: number;
    displayName: string;
    reason: string;
}

export interface ReplacementFinderResult {
    slotId: string;
    date: string;
    vehicleName: string;
    slotLabel: string;
    isTag: boolean;
    isNacht: boolean;
    isFzF: boolean;
    isMa: boolean;
    candidates: ReplacementCandidate[];
    excluded: ExcludedCandidate[];
}

export interface ReplacementFinderOptions {
    slotId: string;
    date: string;
    vehicleName?: string;
    targetYear?: number;
    personnel: Array<{
        id: number;
        name: string;
        vorname?: string;
        fahrzeugfuehrer?: boolean;
        fahrzeugfuehrerHLFB?: boolean | number;
        department?: string;
    }>;
    roster: Record<string, Record<string, { value: string; type: string }>>;
    localRoster?: Record<string, Record<string, { value: string; type: string }>>;
    holidays?: Set<string>;
    currentAssignedValue?: string; // z.B. "p:483" (wer aktuell eingeteilt ist)
    strictPreviousNightExclusion?: boolean; // Bei Nacht-Ausfall: Kollege mit RTW/NEF-Nacht in Vorschicht hart ausschließen (default: true)
    weights?: Partial<ReplacementWeights>;
    personalBalances?: Record<number, PersonalBalanceInfo>; // Persönliches Soll-Ist-Konto der Kollegen (oberste Priorität!)
    nefShiftMode?: 'tag' | 'nacht' | '24h'; // Spezifischer Modus bei NEF (default: '24h')
}

function getShiftCell(
    roster: Record<string, Record<string, { value: string; type: string }>>,
    localRoster: Record<string, Record<string, { value: string; type: string }>> | undefined,
    personId: number,
    dateStr: string
): { value: string; type: string } {
    const pKey = `p_${personId}`;
    if (localRoster && localRoster[pKey] && localRoster[pKey][dateStr] !== undefined) {
        return localRoster[pKey][dateStr] || { value: '', type: '' };
    }
    if (roster && roster[pKey] && roster[pKey][dateStr] !== undefined) {
        return roster[pKey][dateStr] || { value: '', type: '' };
    }
    return { value: '', type: '' };
}

function addDays(isoDate: string, days: number): string {
    const d = new Date(isoDate + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

/**
 * Ermittelt, ob eine Schicht auf einem Rettungsfahrzeug (RTW oder NEF) stattfand.
 * ITW ist ausdrücklich ausgenommen, da dieser in einem anderen Dienstplan geführt wird.
 */
function parseRdVehicleshift(typeStr: string): {
    isRd: boolean;
    isRtw: boolean;
    isNef: boolean;
    isTag: boolean;
    isNacht: boolean;
} {
    const t = (typeStr || '').trim();
    if (!t) return { isRd: false, isRtw: false, isNef: false, isTag: false, isNacht: false };

    // ITW ist ausdrücklich außen vor
    if (t.startsWith('itw')) {
        return { isRd: false, isRtw: false, isNef: false, isTag: false, isNacht: false };
    }

    // RTW
    if (t.startsWith('rtw')) {
        const isTag = t.includes('_tag_');
        const isNacht = t.includes('_nacht_');
        return { isRd: true, isRtw: true, isNef: false, isTag, isNacht };
    }

    // NEF
    if (t.startsWith('nef')) {
        const isAssist = t.includes('_assist') || t.includes('assist');
        if (isAssist) {
            const isTagOnly = t.includes('_tag');
            const isNachtOnly = t.includes('_nacht');
            const isTag = isTagOnly || !isNachtOnly;
            const isNacht = isNachtOnly || !isTagOnly;
            return { isRd: true, isRtw: false, isNef: true, isTag, isNacht };
        }
    }

    return { isRd: false, isRtw: false, isNef: false, isTag: false, isNacht: false };
}

export function findReplacementsForSlot(options: ReplacementFinderOptions): ReplacementFinderResult {
    const {
        slotId,
        date,
        vehicleName = 'Rettungsfahrzeug',
        personnel = [],
        roster = {},
        localRoster,
        holidays = new Set<string>(),
        currentAssignedValue,
        strictPreviousNightExclusion = true,
        weights
    } = options;

    const maxWeights: ReplacementWeights = {
        shiftBalance: weights?.shiftBalance ?? 25,
        shiftTypeFit: weights?.shiftTypeFit ?? 25,
        previousDuty: weights?.previousDuty ?? 20,
        abstinence: weights?.abstinence ?? 15,
        weekend: weights?.weekend ?? 15,
    };

    const isNefSlot = slotId.startsWith('nef');
    const isRtwSlot = slotId.startsWith('rtw');

    let isTag = false;
    let isNacht = false;
    let isFzF = false;
    let isMa = false;

    if (isNefSlot) {
        isFzF = true;
        isMa = false;
        if (options.nefShiftMode === 'tag' || slotId.includes('_tag')) {
            isTag = true;
            isNacht = false;
        } else if (options.nefShiftMode === 'nacht' || slotId.includes('_nacht')) {
            isTag = false;
            isNacht = true;
        } else {
            // 24h NEF umfasst Tag- und Nachtanteil
            isTag = true;
            isNacht = true;
        }
    } else {
        isTag = slotId.includes('_tag_');
        isNacht = slotId.includes('_nacht_');
        isFzF = slotId.endsWith('_1');
        isMa = slotId.endsWith('_2') || slotId.endsWith('_3');
    }

    const slotLabel = isNefSlot
        ? `NEF-Fahrzeugführer (${isNacht && !isTag ? 'Nachtdienst' : (isTag && !isNacht ? 'Tagdienst' : '24h-Dienst')})`
        : (isFzF
            ? `Fahrzeugführer (${isTag ? 'Tagdienst' : 'Nachtdienst'})`
            : `Maschinist (${isTag ? 'Tagdienst' : 'Nachtdienst'})`);

    const prevDateStr = addDays(date, -1);
    const nextDateStr = addDays(date, 1);

    // Aktuell eingeteilte Person ermitteln (damit sie nicht als Nachrücker für sich selbst vorgeschlagen wird)
    let currentAssignedPersonId: number | null = null;
    if (currentAssignedValue && currentAssignedValue.startsWith('p:')) {
        currentAssignedPersonId = parseInt(currentAssignedValue.slice(2), 10);
    }

    const currentTargetYear = options.targetYear || parseInt(date.slice(0, 4), 10) || new Date().getFullYear();

    // 1. Vorab-Analyse: Wochenend-Durchschnitt der Rettungsfahrzeuge (RTW + NEF)
    const deptWeTotals: number[] = [];

    // Datumsliste des aktuellen Jahres bis zum Schichttag
    const yearStartIso = `${currentTargetYear}-01-01`;
    const targetDateObj = new Date(date + 'T00:00:00Z');

    const targetDateDow = targetDateObj.getUTCDay();
    const isTargetWeekendOrHoliday = (targetDateDow === 0 || targetDateDow === 6 || holidays.has(date));

    // Vorab-Erfassung der Metriken aller Personen auf Rettungsfahrzeugen (RTW + NEF gemeinsam)
    const personYearMetrics: Record<number, {
        rdTagYear: number;
        rdNachtYear: number;
        rdTotalYear: number;
        weShiftsCount: number;
        lastRdDate?: string;
        daysSinceLastRd: number;
        prevDutyDate?: string;
        prevDutyRdType?: string;
        prevDutyRdHadNight: boolean;
        prevDutyRdHadTag: boolean;
    }> = {};

    personnel.forEach(p => {
        let rdTagCount = 0;
        let rdNachtCount = 0;
        let weCount = 0;
        let lastRd: string | undefined = undefined;
        let prevDuty: string | undefined = undefined;
        let prevDutyRdType: string | undefined = undefined;
        let prevDutyRdHadNight = false;
        let prevDutyRdHadTag = false;

        // Iteriere rückwärts vom Vortag bis Jahresanfang
        let curIso = addDays(date, -1);
        while (curIso >= yearStartIso) {
            const cell = getShiftCell(roster, localRoster, p.id, curIso);
            const val = (cell.value || '').trim();
            const typ = String(cell.type || '');

            const shift = parseRdVehicleshift(typ);

            // Erfassung des vorangegangenen Wachdienstes (Vorschicht)
            if (!prevDuty && val === 'V') {
                prevDuty = curIso;
                if (shift.isRd) {
                    prevDutyRdType = typ;
                    prevDutyRdHadNight = shift.isNacht;
                    prevDutyRdHadTag = shift.isTag;
                }
            }

            // Erfassung von Rettungsfahrzeug-Schichten (RTW & NEF gemeinsam)
            if (shift.isRd) {
                if (!lastRd) {
                    lastRd = curIso;
                }
                if (shift.isTag) rdTagCount++;
                if (shift.isNacht) rdNachtCount++;

                const curDow = new Date(curIso + 'T00:00:00Z').getUTCDay();
                if (curDow === 0 || curDow === 6 || holidays.has(curIso)) {
                    weCount++;
                }
            }

            curIso = addDays(curIso, -1);
        }

        let daysSince = 999;
        if (lastRd) {
            const lastMs = new Date(lastRd + 'T00:00:00Z').getTime();
            const targetMs = targetDateObj.getTime();
            daysSince = Math.max(1, Math.round((targetMs - lastMs) / (1000 * 60 * 60 * 24)));
        }

        personYearMetrics[p.id] = {
            rdTagYear: rdTagCount,
            rdNachtYear: rdNachtCount,
            rdTotalYear: rdTagCount + rdNachtCount,
            weShiftsCount: weCount,
            lastRdDate: lastRd,
            daysSinceLastRd: daysSince,
            prevDutyDate: prevDuty,
            prevDutyRdType,
            prevDutyRdHadNight,
            prevDutyRdHadTag
        };

        deptWeTotals.push(weCount);
    });

    const avgDeptWe = deptWeTotals.length > 0 ? (deptWeTotals.reduce((a, b) => a + b, 0) / deptWeTotals.length) : 0;

    const candidates: ReplacementCandidate[] = [];
    const excluded: ExcludedCandidate[] = [];

    // 2. Filterung (Stufe 1) und Bewertung (Stufe 2)
    for (const p of personnel) {
        const displayName = p.vorname ? `${p.name}, ${p.vorname}` : p.name;

        // Falls dies die aktuell ausgefallene Person selbst ist, überspringen
        if (currentAssignedPersonId && p.id === currentAssignedPersonId) {
            excluded.push({
                personId: p.id,
                displayName,
                reason: 'Aktuell eingeteilter Kollege (Ausfall)'
            });
            continue;
        }

        const cellToday = getShiftCell(roster, localRoster, p.id, date);
        const valToday = (cellToday.value || '').trim();
        const typeToday = String(cellToday.type || '');

        // --- STUFE 1: HARTE FILTER (MUSS-KRITERIEN) ---

        // Muss-Filter 1: Ausschließlich Kollegen, die am Schichttag ein 'V' (24h-Dienst) haben!
        if (valToday !== 'V') {
            const statusLabel = valToday === '' ? 'Frei (**)' : `Dienstart '${valToday}'`;
            excluded.push({
                personId: p.id,
                displayName,
                reason: `Kein 24h-Wachdienst ('V') am Schichttag (${statusLabel})`
            });
            continue;
        }

        // Muss-Filter 2: Qualifikation (RTW FzF erfordert fahrzeugfuehrer; NEF erfordert nef)
        if (isNefSlot) {
            if (!p.nef) {
                excluded.push({
                    personId: p.id,
                    displayName,
                    reason: 'Fehlende Qualifikation: Keine NEF-Berechtigung'
                });
                continue;
            }
        } else if (isFzF && !p.fahrzeugfuehrer) {
            excluded.push({
                personId: p.id,
                displayName,
                reason: 'Fehlende Qualifikation: Kein Fahrzeugführer RTW'
            });
            continue;
        }

        // Muss-Filter 3: Bereits auf einem anderen Fahrzeug-Slot am selben Tag gebunden
        if (typeToday && (typeToday.startsWith('rtw') || typeToday.startsWith('nef') || typeToday.startsWith('itw'))) {
            const isSameNefLegacy = isNefSlot && ((slotId === 'nef1_assist' && typeToday === 'nef_assist') || (slotId === 'nef_assist' && typeToday === 'nef1_assist'));
            if (typeToday !== slotId && !isSameNefLegacy) {
                excluded.push({
                    personId: p.id,
                    displayName,
                    reason: `Bereits auf anderem Fahrzeug eingeteilt (${typeToday})`
                });
                continue;
            }
        }

        // Muss-Filter 4: 11h ArbZG Ruhezeitprüfung (über RTW & NEF)
        if (isTag) {
            const prevCell = getShiftCell(roster, localRoster, p.id, prevDateStr);
            const prevType = String(prevCell.type || '');
            const prevShift = parseRdVehicleshift(prevType);
            if (prevShift.isNacht) {
                const vehLabel = prevShift.isNef ? 'NEF' : 'RTW';
                excluded.push({
                    personId: p.id,
                    displayName,
                    reason: `Ruhezeitverletzung (11h ArbZG): Hatte in der Vornacht ${vehLabel}-Nachtdienst bis 07:00 Uhr`
                });
                continue;
            }
        }

        if (isNacht) {
            const nextCell = getShiftCell(roster, localRoster, p.id, nextDateStr);
            const nextType = String(nextCell.type || '');
            const nextShift = parseRdVehicleshift(nextType);
            if (nextShift.isTag) {
                const vehLabel = nextShift.isNef ? 'NEF' : 'RTW';
                excluded.push({
                    personId: p.id,
                    displayName,
                    reason: `Ruhezeitverletzung (11h ArbZG): Hat am Folgetag direkt ${vehLabel}-Tagdienst ab 07:00 Uhr`
                });
                continue;
            }
        }

        // Muss-Filter 5: Keine Rettungsfahrzeug-Nachtschicht am vorangegangenen Wachdienst (Vorschicht) bei Nacht-Ausfall
        // (Bei 24h-Diensten soll niemand zwei Wachdienste in Folge eine RTW- oder NEF-Nacht fahren müssen)
        if (isNacht && strictPreviousNightExclusion) {
            const m = personYearMetrics[p.id];
            if (m.prevDutyRdHadNight) {
                const prevDateFormatted = m.prevDutyDate ? m.prevDutyDate : 'letzter Wachdienst';
                const vehLabel = m.prevDutyRdType?.startsWith('nef') ? 'NEF' : 'RTW';
                excluded.push({
                    personId: p.id,
                    displayName,
                    reason: `Hatte am vorangegangenen Wachdienst (${prevDateFormatted}) bereits ${vehLabel}-Nachtschicht`
                });
                continue;
            }
        }

        // --- STUFE 2: AUSGEWOGENES PUNKTESYSTEM (0 - 100 PUNKTE) ---
        const m = personYearMetrics[p.id];
        const badges: ReplacementBadge[] = [];

        // DIMENSION 1: PERSÖNLICHES SOLL-IST-DEFIZIT (Als allererste Priorität!)
        // Bewertet das persönliche Schichtdefizit der Person (Minusschichten / Nachholbedarf z. B. nach Elternzeit)
        const bal = options.personalBalances?.[p.id];
        const personalSoll = bal ? bal.soll : 0;
        const personalIst = bal ? bal.ist : 0;
        const personalDeficit = bal ? bal.deficit : 0; // positiv = Defizit (Soll > Ist), negativ = Überschuss

        // Normierung (Basis 12 von 25 Punkten bei ausgeglichenem Konto; +4 Pkt. je Minusschicht, -4 Pkt. je Plusschicht):
        const normBalanceRatio = Math.max(0, Math.min(1, (12 + personalDeficit * 4) / 25));
        const shiftBalanceScore = Math.round(normBalanceRatio * maxWeights.shiftBalance);

        if (personalDeficit >= 1) {
            badges.push({
                type: 'bonus',
                text: `✓ Persönliches Schichtdefizit: ${personalDeficit} Minusschichten (Soll: ${personalSoll}, Ist: ${personalIst}) (+${shiftBalanceScore} Pkt.)`
            });
        } else if (personalDeficit <= -1) {
            badges.push({
                type: 'penalty',
                text: `⚠ Persönlicher Schichtüberschuss: ${-personalDeficit} Plusschichten über Soll (Soll: ${personalSoll}, Ist: ${personalIst}) (${shiftBalanceScore} Pkt.)`
            });
        } else {
            badges.push({
                type: 'neutral',
                text: `ℹ Persönliches Schichtkonto: Ausgeglichen (Soll: ${personalSoll}, Ist: ${personalIst}, +${shiftBalanceScore} Pkt.)`
            });
        }

        // DIMENSION 2: Tag/Nacht-Balance passend zur Schichtart auf Rettungsfahrzeugen (RTW + NEF)
        let rawTypeRatio = 0.5;
        if (isNacht && !isTag) {
            const diff = m.rdTagYear - m.rdNachtYear;
            rawTypeRatio = Math.max(0, Math.min(1, (12 + diff * 3) / 25));
            const score = Math.round(rawTypeRatio * maxWeights.shiftTypeFit);
            if (diff >= 2) {
                badges.push({
                    type: 'bonus',
                    text: `✓ Tag/Nacht-Balance: ${m.rdTagYear} Tag / nur ${m.rdNachtYear} Nacht auf Rettungsfahrzeugen (RTW/NEF) (+${score} Pkt.)`
                });
            } else if (diff <= -2) {
                badges.push({
                    type: 'penalty',
                    text: `⚠ Tag/Nacht-Balance: Starkes Nacht-Übergewicht (${m.rdTagYear}T / ${m.rdNachtYear}N) (${score} Pkt.)`
                });
            } else {
                badges.push({
                    type: 'neutral',
                    text: `ℹ Tag/Nacht-Verhältnis: Ausgeglichen (${m.rdTagYear}T / ${m.rdNachtYear}N, +${score} Pkt.)`
                });
            }
        } else if (isTag && !isNacht) {
            const diff = m.rdNachtYear - m.rdTagYear;
            rawTypeRatio = Math.max(0, Math.min(1, (12 + diff * 3) / 25));
            const score = Math.round(rawTypeRatio * maxWeights.shiftTypeFit);
            if (diff >= 2) {
                badges.push({
                    type: 'bonus',
                    text: `✓ Tag/Nacht-Balance: ${m.rdNachtYear} Nacht / nur ${m.rdTagYear} Tag auf Rettungsfahrzeugen (RTW/NEF) (+${score} Pkt.)`
                });
            } else if (diff <= -2) {
                badges.push({
                    type: 'penalty',
                    text: `⚠ Tag/Nacht-Balance: Starkes Tag-Übergewicht (${m.rdTagYear}T / ${m.rdNachtYear}N) (${score} Pkt.)`
                });
            } else {
                badges.push({
                    type: 'neutral',
                    text: `ℹ Tag/Nacht-Verhältnis: Ausgeglichen (${m.rdTagYear}T / ${m.rdNachtYear}N, +${score} Pkt.)`
                });
            }
        } else {
            // 24h-Dienst (beide Anteile)
            rawTypeRatio = 0.6;
            const score = Math.round(rawTypeRatio * maxWeights.shiftTypeFit);
            badges.push({
                type: 'neutral',
                text: `ℹ 24h-Dienst: Bisher ${m.rdTagYear}T / ${m.rdNachtYear}N auf Rettungsfahrzeugen (+${score} Pkt.)`
            });
        }
        const shiftTypeFitScore = Math.round(rawTypeRatio * maxWeights.shiftTypeFit);

        // DIMENSION 3: Vorschicht-Belastung / Erholungsabstand (0 bis maxWeights.previousDuty)
        let rawDutyRatio = 0.75;
        if (isNacht && m.prevDutyRdHadNight) {
            rawDutyRatio = 0; // Starker Abzug bei aktivierter Toleranz
            const score = Math.round(rawDutyRatio * maxWeights.previousDuty);
            const vehLabel = m.prevDutyRdType?.startsWith('nef') ? 'NEF' : 'RTW';
            badges.push({
                type: 'penalty',
                text: `⚠ Vorschicht (${m.prevDutyDate}): Hatte bereits ${vehLabel}-Nachtdienst! (${score} Pkt.)`
            });
        } else if (isTag && !isNacht && m.prevDutyRdHadTag) {
            rawDutyRatio = 0.25;
            const score = Math.round(rawDutyRatio * maxWeights.previousDuty);
            const vehLabel = m.prevDutyRdType?.startsWith('nef') ? 'NEF' : 'RTW';
            badges.push({
                type: 'penalty',
                text: `⚠ Vorschicht (${m.prevDutyDate}): Hatte bereits ${vehLabel}-Tagdienst (${score} Pkt.)`
            });
        } else {
            rawDutyRatio = 1.0;
            const score = Math.round(rawDutyRatio * maxWeights.previousDuty);
            const prevText = m.prevDutyDate
                ? `am ${m.prevDutyDate} kein Rettungsfahrzeug`
                : 'erholt';
            badges.push({
                type: 'bonus',
                text: `✓ Vorschicht: Erholt (${prevText}) (+${score} Pkt.)`
            });
        }
        const previousDutyScore = Math.round(rawDutyRatio * maxWeights.previousDuty);

        // DIMENSION 4: Abstinenz auf Rettungsfahrzeugen / Rotation (0 bis maxWeights.abstinence)
        let rawAbstinenceRatio = 0.33;
        if (m.daysSinceLastRd >= 30) {
            rawAbstinenceRatio = 1.0;
            const score = Math.round(rawAbstinenceRatio * maxWeights.abstinence);
            const daysLabel = m.daysSinceLastRd >= 999 ? 'über 60' : `${m.daysSinceLastRd}`;
            badges.push({
                type: 'bonus',
                text: `✓ RD-Abstinenz: Zuletzt auf Rettungsfahrzeug (RTW/NEF) vor ${daysLabel} Tagen (+${score} Pkt.)`
            });
        } else if (m.daysSinceLastRd >= 15) {
            rawAbstinenceRatio = 0.67;
            const score = Math.round(rawAbstinenceRatio * maxWeights.abstinence);
            badges.push({
                type: 'bonus',
                text: `✓ RD-Abstinenz: Zuletzt auf Rettungsfahrzeug vor ${m.daysSinceLastRd} Tagen (+${score} Pkt.)`
            });
        } else if (m.daysSinceLastRd >= 7) {
            rawAbstinenceRatio = 0.33;
            const score = Math.round(rawAbstinenceRatio * maxWeights.abstinence);
            badges.push({
                type: 'neutral',
                text: `ℹ RD-Abstinenz: Zuletzt vor ${m.daysSinceLastRd} Tagen (+${score} Pkt.)`
            });
        } else {
            rawAbstinenceRatio = 0;
            const score = Math.round(rawAbstinenceRatio * maxWeights.abstinence);
            badges.push({
                type: 'penalty',
                text: `⚠ Kürzlich gefahren: Zuletzt vor erst ${m.daysSinceLastRd} Tagen auf RTW/NEF (${score} Pkt.)`
            });
        }
        const abstinenceScore = Math.round(rawAbstinenceRatio * maxWeights.abstinence);

        // DIMENSION 5: Wochenend- / Feiertags-Ausgleich (0 bis maxWeights.weekend)
        let rawWeekendRatio = 0.67;
        if (isTargetWeekendOrHoliday) {
            const weDiff = Math.round(avgDeptWe - m.weShiftsCount);
            if (weDiff >= 1) {
                rawWeekendRatio = Math.min(1.0, (8 + weDiff * 3) / 15);
                const score = Math.round(rawWeekendRatio * maxWeights.weekend);
                badges.push({
                    type: 'bonus',
                    text: `✓ Wochenende: Bisher wenige WE-Dienste auf Rettungsfahrzeugen (${m.weShiftsCount} Schichten) (+${score} Pkt.)`
                });
            } else if (weDiff <= -1) {
                rawWeekendRatio = Math.max(0, (8 + weDiff * 3) / 15);
                const score = Math.round(rawWeekendRatio * maxWeights.weekend);
                badges.push({
                    type: 'penalty',
                    text: `⚠ Wochenende: Bisher viele WE-Dienste auf Rettungsfahrzeugen (${m.weShiftsCount} Schichten) (${score} Pkt.)`
                });
            } else {
                rawWeekendRatio = 0.53;
                const score = Math.round(rawWeekendRatio * maxWeights.weekend);
                badges.push({
                    type: 'neutral',
                    text: `ℹ Wochenende: Durchschnittlich (${m.weShiftsCount} WE-Schichten auf RTW/NEF, +${score} Pkt.)`
                });
            }
        }
        const weekendScore = Math.round(rawWeekendRatio * maxWeights.weekend);

        const totalScore = Math.max(0, Math.min(100,
            shiftBalanceScore + shiftTypeFitScore + previousDutyScore + abstinenceScore + weekendScore
        ));

        candidates.push({
            personId: p.id,
            displayName,
            totalScore,
            breakdown: {
                shiftBalance: shiftBalanceScore,
                shiftTypeFit: shiftTypeFitScore,
                previousDuty: previousDutyScore,
                abstinence: abstinenceScore,
                weekend: weekendScore
            },
            badges,
            metrics: {
                personalSoll,
                personalIst,
                personalDeficit,
                rdTagYear: m.rdTagYear,
                rdNachtYear: m.rdNachtYear,
                rdTotalYear: m.rdTotalYear,
                daysSinceLastRd: m.daysSinceLastRd,
                lastRdDate: m.lastRdDate,
                prevDutyDate: m.prevDutyDate,
                prevDutyRdType: m.prevDutyRdType,
                weekendShiftsCount: m.weShiftsCount,
                rtwTagYear: m.rdTagYear,
                rtwNachtYear: m.rdNachtYear,
                rtwTotalYear: m.rdTotalYear,
                daysSinceLastRtw: m.daysSinceLastRd
            }
        });
    }

    // Sortierung nach Gesamt-Score absteigend (Platz 1 = höchster Score)
    candidates.sort((a, b) => b.totalScore - a.totalScore);

    return {
        slotId,
        date,
        vehicleName,
        slotLabel,
        isTag,
        isNacht,
        isFzF,
        isMa,
        candidates,
        excluded
    };
}

