import React from 'react';
import styles from './MonthTabs.module.css';

// Grid-Layout-Konstanten
const GRID_CONFIG = {
  columns: 'minmax(80px, auto) 55px 20px 20px 40px 72px',
  gap: 8,
  marginBottom: 6,
};

const WAAGE_CONFIG = {
  width: 48,
  height: 8,
  gap: 3,
};

interface KontrollkastenItem {
  key: string;
  name: string;
  target: number | string;
  count: number;
  cumDiff: number;
  nef: number;
  itw: number;
  weekend?: number;
  total: number;
  tag?: number;
  nacht?: number;
  rest: number;
  ue50?: boolean;
  lpal?: boolean;
  hlfb?: boolean;
  teilzeit?: number;
  presenceRemainingByPerson?: number;
  oldRtwShifts?: number;
  hasTransfer?: boolean;
  isItwExternal?: boolean;
}

interface KontrollkastenProps {
  items: KontrollkastenItem[];
  highlightedPersonKey: string | null;
  setHighlightedPersonKey: (key: string | null) => void;
  mixColor: (t: number) => { r: number; g: number; b: number };
  minNR: number;
  maxNR: number;
  presenceRemainingByPerson: Record<string, number>;
  assignedRemainingByPerson: Record<string, number>;
  renderPresenceMeter: (value: number, height: number) => JSX.Element;
  showOldRtwShifts?: boolean;
  showWeekendShifts?: boolean;
  showItw?: boolean;
  availablePersonKeys?: Set<string>;
}

