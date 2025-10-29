import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import url from 'url';
import { initializeDatabase, getSetting, setSetting, getPersonnel, addPersonnel, updatePersonnel, deletePersonnel, updatePersonnelOrder, getShiftTypes, addShiftType, updateShiftType, deleteShiftType, getDutyRoster, setDutyRosterEntry, getAzubiList, addAzubi, updateAzubi, deleteAzubi, updateAzubiOrder, getItwDoctors, addItwDoctor, updateItwDoctor, deleteItwDoctor, updateItwDoctorOrder, clearSlotAssignments, assignSlot } from './database';

let db: any;
let settingsWindow: BrowserWindow | null = null;
let personnelWindow: BrowserWindow | null = null;
let addPersonWindow: BrowserWindow | null = null;
let editPersonWindow: BrowserWindow | null = null;
let confirmDeleteWindow: BrowserWindow | null = null;
let dutyRosterWindow: BrowserWindow | null = null;
let azubiWindow: BrowserWindow | null = null;
let itwWindow: BrowserWindow | null = null;

// Print renderer logs forwarded via preload
ipcMain.on('renderer-log', (_event, { level, args }) => {
    try {
        const payload = Array.isArray(args) ? args.join(' ') : String(args);
        if (level === 'error') console.error(`[Renderer] ${payload}`);
        else if (level === 'warn') console.warn(`[Renderer] ${payload}`);
        else console.log(`[Renderer] ${payload}`);
    } catch (e) {
        console.log('[Renderer] <log parse error>');
    }
});

async function createWindow() {
    db = await initializeDatabase();
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            contextIsolation: true,
        },
    });

    const indexPath = path.join(__dirname, '../../dist/renderer/index.html');
    console.log('[Main] Loading renderer index file:', indexPath);
    mainWindow.loadFile(indexPath);
    // Öffne DevTools nur, wenn DEVTOOLS_ON_START gesetzt ist (z.B. bei aktivem Debugging)
    try {
        const openDev = process.env.DEVTOOLS_ON_START === '1' || process.env.DEVTOOLS_ON_START === 'true';
        if (openDev) mainWindow.webContents.openDevTools();
    } catch (e) { /* ignore env access errors */ }
}

function createSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }
    settingsWindow = new BrowserWindow({
        width: 800,
        height: 600,
        resizable: true,
        minimizable: true,
        maximizable: true,
        parent: BrowserWindow.getAllWindows()[0],
        modal: true,
        webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            contextIsolation: true,
        },
    });
    settingsWindow.loadFile(path.join(__dirname, '../../dist/renderer/settings.html'));
    settingsWindow.on('closed', () => {
        settingsWindow = null;
        // Sende Event an Hauptfenster, damit es die Einstellungen neu lädt
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
            mainWindow.webContents.send('settings-updated');
        }
    });
}

function createPersonnelWindow() {
    if (personnelWindow) {
        personnelWindow.focus();
        return;
    }
    personnelWindow = new BrowserWindow({
        width: 600,
        height: 500,
        resizable: true,
        minimizable: false,
        maximizable: false,
        parent: BrowserWindow.getAllWindows()[0],
        modal: true,
        webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            contextIsolation: true,
        },
    });
    personnelWindow.loadFile(path.join(__dirname, '../../dist/renderer/personnel.html'));
    personnelWindow.on('closed', () => {
        personnelWindow = null;
    });
}

function createAddPersonWindow() {
    if (addPersonWindow) {
        addPersonWindow.focus();
        return;
    }
    addPersonWindow = new BrowserWindow({
        width: 400,
        height: 350,
        resizable: false,
        minimizable: false,
        maximizable: false,
        parent: BrowserWindow.getAllWindows()[0],
        // modal: true, // temporär auskommentiert für Debugging
        webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            contextIsolation: true,
        },
    });
    addPersonWindow.loadFile(path.join(__dirname, '../../dist/renderer/addPerson.html'));
    addPersonWindow.on('closed', () => {
        addPersonWindow = null;
    });
}

function createEditPersonWindow(personId: number) {
    if (editPersonWindow) {
        editPersonWindow.focus();
        return;
    }
    editPersonWindow = new BrowserWindow({
        width: 400,
        height: 350,
        resizable: false,
        minimizable: false,
        maximizable: false,
        parent: BrowserWindow.getAllWindows()[0],
        // modal: true, // temporär auskommentiert für Debugging
        webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            contextIsolation: true,
        },
    });
    editPersonWindow.loadFile(
        path.join(__dirname, '../../dist/renderer/editPerson.html'),
        { query: { id: String(personId) } }
    );
    editPersonWindow.on('closed', () => {
        editPersonWindow = null;
    });
}

