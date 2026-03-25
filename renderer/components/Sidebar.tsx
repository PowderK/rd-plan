import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

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
	const { hasPermission, logout, isDevMode, currentUser } = useAuth();
	const [isAdminRole, setIsAdminRole] = useState(false);

	useEffect(() => {
		let cancelled = false;
		const resolveAdminRole = async () => {
			try {
				if (!currentUser?.roleId) {
					if (!cancelled) setIsAdminRole(false);
					return;
				}

				const rolesRaw = await (window as any).api?.getSetting?.('roles');
				if (!rolesRaw) {
					if (!cancelled) setIsAdminRole(false);
					return;
				}

				const roles = JSON.parse(String(rolesRaw));
				const role = Array.isArray(roles)
					? roles.find((r: any) => Number(r?.id) === Number(currentUser.roleId))
					: null;

				const isAdmin = String(role?.name || '').trim().toLowerCase() === 'administrator';
				if (!cancelled) setIsAdminRole(isAdmin);
			} catch {
				if (!cancelled) setIsAdminRole(false);
			}
		};

		resolveAdminRole();
		return () => { cancelled = true; };
	}, [currentUser?.roleId]);
	
	// Emit collapse state changes
	const toggleCollapse = () => {
		const newState = !collapsed;
		setCollapsed(newState);
		window.dispatchEvent(new CustomEvent('sidebar-collapsed', { detail: { collapsed: newState } }));
	};
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
		power: "M12 2v10m6.36-6.36a9 9 0 1 1-12.72 0",
		logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14l5-5-5-5m5 5H9"
	};
	
	// Menu-Items mit Permission-Check
	const menuItems = [
		{ key: 'einteilung' as NavKey, icon: icons.einteilung, label: 'Einteilung', area: 'einteilung' },
		{ key: 'dienstplan' as NavKey, icon: icons.dienstplan, label: 'Dienstplan', area: 'dienstplan' },
		{ key: 'werte' as NavKey, icon: icons.werte, label: 'Werte', area: 'werte' },
		{ key: 'personal' as NavKey, icon: icons.personal, label: 'Personal', area: 'personal' },
		{ key: 'fahrzeuge' as NavKey, icon: icons.fahrzeuge, label: 'Fahrzeuge', area: 'fahrzeuge' }
	].filter(item => hasPermission(item.area, 'read') || hasPermission(item.area, 'write'));
	const Item = ({ keyName, icon, label, onClick }: { keyName: NavKey; icon: React.ReactNode; label: string; onClick: () => void }) => (
		<button
			onClick={onClick}
			title={collapsed ? label : undefined}
			style={{
				...itemStyle,
				background: active === keyName ? '#f8f9fa' : 'transparent',
				color: active === keyName ? '#0ea5e9' : 'var(--text)',
				fontWeight: active === keyName ? 600 : 400,
				borderLeft: active === keyName ? '3px solid #0ea5e9' : '3px solid transparent',
				transition: 'all 0.2s'
			}}
			onMouseEnter={(e) => {
				if (active !== keyName) {
					e.currentTarget.style.background = '#f3f4f6';
				}
			}}
			onMouseLeave={(e) => {
				if (active !== keyName) {
					e.currentTarget.style.background = 'transparent';
				}
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
				padding: 8,
				position: 'relative',
				height: '100%'
			}}>
				{/* Dev-Mode Badge */}
				{isDevMode && !collapsed && (
					<div style={{
						position: 'absolute',
						top: 8,
						right: 8,
						background: '#fbbf24',
						color: '#78350f',
						fontSize: '10px',
						fontWeight: 'bold',
						padding: '2px 6px',
						borderRadius: '4px',
						zIndex: 10
					}}>
						DEV
					</div>
				)}
				
				{/* Scrollbarer Inhaltsbereich */}
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', paddingBottom: 120 }}>
					<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
					<button onClick={toggleCollapse} title={collapsed ? 'Aufklappen' : 'Einklappen'} style={{ ...itemStyle, padding: 10, width: collapsed ? 48 : 48, height: 48, fontSize: 24 }}>
						<span aria-hidden>{collapsed ? '›' : '‹'}</span>
					</button>
					</div>
				<nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
					{menuItems.map(item => (
						<Item 
							key={item.key}
							keyName={item.key} 
							icon={<Icon path={item.icon} />} 
							label={item.label} 
							onClick={() => emitNavigate(item.key)} 
						/>
					))}
				</nav>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
					{hasPermission('einstellungen', 'read') && (
						<Item keyName="einstellungen" icon={<Icon path={icons.einstellungen} />} label="Einstellungen" onClick={() => emitNavigate('einstellungen')} />
					)}
				</div>
			</div>
					{/* Feste Bottom-Leiste im Seitenmenü */}
					<div style={{ position: 'fixed', left: 8, bottom: 8, width: (collapsed ? 56 : 200) - 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
				{/* User Info (wenn nicht collapsed) */}
				{!collapsed && currentUser && (
					<div style={{
						padding: '8px',
						background: '#f3f4f6',
						borderRadius: '6px',
						fontSize: '12px',
						color: '#6b7280'
					}}>
						<div style={{ fontWeight: '600', color: '#374151' }}>{currentUser.vorname} {currentUser.name}</div>
						<div style={{ fontSize: '10px' }}>#{currentUser.personnelNumber}</div>
					</div>
				)}
				
				{/* Logout Button (nur für Admin) */}
				{isAdminRole && (
					<button onClick={() => logout()} style={{ ...itemStyle, color: '#dc2626', width: '100%' }} title={collapsed ? 'Abmelden' : undefined}>
						<Icon path={icons.logout} />
						{!collapsed && <span>Abmelden</span>}
					</button>
				)}
				
				<button onClick={() => (window as any).api?.quitApp?.()} style={{ ...itemStyle, color: '#991b1b', width: '100%' }} title={collapsed ? 'Beenden' : undefined}>
					<Icon path={icons.power} />
					{!collapsed && <span>Beenden</span>}
				</button>
			</div>
		</aside>
	);
};

export default Sidebar;
