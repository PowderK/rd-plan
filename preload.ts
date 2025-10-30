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
    getPersonnel: () => ipcRenderer.invoke('get-personnel'),
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
    getPersonnelList: () => ipcRenderer.invoke('get-personnel-list'),
    addPerson: (person: any) => ipcRenderer.invoke('add-person', person),
    updatePerson: (person: any) => ipcRenderer.invoke('update-person', person),
    deletePerson: (id: number) => ipcRenderer.invoke('delete-person', id),
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
    updateAzubiOrder: (order: number[]) => ipcRenderer.invoke('update-azubi-order', order),
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
    // Vehicle monthly activation
    getRtwVehicleActivations: (year: number) => ipcRenderer.invoke('get-rtw-vehicle-activations', year),
    setRtwVehicleActivation: (vehicleId: number, year: number, month: number, enabled: boolean) => ipcRenderer.invoke('set-rtw-vehicle-activation', vehicleId, year, month, enabled),
    getNefVehicleActivations: (year: number) => ipcRenderer.invoke('get-nef-vehicle-activations', year),
    setNefVehicleActivation: (vehicleId: number, year: number, month: number, enabled: boolean) => ipcRenderer.invoke('set-nef-vehicle-activation', vehicleId, year, month, enabled),
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
    openItwWindow: () => ipcRenderer.send('open-itw-window'),
    openVehiclesWindow: () => ipcRenderer.send('open-vehicles-window'),
    openValuesWindow: () => ipcRenderer.send('open-values-window'),
    openAddItwWindow: () => ipcRenderer.send('open-add-itw-window'),
    openEditItwWindow: (id: number) => ipcRenderer.send('open-edit-itw-window', id),
    onItwUpdated: (callback: () => void) => ipcRenderer.on('itw-updated', callback),
    offItwUpdated: (callback: () => void) => ipcRenderer.removeListener('itw-updated', callback),
    // Utils
    clearSlotAssignments: () => ipcRenderer.invoke('clear-slot-assignments'),
    assignSlot: (entry: { personId: number, personType: string, date: string, slotType: string }) => ipcRenderer.invoke('assign-slot', entry),
});

// Ergänze für Electron Dialog API
contextBridge.exposeInMainWorld('electronAPI', {
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args)
});