function createConfirmDeleteWindow(personId: number, personType: string = 'person') {
    if (confirmDeleteWindow) {
        confirmDeleteWindow.focus();
        return;
    }
    confirmDeleteWindow = new BrowserWindow({
        width: 350,
        height: 180,
        resizable: false,
        minimizable: false,
        maximizable: false,
        parent: BrowserWindow.getAllWindows()[0],
        // modal: true, // temporär auskommentiert für Debugging
        webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            contextIsolation: true,
        },
    });
    confirmDeleteWindow.loadFile(
        path.join(__dirname, '../../dist/renderer/confirmDelete.html'),
        { query: { id: String(personId), type: personType } }
    );
    confirmDeleteWindow.on('closed', () => {
        confirmDeleteWindow = null;
    });
}

function createDutyRosterWindow() {
    if (dutyRosterWindow) {
        dutyRosterWindow.focus();
        return;
    }
    dutyRosterWindow = new BrowserWindow({
        width: 1200,
        height: 700,
        resizable: true,
        minimizable: false,
        maximizable: true,
        webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            contextIsolation: true,
        },
    });
    dutyRosterWindow.loadFile(path.join(__dirname, '../../dist/renderer/dutyRoster.html'));
    console.log('[Main] Loading renderer dutyRoster file:', path.join(__dirname, '../../dist/renderer/dutyRoster.html'));
    dutyRosterWindow.on('closed', () => {
        dutyRosterWindow = null;
    });
}

function createAzubiWindow() {
  const preloadPath = path.join(__dirname, '../preload.js');
  console.log('[AzubiWindow] Preload-Pfad:', preloadPath);
  const win = new BrowserWindow({
    width: 600,
    height: 500,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Azubis',
  });
  win.loadFile(path.join(__dirname, '../renderer/azubis.html'));
}

function createItwWindow() {
    const preloadPath = path.join(__dirname, '../preload.js');
    const win = new BrowserWindow({
        width: 600,
        height: 500,
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
        },
        title: 'ITW Ärzte',
    });
    win.loadFile(path.join(__dirname, '../renderer/itw.html'));
}

function createAddItwWindow() {
    const preloadPath = path.join(__dirname, '../preload.js');
    const win = new BrowserWindow({
        width: 400,
        height: 300,
        resizable: false,
        minimizable: false,
        maximizable: false,
        parent: itwWindow ?? BrowserWindow.getAllWindows()[0],
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
        },
        title: 'ITW Arzt hinzufügen',
    });
    win.loadFile(path.join(__dirname, '../renderer/addItw.html'));
}

function createEditItwWindow(id: number) {
    const preloadPath = path.join(__dirname, '../preload.js');
    const filePath = path.join(__dirname, '../renderer/editItw.html');
    const winUrl = url.format({ pathname: filePath, protocol: 'file:', slashes: true, query: { id } });
    const win = new BrowserWindow({
        width: 400,
        height: 300,
        resizable: false,
        minimizable: false,
        maximizable: false,
        parent: itwWindow ?? BrowserWindow.getAllWindows()[0],
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
        },
        title: 'ITW Arzt bearbeiten',
    });
    win.loadURL(winUrl);
}

function createAddAzubiWindow() {
  const preloadPath = path.join(__dirname, '../preload.js');
  const win = new BrowserWindow({
    width: 400,
    height: 320,
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: azubiWindow ?? BrowserWindow.getAllWindows()[0],
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Azubi hinzufügen',
  });
  win.loadFile(path.join(__dirname, '../renderer/azubiAdd.html'));
}

function createEditAzubiWindow(id: number) {
  const preloadPath = path.join(__dirname, '../preload.js');
  const filePath = path.join(__dirname, '../renderer/editAzubi.html');
  const winUrl = url.format({
    pathname: filePath,
    protocol: 'file:',
    slashes: true,
    query: { id }
  });
  const win = new BrowserWindow({
    width: 400,
    height: 320,
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: azubiWindow ?? BrowserWindow.getAllWindows()[0],
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Azubi bearbeiten',
  });
  win.loadURL(winUrl);
}

app.whenReady().then(createWindow);

