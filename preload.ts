import { contextBridge, ipcRenderer } from 'electron';

// Small helper to safely stringify arguments
function safeStringify(arg: any) {
    if (typeof arg === 'string') return arg;
    try {
        return JSON.stringify(arg);
    } catch (e) {
        try { return String(arg); } catch (_) { return '<unserializable>'; }
    }
}

// Forward basic console calls from renderer to main so they appear in the terminal
try {
    const _log = console.log.bind(console);
    console.log = (...args: any[]) => {
        try { ipcRenderer.send('renderer-log', { level: 'log', args: args.map(safeStringify) }); } catch (e) {}
        _log(...args);
    };
    const _warn = console.warn.bind(console);
    console.warn = (...args: any[]) => {
        try { ipcRenderer.send('renderer-log', { level: 'warn', args: args.map(safeStringify) }); } catch (e) {}
        _warn(...args);
    };
    const _error = console.error.bind(console);
    console.error = (...args: any[]) => {
        try { ipcRenderer.send('renderer-log', { level: 'error', args: args.map(safeStringify) }); } catch (e) {}
        _error(...args);
    };
} catch (e) {
    // ipcRenderer might not be available in some contexts
}

contextBridge.exposeInMainWorld('api', {
    getShifts: () => ipcRenderer.invoke('get-shifts'),
    getPersonnel: (includeInactive?: boolean) => ipcRenderer.invoke('get-personnel', includeInactive === true),
    updateShift: (shift: any) => ipcRenderer.invoke('update-shift', shift),
    getSetting: (key: string) => ipcRenderer.invoke('get-setting', key),
    setSetting: (key: string, value: string) => ipcRenderer.invoke('set-setting', key, value),
    openSettingsWindow: () => ipcRenderer.send('open-settings-window'),
    onSettingsUpdated: (callback: () => void) => ipcRenderer.on('settings-updated', callback),
    offSettingsUpdated: (callback: () => void) => ipcRenderer.removeListener('settings-updated', callback),
    openPersonnelWindow: () => ipcRenderer.send('open-personnel-window'),
    openAddPersonWindow: () => ipcRenderer.send('open-add-person-window'),
    openEditPersonWindow: (id: number) => ipcRenderer.send('open-edit-person-window', id),
    openConfirmDeleteWindow: (id: number, type: string = 'person') => ipcRenderer.send('open-confirm-delete-window', id, type),
    getPersonnelList: (includeInactive?: boolean, date?: string) => ipcRenderer.invoke('get-personnel-list', includeInactive === true, date),
    addPerson: (person: any) => ipcRenderer.invoke('add-person', person),
    updatePerson: (person: any) => ipcRenderer.invoke('update-person', person),
    deletePerson: (id: number) => ipcRenderer.invoke('delete-person', id),
    setPersonActive: (id: number, active: boolean) => ipcRenderer.invoke('set-person-active', id, active),
    updatePersonnelOrder: (order: number[]) => ipcRenderer.invoke('update-personnel-order', order),
    onPersonnelUpdated: (callback: () => void) => ipcRenderer.on('personnel-updated', callback),
    offPersonnelUpdated: (callback: () => void) => ipcRenderer.removeListener('personnel-updated', callback),
    getPerson: (id: number) => ipcRenderer.invoke('get-person', id),
    quitApp: () => ipcRenderer.send('quit-app'),
    openDutyRosterWindow: () => ipcRenderer.send('open-duty-roster-window'),
    getShiftTypes: () => ipcRenderer.invoke('get-shift-types'),
    addShiftType: (type: { code: string, description: string }) => ipcRenderer.invoke('add-shift-type', type),
    updateShiftType: (type: { id: number, code: string, description: string }) => ipcRenderer.invoke('update-shift-type', type),
    deleteShiftType: (id: number) => ipcRenderer.invoke('delete-shift-type', id),
    getDutyRoster: (year: number) => ipcRenderer.invoke('get-duty-roster', year),
    setDutyRosterEntry: (entry: { personId: number, personType: string, date: string, value: string, type: string }) => ipcRenderer.invoke('set-duty-roster-entry', entry),
    bulkSetDutyRoster: (entries: any[]) => ipcRenderer.invoke('bulk-set-duty-roster', entries),
    clearDutyRosterYear: (year: number) => ipcRenderer.invoke('clear-duty-roster-year', year),
    clearDutyRosterMonth: (year: number, month: number) => ipcRenderer.invoke('clear-duty-roster-month', year, month),
    onBulkImportProgress: (cb: (ev: any, data: { processed: number; total: number }) => void) => ipcRenderer.on('bulk-import-progress', cb),
    offBulkImportProgress: (cb: (ev: any, data: { processed: number; total: number }) => void) => ipcRenderer.removeListener('bulk-import-progress', cb),
    onDutyRosterUpdated: (callback: (...args: any[]) => void) => ipcRenderer.on('duty-roster-updated', callback),
    offDutyRosterUpdated: (callback: (...args: any[]) => void) => ipcRenderer.removeListener('duty-roster-updated', callback),
    openAzubiWindow: () => ipcRenderer.send('open-azubi-window'),
    getAzubiList: () => ipcRenderer.invoke('get-azubi-list'),
    addAzubi: (azubi: any) => ipcRenderer.invoke('add-azubi', azubi),
    updateAzubi: (azubi: any) => ipcRenderer.invoke('update-azubi', azubi),
    deleteAzubi: (id: number) => ipcRenderer.invoke('delete-azubi', id),
    getAzubi: (id: number) => ipcRenderer.invoke('get-azubi', id),
    updateAzubiOrder: (order: number[]) => ipcRenderer.invoke('update-azubi-order', order),
    // Azubi Periods
    getAzubiPeriods: (azubiId: number) => ipcRenderer.invoke('get-azubi-periods', azubiId),
    getAllAzubiPeriods: () => ipcRenderer.invoke('get-all-azubi-periods'),
    addAzubiPeriod: (period: any) => ipcRenderer.invoke('add-azubi-period', period),
    updateAzubiPeriod: (id: number, period: any) => ipcRenderer.invoke('update-azubi-period', id, period),
    deleteAzubiPeriod: (id: number) => ipcRenderer.invoke('delete-azubi-period', id),
    // Qualification Periods
    getQualificationPeriods: (personId: number) => ipcRenderer.invoke('get-qualification-periods', personId),
    getAllQualificationPeriods: () => ipcRenderer.invoke('get-all-qualification-periods'),
    addQualificationPeriod: (period: any) => ipcRenderer.invoke('add-qualification-period', period),
    updateQualificationPeriod: (id: number, period: any) => ipcRenderer.invoke('update-qualification-period', id, period),
    deleteQualificationPeriod: (id: number) => ipcRenderer.invoke('delete-qualification-period', id),
    hasQualificationInMonth: (personId: number, qualType: string, yearMonth: string) => ipcRenderer.invoke('has-qualification-in-month', personId, qualType, yearMonth),
    validateQualificationForShift: (personId: number, shiftValue: string, date: string, cellType?: string) => ipcRenderer.invoke('validate-qualification-for-shift', personId, shiftValue, date, cellType),
    getActiveQualifications: (personId: number, yearMonth: string) => ipcRenderer.invoke('get-active-qualifications', personId, yearMonth),
    
    // Personnel Active Periods
    getPersonnelActivePeriods: (personId: number) => ipcRenderer.invoke('get-personnel-active-periods', personId),
    getAllPersonnelActivePeriods: () => ipcRenderer.invoke('get-all-personnel-active-periods'),
    addPersonnelActivePeriod: (period: any) => ipcRenderer.invoke('add-personnel-active-period', period),
    updatePersonnelActivePeriod: (id: number, period: any) => ipcRenderer.invoke('update-personnel-active-period', id, period),
    deletePersonnelActivePeriod: (id: number) => ipcRenderer.invoke('delete-personnel-active-period', id),
    isPersonnelActiveInMonth: (personId: number, yearMonth: string) => ipcRenderer.invoke('is-personnel-active-in-month', personId, yearMonth),
    
    // Qualification Types Management  
    getQualificationTypes: (activeOnly?: boolean) => ipcRenderer.invoke('get-qualification-types', activeOnly),
    addQualificationType: (qualType: any) => ipcRenderer.invoke('add-qualification-type', qualType),
    updateQualificationType: (id: number, qualType: any) => ipcRenderer.invoke('update-qualification-type', id, qualType),
    deleteQualificationType: (id: number) => ipcRenderer.invoke('delete-qualification-type', id),
  getQualifiedPersonsForPosition: (position: string, date: string, cellType?: string) => ipcRenderer.invoke('get-qualified-persons-for-position', position, date, cellType),
    // Windows
    openAddAzubiWindow: () => ipcRenderer.send('open-add-azubi-window'),
    openEditAzubiWindow: (id: number) => ipcRenderer.send('open-edit-azubi-window', id),
    onAzubisUpdated: (callback: () => void) => ipcRenderer.on('azubis-updated', callback),
    offAzubisUpdated: (callback: () => void) => ipcRenderer.removeListener('azubis-updated', callback),
    // ITW doctors
    getItwDoctors: () => ipcRenderer.invoke('get-itw-doctors'),
    addItwDoctor: (doc: any) => ipcRenderer.invoke('add-itw-doctor', doc),
    updateItwDoctor: (doc: any) => ipcRenderer.invoke('update-itw-doctor', doc),
    deleteItwDoctor: (id: number) => ipcRenderer.invoke('delete-itw-doctor', id),
    updateItwDoctorOrder: (order: number[]) => ipcRenderer.invoke('update-itw-doctor-order', order),
    // ITW Vehicles
    getItwVehicles: () => ipcRenderer.invoke('get-itw-vehicles'),
    addItwVehicle: (v: any) => ipcRenderer.invoke('add-itw-vehicle', v),
    updateItwVehicle: (v: any) => ipcRenderer.invoke('update-itw-vehicle', v),
    deleteItwVehicle: (id: number) => ipcRenderer.invoke('delete-itw-vehicle', id),
    updateItwVehicleOrder: (order: number[]) => ipcRenderer.invoke('update-itw-vehicle-order', order),
    // ITW Vehicle Periods
    getItwVehiclePeriods: (vehicleId: number) => ipcRenderer.invoke('get-itw-vehicle-periods', vehicleId),
    getAllItwVehiclePeriods: () => ipcRenderer.invoke('get-all-itw-vehicle-periods'),
    addItwVehiclePeriod: (period: any) => ipcRenderer.invoke('add-itw-vehicle-period', period),
    updateItwVehiclePeriod: (period: any) => ipcRenderer.invoke('update-itw-vehicle-period', period),
    deleteItwVehiclePeriod: (id: number) => ipcRenderer.invoke('delete-itw-vehicle-period', id),
    openAddItwVehicleWindow: () => ipcRenderer.send('open-add-itw-vehicle-window'),
    // RTW/NEF vehicles
    getRtwVehicles: () => ipcRenderer.invoke('get-rtw-vehicles'),
    addRtwVehicle: (v: any) => ipcRenderer.invoke('add-rtw-vehicle', v),
    updateRtwVehicle: (v: any) => ipcRenderer.invoke('update-rtw-vehicle', v),
    deleteRtwVehicle: (id: number) => ipcRenderer.invoke('delete-rtw-vehicle', id),
    updateRtwVehicleOrder: (order: number[]) => ipcRenderer.invoke('update-rtw-vehicle-order', order),
    getNefVehicles: () => ipcRenderer.invoke('get-nef-vehicles'),
    addNefVehicle: (v: any) => ipcRenderer.invoke('add-nef-vehicle', v),
    updateNefVehicle: (v: any) => ipcRenderer.invoke('update-nef-vehicle', v),
    deleteNefVehicle: (id: number) => ipcRenderer.invoke('delete-nef-vehicle', id),
    updateNefVehicleOrder: (order: number[]) => ipcRenderer.invoke('update-nef-vehicle-order', order),
    setNefOccupancy: (id: number, mode: '24h'|'tag') => ipcRenderer.invoke('set-nef-occupancy', id, mode),
    openAddRtwWindow: () => ipcRenderer.send('open-add-rtw-window'),
    openAddNefWindow: () => ipcRenderer.send('open-add-nef-window'),
    onVehiclesUpdated: (callback: () => void) => ipcRenderer.on('vehicles-updated', callback),
    offVehiclesUpdated: (callback: () => void) => ipcRenderer.removeListener('vehicles-updated', callback),
    // Vehicle Positions
    getVehiclePositions: (vehicleType: string, vehicleId: number) => ipcRenderer.invoke('get-vehicle-positions', vehicleType, vehicleId),
    getVehiclePositionsWithQualifications: (vehicleType: string, vehicleId: number) => ipcRenderer.invoke('get-vehicle-positions-with-qualifications', vehicleType, vehicleId),
    addVehiclePosition: (position: any) => ipcRenderer.invoke('add-vehicle-position', position),
    updateVehiclePosition: (position: any) => ipcRenderer.invoke('update-vehicle-position', position),
    deleteVehiclePosition: (id: number) => ipcRenderer.invoke('delete-vehicle-position', id),
    updateVehiclePositionOrder: (order: number[]) => ipcRenderer.invoke('update-vehicle-position-order', order),
    // Vehicle monthly activation (deprecated - use vehicle periods)
    getRtwVehicleActivations: (year: number) => ipcRenderer.invoke('get-rtw-vehicle-activations', year),
    setRtwVehicleActivation: (vehicleId: number, year: number, month: number, enabled: boolean) => ipcRenderer.invoke('set-rtw-vehicle-activation', vehicleId, year, month, enabled),
    getNefVehicleActivations: (year: number) => ipcRenderer.invoke('get-nef-vehicle-activations', year),
    setNefVehicleActivation: (vehicleId: number, year: number, month: number, enabled: boolean) => ipcRenderer.invoke('set-nef-vehicle-activation', vehicleId, year, month, enabled),
    // RTW Vehicle Periods
    getRtwVehiclePeriods: (vehicleId: number) => ipcRenderer.invoke('get-rtw-vehicle-periods', vehicleId),
    getAllRtwVehiclePeriods: () => ipcRenderer.invoke('get-all-rtw-vehicle-periods'),
    addRtwVehiclePeriod: (period: any) => ipcRenderer.invoke('add-rtw-vehicle-period', period),
    updateRtwVehiclePeriod: (period: any) => ipcRenderer.invoke('update-rtw-vehicle-period', period),
    deleteRtwVehiclePeriod: (id: number) => ipcRenderer.invoke('delete-rtw-vehicle-period', id),
    // NEF Vehicle Periods
    getNefVehiclePeriods: (vehicleId: number) => ipcRenderer.invoke('get-nef-vehicle-periods', vehicleId),
    getAllNefVehiclePeriods: () => ipcRenderer.invoke('get-all-nef-vehicle-periods'),
    addNefVehiclePeriod: (period: any) => ipcRenderer.invoke('add-nef-vehicle-period', period),
    updateNefVehiclePeriod: (period: any) => ipcRenderer.invoke('update-nef-vehicle-period', period),
    deleteNefVehiclePeriod: (id: number) => ipcRenderer.invoke('delete-nef-vehicle-period', id),
    // Holidays
    getHolidaysForYear: (year: number) => ipcRenderer.invoke('get-holidays', year),
    setHolidaysForYear: (year: number, dates: { date: string, name?: string }[]) => ipcRenderer.invoke('set-holidays', year, dates),
    addHoliday: (date: string, name?: string) => ipcRenderer.invoke('add-holiday', date, name ?? ''),
    deleteHoliday: (date: string) => ipcRenderer.invoke('delete-holiday', date),
    // ITW Patterns
    getItwPatterns: () => ipcRenderer.invoke('get-itw-patterns'),
    setItwPatterns: (patterns: { startDate: string, pattern: string }[]) => ipcRenderer.invoke('set-itw-patterns', patterns),
    // Department Patterns
    getDeptPatterns: () => ipcRenderer.invoke('get-dept-patterns'),
    setDeptPatterns: (patterns: { startDate: string, pattern: string }[]) => ipcRenderer.invoke('set-dept-patterns', patterns),
    // File dialogs & roster import
    showOpenDialog: (options: any) => ipcRenderer.invoke('show-open-dialog', options),
    showSaveDialog: (options: any) => ipcRenderer.invoke('show-save-dialog', options),
    showMessageBox: (options: any) => ipcRenderer.invoke('show-message-box', options),
    createDatabaseBackup: (opts?: { year?: number; month?: number }) => ipcRenderer.invoke('create-database-backup', opts),
    getDatabaseSummary: (year?: number, month?: number) => ipcRenderer.invoke('get-database-summary', year, month),
    listBackups: (limit?: number) => ipcRenderer.invoke('list-backups', limit),
    getBackupSummary: (backupDir: string, year?: number, month?: number) => ipcRenderer.invoke('get-backup-summary', backupDir, year, month),
    restoreBackup: (backupDir: string) => ipcRenderer.invoke('restore-backup', backupDir),
    // Update Management
    getCurrentVersion: () => ipcRenderer.invoke('get-current-version'),
    createManualBackup: (label: string) => ipcRenderer.invoke('create-manual-backup', label),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    performManualUpdate: () => ipcRenderer.invoke('perform-manual-update'),
    // Roster Import
    importDutyRoster: (filePath: string, year: number, month?: number, options?: { mappings?: Record<string, number> }) => ipcRenderer.invoke('import-duty-roster', filePath, year, month, options),
    previewDutyRoster: (filePath: string, year: number, month?: number) => ipcRenderer.invoke('preview-duty-roster-import', filePath, year, month),
    // Year Plannings
    getYearPlannings: () => ipcRenderer.invoke('get-year-plannings'),
    getYearPlanningForYear: (year: number) => ipcRenderer.invoke('get-year-planning-for-year', year),
    saveYearPlannings: (plannings: { year: number; filePath: string }[]) => ipcRenderer.invoke('save-year-plannings', plannings),
    deleteYearPlanning: (year: number) => ipcRenderer.invoke('delete-year-planning', year),
    openItwWindow: () => ipcRenderer.send('open-itw-window'),
    openVehiclesWindow: () => ipcRenderer.send('open-vehicles-window'),
    openValuesWindow: () => ipcRenderer.send('open-values-window'),
    openAddItwWindow: () => ipcRenderer.send('open-add-itw-window'),
    openTestConsoleWindow: () => ipcRenderer.send('open-test-console-window'),
    openEditItwWindow: (id: number) => ipcRenderer.send('open-edit-itw-window', id),
    onItwUpdated: (callback: () => void) => ipcRenderer.on('itw-updated', callback),
    offItwUpdated: (callback: () => void) => ipcRenderer.removeListener('itw-updated', callback),
    // Utils
    clearSlotAssignments: () => ipcRenderer.invoke('clear-slot-assignments'),
    assignSlot: (entry: { personId: number, personType: string, date: string, slotType: string }) => ipcRenderer.invoke('assign-slot', entry),
    // Diagnostics
    getDiagnostics: () => ipcRenderer.invoke('get-diagnostics'),
    testQualificationPeriods: () => ipcRenderer.invoke('test-qualification-periods'),
    // DB config
    getDbConfig: () => ipcRenderer.invoke('get-db-config'),
    setDbDir: (dir: string) => ipcRenderer.invoke('set-db-dir', dir),
    // Setup wizard
    getSetupDefaults: () => ipcRenderer.invoke('get-setup-defaults'),
    testDirWritable: (dir: string) => ipcRenderer.invoke('test-dir-writable', dir),
    finalizeSetup: (dir: string) => ipcRenderer.invoke('finalize-setup', dir),
});

// Ergänze für Electron Dialog API
contextBridge.exposeInMainWorld('electronAPI', {
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args)
});