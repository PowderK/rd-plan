"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Small helper to safely stringify arguments
function safeStringify(arg) {
    if (typeof arg === 'string')
        return arg;
    try {
        return JSON.stringify(arg);
    }
    catch (e) {
        try {
            return String(arg);
        }
        catch (_) {
            return '<unserializable>';
        }
    }
}
// Forward basic console calls from renderer to main so they appear in the terminal
try {
    const _log = console.log.bind(console);
    console.log = (...args) => {
        try {
            electron_1.ipcRenderer.send('renderer-log', { level: 'log', args: args.map(safeStringify) });
        }
        catch (e) { }
        _log(...args);
    };
    const _warn = console.warn.bind(console);
    console.warn = (...args) => {
        try {
            electron_1.ipcRenderer.send('renderer-log', { level: 'warn', args: args.map(safeStringify) });
        }
        catch (e) { }
        _warn(...args);
    };
    const _error = console.error.bind(console);
    console.error = (...args) => {
        try {
            electron_1.ipcRenderer.send('renderer-log', { level: 'error', args: args.map(safeStringify) });
        }
        catch (e) { }
        _error(...args);
    };
}
catch (e) {
    // ipcRenderer might not be available in some contexts
}
electron_1.contextBridge.exposeInMainWorld('api', {
    getShifts: () => electron_1.ipcRenderer.invoke('get-shifts'),
    getPersonnel: () => electron_1.ipcRenderer.invoke('get-personnel'),
    updateShift: (shift) => electron_1.ipcRenderer.invoke('update-shift', shift),
    getSetting: (key) => electron_1.ipcRenderer.invoke('get-setting', key),
    setSetting: (key, value) => electron_1.ipcRenderer.invoke('set-setting', key, value),
    openSettingsWindow: () => electron_1.ipcRenderer.send('open-settings-window'),
    onSettingsUpdated: (callback) => electron_1.ipcRenderer.on('settings-updated', callback),
    offSettingsUpdated: (callback) => electron_1.ipcRenderer.removeListener('settings-updated', callback),
    openPersonnelWindow: () => electron_1.ipcRenderer.send('open-personnel-window'),
    openAddPersonWindow: () => electron_1.ipcRenderer.send('open-add-person-window'),
    openEditPersonWindow: (id) => electron_1.ipcRenderer.send('open-edit-person-window', id),
    openConfirmDeleteWindow: (id, type = 'person') => electron_1.ipcRenderer.send('open-confirm-delete-window', id, type),
    getPersonnelList: () => electron_1.ipcRenderer.invoke('get-personnel-list'),
    addPerson: (person) => electron_1.ipcRenderer.invoke('add-person', person),
    updatePerson: (person) => electron_1.ipcRenderer.invoke('update-person', person),
    deletePerson: (id) => electron_1.ipcRenderer.invoke('delete-person', id),
    updatePersonnelOrder: (order) => electron_1.ipcRenderer.invoke('update-personnel-order', order),
    onPersonnelUpdated: (callback) => electron_1.ipcRenderer.on('personnel-updated', callback),
    offPersonnelUpdated: (callback) => electron_1.ipcRenderer.removeListener('personnel-updated', callback),
    getPerson: (id) => electron_1.ipcRenderer.invoke('get-person', id),
    quitApp: () => electron_1.ipcRenderer.send('quit-app'),
    openDutyRosterWindow: () => electron_1.ipcRenderer.send('open-duty-roster-window'),
    getShiftTypes: () => electron_1.ipcRenderer.invoke('get-shift-types'),
    addShiftType: (type) => electron_1.ipcRenderer.invoke('add-shift-type', type),
    updateShiftType: (type) => electron_1.ipcRenderer.invoke('update-shift-type', type),
    deleteShiftType: (id) => electron_1.ipcRenderer.invoke('delete-shift-type', id),
    getDutyRoster: (year) => electron_1.ipcRenderer.invoke('get-duty-roster', year),
    setDutyRosterEntry: (entry) => electron_1.ipcRenderer.invoke('set-duty-roster-entry', entry),
    bulkSetDutyRoster: (entries) => electron_1.ipcRenderer.invoke('bulk-set-duty-roster', entries),
    clearDutyRosterYear: (year) => electron_1.ipcRenderer.invoke('clear-duty-roster-year', year),
    clearDutyRosterMonth: (year, month) => electron_1.ipcRenderer.invoke('clear-duty-roster-month', year, month),
    onBulkImportProgress: (cb) => electron_1.ipcRenderer.on('bulk-import-progress', cb),
    offBulkImportProgress: (cb) => electron_1.ipcRenderer.removeListener('bulk-import-progress', cb),
    onDutyRosterUpdated: (callback) => electron_1.ipcRenderer.on('duty-roster-updated', callback),
    offDutyRosterUpdated: (callback) => electron_1.ipcRenderer.removeListener('duty-roster-updated', callback),
    openAzubiWindow: () => electron_1.ipcRenderer.send('open-azubi-window'),
    getAzubiList: () => electron_1.ipcRenderer.invoke('get-azubi-list'),
    addAzubi: (azubi) => electron_1.ipcRenderer.invoke('add-azubi', azubi),
    updateAzubi: (azubi) => electron_1.ipcRenderer.invoke('update-azubi', azubi),
    deleteAzubi: (id) => electron_1.ipcRenderer.invoke('delete-azubi', id),
    updateAzubiOrder: (order) => electron_1.ipcRenderer.invoke('update-azubi-order', order),
    openAddAzubiWindow: () => electron_1.ipcRenderer.send('open-add-azubi-window'),
    openEditAzubiWindow: (id) => electron_1.ipcRenderer.send('open-edit-azubi-window', id),
    onAzubisUpdated: (callback) => electron_1.ipcRenderer.on('azubis-updated', callback),
    offAzubisUpdated: (callback) => electron_1.ipcRenderer.removeListener('azubis-updated', callback),
    // ITW doctors
    getItwDoctors: () => electron_1.ipcRenderer.invoke('get-itw-doctors'),
    addItwDoctor: (doc) => electron_1.ipcRenderer.invoke('add-itw-doctor', doc),
    updateItwDoctor: (doc) => electron_1.ipcRenderer.invoke('update-itw-doctor', doc),
    deleteItwDoctor: (id) => electron_1.ipcRenderer.invoke('delete-itw-doctor', id),
    updateItwDoctorOrder: (order) => electron_1.ipcRenderer.invoke('update-itw-doctor-order', order),
    // RTW/NEF vehicles
    getRtwVehicles: () => electron_1.ipcRenderer.invoke('get-rtw-vehicles'),
    addRtwVehicle: (v) => electron_1.ipcRenderer.invoke('add-rtw-vehicle', v),
    updateRtwVehicle: (v) => electron_1.ipcRenderer.invoke('update-rtw-vehicle', v),
    deleteRtwVehicle: (id) => electron_1.ipcRenderer.invoke('delete-rtw-vehicle', id),
    updateRtwVehicleOrder: (order) => electron_1.ipcRenderer.invoke('update-rtw-vehicle-order', order),
    getNefVehicles: () => electron_1.ipcRenderer.invoke('get-nef-vehicles'),
    addNefVehicle: (v) => electron_1.ipcRenderer.invoke('add-nef-vehicle', v),
    updateNefVehicle: (v) => electron_1.ipcRenderer.invoke('update-nef-vehicle', v),
    deleteNefVehicle: (id) => electron_1.ipcRenderer.invoke('delete-nef-vehicle', id),
    updateNefVehicleOrder: (order) => electron_1.ipcRenderer.invoke('update-nef-vehicle-order', order),
    setNefOccupancy: (id, mode) => electron_1.ipcRenderer.invoke('set-nef-occupancy', id, mode),
    openAddRtwWindow: () => electron_1.ipcRenderer.send('open-add-rtw-window'),
    openAddNefWindow: () => electron_1.ipcRenderer.send('open-add-nef-window'),
    // Vehicle monthly activation
    getRtwVehicleActivations: (year) => electron_1.ipcRenderer.invoke('get-rtw-vehicle-activations', year),
    setRtwVehicleActivation: (vehicleId, year, month, enabled) => electron_1.ipcRenderer.invoke('set-rtw-vehicle-activation', vehicleId, year, month, enabled),
    getNefVehicleActivations: (year) => electron_1.ipcRenderer.invoke('get-nef-vehicle-activations', year),
    setNefVehicleActivation: (vehicleId, year, month, enabled) => electron_1.ipcRenderer.invoke('set-nef-vehicle-activation', vehicleId, year, month, enabled),
    // Holidays
    getHolidaysForYear: (year) => electron_1.ipcRenderer.invoke('get-holidays', year),
    setHolidaysForYear: (year, dates) => electron_1.ipcRenderer.invoke('set-holidays', year, dates),
    addHoliday: (date, name) => electron_1.ipcRenderer.invoke('add-holiday', date, name ?? ''),
    deleteHoliday: (date) => electron_1.ipcRenderer.invoke('delete-holiday', date),
    // ITW Patterns
    getItwPatterns: () => electron_1.ipcRenderer.invoke('get-itw-patterns'),
    setItwPatterns: (patterns) => electron_1.ipcRenderer.invoke('set-itw-patterns', patterns),
    // Department Patterns
    getDeptPatterns: () => electron_1.ipcRenderer.invoke('get-dept-patterns'),
    setDeptPatterns: (patterns) => electron_1.ipcRenderer.invoke('set-dept-patterns', patterns),
    openItwWindow: () => electron_1.ipcRenderer.send('open-itw-window'),
    openVehiclesWindow: () => electron_1.ipcRenderer.send('open-vehicles-window'),
    openValuesWindow: () => electron_1.ipcRenderer.send('open-values-window'),
    openAddItwWindow: () => electron_1.ipcRenderer.send('open-add-itw-window'),
    openEditItwWindow: (id) => electron_1.ipcRenderer.send('open-edit-itw-window', id),
    onItwUpdated: (callback) => electron_1.ipcRenderer.on('itw-updated', callback),
    offItwUpdated: (callback) => electron_1.ipcRenderer.removeListener('itw-updated', callback),
    // Utils
    clearSlotAssignments: () => electron_1.ipcRenderer.invoke('clear-slot-assignments'),
    assignSlot: (entry) => electron_1.ipcRenderer.invoke('assign-slot', entry),
});
// Ergänze für Electron Dialog API
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    invoke: (channel, ...args) => electron_1.ipcRenderer.invoke(channel, ...args)
});
