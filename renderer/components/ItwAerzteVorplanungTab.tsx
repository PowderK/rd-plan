import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

interface Doctor {
    id: number;
    name: string;
    vorname: string;
    anrede?: string;
    title?: string;
    is_nef?: boolean | number;
    is_itw?: boolean | number;
}

interface RosterEntry {
    personId: number;
    personType: string;
    date: string;
    value: string;
    type: string;
}

interface ParsedImportRow {
    id: string;
    rawDate: string;
    rawName: string;
    parsedDate: string | null;
    matchedDoctorId: number;
    matchStatus: 'exact' | 'partial' | 'none' | 'invalid_date';
    matchReason?: string;
    isDutyDay: boolean;
    isWeekend: boolean;
    isHoliday: boolean;
}

const ItwAerzteVorplanungTab: React.FC = () => {
    const { currentUser, isDevMode } = useAuth();
    const isAppAdmin = isDevMode || currentUser?.roleName?.toLowerCase() === 'administrator';
    const canEditDoctorAssignments = isAppAdmin || currentUser?.permissions?.itw === 'write_all';

    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [month, setMonth] = useState<number>(new Date().getMonth());
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [doctorPeriods, setDoctorPeriods] = useState<Record<number, any[]>>({});
    const [roster, setRoster] = useState<RosterEntry[]>([]);
    const [holidays, setHolidays] = useState<string[]>([]);
    const [itwSeqs, setItwSeqs] = useState<{ startDate: string, pattern: string }[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Import Modal States
    const [showImportModal, setShowImportModal] = useState<boolean>(false);
    const [importText, setImportText] = useState<string>('');
    const [parsedImportRows, setParsedImportRows] = useState<ParsedImportRow[]>([]);
    const [overwriteExisting, setOverwriteExisting] = useState<boolean>(true);
    const [importing, setImporting] = useState<boolean>(false);

    const sortedItwSeqs = useMemo(() => {
        return [...itwSeqs].sort((a, b) => a.startDate.localeCompare(b.startDate));
    }, [itwSeqs]);

    const minYear = useMemo(() => {
        if (sortedItwSeqs.length === 0) return new Date().getFullYear();
        const y = Number(sortedItwSeqs[0].startDate.slice(0, 4));
        return Number.isNaN(y) ? new Date().getFullYear() : y;
    }, [sortedItwSeqs]);

    useEffect(() => {
        if (year < minYear) {
            setYear(minYear);
        }
    }, [minYear, year]);

    const isItwDoctor = (d: Doctor) => {
        return d.is_itw === 1 || d.is_itw === true || String(d.is_itw) === '1' || (d.is_itw === undefined && !d.is_nef);
    };

    const isDoctorActiveOnDate = (docId: number, dateStr: string) => {
        const periods = doctorPeriods[docId] || [];
        if (periods.length === 0) return true; // Keine Perioden definiert => dauerhaft verfügbar
        const dIso = dateStr.slice(0, 10);
        return periods.some(p => {
            const s = String(p.start_date || '').slice(0, 10);
            const e = String(p.end_date || '').slice(0, 10);
            return s <= dIso && e >= dIso;
        });
    };

    const itwDoctors = useMemo(() => {
        return doctors.filter(isItwDoctor);
    }, [doctors]);

    const formatDateString = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const daysInMonth = useMemo(() => {
        const days: Date[] = [];
        const date = new Date(year, month, 1);
        while (date.getMonth() === month) {
            days.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }
        return days;
    }, [year, month]);

    const loadData = async () => {
        setLoading(true);
        try {
            const seqs = await (window as any).api.getItwPatterns?.() || [];
            setItwSeqs(seqs);

            const docs = await (window as any).api.getItwDoctors?.() || [];
            setDoctors(docs);

            const docP = await (window as any).api.getAllDoctorPeriods?.() || [];
            const dpMap: Record<number, any[]> = {};
            (docP || []).forEach((p: any) => {
                if (!dpMap[p.doctor_id]) dpMap[p.doctor_id] = [];
                dpMap[p.doctor_id].push(p);
            });
            setDoctorPeriods(dpMap);

            const rosterData = await (window as any).api.getItwDutyRoster?.(year) || [];
            setRoster(rosterData);

            const hols = await (window as any).api.getHolidaysForYear?.(year) || [];
            setHolidays(hols.map((h: any) => h.date));
        } catch (e) {
            console.error('Fehler beim Laden der Ärzte-Vorplanung:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [year, month]);

    useEffect(() => {
        const handleUpdated = () => {
            loadData();
        };
        (window as any).api.onItwUpdated?.(handleUpdated);
        window.addEventListener('itw-patterns-updated', handleUpdated);
        window.addEventListener('itw-doctors-updated', handleUpdated);
        window.addEventListener('doctor-periods-updated', handleUpdated);
        return () => {
            (window as any).api.offItwUpdated?.(handleUpdated);
            window.removeEventListener('itw-patterns-updated', handleUpdated);
            window.removeEventListener('itw-doctors-updated', handleUpdated);
            window.removeEventListener('doctor-periods-updated', handleUpdated);
        };
    }, [year, month]);

    const handleDoctorSelect = async (dateStr: string, selectedDoctorId: number) => {
        try {
            // Clear existing doctor assigned on this date
            const existingDoctorsOnDate = roster.filter(r => r.personType === 'doctor' && r.date === dateStr);
            for (const entry of existingDoctorsOnDate) {
                await (window as any).api.setItwDutyRosterEntry?.({
                    personId: entry.personId,
                    personType: 'doctor',
                    date: dateStr,
                    value: '',
                    type: '',
                    manual_edit: 1
                });
            }

            // Assign new doctor if selected
            if (selectedDoctorId > 0) {
                await (window as any).api.setItwDutyRosterEntry?.({
                    personId: selectedDoctorId,
                    personType: 'doctor',
                    date: dateStr,
                    value: '1',
                    type: 'IW',
                    manual_edit: 1
                });
            }

            await loadData();
        } catch (e) {
            console.error('Fehler beim Speichern der Arzt-Zuordnung:', e);
        }
    };

    // --- Parser & Smart Matching für Copy & Paste Import ---
    const parseDateString = (input: string): string | null => {
        if (!input) return null;
        const trimmed = input.trim();

        // 1. Format: YYYY-MM-DD
        const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
        if (isoMatch) {
            const y = Number(isoMatch[1]);
            const m = Number(isoMatch[2]);
            const d = Number(isoMatch[3]);
            if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
                return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            }
        }

        // 2. Format: DD.MM.YYYY oder DD.MM.YY oder DD/MM/YYYY
        const deMatch = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
        if (deMatch) {
            const d = Number(deMatch[1]);
            const m = Number(deMatch[2]);
            let y = Number(deMatch[3]);
            if (y < 100) {
                y += 2000;
            }
            if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
                return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            }
        }

        return null;
    };

    const cleanDoctorName = (raw: string): string => {
        return raw
            .replace(/\b(prof\.|prof|dr\.|dr|med\.|med|pd\.|pd|herr|frau|oa\.|oa|oä\.|oä|ca\.|ca|cä\.|cä|fa\.|fa|fä\.|fä|mba|m\.sc\.|b\.sc\.)\b/gi, '')
            .replace(/[,\.\-\/\\_\(\)]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    };

    const matchDoctor = (rawName: string, doctorList: Doctor[]): { doctorId: number; status: 'exact' | 'partial' | 'none'; reason?: string } => {
        if (!rawName || rawName.trim().length === 0) {
            return { doctorId: 0, status: 'none', reason: 'Kein Name angegeben' };
        }

        const cleanedInput = cleanDoctorName(rawName).toLowerCase();
        const inputTokens = cleanedInput.split(/\s+/).filter(t => t.length > 0);

        if (inputTokens.length === 0) {
            return { doctorId: 0, status: 'none', reason: 'Kein Name nach Bereinigung' };
        }

        // 1. Exakte Übereinstimmung (Nachname oder "Nachname, Vorname" oder "Vorname Nachname")
        for (const doc of doctorList) {
            const docNachname = (doc.name || '').trim().toLowerCase();
            const docVorname = (doc.vorname || '').trim().toLowerCase();
            const full1 = `${docVorname} ${docNachname}`.trim();
            const full2 = `${docNachname} ${docVorname}`.trim();

            if (cleanedInput === docNachname || cleanedInput === full1 || cleanedInput === full2) {
                return { doctorId: doc.id, status: 'exact', reason: `Exakter Treffer: ${doc.name}, ${doc.vorname}` };
            }
        }

        // 2. Token-Matching: Nachname im Input enthalten
        const matchesWithScore: { doc: Doctor; score: number; reason: string }[] = [];

        for (const doc of doctorList) {
            const docNachname = (doc.name || '').trim().toLowerCase();
            const docVorname = (doc.vorname || '').trim().toLowerCase();
            let score = 0;
            let reason = '';

            // Prüfen ob Nachname als ganzes Wort im Input vorkommt
            if (docNachname.length > 2 && inputTokens.includes(docNachname)) {
                score += 50;
                reason = `Nachname "${doc.name}" gefunden`;

                // Prüfen ob Vorname auch vorkommt
                if (docVorname.length > 1 && inputTokens.includes(docVorname)) {
                    score += 40;
                    reason += ` + Vorname "${doc.vorname}"`;
                }
            } else if (docNachname.length > 2 && cleanedInput.includes(docNachname)) {
                score += 30;
                reason = `Nachname "${doc.name}" enthalten`;
            }

            // Bonus wenn ITW-Arzt
            if (score > 0 && (doc.is_itw === undefined || doc.is_itw === true || doc.is_itw === 1 || String(doc.is_itw) === '1')) {
                score += 5;
            }

            if (score > 0) {
                matchesWithScore.push({ doc, score, reason });
            }
        }

        if (matchesWithScore.length === 1 && matchesWithScore[0].score >= 30) {
            return { doctorId: matchesWithScore[0].doc.id, status: 'exact', reason: matchesWithScore[0].reason };
        }

        if (matchesWithScore.length > 1) {
            matchesWithScore.sort((a, b) => b.score - a.score);
            if (matchesWithScore[0].score > matchesWithScore[1].score + 10) {
                return { doctorId: matchesWithScore[0].doc.id, status: 'exact', reason: matchesWithScore[0].reason };
            }
            return {
                doctorId: matchesWithScore[0].doc.id,
                status: 'partial',
                reason: `Mehrere mögliche Treffer (Bester: ${matchesWithScore[0].doc.name})`
            };
        }

        return { doctorId: 0, status: 'none', reason: 'Kein passender Arzt gefunden' };
    };

    // Re-parse when import text or doctors change
    useEffect(() => {
        if (!importText.trim()) {
            setParsedImportRows([]);
            return;
        }

        const lines = importText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        const rows: ParsedImportRow[] = [];

        lines.forEach((line, index) => {
            // Split by Tab, Semicolon, or 2+ spaces
            let parts = line.split(/\t/);
            if (parts.length < 2) {
                parts = line.split(/;/);
            }
            if (parts.length < 2) {
                parts = line.split(/\s{2,}/);
            }
            if (parts.length < 2) {
                // Try comma if not in date
                const commaIdx = line.indexOf(',');
                if (commaIdx > 0 && !line.substring(0, commaIdx).includes('.')) {
                    parts = [line.substring(0, commaIdx), line.substring(commaIdx + 1)];
                } else {
                    // Try to extract leading date token
                    const match = line.match(/^(\S+)\s+(.+)$/);
                    if (match) {
                        parts = [match[1], match[2]];
                    } else {
                        parts = [line, ''];
                    }
                }
            }

            const rawDate = parts[0]?.trim() || '';
            const rawName = parts.slice(1).join(' ').trim();
            const parsedDate = parseDateString(rawDate);

            let isDutyDay = false;
            let isWeekend = false;
            let isHoliday = false;

            if (parsedDate) {
                const [y, m, d] = parsedDate.split('-').map(Number);
                const dt = new Date(y, m - 1, d);
                const dayNum = dt.getDay();
                isWeekend = dayNum === 0 || dayNum === 6;
                isHoliday = holidays.includes(parsedDate);
                isDutyDay = !isWeekend && !isHoliday;
            }

            let matchStatus: 'exact' | 'partial' | 'none' | 'invalid_date' = 'none';
            let matchedDoctorId = 0;
            let matchReason = '';

            if (!parsedDate) {
                matchStatus = 'invalid_date';
                matchReason = 'Ungültiges Datumsformat';
            } else {
                const matchRes = matchDoctor(rawName, itwDoctors);
                matchedDoctorId = matchRes.doctorId;
                matchStatus = matchRes.status;
                matchReason = matchRes.reason || '';
            }

            rows.push({
                id: `row-${index}-${rawDate}`,
                rawDate,
                rawName,
                parsedDate,
                matchedDoctorId,
                matchStatus,
                matchReason,
                isDutyDay,
                isWeekend,
                isHoliday
            });
        });

        setParsedImportRows(rows);
    }, [importText, itwDoctors, holidays]);

    const handleExecuteImport = async () => {
        try {
            setImporting(true);
            const validRows = parsedImportRows.filter(r => r.parsedDate && r.matchedDoctorId > 0);
            if (validRows.length === 0) {
                alert('Keine gültigen Zuordnungen zum Importieren gefunden. Bitte überprüfen Sie die importierten Zeilen.');
                return;
            }

            for (const row of validRows) {
                if (!row.parsedDate) continue;

                if (overwriteExisting) {
                    // Clear existing doctors on this date if different
                    const existingDoctorsOnDate = roster.filter(r => r.personType === 'doctor' && r.date === row.parsedDate);
                    for (const entry of existingDoctorsOnDate) {
                        if (entry.personId !== row.matchedDoctorId) {
                            await (window as any).api.setItwDutyRosterEntry?.({
                                personId: entry.personId,
                                personType: 'doctor',
                                date: row.parsedDate,
                                value: '',
                                type: '',
                                manual_edit: 1
                            });
                        }
                    }
                }

                await (window as any).api.setItwDutyRosterEntry?.({
                    personId: row.matchedDoctorId,
                    personType: 'doctor',
                    date: row.parsedDate,
                    value: '1',
                    type: 'IW',
                    manual_edit: 1
                });
            }

            await loadData();
            setShowImportModal(false);
            setImportText('');
            setParsedImportRows([]);
            alert(`Import erfolgreich abgeschlossen: ${validRows.length} Arzt-Dienste wurden eingetragen!`);
        } catch (e: any) {
            console.error('Fehler beim Ausführen des Imports:', e);
            alert('Fehler beim Importieren: ' + (e?.message || String(e)));
        } finally {
            setImporting(false);
        }
    };

    const handlePasteFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                setImportText(text);
            } else {
                alert('Die Zwischenablage ist leer.');
            }
        } catch (e) {
            console.warn('Clipboard API nicht verfügbar, bitte manuell mit Strg+V einfügen.', e);
        }
    };

    // Calculate monthly stats
    const stats = useMemo(() => {
        let totalDutyDays = 0;
        let assignedDays = 0;

        for (const d of daysInMonth) {
            const dateStr = formatDateString(d);
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const isHoliday = holidays.includes(dateStr);
            const isDutyDay = !isWeekend && !isHoliday;

            if (isDutyDay) {
                totalDutyDays++;
                const assigned = roster.some(r => r.personType === 'doctor' && r.date === dateStr && r.type === 'IW');
                if (assigned) assignedDays++;
            }
        }

        return {
            totalDutyDays,
            assignedDays
        };
    }, [daysInMonth, roster, holidays]);

    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1100px', margin: '0 auto' }}>
            {/* Header mit Jahr & Titel & Import Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <h2 style={{ margin: 0, color: '#1e293b', fontSize: '20px' }}>ITW Ärzte Vorplanung</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {canEditDoctorAssignments && (
                        <button
                            onClick={() => setShowImportModal(true)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 16px',
                                background: '#16a34a',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                fontWeight: 600,
                                fontSize: '14px',
                                cursor: 'pointer',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                                transition: 'all 0.15s ease'
                            }}
                            title="Tabelle mit Datum und Name aus der Zwischenablage einfügen"
                        >
                            📋 Dienste importieren
                        </button>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            onClick={() => setYear(prev => Math.max(minYear, prev - 1))}
                            disabled={year <= minYear}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                background: year <= minYear ? '#f1f5f9' : '#fff',
                                color: year <= minYear ? '#94a3b8' : '#1e293b',
                                fontWeight: 'bold',
                                cursor: year <= minYear ? 'not-allowed' : 'pointer',
                                fontSize: '14px'
                            }}
                            title="Vorheriges Jahr"
                        >
                            &lt;
                        </button>
                        <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#1e293b', minWidth: '50px', textAlign: 'center' }}>
                            {year}
                        </span>
                        <button
                            onClick={() => setYear(prev => prev + 1)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                background: '#fff',
                                color: '#1e293b',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                            title="Nächstes Jahr"
                        >
                            &gt;
                        </button>
                    </div>
                </div>
            </div>

            {/* Monate-Tabs Navigation */}
            <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #cbd5e1', marginBottom: '20px', overflowX: 'auto' }}>
                {monthNames.map((name, idx) => (
                    <button
                        key={name}
                        onClick={() => setMonth(idx)}
                        style={{
                            padding: '8px 16px',
                            background: month === idx ? '#007bff' : '#f1f5f9',
                            color: month === idx ? '#fff' : '#475569',
                            border: 'none',
                            borderTopLeftRadius: '6px',
                            borderTopRightRadius: '6px',
                            fontWeight: month === idx ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            fontSize: '14px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {name}
                    </button>
                ))}
            </div>

            {/* Statistik-Leiste (Ärzte zugeteilt - Dynamische Farben) */}
            {(() => {
                const isAllAssigned = stats.totalDutyDays > 0 && stats.assignedDays >= stats.totalDutyDays;
                return (
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
                        <div style={{
                            background: isAllAssigned ? '#f0fdf4' : '#fef2f2',
                            border: isAllAssigned ? '1px solid #bbf7d0' : '1px solid #fecaca',
                            borderRadius: '8px',
                            padding: '12px 18px',
                            flex: 1,
                            minWidth: '180px',
                            transition: 'all 0.2s ease'
                        }}>
                            <div style={{ fontSize: '12px', color: isAllAssigned ? '#15803d' : '#b91c1c', fontWeight: 600 }}>
                                Ärzte zugeteilt {isAllAssigned ? '✓ (Vollständig)' : '⚠ (Fehlt was)'}
                            </div>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: isAllAssigned ? '#166534' : '#991b1b' }}>
                                {stats.assignedDays} / {stats.totalDutyDays} Tage
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Vorplanung Tabelle */}
            {loading ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Lade Ärzte-Vorplanung...</div>
            ) : (
                <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                                <th style={{ padding: '10px 16px', width: '120px' }}>Datum</th>
                                <th style={{ padding: '10px 16px', width: '120px' }}>Wochentag</th>
                                <th style={{ padding: '10px 16px', width: '180px' }}>Dienst-Status</th>
                                <th style={{ padding: '10px 16px' }}>Zugeordneter ITW-Arzt</th>
                            </tr>
                        </thead>
                        <tbody>
                            {daysInMonth.map(d => {
                                const dateStr = formatDateString(d);
                                const dayNum = d.getDay();
                                const isWeekend = dayNum === 0 || dayNum === 6;
                                const isHoliday = holidays.includes(dateStr);
                                const isDutyDay = !isWeekend && !isHoliday;

                                const currentDoctorEntry = roster.find(r => r.personType === 'doctor' && r.date === dateStr && r.type === 'IW');
                                const currentDoctorId = currentDoctorEntry ? currentDoctorEntry.personId : 0;

                                let rowBg = '#ffffff';
                                if (isWeekend || isHoliday) {
                                    rowBg = '#f8fafc';
                                } else if (currentDoctorId > 0) {
                                    rowBg = '#f0fdf4';
                                } else {
                                    rowBg = '#fef2f2';
                                }

                                return (
                                    <tr 
                                        key={dateStr}
                                        style={{ 
                                            background: rowBg, 
                                            borderBottom: '1px solid #f1f5f9',
                                            transition: 'background-color 0.15s ease'
                                        }}
                                    >
                                        <td style={{ padding: '10px 16px', fontWeight: 500, color: '#1e293b' }}>
                                            {d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </td>
                                        <td style={{ padding: '10px 16px', color: isWeekend ? '#94a3b8' : '#475569' }}>
                                            {dayNames[dayNum]}
                                        </td>
                                        <td style={{ padding: '10px 16px' }}>
                                            {isWeekend ? (
                                                <span style={{ background: '#e2e8f0', color: '#64748b', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500 }}>
                                                    Wochenende
                                                </span>
                                            ) : isHoliday ? (
                                                <span style={{ background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500 }}>
                                                    Feiertag
                                                </span>
                                            ) : (
                                                <span style={{ background: currentDoctorId > 0 ? '#dcfce7' : '#fee2e2', color: currentDoctorId > 0 ? '#15803d' : '#991b1b', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                                                    ITW-Dienst
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '10px 16px' }}>
                                            {!isDutyDay ? (
                                                <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' }}>Kein ITW-Dienst</span>
                                            ) : (
                                                <select
                                                    value={currentDoctorId}
                                                    disabled={!canEditDoctorAssignments}
                                                    onChange={(e) => handleDoctorSelect(dateStr, Number(e.target.value))}
                                                    style={{
                                                        width: '100%',
                                                        maxWidth: '320px',
                                                        padding: '8px 12px',
                                                        borderRadius: '6px',
                                                        border: currentDoctorId > 0 ? '1.5px solid #22c55e' : '1.5px solid #ef4444',
                                                        backgroundColor: !canEditDoctorAssignments ? '#f1f5f9' : (currentDoctorId > 0 ? '#ffffff' : '#fef2f2'),
                                                        color: currentDoctorId > 0 ? '#0f172a' : '#991b1b',
                                                        fontWeight: currentDoctorId > 0 ? 600 : 400,
                                                        fontSize: '14px',
                                                        cursor: canEditDoctorAssignments ? 'pointer' : 'not-allowed'
                                                    }}
                                                >
                                                    <option value={0}>-- Kein Arzt eingeteilt --</option>
                                                    {doctors
                                                        .filter(doc => {
                                                            if (!isItwDoctor(doc)) return false;
                                                            if (doc.id === currentDoctorId) return true;
                                                            return isDoctorActiveOnDate(doc.id, dateStr);
                                                        })
                                                        .map(doc => {
                                                            const parts = [];
                                                            if (doc.anrede) parts.push(doc.anrede);
                                                            if (doc.title) parts.push(doc.title);
                                                            parts.push(`${doc.name}, ${doc.vorname}`);
                                                            const label = parts.join(' ');
                                                            return (
                                                                <option key={doc.id} value={doc.id}>
                                                                    {label}
                                                                </option>
                                                            );
                                                        })}
                                                </select>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* --- Modal für Copy & Paste Import --- */}
            {showImportModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 2000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '12px',
                        width: '100%',
                        maxWidth: '900px',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                        overflow: 'hidden'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '16px 24px',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: '#f8fafc'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '20px' }}>📋</span>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                                    ITW-Ärzte Dienste importieren (Copy & Paste)
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowImportModal(false)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    fontSize: '20px',
                                    color: '#64748b',
                                    cursor: 'pointer',
                                    padding: '4px 8px',
                                    borderRadius: '4px'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Anleitung */}
                            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#1e3a8a', lineHeight: 1.5 }}>
                                <div style={{ fontWeight: 700, marginBottom: '4px' }}>💡 Anleitung zum Import:</div>
                                Kopieren Sie 2 Spalten (<strong>Datum</strong> und <strong>Name</strong>) z. B. aus Excel oder einer Tabelle und fügen Sie diese in das nachfolgende Textfeld ein.<br />
                                Der Namensabgleich erfolgt automatisch mit der Ärzteliste. Formate wie <em>„01.03.2026 Dr. Mustermann“</em> oder <em>„2026-03-01 Mustermann, Max“</em> werden erkannt.
                            </div>

                            {/* Textarea für Copy-Paste */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <label style={{ fontWeight: 600, fontSize: '14px', color: '#334155' }}>
                                        Kopierte Tabellendaten hier einfügen:
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handlePasteFromClipboard}
                                        style={{
                                            padding: '4px 10px',
                                            fontSize: '12px',
                                            background: '#f1f5f9',
                                            color: '#334155',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Aus Zwischenablage einfügen
                                    </button>
                                </div>
                                <textarea
                                    value={importText}
                                    onChange={(e) => setImportText(e.target.value)}
                                    placeholder={'Beispiel:\n01.03.2026\tDr. Müller\n02.03.2026\tSchmidt, Anna\n03.03.2026\tMeier'}
                                    rows={5}
                                    style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        padding: '10px 12px',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        fontFamily: 'monospace',
                                        fontSize: '13px',
                                        lineHeight: 1.4,
                                        resize: 'vertical'
                                    }}
                                />
                            </div>

                            {/* Optionen */}
                            <div style={{ display: 'flex', gap: '24px', alignItems: 'center', padding: '8px 0' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#334155' }}>
                                    <input
                                        type="checkbox"
                                        checked={overwriteExisting}
                                        onChange={(e) => setOverwriteExisting(e.target.checked)}
                                        style={{ accentColor: '#16a34a' }}
                                    />
                                    <span>Bestehende ITW-Arzt-Dienste an den importierten Tagen überschreiben</span>
                                </label>
                            </div>

                            {/* Vorschau-Tabelle */}
                            {parsedImportRows.length > 0 && (
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>
                                            Vorschau & Namensabgleich ({parsedImportRows.filter(r => r.matchedDoctorId > 0).length} von {parsedImportRows.length} Zeilen zugeordnet):
                                        </div>
                                    </div>
                                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', maxHeight: '280px', overflowY: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                            <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', zIndex: 1 }}>
                                                <tr>
                                                    <th style={{ padding: '8px 12px', textAlign: 'left', width: '40px' }}>#</th>
                                                    <th style={{ padding: '8px 12px', textAlign: 'left', width: '130px' }}>Datum</th>
                                                    <th style={{ padding: '8px 12px', textAlign: 'left', width: '160px' }}>Gepaster Name</th>
                                                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Zugeordneter Arzt</th>
                                                    <th style={{ padding: '8px 12px', textAlign: 'left', width: '140px' }}>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {parsedImportRows.map((row, idx) => {
                                                    const isMatched = row.matchedDoctorId > 0;
                                                    let rowBg = idx % 2 === 0 ? '#ffffff' : '#fbfcfd';
                                                    if (row.matchStatus === 'none' || row.matchStatus === 'invalid_date') {
                                                        rowBg = '#fff1f2';
                                                    } else if (row.matchStatus === 'partial') {
                                                        rowBg = '#fffbeb';
                                                    }

                                                    return (
                                                        <tr key={row.id} style={{ background: rowBg, borderBottom: '1px solid #f1f5f9' }}>
                                                            <td style={{ padding: '8px 12px', color: '#94a3b8', fontSize: '12px' }}>
                                                                {idx + 1}
                                                            </td>
                                                            <td style={{ padding: '8px 12px', fontWeight: 600, color: row.parsedDate ? '#1e293b' : '#e11d48' }}>
                                                                {row.parsedDate ? (
                                                                    <span>
                                                                        {new Date(row.parsedDate + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                                    </span>
                                                                ) : (
                                                                    <span>{row.rawDate || '–'}</span>
                                                                )}
                                                            </td>
                                                            <td style={{ padding: '8px 12px', color: '#475569' }}>
                                                                {row.rawName || '–'}
                                                            </td>
                                                            <td style={{ padding: '8px 12px' }}>
                                                                <select
                                                                    value={row.matchedDoctorId}
                                                                    onChange={(e) => {
                                                                        const selectedId = Number(e.target.value);
                                                                        setParsedImportRows(prev => prev.map((r, i) => {
                                                                            if (i === idx) {
                                                                                return {
                                                                                    ...r,
                                                                                    matchedDoctorId: selectedId,
                                                                                    matchStatus: selectedId > 0 ? 'exact' : 'none',
                                                                                    matchReason: selectedId > 0 ? 'Manuell ausgewählt' : 'Kein Arzt ausgewählt'
                                                                                };
                                                                            }
                                                                            return r;
                                                                        }));
                                                                    }}
                                                                    style={{
                                                                        width: '100%',
                                                                        padding: '6px 8px',
                                                                        borderRadius: '4px',
                                                                        border: isMatched ? '1px solid #86efac' : '1px solid #fca5a5',
                                                                        background: isMatched ? '#ffffff' : '#fff1f2',
                                                                        fontSize: '12px',
                                                                        fontWeight: isMatched ? 600 : 400
                                                                    }}
                                                                >
                                                                    <option value={0}>-- Kein Arzt --</option>
                                                                    {itwDoctors.map(doc => {
                                                                        const parts = [];
                                                                        if (doc.anrede) parts.push(doc.anrede);
                                                                        if (doc.title) parts.push(doc.title);
                                                                        parts.push(`${doc.name}, ${doc.vorname}`);
                                                                        return (
                                                                            <option key={doc.id} value={doc.id}>
                                                                                {parts.join(' ')}
                                                                            </option>
                                                                        );
                                                                    })}
                                                                </select>
                                                            </td>
                                                            <td style={{ padding: '8px 12px' }}>
                                                                {row.matchStatus === 'invalid_date' ? (
                                                                    <span style={{ color: '#e11d48', fontSize: '11px', fontWeight: 600 }}>❌ Ungült. Datum</span>
                                                                ) : row.matchedDoctorId > 0 && (row.isWeekend || row.isHoliday) ? (
                                                                    <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                                                        ⚠️ {row.isWeekend ? 'Wochenende' : 'Feiertag'}
                                                                    </span>
                                                                ) : row.matchStatus === 'exact' && row.matchedDoctorId > 0 ? (
                                                                    <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                                                        ✅ Zugeordnet
                                                                    </span>
                                                                ) : row.matchStatus === 'partial' && row.matchedDoctorId > 0 ? (
                                                                    <span style={{ background: '#fef9c3', color: '#a16207', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                                                        🟡 Prüfen
                                                                    </span>
                                                                ) : (
                                                                    <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                                                        ❌ Nicht gefunden
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            padding: '16px 24px',
                            borderTop: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: '#f8fafc'
                        }}>
                            <div style={{ fontSize: '13px', color: '#64748b' }}>
                                {parsedImportRows.filter(r => r.matchedDoctorId > 0).length > 0 && (
                                    <span>
                                        <strong>{parsedImportRows.filter(r => r.matchedDoctorId > 0).length}</strong> Dienst(e) bereit zum Eintragen
                                    </span>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={() => setShowImportModal(false)}
                                    disabled={importing}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '6px',
                                        border: '1px solid #cbd5e1',
                                        background: '#ffffff',
                                        color: '#334155',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 500
                                    }}
                                >
                                    Abbrechen
                                </button>
                                <button
                                    onClick={handleExecuteImport}
                                    disabled={importing || parsedImportRows.filter(r => r.matchedDoctorId > 0).length === 0}
                                    style={{
                                        padding: '8px 20px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: parsedImportRows.filter(r => r.matchedDoctorId > 0).length > 0 ? '#16a34a' : '#94a3b8',
                                        color: '#ffffff',
                                        cursor: (importing || parsedImportRows.filter(r => r.matchedDoctorId > 0).length === 0) ? 'not-allowed' : 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
                                    }}
                                >
                                    {importing ? 'Importiere...' : `Dienste importieren (${parsedImportRows.filter(r => r.matchedDoctorId > 0).length})`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ItwAerzteVorplanungTab;
