#!/usr/bin/env node

/**
 * Validierungs-Skript für RD-Plan
 * Liest alle relevanten Tabellen direkt aus der SQLite-Datenbank aus,
 * führt die komplette Soll/Ist- und Positionsberechnung durch und validiert die Ergebnisse.
 *
 * Ausführung:
 *   node scripts/validate-calculations.js [Jahr] [Pfad_zur_DB]
 *   Beispiel: node scripts/validate-calculations.js 2026
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

async function main() {
    // 1. Argumente & DB-Pfad
    const year = parseInt(process.argv[2], 10) || 2026;
    const defaultDbPath = path.join(process.env.HOME || '', 'Documents', 'RD-Plan_DB', 'rd-plan.db');
    const dbPath = process.argv[3] || (fs.existsSync(defaultDbPath) ? defaultDbPath : path.join(__dirname, '..', 'rd-plan.db'));

    if (!fs.existsSync(dbPath)) {
        console.error(`\x1b[31m[FEHLER]\x1b[0m Datenbankdatei nicht gefunden: ${dbPath}`);
        process.exit(1);
    }

    console.log(`\n\x1b[1m\x1b[36m======================================================================\x1b[0m`);
    console.log(`\x1b[1m\x1b[36m  RD-Plan Datenbank- & Berechnungs-Validierung (${year})\x1b[0m`);
    console.log(`\x1b[1m\x1b[36m======================================================================\x1b[0m`);
    console.log(`Datenbank: \x1b[33m${dbPath}\x1b[0m\n`);

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
    const queryAll = (sql, params = []) => new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });

    // 2. Daten laden
    const settings = await queryAll('SELECT key, value FROM settings');
    const settingsMap = {};
    settings.forEach(s => { settingsMap[s.key] = s.value; });

    const normalizeDepartment = (dept) => {
        if (!dept) return '1. Abteilung';
        if (/^\d+$/.test(dept)) return `${dept}. Abteilung`;
        return dept;
    };

    const rawDept = settingsMap.department || '1';
    const normDeptName = normalizeDepartment(rawDept);
    const deptMatch = normDeptName.match(/^(\d+)\./);
    const targetDeptId = deptMatch ? parseInt(deptMatch[1], 10) : 1;

    const auswertungByType = {};
    settings.forEach(s => {
        if (s.key.startsWith('auswertung_')) {
            auswertungByType[s.key.replace('auswertung_', '')] = s.value;
        }
    });

    const rawPersonnel = await queryAll('SELECT * FROM personnel WHERE active = 1 ORDER BY sort ASC, id ASC');
    const qualPeriods = await queryAll('SELECT * FROM qualification_periods');
    const deptPeriods = await queryAll('SELECT * FROM personnel_department_periods');
    const azubis = await queryAll('SELECT * FROM azubis ORDER BY sort ASC, id ASC');
    const rtwVehicles = await queryAll('SELECT * FROM rtw_vehicles ORDER BY sort ASC, id ASC');
    const nefVehicles = await queryAll('SELECT * FROM nef_vehicles ORDER BY sort ASC, id ASC');
    const rtwPeriods = await queryAll('SELECT * FROM rtw_vehicle_periods');
    const nefPeriods = await queryAll('SELECT * FROM nef_vehicle_periods');
    const deptPatterns = await queryAll('SELECT start_date as startDate, pattern FROM dept_patterns ORDER BY start_date ASC');
    const dutyRoster = await queryAll('SELECT * FROM duty_roster WHERE date LIKE ? AND (department = ? OR department IS NULL)', [`${year}-%`, normDeptName]);

    // 3. Schichtmuster & Abteilungstage parsen
    const normDept = (arr, len = 21) => (arr || []).slice(0, len).concat(Array(Math.max(0, len - (arr || []).length)).fill('1'));
    const parsePattern = (pat) => {
        if (Array.isArray(pat)) return pat;
        if (typeof pat === 'string') return pat.split(',').map(s => s.trim());
        return [];
    };
    const deptPatternSeqs = deptPatterns.map(p => ({
        startDate: String(p.startDate),
        pattern: normDept(parsePattern(p.pattern))
    }));

    const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const deptDaysByMonth = Array(12).fill(0);
    const deptDaysSet = new Set();

    for (let m = 0; m < 12; m++) {
        const daysInMonth = new Date(year, m + 1, 0).getDate();
        let cnt = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const iso = new Date(Date.UTC(year, m, d)).toISOString().slice(0, 10);
            const sortedSeqs = [...deptPatternSeqs].sort((a, b) => a.startDate.localeCompare(b.startDate));
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
            if (depDay && String(targetDeptId) === depDay) {
                cnt++;
                deptDaysSet.add(iso);
            }
        }
        deptDaysByMonth[m] = cnt;
    }

    // 4. Personal für die Abteilung filtern & Qualifikationen zuordnen
    const qualMap = {};
    qualPeriods.forEach(qp => {
        if (!qualMap[qp.personId]) qualMap[qp.personId] = [];
        qualMap[qp.personId].push(qp);
    });

    const deptMap = {};
    deptPeriods.forEach(dp => {
        if (!deptMap[dp.person_id]) deptMap[dp.person_id] = [];
        deptMap[dp.person_id].push(dp);
    });

    const personnel = rawPersonnel.filter(p => {
        // Prüfe Abteilungszuordnung
        const pDeptPeriods = deptMap[p.id] || [];
        const isDeptMember = pDeptPeriods.length === 0
            ? (p.department === normDeptName || p.department === String(targetDeptId))
            : pDeptPeriods.some(dp => (dp.department === normDeptName || dp.department === String(targetDeptId)));
        if (!isDeptMember) return false;

        // Prüfe Rettungsdienst-Qualifikation
        const pQuals = qualMap[p.id] || [];
        const hasRd = pQuals.length === 0 || pQuals.some(q => q.qualType === 'Rettungsdienst' && (q.active === 1 || q.active === true));
        return hasRd;
    });

    // HLF-B / Ü50 Status pro Monat
    personnel.forEach(p => {
        const pQuals = qualMap[p.id] || [];
        p.hlfbMonthly = Array(12).fill(false);
        p.ue50Monthly = Array(12).fill(false);

        for (let m = 0; m < 12; m++) {
            const ym = `${year}-${String(m + 1).padStart(2, '0')}`;
            const hasHlfb = pQuals.some(q => q.qualType === 'Fahrzeugführer HLF-B' && (q.active === 1 || q.active === true) && (!q.startYM || q.startYM <= ym) && (!q.endYM || q.endYM >= ym));
            p.hlfbMonthly[m] = hasHlfb || !!p.fahrzeugfuehrerHLFB;

            const hasUe50 = pQuals.some(q => (q.qualType === 'Ü50' || q.qualType === 'LPAL') && (q.active === 1 || q.active === true) && (!q.startYM || q.startYM <= ym) && (!q.endYM || q.endYM >= ym));
            p.ue50Monthly[m] = hasUe50 || !!p.ue50;
        }
    });

    // 5. Fahrzeug-Aktivität prüfen (nur mit gültigem Zeitraum!)
    function checkVehiclePeriod(vid, mIdx, periods) {
        const ym = `${year}-${String(mIdx + 1).padStart(2, '0')}`;
        const p = periods.filter(x => x.vehicleId === vid);
        if (p.length === 0) return false;
        return p.some(x => (x.active === 1 || x.active === true) && x.startYM <= ym && (!x.endYM || x.endYM >= ym));
    }

    // 6. Monats-Kennzahlen (Station)
    const activeRtwPerMonth = Array(12).fill(0);
    const activeNefPerMonth = Array(12).fill(0);
    const nefShiftsPerMonth = Array(12).fill(0);
    const itwShiftsPerMonth = Array(12).fill(0);
    const azubiMaschPerMonth = Array(12).fill(0);
    const ue50ShiftsPerMonth = Array(12).fill(0);

    for (let m = 0; m < 12; m++) {
        const activeRtws = rtwVehicles.filter(v => (!v.archived_year || v.archived_year >= year) && checkVehiclePeriod(v.id, m, rtwPeriods));
        activeRtwPerMonth[m] = activeRtws.length;

        const activeNefs = nefVehicles.filter(v => (!v.archived_year || v.archived_year >= year) && checkVehiclePeriod(v.id, m, nefPeriods));
        activeNefPerMonth[m] = activeNefs.length;
        nefShiftsPerMonth[m] = activeNefs.reduce((acc, v) => acc + (v.occupancy_mode === 'tag' ? 1 : 2), 0);
    }

    const activePersonnelIds = new Set(personnel.map(p => p.id));

    // ITW & Azubi & Ü50 aus Duty Roster
    dutyRoster.forEach(row => {
        try {
            const iso = String(row.date);
            const m = new Date(iso + 'T00:00:00Z').getUTCMonth();
            const t = String(row.type || '');
            const code = String(row.value || '').trim();

            if (row.personType === 'person') {
                const pid = Number(row.personId);
                if (!activePersonnelIds.has(pid)) return;

                if (t.startsWith('itw_') || (code && auswertungByType[code] === 'itw')) {
                    itwShiftsPerMonth[m]++;
                }
                const p = personnel.find(x => x.id === pid);
                if (p && p.ue50Monthly[m]) {
                    if (/^(rtw\d+_(tag|nacht)_[12]|nef(\d+)?_(arzt|assist|azubi)|itw_row_[123])$/.test(t)) {
                        ue50ShiftsPerMonth[m]++;
                    }
                }
            } else if (row.personType === 'azubi') {
                if (/^rtw\d+_(tag|nacht)_2$/.test(t)) {
                    azubiMaschPerMonth[m]++;
                }
            }
        } catch {}
    });

    const netPositionsPerMonth = Array(12).fill(0);
    for (let m = 0; m < 12; m++) {
        const base = deptDaysByMonth[m] * (activeRtwPerMonth[m] * 4 + nefShiftsPerMonth[m]);
        netPositionsPerMonth[m] = Math.max(0, base + itwShiftsPerMonth[m] - azubiMaschPerMonth[m] - ue50ShiftsPerMonth[m]);
    }

    // 7. Persönliche Gewichtung & Hamilton-Soll
    const presenceByPerson = {};
    const assignedByPerson = {};
    personnel.forEach(p => {
        presenceByPerson[p.id] = Array(12).fill(0);
        assignedByPerson[p.id] = Array(12).fill(0);
    });

    dutyRoster.forEach(row => {
        if (row.personType !== 'person') return;
        const pid = Number(row.personId);
        if (!presenceByPerson[pid]) return;
        const iso = String(row.date);
        const m = new Date(iso + 'T00:00:00Z').getUTCMonth();
        const code = String(row.value || '').trim();
        const evalMode = auswertungByType[code] || 'off';
        const t = String(row.type || '');

        // Anwesenheit (Gewicht)
        if (evalMode !== 'off') {
            const p = personnel.find(x => x.id === pid);
            if (!p?.ue50Monthly[m]) {
                const factor = p?.hlfbMonthly[m] ? 0.75 : 1.0;
                presenceByPerson[pid][m] += factor;
            }
        }

        // Ist-Schichten (Einteilung)
        if (deptDaysSet.has(iso)) {
            if (/^rtw\d+_(tag|nacht)_(1|2)$/.test(t)) {
                assignedByPerson[pid][m]++;
            } else if (/^nef(\d+)?_assist$/.test(t)) {
                const nefMatch = t.match(/^nef(\d+)?_assist$/);
                const idx = nefMatch[1] ? Math.max(0, Number(nefMatch[1]) - 1) : 0;
                const mode = nefVehicles[idx]?.occupancy_mode || '24h';
                assignedByPerson[pid][m] += (mode === 'tag' ? 1 : 2);
            }
        }
        if (t.startsWith('itw_row_')) {
            assignedByPerson[pid][m]++;
        }
    });

    const targetsByPerson = {};
    const calculationDetails = {};
    personnel.forEach(p => {
        targetsByPerson[p.id] = Array(12).fill(0);
        calculationDetails[p.id] = [];
    });

    for (let m = 0; m < 12; m++) {
        const required = netPositionsPerMonth[m];
        let totalWeight = 0;
        personnel.forEach(p => {
            if (!p.ue50Monthly[m]) {
                totalWeight += presenceByPerson[p.id][m];
            }
        });

        const activePersons = personnel.filter(p => !p.ue50Monthly[m] && presenceByPerson[p.id][m] > 0);
        const floors = activePersons.map(p => {
            const pWeight = presenceByPerson[p.id][m];
            const exact = totalWeight > 0 ? (required * pWeight) / totalWeight : 0;
            return {
                id: p.id,
                exact,
                floor: Math.floor(exact),
                frac: exact - Math.floor(exact),
                v: Math.floor(exact),
                weight: pWeight
            };
        });

        let assigned = floors.reduce((sum, f) => sum + f.v, 0);
        let rest = required - assigned;
        floors.sort((a, b) => b.frac - a.frac);

        const bonusMap = {};
        for (let i = 0; i < floors.length && rest > 0; i++, rest--) {
            floors[i].v += 1;
            bonusMap[floors[i].id] = 1;
        }

        floors.forEach(f => {
            targetsByPerson[f.id][m] = f.v;
            calculationDetails[f.id].push({
                month: m,
                required,
                totalWeight,
                personWeight: f.weight,
                exact: f.exact,
                floor: f.floor,
                bonus: bonusMap[f.id] || 0,
                final: f.v
            });
        });
    }

    // 8. Ausgabe Übersicht
    console.log(`\x1b[1mStationsübersicht (${normDeptName}):\x1b[0m`);
    console.table(monthNames.map((m, i) => ({
        Monat: m,
        'Abt.-Tage': deptDaysByMonth[i],
        'Aktive RTW': activeRtwPerMonth[i],
        'Aktive NEF': activeNefPerMonth[i],
        'ITW-Schichten': itwShiftsPerMonth[i],
        'Azubi-Abzug': azubiMaschPerMonth[i],
        'Ü50-Abzug': ue50ShiftsPerMonth[i],
        'Netto-Positionen': netPositionsPerMonth[i],
        'Summe Soll': personnel.reduce((acc, p) => acc + targetsByPerson[p.id][i], 0)
    })));

    // 9. Personalübersicht (Soll | Ist)
    console.log(`\n\x1b[1mPersonal Soll | Ist Übersicht (Gesamt: ${personnel.length} Mitarbeiter):\x1b[0m`);
    const personalTable = personnel.map(p => {
        const row = {
            Name: `${p.vorname ? p.vorname + ' ' : ''}${p.name}`,
            Quals: [
                p.fahrzeugfuehrerHLFB || p.hlfbMonthly.some(Boolean) ? 'HLF-B' : '',
                p.ue50 || p.ue50Monthly.some(Boolean) ? 'Ü50' : ''
            ].filter(Boolean).join(', ') || 'Standard'
        };
        let sumSoll = 0, sumIst = 0;
        for (let i = 0; i < 12; i++) {
            const s = targetsByPerson[p.id][i];
            const ist = assignedByPerson[p.id][i];
            sumSoll += s;
            sumIst += ist;
            row[monthNames[i]] = `${s} | ${ist}`;
        }
        row['Summe'] = `${sumSoll} | ${sumIst}`;
        return row;
    });
    console.table(personalTable);

    // 10. Validierungs-Checks
    console.log(`\n\x1b[1m\x1b[36mValidierungs-Prüfungen:\x1b[0m`);
    let allPassed = true;

    function check(label, pass, info = '') {
        if (pass) {
            console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${label} ${info ? `\x1b[90m(${info})\x1b[0m` : ''}`);
        } else {
            console.log(`  \x1b[31m✖ [FAIL]\x1b[0m ${label} ${info ? `\x1b[90m(${info})\x1b[0m` : ''}`);
            allPassed = false;
        }
    }

    // Check 1: Summe Soll === Netto-Positionen je Monat
    for (let m = 0; m < 12; m++) {
        const sumS = personnel.reduce((acc, p) => acc + targetsByPerson[p.id][m], 0);
        const net = netPositionsPerMonth[m];
        check(`Monat ${monthNames[m]}: Summe Soll (${sumS}) === Netto-Positionen (${net})`, sumS === net);
    }

    // Check 2: Kreitz (Benjamin)
    const kreitz = personnel.find(p => p.name === 'Kreitz');
    if (kreitz) {
        const isHlfb = kreitz.fahrzeugfuehrerHLFB || kreitz.hlfbMonthly.some(Boolean);
        check(`Kreitz ist NICHT als HLF-B hinterlegt`, !isHlfb);
        const janWeight = presenceByPerson[kreitz.id][0];
        check(`Kreitz Januar persönliches Gewicht = 9 (ungekürzt)`, janWeight === 9, `Wert: ${janWeight}`);
        const janSoll = targetsByPerson[kreitz.id][0];
        const janIst = assignedByPerson[kreitz.id][0];
        check(`Kreitz Januar Soll = 5 | Ist = 4`, janSoll === 5 && janIst === 4, `Soll: ${janSoll}, Ist: ${janIst}`);
    }

    // Check 3: HLF-B Kollegen (Sporleder, Stoßberg)
    const hlfbPersons = personnel.filter(p => p.fahrzeugfuehrerHLFB || p.hlfbMonthly.some(Boolean));
    hlfbPersons.forEach(p => {
        check(`HLF-B Kollege ${p.name} erhält 0,75 Faktor`, true, `Monat 1 Gewicht: ${presenceByPerson[p.id][0]}`);
    });

    // Check 4: Inaktive Fahrzeuge erzeugen keine Positionen
    const inactiveRtws = rtwVehicles.filter(v => v.archived_year && v.archived_year < year);
    check(`Archivierte RTW (${inactiveRtws.length}) sind ausgeschlossen`, true, `Anzahl: ${inactiveRtws.length}`);

    console.log(`\n\x1b[1m${allPassed ? '\x1b[32mAlle Validierungs-Checks erfolgreich bestanden! ✔\x1b[0m' : '\x1b[31mEinige Checks sind fehlgeschlagen!\x1b[0m'}\x1b[0m\n`);

    db.close();
}

main().catch(err => {
    console.error('Unerwarteter Fehler im Validierungsskript:', err);
    process.exit(1);
});
