import React, { useState } from 'react';

type NavKey = 'dienstplan' | 'einteilung' | 'werte' | 'personal' | 'fahrzeuge' | 'einstellungen';

const itemStyle: React.CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: 8,
	width: '100%',
	padding: '8px 10px',
	border: 'none',
	background: 'transparent',
	cursor: 'pointer',
	borderRadius: 6,
};

function emitNavigate(view: NavKey) {
	// Wenn Renderer‑App lauscht, kann sie den View umschalten
	window.dispatchEvent(new CustomEvent('navigate', { detail: { view } }));
}

const Sidebar: React.FC<{ active?: NavKey }> = ({ active }) => {
	const [collapsed, setCollapsed] = useState(false);
	const Icon = ({ path, viewBox = '0 0 24 24' }: { path: string; viewBox?: string }) => (
		<svg aria-hidden width={18} height={18} viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ minWidth: 18 }}>
			<path d={path} />
		</svg>
	);

	const icons = {
		einteilung: "M3 7h10M3 12h14M3 17h8",
		dienstplan: "M8 3v3M16 3v3M3 9h18M5 12h4m-4 4h6m4-4h4m-4 4h4",
		werte: "M4 19V9m6 10V5m6 14v-7",
		personal: "M16 14c2.21 0 4 1.79 4 4v2H4v-2c0-2.21 1.79-4 4-4h8Zm-4-2a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z",
		fahrzeuge: "M3 13l2-5a2 2 0 0 1 2-1h8a2 2 0 0 1 2 1l2 5v5h-2a2 2 0 0 1-2-2H7a2 2 0 0 1-2 2H3v-5Zm4-1h10",
		einstellungen: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8 4l-1.2-.7.2-1.4-1.4-.8-.8-1.4-1.4.2L14 6l-2-1-2 1-1.4-.2-.8 1.4-1.4.8.2 1.4L4 12l1.2.7-.2 1.4 1.4.8.8 1.4 1.4-.2 2 1 2-1 1.4.2.8-1.4 1.4-.8-.2-1.4L20 12Z",
		power: "M12 2v10m6.36-6.36a9 9 0 1 1-12.72 0"
	};
	const Item = ({ keyName, icon, label, onClick }: { keyName: NavKey; icon: React.ReactNode; label: string; onClick: () => void }) => (
		<button
			onClick={onClick}
			title={collapsed ? label : undefined}
			style={{
				...itemStyle,
				background: active === keyName ? 'var(--hover)' : 'transparent',
				color: active === keyName ? 'var(--text)' : undefined
			}}
		>
			{icon}
			{!collapsed && <span>{label}</span>}
		</button>
	);

		return (
			<aside style={{
				width: collapsed ? 56 : 200,
				transition: 'width 0.15s',
				borderRight: '1px solid var(--line)',
				background: 'var(--bg)',
				boxSizing: 'border-box',
				padding: 8
			}}>
				{/* Scrollbarer Inhaltsbereich */}
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', paddingBottom: 64 }}>
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
					<button onClick={() => setCollapsed(v => !v)} title={collapsed ? 'Aufklappen' : 'Einklappen'} style={{ ...itemStyle, padding: 6, width: collapsed ? 40 : 32 }}>
						<span aria-hidden>{collapsed ? '›' : '‹'}</span>
					</button>
					</div>
				<nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
				<Item keyName="einteilung" icon={<Icon path={icons.einteilung} />} label="Einteilung" onClick={() => emitNavigate('einteilung')} />
				<Item keyName="dienstplan" icon={<Icon path={icons.dienstplan} />} label="Dienstplan" onClick={() => emitNavigate('dienstplan')} />
				<Item keyName="werte" icon={<Icon path={icons.werte} />} label="Werte" onClick={() => emitNavigate('werte')} />
				<Item keyName="personal" icon={<Icon path={icons.personal} />} label="Personal" onClick={() => emitNavigate('personal')} />
				<Item keyName="fahrzeuge" icon={<Icon path={icons.fahrzeuge} />} label="Fahrzeuge" onClick={() => emitNavigate('fahrzeuge')} />
				</nav>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
					<Item keyName="einstellungen" icon={<Icon path={icons.einstellungen} />} label="Einstellungen" onClick={() => emitNavigate('einstellungen')} />
				</div>
			</div>
					{/* Feste Bottom-Leiste im Seitenmenü */}
					<div style={{ position: 'fixed', left: 8, bottom: 8, width: (collapsed ? 56 : 200) - 16 }}>
				<button onClick={() => (window as any).api?.quitApp?.()} style={{ ...itemStyle, color: '#991b1b', width: '100%' }} title={collapsed ? 'Beenden' : undefined}>
					<Icon path={icons.power} />
					{!collapsed && <span>Beenden</span>}
				</button>
			</div>
		</aside>
	);
};

export default Sidebar;
