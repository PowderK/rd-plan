import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

type NavKey = 'dienstplan' | 'einteilung' | 'werte' | 'personal' | 'fahrzeuge' | 'einstellungen' | 'itw';
export type SettingsCategory = 'general' | 'roster' | 'features' | 'itw' | 'qualifications' | 'roles' | 'audit';

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

function emitNavigate(view: NavKey, category?: SettingsCategory) {
	window.dispatchEvent(new CustomEvent('navigate', { detail: { view, category } }));
}

interface SidebarProps {
	active?: NavKey;
	activeSettingsCategory?: SettingsCategory;
}

const Sidebar: React.FC<SidebarProps> = ({ active, activeSettingsCategory = 'general' }) => {
	const [collapsed, setCollapsed] = useState(false);
	const [settingsExpanded, setSettingsExpanded] = useState(false);
	const { hasPermission, logout, isDevMode, currentUser } = useAuth();
	const isAdminRole = currentUser?.roleName === 'Administrator';
	const [itwFeatureEnabled, setItwFeatureEnabled] = useState(false);
	const [selectedDept, setSelectedDept] = useState<string>('');
	const [departments, setDepartments] = useState<string[]>([]);

	useEffect(() => {
		if (active === 'einstellungen') {
			setSettingsExpanded(true);
		}
	}, [active]);

	useEffect(() => {
		let cancelled = false;
		
		const loadDepts = async () => {
			try {
				const depts = await (window as any).api?.getUniqueDepartments?.();
				if (!cancelled && Array.isArray(depts)) {
					setDepartments(depts);
					const savedDept = await (window as any).api?.getSetting?.('admin_selected_department');
					if (savedDept && depts.includes(savedDept)) {
						setSelectedDept(savedDept);
					} else if (depts.length > 0) {
						setSelectedDept(depts[0]);
						await (window as any).api?.setSetting?.('admin_selected_department', depts[0]);
					}
				}
			} catch {}
		};
		loadDepts();

		const loadItwSetting = async () => {
			try {
				const val = await (window as any).api?.getSetting?.('itw');
				setItwFeatureEnabled(val === 'true' || val === '1');
			} catch {}
		};
		loadItwSetting();

		const onSettingsUpdated = () => {
			loadDepts();
			loadItwSetting();
		};
		const onPersonnelUpdated = () => {
			loadDepts();
		};
		(window as any).api?.onSettingsUpdated?.(onSettingsUpdated);
		(window as any).api?.onPersonnelUpdated?.(onPersonnelUpdated);

		return () => { 
			cancelled = true; 
			(window as any).api?.offSettingsUpdated?.(onSettingsUpdated);
			(window as any).api?.offPersonnelUpdated?.(onPersonnelUpdated);
		};
	}, [currentUser?.roleId]);

	const onDepartmentChange = async (dept: string) => {
		try {
			setSelectedDept(dept);
			await (window as any).api?.setSetting?.('admin_selected_department', dept);
			// Broadcast update to all windows
			window.dispatchEvent(new CustomEvent('settings-updated'));
			window.dispatchEvent(new CustomEvent('rdplan-department-changed', { detail: { department: dept } }));
		} catch (e) {
			console.error('Failed to update admin department:', e);
		}
	};
	
	// Emit collapse state changes
	const toggleCollapse = () => {
		const newState = !collapsed;
		setCollapsed(newState);
		(window as any).sidebarCollapsed = newState;
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
		itw: "M5 12h14M5 12l4-4m-4 4 4 4M19 12l-4-4m4 4-4 4",
		power: "M12 2v10m6.36-6.36a9 9 0 1 1-12.72 0",
		logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14l5-5-5-5m5 5H9",
		// Settings sub-category icons
		catGeneral: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
		catRoster: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
		catFeatures: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
		catQualifications: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
		catRoles: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
		catAudit: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
	};
	
	// Menu-Items mit Permission-Check
	const menuItems = [
		{ key: 'einteilung' as NavKey, icon: icons.einteilung, label: 'Einteilung', area: 'einteilung' },
		{ key: 'dienstplan' as NavKey, icon: icons.dienstplan, label: 'Dienstplan', area: 'dienstplan' },
		{ key: 'werte' as NavKey, icon: icons.werte, label: 'Werte', area: 'werte' },
		{ key: 'personal' as NavKey, icon: icons.personal, label: 'Personal', area: 'personal' },
		{ key: 'fahrzeuge' as NavKey, icon: icons.fahrzeuge, label: 'Fahrzeuge', area: 'fahrzeuge' },
		...((itwFeatureEnabled ? [{ key: 'itw' as NavKey, icon: icons.itw, label: 'ITW', area: 'itw' }] : []))
	].filter(item => hasPermission(item.area, 'read') || hasPermission(item.area, 'write'));

	// Sub-Items für Einstellungen (Kategorien)
	const settingsCategories: { key: SettingsCategory; label: string; icon: string }[] = [
		{ key: 'general', label: 'Allgemein', icon: icons.catGeneral },
		{ key: 'roster', label: 'Dienstplan', icon: icons.catRoster },
		{ key: 'features', label: 'Features', icon: icons.catFeatures },
		...((itwFeatureEnabled ? [{ key: 'itw' as SettingsCategory, label: 'ITW', icon: icons.itw }] : [])),
		{ key: 'qualifications', label: 'Qualifikationen', icon: icons.catQualifications },
		{ key: 'roles', label: 'Rollen & Rechte', icon: icons.catRoles },
		{ key: 'audit', label: 'Verlauf', icon: icons.catAudit },
	];

	const Item = ({ keyName, icon, label, onClick }: { keyName: NavKey; icon: React.ReactNode; label: string; onClick: () => void }) => (
		<button
			onClick={onClick}
			title={collapsed ? label : undefined}
			style={{
				...itemStyle,
				padding: '8px 10px',
				fontSize: '14px',
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
					<button onClick={toggleCollapse} title={collapsed ? 'Aufklappen' : 'Einklappen'} style={{ ...itemStyle, padding: 10, width: 48, height: 48, fontSize: 24, justifyContent: 'center' }}>
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

				{isAdminRole && !collapsed && (
					<div style={{ marginTop: 12, padding: '0 8px' }}>
						<div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4, paddingLeft: 4 }}>Abteilung (Admin)</div>
						<select 
							value={selectedDept} 
							onChange={(e) => onDepartmentChange(e.target.value)}
							style={{
								width: '100%',
								padding: '6px 8px',
								borderRadius: 4,
								border: '1px solid var(--line)',
								background: 'var(--bg)',
								color: 'var(--text)',
								fontSize: 12,
								outline: 'none'
							}}
						>
							{departments.map(d => (
								<option key={d} value={d}>{d}</option>
							))}
						</select>
					</div>
				)}

				{/* Einstellungen als Ordnerbaum */}
				<div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
					{hasPermission('einstellungen', 'read') && (
						<div>
							<div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
								<button
									onClick={() => {
										emitNavigate('einstellungen', activeSettingsCategory || 'general');
										setSettingsExpanded(true);
										if (collapsed) {
											toggleCollapse();
										}
									}}
									title={collapsed ? 'Einstellungen' : undefined}
									style={{
										...itemStyle,
										padding: '8px 10px',
										fontSize: '14px',
										background: active === 'einstellungen' ? '#f8f9fa' : 'transparent',
										color: active === 'einstellungen' ? '#0ea5e9' : 'var(--text)',
										fontWeight: active === 'einstellungen' ? 600 : 400,
										borderLeft: active === 'einstellungen' ? '3px solid #0ea5e9' : '3px solid transparent',
										transition: 'all 0.2s',
										flex: 1
									}}
									onMouseEnter={(e) => {
										if (active !== 'einstellungen') {
											e.currentTarget.style.background = '#f3f4f6';
										}
									}}
									onMouseLeave={(e) => {
										if (active !== 'einstellungen') {
											e.currentTarget.style.background = 'transparent';
										}
									}}
								>
									<Icon path={icons.einstellungen} />
									{!collapsed && <span style={{ flex: 1, textAlign: 'left' }}>Einstellungen</span>}
								</button>
								{!collapsed && (
									<button
										onClick={(e) => {
											e.stopPropagation();
											setSettingsExpanded(prev => !prev);
										}}
										title={settingsExpanded ? 'Untermenü einklappen' : 'Untermenü aufklappen'}
										style={{
											border: 'none',
											background: 'transparent',
											cursor: 'pointer',
											padding: '6px 8px',
											color: 'var(--muted)',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											borderRadius: 4
										}}
										onMouseEnter={(e) => { e.currentTarget.style.background = '#e5e7eb'; }}
										onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
									>
										<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ transform: settingsExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>
											<polyline points="9 18 15 12 9 6" />
										</svg>
									</button>
								)}
							</div>

							{/* Ausklappbare Unterpunkte (Ordnerbaum) */}
							{!collapsed && settingsExpanded && (
								<div style={{
									display: 'flex',
									flexDirection: 'column',
									gap: 2,
									paddingLeft: 10,
									borderLeft: '2px solid var(--line)',
									marginLeft: 18,
									marginTop: 3,
									marginBottom: 6
								}}>
									{settingsCategories.map(cat => {
										const isCatActive = active === 'einstellungen' && activeSettingsCategory === cat.key;
										return (
											<button
												key={cat.key}
												onClick={() => emitNavigate('einstellungen', cat.key)}
												title={`Einstellungen: ${cat.label}`}
												style={{
													...itemStyle,
													padding: '5px 8px',
													fontSize: '12.5px',
													background: isCatActive ? '#e0f2fe' : 'transparent',
													color: isCatActive ? '#0284c7' : '#64748b',
													fontWeight: isCatActive ? 600 : 400,
													borderRadius: 4,
													transition: 'all 0.15s'
												}}
												onMouseEnter={(e) => {
													if (!isCatActive) {
														e.currentTarget.style.background = '#f3f4f6';
														e.currentTarget.style.color = 'var(--text)';
													}
												}}
												onMouseLeave={(e) => {
													if (!isCatActive) {
														e.currentTarget.style.background = 'transparent';
														e.currentTarget.style.color = '#64748b';
													}
												}}
											>
												<svg aria-hidden width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ minWidth: 14 }}>
													<path d={cat.icon} />
												</svg>
												<span>{cat.label}</span>
											</button>
										);
									})}
								</div>
							)}
						</div>
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
