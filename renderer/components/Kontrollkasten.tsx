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
        <span style={{ textAlign: 'right', paddingRight: 4, fontWeight: 600, fontSize: 10, color: '#374151', paddingBottom: 1, borderBottom: '1px solid var(--line)' }}>Name</span>
        <span style={{ textAlign: 'center', paddingRight: 4, fontWeight: 600, fontSize: 10, color: '#374151', paddingBottom: 1, borderBottom: '1px solid var(--line)' }}>Soll | Ist</span>
        <span style={{ textAlign: 'center', paddingRight: 4, fontWeight: 600, fontSize: 10, color: '#374151', paddingBottom: 1, borderBottom: '1px solid var(--line)' }}>NEF</span>
        {showItw && <span style={{ textAlign: 'center', paddingRight: 4, fontWeight: 600, fontSize: 10, color: '#374151', paddingBottom: 1, borderBottom: '1px solid var(--line)' }}>ITW</span>}
        {showWeekendShifts && <span style={{ textAlign: 'center', paddingRight: 4, fontSize: 9, fontWeight: 600, color: '#374151', paddingBottom: 1, borderBottom: '1px solid var(--line)' }}>WE</span>}
        {showOldRtwShifts && <span style={{ textAlign: 'center', paddingRight: 4, fontSize: 9, fontWeight: 600, color: '#374151', paddingBottom: 1, borderBottom: '1px solid var(--line)' }}>Alt</span>}
        <span style={{ textAlign: 'center', paddingRight: 4, fontWeight: 600, fontSize: 10, color: '#374151', paddingBottom: 1, borderBottom: '1px solid var(--line)' }}>Ges.</span>
        <span style={{ textAlign: 'center', fontWeight: 600, fontSize: 10, color: '#374151', paddingBottom: 1, borderBottom: '1px solid var(--line)' }}>T/N | Rest</span>
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
                  style={{
                    color: it.lpal ? '#fd7e14' : it.ue50 ? '#dc3545' : it.hlfb ? '#1565c0' : undefined,
                    cursor: 'pointer',
                    fontWeight: highlightedPersonKey === it.key ? 700 : undefined,
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, borderRight: '1px solid var(--line)', paddingRight: 4 }}>
                  <span className={styles.sidebarVal} style={{ fontSize: 11, color: it.hasTransfer ? '#3b82f6' : undefined, fontWeight: it.hasTransfer ? 600 : undefined }}>
                    {(it.target === '' ? '–' : it.target) + ' | ' + it.count}
                  </span>
                  {renderPresenceMeter(it.cumDiff, 5)}
                </div>

                {/* NEF */}
                <span className={styles.sidebarVal} style={{ textAlign: 'center', fontSize: 11, borderRight: '1px solid var(--line)', paddingRight: 4 }}>
                  {it.nef}
                </span>

                {showItw && (
                  <span className={styles.sidebarVal} style={{ textAlign: 'center', fontSize: 11, borderRight: '1px solid var(--line)', paddingRight: 4 }}>
                    {it.itw}
                  </span>
                )}

                {/* WE */}
                {showWeekendShifts && (
                  <span className={styles.sidebarVal} style={{ textAlign: 'center', fontSize: 11, borderRight: '1px solid var(--line)', paddingRight: 4, color: weekendColor, fontWeight: weekendColor ? 600 : undefined }}>
                    {typeof it.weekend === 'number' ? it.weekend : '–'}
                  </span>
                )}

                {/* Alte RTW-Schichten */}
                {showOldRtwShifts && (
                  <span className={styles.sidebarVal} style={{ textAlign: 'center', fontSize: 11, borderRight: '1px solid var(--line)', paddingRight: 4, color: '#666' }}>
                    {it.oldRtwShifts || 0}
                  </span>
                )}

                {/* Gesamt */}
                {!it.ue50 && !it.lpal && (
                  <span className={styles.sidebarVal} style={{ ...restStyle, textAlign: 'center', fontSize: 11, borderRight: '1px solid var(--line)', paddingRight: 4 }}>
                    {Number.isFinite(it.rest) ? it.rest : '–'}
                  </span>
                )}
                {(it.ue50 || it.lpal) && <span className={styles.sidebarVal} style={{ textAlign: 'center', fontSize: 11, borderRight: '1px solid var(--line)', paddingRight: 4 }}>–</span>}

                {/* Tag/Nacht Waage und Rest V untereinander */}
                {!it.ue50 && !it.lpal && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: WAAGE_CONFIG.gap, alignItems: 'center' }}>
                    {/* Tag/Nacht Waage */}
                    <div
                      style={{
                        position: 'relative',
                        width: WAAGE_CONFIG.width,
                        height: WAAGE_CONFIG.height,
                        background: '#eef2f7',
                        borderRadius: 3,
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
                        const tagCount = it.tag || 0;
                        const nachtCount = it.nacht || 0;
                        const diff = tagCount - nachtCount;

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

                    {/* Rest V Balken */}
                    {(() => {
                      const pres = presenceRemainingByPerson[it.key] || 0;
                      const assigned = assignedRemainingByPerson[it.key] || 0;
                      const remain = Math.max(0, pres - assigned);
                      const needed = Math.max(0, Number(it.rest || 0));
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

                      return (
                        <div
                          style={{
                            position: 'relative',
                            width: WAAGE_CONFIG.width,
                            height: WAAGE_CONFIG.height,
                            background: '#eef2f7',
                            borderRadius: 3,
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