ipcMain.handle('get-setting', async (_event, key: string) => {
    if (!db) db = await initializeDatabase();
    return await getSetting(db, key);
});

ipcMain.handle('set-setting', async (_event, key: string, value: string) => {
    if (!db) db = await initializeDatabase();
    await setSetting(db, key, value);
    return true;
});

ipcMain.handle('get-personnel-list', async () => {
    if (!db) db = await initializeDatabase();
    return await getPersonnel(db);
});

function sendPersonnelUpdatedToPersonnelWindow() {
    // Sende Event an alle offenen Fenster so, dass jede Renderer-Instanz die Personnel-Liste neu laden kann.
    try {
        const all = BrowserWindow.getAllWindows();
        if (all && all.length > 0) {
            console.log('[Main] Broadcasting personnel-updated to all windows (count=' + all.length + ')');
            all.forEach(w => {
                try { w.webContents.send('personnel-updated'); } catch (e) { console.warn('[Main] Fehler beim Senden an ein Fenster', e); }
            });
        } else {
            console.log('[Main] Keine offenen Fenster zum Broadcasten von personnel-updated gefunden');
        }
    } catch (e) {
        console.error('[Main] Fehler in sendPersonnelUpdatedToPersonnelWindow', e);
    }
}

ipcMain.handle('add-person', async (_event, person) => {
    if (!db) db = await initializeDatabase();
    await addPersonnel(db, person);
    sendPersonnelUpdatedToPersonnelWindow();
    return true;
});
ipcMain.handle('update-person', async (_event, person) => {
    if (!db) db = await initializeDatabase();
    await updatePersonnel(db, person);
    sendPersonnelUpdatedToPersonnelWindow();
    return true;
});
ipcMain.handle('delete-person', async (_event, id) => {
    if (!db) db = await initializeDatabase();
    await deletePersonnel(db, id);
    sendPersonnelUpdatedToPersonnelWindow();
    return true;
});
ipcMain.handle('update-personnel-order', async (_event, order) => {
    if (!db) db = await initializeDatabase();
    await updatePersonnelOrder(db, order);
    sendPersonnelUpdatedToPersonnelWindow();
    return true;
});
ipcMain.handle('get-person', async (_event, id) => {
    if (!db) db = await initializeDatabase();
    const row = await db.get('SELECT * FROM personnel WHERE id = ?', [id]);
    return row;
});

