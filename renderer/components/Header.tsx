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
  department: string | number;
  year: number;
  onOpenSettings?: () => void;
};

const Header: React.FC<HeaderProps> = ({ rescueStation, department, year }) => {
  const [imgError, setImgError] = React.useState<null | string>(null);
  const [imgLoaded, setImgLoaded] = React.useState(false);

  React.useEffect(() => {
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
            Feuer- und Rettungswache {String(rescueStation)} {typeof department === 'number' ? `${department}. Abteilung` : department} {year}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;