export const Kontrollkasten: React.FC<KontrollkastenProps> = ({
  items,
  highlightedPersonKey,
  setHighlightedPersonKey,
  mixColor,
  minNR,
  maxNR,
  presenceRemainingByPerson,
  assignedRemainingByPerson,
  renderPresenceMeter,
  showOldRtwShifts = false,
  showWeekendShifts = false,
  showItw = true,
  availablePersonKeys,
}) => {
  // Dynamisches Grid-Layout
  const wCol = showWeekendShifts ? '22px ' : '';
  const altCol = showOldRtwShifts ? '24px ' : '';
  const itwCol = showItw ? '20px ' : '';
  const columns = `max-content 55px 20px ${itwCol}${wCol}${altCol}40px 72px`;

  const { minWeekend, maxWeekend } = React.useMemo(() => {
    if (!showWeekendShifts) return { minWeekend: 0, maxWeekend: 0 };
    const eligible = items.filter(it => typeof it.weekend === 'number' && !it.ue50 && !it.lpal && !it.hlfb);
    const minW = eligible.length ? Math.min(...eligible.map(it => it.weekend!)) : 0;
    const maxW = eligible.length ? Math.max(...eligible.map(it => it.weekend!)) : 0;
    return { minWeekend: minW, maxWeekend: maxW };
  }, [items, showWeekendShifts]);

  return (
    <div className={styles.sidebarList} style={{
      display: 'grid',
      gridTemplateColumns: columns,
      alignItems: 'center',
      columnGap: GRID_CONFIG.gap,
      rowGap: GRID_CONFIG.marginBottom,
    }}>
      {/* Header-Zeile */}
      <div style={{ display: 'contents' }}>
        <span 
          style={{ textAlign: 'right', paddingRight: 4, fontWeight: 600, fontSize: 10, color: '#374151', paddingBottom: 1, borderBottom: '1px solid var(--line)', cursor: 'help' }}
          title="Mitarbeitername. Klick auf den Namen hebt die Person und ihre Dienste in der Einteilung hervor."
        >
          Name
        </span>
        <span 
          style={{ textAlign: 'center', paddingRight: 4, fontWeight: 600, fontSize: 10, color: '#374151', paddingBottom: 1, borderBottom: '1px solid var(--line)', cursor: 'help' }}
          title="Soll | Ist: Berechnetes Schichtsoll im Monat vs. tatsächlich eingeteilte Schichten. Die Mini-Waage darunter zeigt den kumulierten Jahrestrend (Rot nach links = im Rückstand, Grün nach rechts = im Vorsprung)."
        >
          Soll | Ist
        </span>
        <span 
          style={{ textAlign: 'center', paddingRight: 4, fontWeight: 600, fontSize: 10, color: '#374151', paddingBottom: 1, borderBottom: '1px solid var(--line)', cursor: 'help' }}
          title="NEF: Gesamtzahl der eingeteilten NEF-Schichten im Jahr."
        >
          NEF
        </span>
        {showItw && (
          <span 
            style={{ textAlign: 'center', paddingRight: 4, fontWeight: 600, fontSize: 10, color: '#374151', paddingBottom: 1, borderBottom: '1px solid var(--line)', cursor: 'help' }}
            title="ITW: Anzahl der eingeteilten ITW-Schichten im aktuellen Monat."
          >
            ITW
          </span>
        )}
        {showWeekendShifts && (
          <span 
            style={{ textAlign: 'center', paddingRight: 4, fontSize: 9, fontWeight: 600, color: '#374151', paddingBottom: 1, borderBottom: '1px solid var(--line)', cursor: 'help' }}
            title="WE: Geleistete Wochenendschichten im Vergleich zur Abteilung (Grün = überdurchschnittlich viele, Rot = unterdurchschnittlich viele)."
          >
            WE
          </span>
        )}
        {showOldRtwShifts && (
          <span 
            style={{ textAlign: 'center', paddingRight: 4, fontSize: 9, fontWeight: 600, color: '#374151', paddingBottom: 1, borderBottom: '1px solid var(--line)', cursor: 'help' }}
            title="Alt: Historische/alte RTW-Schichten."
          >
            Alt
          </span>
        )}
        <span 
          style={{ textAlign: 'center', paddingRight: 4, fontWeight: 600, fontSize: 10, color: '#374151', paddingBottom: 1, borderBottom: '1px solid var(--line)', cursor: 'help' }}
          title="Ges. (Jahressaldo): Differenz zwischen geleisteten Ist-Schichten und Soll-Schichten im Jahr (Gesamt). Negativ = noch Schichten offen, Positiv = Jahressoll übererfüllt. Ampelfarbe: Grün = guter Puffer, Gelb = mittlerer Bereich, Rot = kritisch. Bei Ü50/LPAL ohne Restwert."
        >
          Ges.
        </span>
        <span 
          style={{ textAlign: 'center', fontWeight: 600, fontSize: 10, color: '#374151', paddingBottom: 1, borderBottom: '1px solid var(--line)', cursor: 'help' }}
          title="T/N | Rest: Oben: Tag/Nacht-Verhältnis (Rot links = Tag-Überhang, Blau rechts = Nacht-Überhang). Unten: Restkapazität (Rest V) im Vergleich zum offenen Jahresbedarf (Grün = ausreichend Luft, Gelb = eng, Rot = kritisch)."
        >
          T/N | Rest
        </span>
      </div>

      {/* Items */}
      {
        items.map((it, idx) => {
          const isEligible = typeof it.target === 'number' && (it.target as number) > 0;
          let restStyle: React.CSSProperties | undefined = undefined;
          if (isEligible && maxNR > minNR) {
            const fte = Math.max(0.01, (it.teilzeit || 100) / 100);
            const normRest = it.rest / fte;
            const t = (normRest - minNR) / (maxNR - minNR);
            const col = mixColor(t);
            const bg = `rgba(${col.r}, ${col.g}, ${col.b}, 0.18)`;
            const border = `1px solid rgba(${col.r}, ${col.g}, ${col.b}, 0.35)`;
            restStyle = { background: bg, borderRadius: 4, border, padding: '2px 6px' };
          }

          let weekendColor: string | undefined = undefined;
          if (showWeekendShifts && typeof it.weekend === 'number' && !it.ue50 && !it.lpal && !it.hlfb) {
            if (maxWeekend > minWeekend) {
              // INVERTED: 1 = max (Grün), 0 = min (Rot)
              const tW = (it.weekend - minWeekend) / (maxWeekend - minWeekend);
              const colW = mixColor(tW);
              weekendColor = `rgb(${colW.r}, ${colW.g}, ${colW.b})`;
            } else {
              const colW = mixColor(0.5);
              weekendColor = `rgb(${colW.r}, ${colW.g}, ${colW.b})`;
            }
          }

          const personMetaDetails = [
            it.teilzeit && it.teilzeit < 100 ? `${it.teilzeit}% Teilzeit` : null,
            it.ue50 ? 'Ü50' : null,
            it.lpal ? 'LPAL' : null,
            it.hlfb ? 'HLF-B' : null,
            it.isItwExternal ? 'ITW Extern' : null,
          ].filter(Boolean).join(' • ');

          const personTooltip = `${it.name}${personMetaDetails ? ` (${personMetaDetails})` : ''} — Klicken zum Hervorheben in der Einteilung`;

          const trendDiffText = it.cumDiff > 0 
            ? `${it.cumDiff} Schicht(en) im Rückstand (Rot)` 
            : it.cumDiff < 0 
              ? `${Math.abs(it.cumDiff)} Schicht(en) im Vorsprung (Grün)` 
              : 'Genau im Plan (Soll = Ist)';

          const sollIstTooltip = `${it.name}: ${it.target === '' ? 0 : it.target} Soll | ${it.count} Ist im Monat${it.hasTransfer ? ' (inkl. Schichtübernahme)' : ''} — Jahrestrend: ${trendDiffText}`;

          return (
            <React.Fragment key={idx}>
              <div
                className={styles.sidebarItem}
                style={{ display: 'contents' }}
              >
                {/* Name */}
                <span
                  className={styles.sidebarName}
                  onClick={() => setHighlightedPersonKey(highlightedPersonKey === it.key ? null : it.key)}
                  title={personTooltip}
                  style={{
                    color: it.lpal ? '#fd7e14' : it.ue50 ? '#dc3545' : it.hlfb ? '#1565c0' : (it.isItwExternal ? '#6b7280' : undefined),
                    cursor: 'pointer',
                    fontWeight: highlightedPersonKey === it.key ? 700 : undefined,
                    backgroundColor: availablePersonKeys?.has(it.key) ? (it.isItwExternal ? '#f3f4f6' : '#e8f5e9') : (it.isItwExternal ? '#f9fafb' : undefined),
                    fontStyle: it.isItwExternal ? 'italic' : undefined,
                    textDecoration: highlightedPersonKey === it.key ? 'underline' : undefined,
                    whiteSpace: 'nowrap',
                    textAlign: 'right',
                    borderRight: '1px solid var(--line)',
                    paddingRight: 4,
                  }}
                >
                  {it.name}
                </span>

                {/* Soll/Ist mit Waage */}
                <div 
                  title={sollIstTooltip}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, borderRight: '1px solid var(--line)', paddingRight: 4, cursor: 'help' }}
                >
                  <span className={styles.sidebarVal} style={{ fontSize: 11, color: it.hasTransfer ? '#3b82f6' : undefined, fontWeight: it.hasTransfer ? 600 : undefined }}>
                    {(it.target === '' ? '–' : it.target) + ' | ' + it.count}
                  </span>
                  {renderPresenceMeter(it.cumDiff, 5)}
                </div>

                {/* NEF */}
                <span 
                  className={styles.sidebarVal} 
                  title={`${it.name}: ${it.nef} NEF-Schicht(en) im Jahr (Gesamt)`}
                  style={{ textAlign: 'center', fontSize: 11, borderRight: '1px solid var(--line)', paddingRight: 4, cursor: 'help' }}
                >
                  {it.nef}
                </span>

                {showItw && (
                  <span 
                    className={styles.sidebarVal} 
                    title={`${it.name}: ${it.itw} ITW-Schicht(en) in diesem Monat`}
                    style={{ textAlign: 'center', fontSize: 11, borderRight: '1px solid var(--line)', paddingRight: 4, cursor: 'help' }}
                  >
                    {it.itw}
                  </span>
                )}

                {/* WE */}
                {showWeekendShifts && (
                  <span 
                    className={styles.sidebarVal} 
                    title={`${it.name}: ${typeof it.weekend === 'number' ? it.weekend : 0} Wochenendschicht(en)`}
                    style={{ textAlign: 'center', fontSize: 11, borderRight: '1px solid var(--line)', paddingRight: 4, color: weekendColor, fontWeight: weekendColor ? 600 : undefined, cursor: 'help' }}
                  >
                    {typeof it.weekend === 'number' ? it.weekend : '–'}
                  </span>
                )}

                {/* Alte RTW-Schichten */}
                {showOldRtwShifts && (
                  <span 
                    className={styles.sidebarVal} 
                    title={`${it.name}: ${it.oldRtwShifts || 0} alte RTW-Schichten`}
                    style={{ textAlign: 'center', fontSize: 11, borderRight: '1px solid var(--line)', paddingRight: 4, color: '#666', cursor: 'help' }}
                  >
                    {it.oldRtwShifts || 0}
                  </span>
                )}

                {/* Gesamt */}
                {!it.ue50 && !it.lpal && (
                  <span 
                    className={styles.sidebarVal} 
                    title={
                      typeof it.rest === 'number' && it.rest < 0
                        ? `${it.name} Jahressaldo (Gesamt): ${it.rest} Schichten (noch ${Math.abs(it.rest)} Schichten bis zum Jahresziel)`
                        : `${it.name} Jahressaldo (Gesamt): +${it.rest || 0} Schichten (Jahresziel erreicht/übererfüllt)`
                    }
                    style={{ ...restStyle, textAlign: 'center', fontSize: 11, borderRight: '1px solid var(--line)', paddingRight: 4, cursor: 'help' }}
                  >
                    {Number.isFinite(it.rest) ? it.rest : '–'}
                  </span>
                )}
                {(it.ue50 || it.lpal) && (
                  <span 
                    className={styles.sidebarVal} 
                    title={`${it.name}: Kein fester Jahresrest (Sonderstatus ${it.ue50 ? 'Ü50' : 'LPAL'})`}
                    style={{ textAlign: 'center', fontSize: 11, borderRight: '1px solid var(--line)', paddingRight: 4, cursor: 'help' }}
                  >
                    –
                  </span>
                )}

                {/* Tag/Nacht Waage und Rest V untereinander */}
                {!it.ue50 && !it.lpal && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: WAAGE_CONFIG.gap, alignItems: 'center' }}>
                    {/* Tag/Nacht Waage */}
                    {(() => {
                      const tagCount = it.tag || 0;
                      const nachtCount = it.nacht || 0;
                      const diff = tagCount - nachtCount;
                      const tnDiffText = diff > 0 
                        ? `${diff} mehr Tag-Schicht(en)` 
                        : diff < 0 
                          ? `${Math.abs(diff)} mehr Nacht-Schicht(en)` 
                          : 'ausgeglichen';
                      const tnTooltip = `${it.name} Tag/Nacht-Verhältnis: ${tagCount} Tag / ${nachtCount} Nacht (${tnDiffText})`;

                      return (
                        <div
                          title={tnTooltip}
                          style={{
                            position: 'relative',
                            width: WAAGE_CONFIG.width,
                            height: WAAGE_CONFIG.height,
                            background: '#eef2f7',
                            borderRadius: 3,
                            cursor: 'help',
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              left: '50%',
                              top: 0,
                              bottom: 0,
                              width: 1,
                              background: '#cbd5e1',
                              zIndex: 1,
                            }}
                          />
                          {(() => {
                            if (diff === 0 && tagCount === 0 && nachtCount === 0) return null;

                            const maxVal = 5;
                            const percentage = Math.min(1, Math.abs(diff) / maxVal);
                            const width = percentage * 50;

                            return (
                              <>
                                {/* Wenn mehr Tag-Schichten: Balken nach links (rot) */}
                                {diff > 0 && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      right: '50%',
                                      width: `${width}%`,
                                      top: 0,
                                      bottom: 0,
                                      background: '#ef4444',
                                      borderTopLeftRadius: 3,
                                      borderBottomLeftRadius: 3,
                                    }}
                                  />
                                )}
                                {/* Wenn mehr Nacht-Schichten: Balken nach rechts (blau) */}
                                {diff < 0 && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      left: '50%',
                                      width: `${width}%`,
                                      top: 0,
                                      bottom: 0,
                                      background: '#3b82f6',
                                      borderTopRightRadius: 3,
                                      borderBottomRightRadius: 3,
                                    }}
                                  />
                                )}
                              </>
                            );
                          })()}
                        </div>
                      );
                    })()}

                    {/* Rest V Balken */}
                    {(() => {
                      const pres = presenceRemainingByPerson[it.key] || 0;
                      const assigned = assignedRemainingByPerson[it.key] || 0;
                      const remain = Math.max(0, pres - assigned);
                      const needed = typeof it.rest === 'number' && it.rest < 0 ? Math.abs(it.rest) : 0;
                      const distance = remain - needed;

                      const yellowThreshold = 10;
                      const redThreshold = 5;
                      const widthStartDistance = 15;

                      let barColor = '#34c759';
                      if (distance <= redThreshold) {
                        barColor = '#ef4444';
                      } else if (distance <= yellowThreshold) {
                        barColor = '#f59e0b';
                      }

                      const widthFraction = needed <= 0
                        ? 1
                        : Math.max(0, Math.min(1, distance / widthStartDistance));

                      const restVTooltip = needed <= 0
                        ? `${it.name} Restkapazität (Rest V): ${remain} freie Schichten im Restjahr verfügbar (Jahressoll bereits erfüllt / Gesamt: ${typeof it.rest === 'number' && it.rest >= 0 ? `+${it.rest}` : it.rest}, Puffer: +${remain} Schichten)`
                        : `${it.name} Restkapazität (Rest V): ${remain} freie Schichten im Restjahr verfügbar vs. ${needed} noch benötigte Schichten (Gesamt: ${it.rest}, Puffer: ${distance >= 0 ? `+${distance}` : distance} Schichten)`;

                      return (
                        <div
                          title={restVTooltip}
                          style={{
                            position: 'relative',
                            width: WAAGE_CONFIG.width,
                            height: WAAGE_CONFIG.height,
                            background: '#eef2f7',
                            borderRadius: 3,
                            cursor: 'help',
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: `${widthFraction * 100}%`,
                              background: barColor,
                              borderRadius: 3,
                            }}
                          />
                        </div>
                      );
                    })()}
                  </div>
                )}
                {(it.ue50 || it.lpal) && <div></div>}
              </div>
            </React.Fragment>
          );
        })
      }
    </div >
  );
};