ipcMain.handle('get-shift-types', async () => {
    if (!db) db = await initializeDatabase();
    return await getShiftTypes(db);
});
ipcMain.handle('add-shift-type', async (_event, type) => {
    if (!db) db = await initializeDatabase();
    await addShiftType(db, type);
    // Notify renderers that settings/shift types changed
    try {
        BrowserWindow.getAllWindows().forEach(w => {
            try { w.webContents.send('settings-updated'); } catch (e) {}
        });
    } catch (e) { /* ignore */ }
    return true;
});
ipcMain.handle('update-shift-type', async (_event, type) => {
    if (!db) db = await initializeDatabase();
    await updateShiftType(db, type);
    try {
        BrowserWindow.getAllWindows().forEach(w => {
            try { w.webContents.send('settings-updated'); } catch (e) {}
        });
    } catch (e) { /* ignore */ }
    return true;
});
ipcMain.handle('delete-shift-type', async (_event, id) => {
    if (!db) db = await initializeDatabase();
    await deleteShiftType(db, id);
    try {
        BrowserWindow.getAllWindows().forEach(w => {
            try { w.webContents.send('settings-updated'); } catch (e) {}
        });
    } catch (e) { /* ignore */ }
    return true;
});
ipcMain.handle('get-duty-roster', async (_event, year) => {
    console.log('[Main] IPC get-duty-roster year=', year);
    if (!db) db = await initializeDatabase();
    const rows = await getDutyRoster(db, year);
    console.log('[Main] get-duty-roster returned', Array.isArray(rows) ? rows.length : typeof rows);
    return rows;
});
ipcMain.handle('set-duty-roster-entry', async (_event, entry) => {
    console.log('[Main] IPC set-duty-roster-entry', entry);
    if (!db) db = await initializeDatabase();
    await setDutyRosterEntry(db, entry);
    // Broadcast to all renderer windows that the duty roster changed
    console.log('[Main] Broadcasting duty-roster-updated to all windows');
    BrowserWindow.getAllWindows().forEach(w => {
        try { w.webContents.send('duty-roster-updated', entry); } catch (e) { /* ignore */ }
    });
    return true;
});
ipcMain.handle('assign-slot', async (_event, entry) => {
    console.log('[Main] IPC assign-slot', entry);
    if (!db) db = await initializeDatabase();
    await assignSlot(db, entry);
    BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('duty-roster-updated', entry); } catch (e) {} });
    return true;
});
ipcMain.handle('add-azubi', async (_event, azubi) => {
  if (!db) db = await initializeDatabase();
  await addAzubi(db, azubi);
    // Broadcast to all renderer windows that azubis changed
    try {
        BrowserWindow.getAllWindows().forEach(w => {
            try { w.webContents.send('azubis-updated'); } catch (e) { /* ignore */ }
        });
    } catch (e) { /* ignore */ }
  return true;
});
ipcMain.handle('update-azubi', async (_event, azubi) => {
  if (!db) db = await initializeDatabase();
  await updateAzubi(db, azubi);
    try {
        BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('azubis-updated'); } catch (e) {} });
    } catch (e) {}
  return true;
});
ipcMain.handle('get-azubi-list', async () => {
  if (!db) db = await initializeDatabase();
  return await getAzubiList(db);
});
ipcMain.handle('update-azubi-order', async (_event, order: number[]) => {
    if (!db) db = await initializeDatabase();
    await updateAzubiOrder(db, order);
    try { BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('azubis-updated'); } catch (e) {} }); } catch (e) {}
    return true;
});
// ITW doctors
ipcMain.handle('get-itw-doctors', async () => {
    if (!db) db = await initializeDatabase();
    return await getItwDoctors(db);
});
ipcMain.handle('add-itw-doctor', async (_event, doc) => {
    if (!db) db = await initializeDatabase();
    await addItwDoctor(db, doc);
    try { BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('itw-updated'); } catch (e) {} }); } catch (e) {}
    return true;
});
ipcMain.handle('update-itw-doctor', async (_event, doc) => {
    if (!db) db = await initializeDatabase();
    await updateItwDoctor(db, doc);
    try { BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('itw-updated'); } catch (e) {} }); } catch (e) {}
    return true;
});
ipcMain.handle('delete-itw-doctor', async (_event, id: number) => {
    if (!db) db = await initializeDatabase();
    await deleteItwDoctor(db, id);
    try { BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('itw-updated'); } catch (e) {} }); } catch (e) {}
    return true;
});
ipcMain.handle('update-itw-doctor-order', async (_event, order: number[]) => {
    if (!db) db = await initializeDatabase();
    await updateItwDoctorOrder(db, order);
    try { BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('itw-updated'); } catch (e) {} }); } catch (e) {}
    return true;
});
ipcMain.handle('delete-azubi', async (_event, id: number) => {
    if (!db) db = await initializeDatabase();
    await deleteAzubi(db, id);
    try {
        BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('azubis-updated'); } catch (e) {} });
    } catch (e) {}
    return true;
});

ipcMain.handle('clear-slot-assignments', async () => {
    if (!db) db = await initializeDatabase();
    await clearSlotAssignments(db);
    try {
        BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('duty-roster-updated'); } catch (e) {} });
    } catch (e) {}
    return true;
});

ipcMain.on('open-settings-window', () => {
    createSettingsWindow();
});

ipcMain.on('open-personnel-window', () => {
    createPersonnelWindow();
});

ipcMain.on('open-add-person-window', () => {
    createAddPersonWindow();
});
ipcMain.on('open-edit-person-window', (_event, personId: number) => {
    createEditPersonWindow(personId);
});
ipcMain.on('open-confirm-delete-window', (_event, personId: number, personType: string = 'person') => {
    createConfirmDeleteWindow(personId, personType);
});
ipcMain.on('open-duty-roster-window', () => {
    createDutyRosterWindow();
});
ipcMain.on('open-azubi-window', () => {
  createAzubiWindow();
});
ipcMain.on('open-add-azubi-window', () => {
  createAddAzubiWindow();
});
ipcMain.on('open-edit-azubi-window', (_event, id: number) => {
  createEditAzubiWindow(id);
});
ipcMain.on('open-itw-window', () => {
    createItwWindow();
});
ipcMain.on('open-add-itw-window', () => {
    createAddItwWindow();
});
ipcMain.on('open-edit-itw-window', (_event, id: number) => {
    createEditItwWindow(id);
});
ipcMain.on('quit-app', () => {
    app.quit();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});