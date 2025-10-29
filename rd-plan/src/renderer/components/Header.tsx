import React, { useState } from 'react';

type HeaderProps = {
  currentMonth: string;
  rescueStation: string;
  onOpenSettings: () => void;
};

const Header: React.FC<HeaderProps> = ({ currentMonth, rescueStation, onOpenSettings }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => setMenuOpen((open) => !open);

  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <style>{`
        .menu-btn {
          width: 100%;
          text-align: left;
          padding: 0.5em 1em;
          background: none;
          border: none;
          transition: background 0.15s;
        }
        .menu-btn:hover {
          background: #f0f0f0;
        }
        .menu-btn.menu-btn-red:hover {
          background: #ffeaea;
        }
      `}</style>
      <h1>{currentMonth} – {rescueStation}</h1>
      <div style={{ position: 'relative' }}>
        <button onClick={toggleMenu} style={{ fontSize: '1.2em', padding: '0.5em 1em' }}>
          ☰ Menü
        </button>
        {menuOpen && (
          <ul style={{
            position: 'absolute',
            right: 0,
            top: '2.5em',
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            listStyle: 'none',
            margin: 0,
            padding: '0.5em 0',
            minWidth: '150px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}>
            <li>
              <button
                className="menu-btn"
                onClick={() => { setMenuOpen(false); onOpenSettings(); }}
              >
                Einstellungen
              </button>
            </li>
            <li>
              <button
                className="menu-btn"
                onClick={() => { setMenuOpen(false); (window as any).api.openPersonnelWindow(); }}
              >
                Personal
              </button>
            </li>
            <li>
              <button
                className="menu-btn"
                onClick={() => { setMenuOpen(false); (window as any).api.openDutyRosterWindow(); }}
              >
                Dienstplan
              </button>
            </li>
            {/* Azubis menu removed per user request */}
            <li>
              <button
                className="menu-btn menu-btn-red"
                onClick={() => { setMenuOpen(false); (window as any).api.quitApp(); }}
                style={{ color: 'red' }}
              >
                Beenden
              </button>
            </li>
          </ul>
        )}
      </div>
    </header>
  );
};

export default Header;