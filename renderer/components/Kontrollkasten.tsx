import React from 'react';
import styles from './MonthTabs.module.css';

// Grid-Layout-Konstanten
const GRID_CONFIG = {
  columns: 'minmax(80px, auto) 55px 24px 24px 40px 72px',
  gap: 5,
  marginBottom: 1,
};

const WAAGE_CONFIG = {
  width: 48,
  height: 5,
  gap: 1,
};

interface KontrollkastenItem {
  key: string;
  name: string;
  target: number | string;
  count: number;
  cumDiff: number;
  nef: number;
  itw: number;
  total: number;
  tag?: number;
  nacht?: number;
  rest: number;
  ue50?: boolean;
  hlfb?: boolean;
  teilzeit?: number;
  presenceRemainingByPerson?: number;
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
}) => {
  return (
    <div className={styles.sidebarList}>
      {/* Header-Zeile */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: GRID_CONFIG.columns,
          alignItems: 'center',
          gap: GRID_CONFIG.gap,
          fontWeight: 600,
          fontSize: 10,
          color: '#374151',
          marginBottom: GRID_CONFIG.marginBottom,
          paddingBottom: 1,
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <span style={{ textAlign: 'right' }}>Name</span>
        <span style={{ textAlign: 'center' }}>Soll | Ist</span>
        <span style={{ textAlign: 'center' }}>NEF</span>
        <span style={{ textAlign: 'center' }}>ITW</span>
        <span style={{ textAlign: 'center' }}>Gesamt</span>
        <span style={{ textAlign: 'center' }}>T/N | Rest</span>
      </div>

      {/* Items */}
      {items.map((it, idx) => {
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

        return (
          <div key={idx} style={{ marginBottom: GRID_CONFIG.marginBottom }}>
            <div
              className={styles.sidebarItem}
              style={{
                display: 'grid',
                gridTemplateColumns: GRID_CONFIG.columns,
                alignItems: 'center',
                gap: GRID_CONFIG.gap,
              }}
            >
              {/* Name */}
              <span
                className={styles.sidebarName}
                onClick={() => setHighlightedPersonKey(highlightedPersonKey === it.key ? null : it.key)}
                style={{
                  color: it.ue50 ? '#dc3545' : it.hlfb ? '#1565c0' : undefined,
                  cursor: 'pointer',
                  fontWeight: highlightedPersonKey === it.key ? 700 : undefined,
                  textDecoration: highlightedPersonKey === it.key ? 'underline' : undefined,
                  whiteSpace: 'nowrap',
                  textAlign: 'right',
                }}
              >
                {it.name}
              </span>

              {/* Soll/Ist mit Waage */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <span className={styles.sidebarVal} style={{ fontSize: 11 }}>
                  {(it.target === '' ? '–' : it.target) + ' | ' + it.count}
                </span>
                {renderPresenceMeter(it.presenceRemainingByPerson ?? 0, 5)}
              </div>

              {/* NEF */}
              <span className={styles.sidebarVal} style={{ textAlign: 'center', fontSize: 11 }}>
                {it.nef}
              </span>

              {/* ITW */}
              <span className={styles.sidebarVal} style={{ textAlign: 'center', fontSize: 11 }}>
                {it.itw}
              </span>

              {/* Gesamt */}
              {!it.ue50 && (
                <span className={styles.sidebarVal} style={{ ...restStyle, textAlign: 'center', fontSize: 11 }}>
                  {Number.isFinite(it.rest) ? it.rest : '–'}
                </span>
              )}
              {it.ue50 && <span className={styles.sidebarVal} style={{ textAlign: 'center', fontSize: 11 }}>–</span>}

              {/* Tag/Nacht Waage und Rest V untereinander */}
              {!it.ue50 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: WAAGE_CONFIG.gap }}>
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
                      const total = tagCount + nachtCount;

                      if (total === 0) return null;

                      const lp = Math.min(1, nachtCount / total);
                      const rp = Math.min(1, tagCount / total);

                      return (
                        <>
                          {/* Nacht (links) - Blau */}
                          <div
                            style={{
                              position: 'absolute',
                              right: '50%',
                              width: `${lp * 50}%`,
                              top: 0,
                              bottom: 0,
                              background: '#3b82f6',
                              borderTopLeftRadius: 3,
                              borderBottomLeftRadius: 3,
                            }}
                          />
                          {/* Tag (rechts) - Rot */}
                          <div
                            style={{
                              position: 'absolute',
                              left: '50%',
                              width: `${rp * 50}%`,
                              top: 0,
                              bottom: 0,
                              background: '#ef4444',
                              borderTopRightRadius: 3,
                              borderBottomRightRadius: 3,
                            }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 8,
                              color: '#111827',
                              fontWeight: 600,
                            }}
                          >
                            {tagCount} • {nachtCount}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Rest V Balken */}
                  {(() => {
                    const pres = presenceRemainingByPerson[it.key] || 0;
                    const assigned = assignedRemainingByPerson[it.key] || 0;
                    const remain = Math.max(0, pres - assigned);
                    const frac = pres > 0 ? Math.min(1, remain / pres) : 0;
                    const needed = Math.max(0, Number(it.rest || 0));
                    
                    let barColor = '#34c759';
                    if (needed > 0) {
                      if (remain < needed) {
                        barColor = '#ef4444';
                      } else {
                        const diff = remain - needed;
                        const threshold = 0.2 * needed;
                        barColor = (diff <= threshold) ? '#f59e0b' : '#34c759';
                      }
                    }

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
                            width: `${frac * 100}%`,
                            background: barColor,
                            borderRadius: 3,
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 8,
                            color: '#111827',
                            fontWeight: 600,
                          }}
                        >
                          {remain}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              {it.ue50 && <div></div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};
