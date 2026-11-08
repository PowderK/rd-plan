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
        rtwTagYear: number;
        rtwNachtYear: number;
        rtwTotalYear: number;
        daysSinceLastRtw: number;
        lastRtwDate?: string;
        prevDutyDate?: string;
        prevDutyRtwType?: string;
        weekendShiftsCount: number;
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
    strictPreviousNightExclusion?: boolean; // Bei Nacht-Ausfall: Kollege mit RTW-Nacht in Vorschicht hart ausschließen (default: true)
    weights?: Partial<ReplacementWeights>;
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

export function findReplacementsForSlot(options: ReplacementFinderOptions): ReplacementFinderResult {
    const {
        slotId,
        date,
        vehicleName = 'RTW',
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

    const isTag = slotId.includes('_tag_');
    const isNacht = slotId.includes('_nacht_');
    const isFzF = slotId.endsWith('_1');
    const isMa = slotId.endsWith('_2') || slotId.endsWith('_3');

    const slotLabel = isFzF
        ? `Fahrzeugführer (${isTag ? 'Tagdienst' : 'Nachtdienst'})`
        : `Maschinist (${isTag ? 'Tagdienst' : 'Nachtdienst'})`;

    const prevDateStr = addDays(date, -1);
    const nextDateStr = addDays(date, 1);

    // Aktuell eingeteilte Person ermitteln (damit sie nicht als Nachrücker für sich selbst vorgeschlagen wird)
    let currentAssignedPersonId: number | null = null;
    if (currentAssignedValue && currentAssignedValue.startsWith('p:')) {
        currentAssignedPersonId = parseInt(currentAssignedValue.slice(2), 10);
    }

    const currentTargetYear = options.targetYear || parseInt(date.slice(0, 4), 10) || new Date().getFullYear();

    // 1. Vorab-Analyse: Durchschnittszahlen der Abteilung im laufenden Jahr berechnen
    const deptTotals: number[] = [];
    const deptWeTotals: number[] = [];

    // Datumsliste des aktuellen Jahres bis zum Schichttag
    const yearStartIso = `${currentTargetYear}-01-01`;
    const targetDateObj = new Date(date + 'T00:00:00Z');

    const targetDateDow = targetDateObj.getUTCDay();
    const isTargetWeekendOrHoliday = (targetDateDow === 0 || targetDateDow === 6 || holidays.has(date));

    // Vorab-Erfassung der Metriken aller Personen
    const personYearMetrics: Record<number, {
        rtwTagYear: number;
        rtwNachtYear: number;
        rtwTotalYear: number;
        weShiftsCount: number;
        lastRtwDate?: string;
        daysSinceLastRtw: number;
        prevDutyDate?: string;
        prevDutyRtwType?: string;
    }> = {};

    personnel.forEach(p => {
        let tagCount = 0;
        let nachtCount = 0;
        let weCount = 0;
        let lastRtw: string | undefined = undefined;
        let prevDuty: string | undefined = undefined;
        let prevDutyRtwType: string | undefined = undefined;

        // Iteriere rückwärts vom Vortag bis Jahresanfang
        let curIso = addDays(date, -1);
        while (curIso >= yearStartIso) {
            const cell = getShiftCell(roster, localRoster, p.id, curIso);
            const val = (cell.value || '').trim();
            const typ = String(cell.type || '');

            // Erfassung des vorangegangenen Wachdienstes (Vorschicht)
            if (!prevDuty && val === 'V') {
                prevDuty = curIso;
                if (/^rtw\d+_(tag|nacht)/.test(typ)) {
                    prevDutyRtwType = typ;
                }
            }

            // Erfassung von RTW-Schichten
            const isRtwTag = typ.includes('_tag_') && typ.startsWith('rtw');
            const isRtwNacht = typ.includes('_nacht_') && typ.startsWith('rtw');

            if (isRtwTag || isRtwNacht) {
                if (!lastRtw) {
                    lastRtw = curIso;
                }
                if (isRtwTag) tagCount++;
                if (isRtwNacht) nachtCount++;

                const curDow = new Date(curIso + 'T00:00:00Z').getUTCDay();
                if (curDow === 0 || curDow === 6 || holidays.has(curIso)) {
                    weCount++;
                }
            }

            curIso = addDays(curIso, -1);
        }

        let daysSince = 999;
        if (lastRtw) {
            const lastMs = new Date(lastRtw + 'T00:00:00Z').getTime();
            const targetMs = targetDateObj.getTime();
            daysSince = Math.max(1, Math.round((targetMs - lastMs) / (1000 * 60 * 60 * 24)));
        }

        const totalRtw = tagCount + nachtCount;
        personYearMetrics[p.id] = {
            rtwTagYear: tagCount,
            rtwNachtYear: nachtCount,
            rtwTotalYear: totalRtw,
            weShiftsCount: weCount,
            lastRtwDate: lastRtw,
            daysSinceLastRtw: daysSince,
            prevDutyDate: prevDuty,
            prevDutyRtwType: prevDutyRtwType
        };

        deptTotals.push(totalRtw);
        deptWeTotals.push(weCount);
    });

    const avgDeptRtw = deptTotals.length > 0 ? (deptTotals.reduce((a, b) => a + b, 0) / deptTotals.length) : 0;
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

        // Muss-Filter 2: Qualifikation (bei Fahrzeugführer ist FzF RTW zwingend erforderlich)
        if (isFzF && !p.fahrzeugfuehrer) {
            excluded.push({
                personId: p.id,
                displayName,
                reason: 'Fehlende Qualifikation: Kein Fahrzeugführer RTW'
            });
            continue;
        }

        // Muss-Filter 3: Bereits auf einem anderen Fahrzeug-Slot am selben Tag gebunden
        if (typeToday && (typeToday.startsWith('rtw') || typeToday.startsWith('nef') || typeToday.startsWith('itw'))) {
            if (typeToday !== slotId) {
                excluded.push({
                    personId: p.id,
                    displayName,
                    reason: `Bereits auf anderem Fahrzeug eingeteilt (${typeToday})`
                });
                continue;
            }
        }

        // Muss-Filter 4: 11h ArbZG Ruhezeitprüfung
        if (isTag) {
            const prevCell = getShiftCell(roster, localRoster, p.id, prevDateStr);
            const prevType = String(prevCell.type || '');
            if (prevType.includes('_nacht_') || /^rtw\d+_nacht/.test(prevType)) {
                excluded.push({
                    personId: p.id,
                    displayName,
                    reason: 'Ruhezeitverletzung (11h ArbZG): Hatte in der Vornacht Nachtschicht bis 07:00 Uhr'
                });
                continue;
            }
        }

        if (isNacht) {
            const nextCell = getShiftCell(roster, localRoster, p.id, nextDateStr);
            const nextType = String(nextCell.type || '');
            if (nextType.includes('_tag_') || /^rtw\d+_tag/.test(nextType)) {
                excluded.push({
                    personId: p.id,
                    displayName,
                    reason: 'Ruhezeitverletzung (11h ArbZG): Hat am Folgetag direkt Tagschicht ab 07:00 Uhr'
                });
                continue;
            }
        }

        // Muss-Filter 5: Keine RTW-Nachtschicht am vorangegangenen Wachdienst (Vorschicht) bei Nacht-Ausfall
        // (Bei 24h-Diensten soll niemand zwei Wachdienste in Folge eine RTW-Nacht fahren müssen)
        if (isNacht && strictPreviousNightExclusion) {
            const m = personYearMetrics[p.id];
            if (m.prevDutyRtwType && m.prevDutyRtwType.includes('_nacht_')) {
                const prevDateFormatted = m.prevDutyDate ? m.prevDutyDate : 'letzter Wachdienst';
                excluded.push({
                    personId: p.id,
                    displayName,
                    reason: `Hatte am vorangegangenen Wachdienst (${prevDateFormatted}) bereits RTW-Nachtschicht`
                });
                continue;
            }
        }

        // --- STUFE 2: AUSGEWOGENES PUNKTESYSTEM (0 - 100 PUNKTE) ---
        const m = personYearMetrics[p.id];
        const badges: ReplacementBadge[] = [];

        // DIMENSION 1: Schichtsaldo / Auslastung (0 bis maxWeights.shiftBalance)
        // Vergleicht bisherige RTW-Gesamtschichten mit dem Wachabteilungs-Schnitt
        const balanceDelta = Math.round(avgDeptRtw - m.rtwTotalYear);
        const normBalanceRatio = Math.max(0, Math.min(1, (12 + balanceDelta * 3) / 25));
        const shiftBalanceScore = Math.round(normBalanceRatio * maxWeights.shiftBalance);

        if (balanceDelta >= 2) {
            badges.push({
                type: 'bonus',
                text: `✓ Schichtdefizit: ${balanceDelta} Schichten unter Wachdurchschnitt (+${shiftBalanceScore} Pkt.)`
            });
        } else if (balanceDelta <= -2) {
            badges.push({
                type: 'penalty',
                text: `⚠ Schichtüberschuss: ${-balanceDelta} Schichten über Wachdurchschnitt (${shiftBalanceScore} Pkt.)`
            });
        } else {
            badges.push({
                type: 'neutral',
                text: `ℹ Schichtkonto: Ausgeglichen (${m.rtwTotalYear} RTW-Schichten bisher, +${shiftBalanceScore} Pkt.)`
            });
        }

        // DIMENSION 2: Tag/Nacht-Balance passend zur Schichtart (0 bis maxWeights.shiftTypeFit)
        let rawTypeRatio = 0.5;
        if (isNacht) {
            const diff = m.rtwTagYear - m.rtwNachtYear;
            rawTypeRatio = Math.max(0, Math.min(1, (12 + diff * 3) / 25));
            const score = Math.round(rawTypeRatio * maxWeights.shiftTypeFit);
            if (diff >= 2) {
                badges.push({
                    type: 'bonus',
                    text: `✓ Tag/Nacht-Balance: ${m.rtwTagYear} Tag / nur ${m.rtwNachtYear} Nacht (benötigt Nachtdienst!) (+${score} Pkt.)`
                });
            } else if (diff <= -2) {
                badges.push({
                    type: 'penalty',
                    text: `⚠ Tag/Nacht-Balance: Bereits starkes Nacht-Übergewicht (${m.rtwTagYear}T / ${m.rtwNachtYear}N) (${score} Pkt.)`
                });
            } else {
                badges.push({
                    type: 'neutral',
                    text: `ℹ Tag/Nacht-Verhältnis: Ausgeglichen (${m.rtwTagYear}T / ${m.rtwNachtYear}N, +${score} Pkt.)`
                });
            }
        } else if (isTag) {
            const diff = m.rtwNachtYear - m.rtwTagYear;
            rawTypeRatio = Math.max(0, Math.min(1, (12 + diff * 3) / 25));
            const score = Math.round(rawTypeRatio * maxWeights.shiftTypeFit);
            if (diff >= 2) {
                badges.push({
                    type: 'bonus',
                    text: `✓ Tag/Nacht-Balance: ${m.rtwNachtYear} Nacht / nur ${m.rtwTagYear} Tag (benötigt Tagdienst!) (+${score} Pkt.)`
                });
            } else if (diff <= -2) {
                badges.push({
                    type: 'penalty',
                    text: `⚠ Tag/Nacht-Balance: Bereits starkes Tag-Übergewicht (${m.rtwTagYear}T / ${m.rtwNachtYear}N) (${score} Pkt.)`
                });
            } else {
                badges.push({
                    type: 'neutral',
                    text: `ℹ Tag/Nacht-Verhältnis: Ausgeglichen (${m.rtwTagYear}T / ${m.rtwNachtYear}N, +${score} Pkt.)`
                });
            }
        }
        const shiftTypeFitScore = Math.round(rawTypeRatio * maxWeights.shiftTypeFit);

        // DIMENSION 3: Vorschicht-Belastung / Erholungsabstand (0 bis maxWeights.previousDuty)
        let rawDutyRatio = 0.75;
        if (isNacht && m.prevDutyRtwType && m.prevDutyRtwType.includes('_nacht_')) {
            rawDutyRatio = 0; // Starker Abzug bei aktivierter Toleranz
            const score = Math.round(rawDutyRatio * maxWeights.previousDuty);
            badges.push({
                type: 'penalty',
                text: `⚠ Vorschicht (${m.prevDutyDate}): Hatte bereits RTW-Nacht! (${score} Pkt.)`
            });
        } else if (isTag && m.prevDutyRtwType && m.prevDutyRtwType.includes('_tag_')) {
            rawDutyRatio = 0.25;
            const score = Math.round(rawDutyRatio * maxWeights.previousDuty);
            badges.push({
                type: 'penalty',
                text: `⚠ Vorschicht (${m.prevDutyDate}): Hatte bereits RTW-Tag (${score} Pkt.)`
            });
        } else {
            rawDutyRatio = 1.0;
            const score = Math.round(rawDutyRatio * maxWeights.previousDuty);
            const prevText = m.prevDutyDate
                ? `am ${m.prevDutyDate} kein ${isNacht ? 'Nacht' : 'Tag'}dienst`
                : 'erholt';
            badges.push({
                type: 'bonus',
                text: `✓ Vorschicht: Erholt (${prevText}) (+${score} Pkt.)`
            });
        }
        const previousDutyScore = Math.round(rawDutyRatio * maxWeights.previousDuty);

        // DIMENSION 4: RTW-Abstinenz / Rotation (0 bis maxWeights.abstinence)
        let rawAbstinenceRatio = 0.33;
        if (m.daysSinceLastRtw >= 30) {
            rawAbstinenceRatio = 1.0;
            const score = Math.round(rawAbstinenceRatio * maxWeights.abstinence);
            const daysLabel = m.daysSinceLastRtw >= 999 ? 'über 60' : `${m.daysSinceLastRtw}`;
            badges.push({
                type: 'bonus',
                text: `✓ RTW-Abstinenz: Zuletzt RTW vor ${daysLabel} Tagen (+${score} Pkt.)`
            });
        } else if (m.daysSinceLastRtw >= 15) {
            rawAbstinenceRatio = 0.67;
            const score = Math.round(rawAbstinenceRatio * maxWeights.abstinence);
            badges.push({
                type: 'bonus',
                text: `✓ RTW-Abstinenz: Zuletzt RTW vor ${m.daysSinceLastRtw} Tagen (+${score} Pkt.)`
            });
        } else if (m.daysSinceLastRtw >= 7) {
            rawAbstinenceRatio = 0.33;
            const score = Math.round(rawAbstinenceRatio * maxWeights.abstinence);
            badges.push({
                type: 'neutral',
                text: `ℹ RTW-Abstinenz: Zuletzt vor ${m.daysSinceLastRtw} Tagen (+${score} Pkt.)`
            });
        } else {
            rawAbstinenceRatio = 0;
            const score = Math.round(rawAbstinenceRatio * maxWeights.abstinence);
            badges.push({
                type: 'penalty',
                text: `⚠ Kürzlich gefahren: Zuletzt vor erst ${m.daysSinceLastRtw} Tagen auf RTW (${score} Pkt.)`
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
                    text: `✓ Wochenende: Bisher wenige WE-Dienste (${m.weShiftsCount} Schichten) (+${score} Pkt.)`
                });
            } else if (weDiff <= -1) {
                rawWeekendRatio = Math.max(0, (8 + weDiff * 3) / 15);
                const score = Math.round(rawWeekendRatio * maxWeights.weekend);
                badges.push({
                    type: 'penalty',
                    text: `⚠ Wochenende: Bisher viele WE-Dienste (${m.weShiftsCount} Schichten) (${score} Pkt.)`
                });
            } else {
                rawWeekendRatio = 0.53;
                const score = Math.round(rawWeekendRatio * maxWeights.weekend);
                badges.push({
                    type: 'neutral',
                    text: `ℹ Wochenende: Durchschnittlich (${m.weShiftsCount} WE-Schichten, +${score} Pkt.)`
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
                rtwTagYear: m.rtwTagYear,
                rtwNachtYear: m.rtwNachtYear,
                rtwTotalYear: m.rtwTotalYear,
                daysSinceLastRtw: m.daysSinceLastRtw,
                lastRtwDate: m.lastRtwDate,
                prevDutyDate: m.prevDutyDate,
                prevDutyRtwType: m.prevDutyRtwType,
                weekendShiftsCount: m.weShiftsCount
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

