import React from 'react';
// Inline das Header-Bild, damit es im Paket nicht als separate Asset-Datei fehlen kann
// Vite '?inline' erzwingt Base64-Einbettung ins Bundle
// Pfad relativ zu dieser Datei: ../../../media/Header.png
// Hinweis: Bei sehr großen Dateien steigt die Bundle-Größe, aber Zuverlässigkeit geht vor
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import headerPngUrl from '../../media/Header.png?url';

type HeaderProps = {
  currentMonth?: string; // not displayed anymore
  rescueStation: string | number;
  department: number;
  year: number;
  onOpenSettings?: () => void;
};

const Header: React.FC<HeaderProps> = ({ rescueStation, department, year }) => {
  const [isDark, setIsDark] = React.useState(false);
  const [imgError, setImgError] = React.useState<null | string>(null);
  const [imgLoaded, setImgLoaded] = React.useState(false);
  const toggleTheme = () => {
    const root = document.documentElement;
    const nextIsDark = !(root.getAttribute('data-theme') === 'dark');
    if (!nextIsDark) root.removeAttribute('data-theme'); else root.setAttribute('data-theme', 'dark');
    setIsDark(nextIsDark);
    try { localStorage.setItem('rdplan.theme', nextIsDark ? 'dark' : 'light'); } catch {}
  };

  // Lade gespeichertes Theme einmalig
  React.useEffect(() => {
    try {
      const t = localStorage.getItem('rdplan.theme');
      if (t === 'dark') { document.documentElement.setAttribute('data-theme', 'dark'); setIsDark(true); }
      else { document.documentElement.removeAttribute('data-theme'); setIsDark(false); }
    } catch {}
    try {
      // console.log('[Header] img src preview:', (headerPngUrl && typeof headerPngUrl === 'string') ? headerPngUrl.slice(0, 128) : String(headerPngUrl));
    } catch {}
  }, []);

  // Kein benutzerdefiniertes Bild – fester Header

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 10 }}>
      {/* PNG-Banner als Hintergrund, wird nur skaliert */}
      {/** Erzeuge eine URL zum PNG aus dem media-Ordner (funktioniert in Vite/Electron) */}
      {(() => { return null; })()}
      <div
        style={{
          position: 'relative',
          width: 'min(1400px, 98vw)',
          margin: '0 auto',
          height: 'clamp(56px, 6.5vw, 90px)',
          overflow: 'hidden',
          // dezentes Fallback-Gradient, falls das Bild nicht geladen werden kann
          background: imgError ? 'linear-gradient(90deg, #0ea5e9 0%, #0369a1 100%)' : undefined
        }}
      >
        {/* Bild als echtes <img>, absolut positioniert, damit es in allen Umgebungen sicher gerendert wird */}
        <img
          src={headerPngUrl}
          alt="Header"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'fill',
            pointerEvents: 'none',
            userSelect: 'none',
            display: imgError ? 'none' : 'block'
          }}
          onLoad={() => {
            setImgLoaded(true);
            try { console.log('[Header] img loaded ok'); } catch {}
          }}
          onError={(e) => {
            const src = (e?.currentTarget as HTMLImageElement)?.src;
            setImgError(src || 'unknown');
            try { console.warn('[Header] img failed to load:', src); } catch {}
          }}
        />
        {/* Overlay-Inhalt innerhalb des Banners */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'clamp(6px, 1.2vw, 14px) clamp(20px, 3.5vw, 48px) clamp(6px, 1.2vw, 14px) clamp(56px, 7vw, 160px)'
          }}
        >
          <div style={{ color: '#fff', fontSize: 'clamp(16px, 2.4vw, 24px)', fontWeight: 800, letterSpacing: '0.3px', textShadow: '0 1px 2px rgba(0,0,0,0.35)', marginLeft: 'clamp(8px, 1vw, 16px)' }}>
            Feuer- und Rettungswache {String(rescueStation)} {department}. Abteilung {year}
          </div>
          <div>
            <button
              onClick={toggleTheme}
              title={isDark ? 'Light Mode umschalten' : 'Dark Mode umschalten'}
              style={{
                padding: '8px 12px',
                color: '#fff',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: 10,
                backdropFilter: 'saturate(120%) brightness(105%)'
              }}
            >
              {isDark ? (
                // Sonne (Light)
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              ) : (
                // Mond (Dark)
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" fill="none"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;