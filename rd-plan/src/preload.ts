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
    openItwWindow: () => ipcRenderer.send('open-itw-window'),
    openAddItwWindow: () => ipcRenderer.send('open-add-itw-window'),
    openEditItwWindow: (id: number) => ipcRenderer.send('open-edit-itw-window', id),
    onItwUpdated: (callback: () => void) => ipcRenderer.on('itw-updated', callback),
    offItwUpdated: (callback: () => void) => ipcRenderer.removeListener('itw-updated', callback),
    // Utils
    clearSlotAssignments: () => ipcRenderer.invoke('clear-slot-assignments'),
    assignSlot: (entry: { personId: number, personType: string, date: string, slotType: string }) => ipcRenderer.invoke('assign-slot', entry),
});