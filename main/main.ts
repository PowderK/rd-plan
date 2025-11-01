import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import path from 'path';
import url from 'url';
import { initializeDatabaseManager, DatabaseAdapter, createDatabaseBackup, listDatabaseBackups, getSummaryForBackup, restoreDatabaseFromBackup, previewDutyRosterImport } from './database-manager';

let databaseAdapter: DatabaseAdapter | null = null;
let settingsWindow: BrowserWindow | null = null;
let personnelWindow: BrowserWindow | null = null;
let addPersonWindow: BrowserWindow | null = null;
let editPersonWindow: BrowserWindow | null = null;
let confirmDeleteWindow: BrowserWindow | null = null;
let dutyRosterWindow: BrowserWindow | null = null;
let azubiWindow: BrowserWindow | null = null;
let itwWindow: BrowserWindow | null = null;
let vehiclesWindow: BrowserWindow | null = null;
let addRtwWindow: BrowserWindow | null = null;
let addNefWindow: BrowserWindow | null = null;

// Helper function to ensure database is initialized
async function ensureDatabaseAdapter(): Promise<DatabaseAdapter> {
    if (!databaseAdapter) {
        databaseAdapter = await initializeDatabaseManager();
    }
    return databaseAdapter;
}

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

// Clear duty roster for year/month
ipcMain.handle('clear-duty-roster-year', async (_event, year: number) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.clearDutyRosterForYear(year);
    BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('duty-roster-updated'); } catch {} });
    return true;
});
ipcMain.handle('clear-duty-roster-month', async (_event, year: number, month: number) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.clearDutyRosterForMonth(year, month);
    BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('duty-roster-updated'); } catch {} });
    return true;
});

async function createWindow() {
    databaseAdapter = await initializeDatabaseManager();
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    const isDev = process.argv.includes('--dev');
    if (isDev) {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
        mainWindow.webContents.openDevTools();
    } else {
        const filePath = path.join(__dirname, '../renderer/index.html');
        mainWindow.loadFile(filePath);
    }

    mainWindow.on('closed', () => {
        // Handled by app.on('window-all-closed')
    });
}

// (instrumentation removed) global startup logging and handlers were removed

// Settings handlers
ipcMain.handle('get-setting', async (_event, key: string) => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getSetting(key);
});

ipcMain.handle('set-setting', async (_event, key: string, value: string) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.setSetting(key, value);
    return true;
});

// Personnel handlers
ipcMain.handle('get-personnel', async () => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getPersonnel();
});

ipcMain.handle('get-personnel-list', async () => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getPersonnel();
});

ipcMain.handle('add-personnel', async (_event, person: any) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.addPersonnel(person);
    BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('personnel-updated'); } catch {} });
    return true;
});

ipcMain.handle('update-personnel', async (_event, person: any) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.updatePersonnel(person);
    BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('personnel-updated'); } catch {} });
    return true;
});

ipcMain.handle('delete-personnel', async (_event, id: number) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.deletePersonnel(id);
    BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('personnel-updated'); } catch {} });
    return true;
});

ipcMain.handle('update-personnel-order', async (_event, order: number[]) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.updatePersonnelOrder(order);
    BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('personnel-updated'); } catch {} });
    return true;
});

// Shift type handlers
ipcMain.handle('get-shift-types', async () => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getShiftTypes();
});

ipcMain.handle('add-shift-type', async (_event, type: any) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.addShiftType(type);
    return true;
});

ipcMain.handle('update-shift-type', async (_event, type: any) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.updateShiftType(type);
    return true;
});

ipcMain.handle('delete-shift-type', async (_event, id: number) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.deleteShiftType(id);
    return true;
});

// Duty roster handlers
ipcMain.handle('get-duty-roster', async (_event, year: number) => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getDutyRoster(year);
});

ipcMain.handle('set-duty-roster-entry', async (_event, entry: any) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.setDutyRosterEntry(entry);
    BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('duty-roster-updated'); } catch {} });
    return true;
});

ipcMain.handle('bulk-set-duty-roster-entries', async (_event, entries: any[]) => {
    const adapter = await ensureDatabaseAdapter();
    const result = await adapter.bulkSetDutyRosterEntries(entries);
    BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('duty-roster-updated'); } catch {} });
    return result;
});

// Azubi handlers
ipcMain.handle('get-azubi-list', async () => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getAzubiList();
});

ipcMain.handle('add-azubi', async (_event, azubi: any) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.addAzubi(azubi);
    BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('azubi-updated'); } catch {} });
    return true;
});

ipcMain.handle('update-azubi', async (_event, azubi: any) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.updateAzubi(azubi);
    BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('azubi-updated'); } catch {} });
    return true;
});

ipcMain.handle('delete-azubi', async (_event, id: number) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.deleteAzubi(id);
    BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('azubi-updated'); } catch {} });
    return true;
});

// ITW Doctor handlers
ipcMain.handle('get-itw-doctors', async () => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getItwDoctors();
});

ipcMain.handle('add-itw-doctor', async (_event, doctor: any) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.addItwDoctor(doctor);
    BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('itw-doctors-updated'); } catch {} });
    return true;
});

ipcMain.handle('update-itw-doctor', async (_event, doctor: any) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.updateItwDoctor(doctor);
    BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('itw-doctors-updated'); } catch {} });
    return true;
});

ipcMain.handle('delete-itw-doctor', async (_event, id: number) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.deleteItwDoctor(id);
    BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('itw-doctors-updated'); } catch {} });
    return true;
});

// Vehicle handlers
ipcMain.handle('get-rtw-vehicles', async (_event, year?: number) => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getRtwVehicles(year);
});

ipcMain.handle('get-nef-vehicles', async (_event, year?: number) => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getNefVehicles(year);
});

ipcMain.handle('get-rtw-vehicle-activations', async (_event, year: number) => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getRtwVehicleActivations(year);
});

ipcMain.handle('set-rtw-vehicle-activation', async (_event, vehicleId: number, year: number, month: number, enabled: boolean) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.setRtwVehicleActivation(vehicleId, year, month, enabled);
    return true;
});

ipcMain.handle('get-nef-vehicle-activations', async (_event, year: number) => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getNefVehicleActivations(year);
});

ipcMain.handle('set-nef-vehicle-activation', async (_event, vehicleId: number, year: number, month: number, enabled: boolean) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.setNefVehicleActivation(vehicleId, year, month, enabled);
    return true;
});

// Holiday handlers
ipcMain.handle('get-holidays-for-year', async (_event, year: number) => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getHolidaysForYear(year);
});

ipcMain.handle('get-holidays', async (_event, year: number) => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getHolidaysForYear(year);
});

ipcMain.handle('set-holidays-for-year', async (_event, year: number, dates: any[]) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.setHolidaysForYear(year, dates);
    return true;
});

// Pattern handlers
ipcMain.handle('get-itw-patterns', async () => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getItwPatterns();
});

ipcMain.handle('set-itw-patterns', async (_event, patterns: any[]) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.setItwPatterns(patterns);
    return true;
});

ipcMain.handle('get-dept-patterns', async () => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getDeptPatterns();
});

ipcMain.handle('set-dept-patterns', async (_event, patterns: any[]) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.setDeptPatterns(patterns);
    return true;
});

// Excel Import/Export handlers
ipcMain.handle('import-personnel-excel', async (_event, filePath: string, replaceExisting = false) => {
    const adapter = await ensureDatabaseAdapter();
    const result = await adapter.importPersonnelFromExcel(filePath, replaceExisting);
    if (result.success) {
        BrowserWindow.getAllWindows().forEach(w => { try { w.webContents.send('personnel-updated'); } catch {} });
    }
    return result;
});

ipcMain.handle('export-personnel-excel', async (_event, filePath: string) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.exportPersonnelToExcel(filePath);
    return true;
});

ipcMain.handle('create-personnel-template', async (_event, filePath: string) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.createPersonnelTemplate(filePath);
    return true;
});

// File dialog handlers
ipcMain.handle('show-open-dialog', async (_event, options: any) => {
    const result = await dialog.showOpenDialog(options);
    return result;
});

ipcMain.handle('show-save-dialog', async (_event, options: any) => {
    const result = await dialog.showSaveDialog(options);
    return result;
});

// Message box handler (native Confirm/Info/Warning dialogs)
ipcMain.handle('show-message-box', async (_event, options: Electron.MessageBoxOptions) => {
    const result = await dialog.showMessageBox(options);
    return result;
});

// Create database backup (SQLite file copy)
ipcMain.handle('create-database-backup', async (_event, opts?: { year?: number; month?: number }) => {
    try {
        const dir = await createDatabaseBackup(opts);
        return { success: true, dir };
    } catch (e: any) {
        console.error('[Main] Backup error', e);
        return { success: false, message: e?.message || String(e) };
    }
});

// DB summary for preview (counts for given year/month)
ipcMain.handle('get-database-summary', async (_event, year?: number, month?: number) => {
    try {
        const adapter = await ensureDatabaseAdapter();
        const [pers, az] = await Promise.all([
            adapter.getPersonnel(),
            adapter.getAzubiList(),
        ]);
        let roster = await adapter.getDutyRoster(year ?? new Date().getFullYear());
        if (typeof month === 'number') {
            roster = (roster || []).filter(r => {
                if (!r || !r.date) return false;
                const d = new Date(String(r.date));
                return d.getMonth() === month;
            });
        }
        return {
            success: true,
            counts: {
                personnel: pers?.length || 0,
                azubis: az?.length || 0,
                dutyRoster: roster?.length || 0,
            }
        };
    } catch (e: any) {
        console.error('[Main] get-database-summary error', e);
        return { success: false, message: e?.message || String(e) };
    }
});

// Backups: list, summary, restore
ipcMain.handle('list-backups', async (_event, limit?: number) => {
    try {
        const list = await listDatabaseBackups(limit);
        return { success: true, list };
    } catch (e: any) {
        console.error('[Main] list-backups error', e);
        return { success: false, message: e?.message || String(e) };
    }
});

ipcMain.handle('get-backup-summary', async (_event, backupDir: string, year?: number, month?: number) => {
    try {
        const counts = await getSummaryForBackup(backupDir, year, month);
        return { success: true, counts };
    } catch (e: any) {
        console.error('[Main] get-backup-summary error', e);
        return { success: false, message: e?.message || String(e) };
    }
});

ipcMain.handle('restore-backup', async (_event, backupDir: string) => {
    try {
        await restoreDatabaseFromBackup(backupDir);
        // After restore, relaunch app to ensure DB connection reloads
        app.relaunch();
        app.exit(0);
        return { success: true };
    } catch (e: any) {
        console.error('[Main] restore-backup error', e);
        return { success: false, message: e?.message || String(e) };
    }
});

// Settings Import/Export handlers
ipcMain.handle('import-settings-json', async (_event, filePath: string, replaceExisting: boolean = false) => {
    try {
        console.log('[Main] Settings JSON import started:', { filePath, replaceExisting });
        const adapter = await ensureDatabaseAdapter();
        const result = await adapter.importSettingsFromJson(filePath, replaceExisting);
        console.log('[Main] Settings JSON import completed:', result);
        
        // Notify all windows about settings update
        BrowserWindow.getAllWindows().forEach(w => {
            try { w.webContents.send('settings-updated'); } catch {}
        });
        
        return result;
    } catch (error) {
        console.error('[Main] Settings JSON import error:', error);
        throw error;
    }
});

ipcMain.handle('export-settings-json', async (_event, filePath: string) => {
    try {
        console.log('[Main] Settings JSON export started:', filePath);
        const adapter = await ensureDatabaseAdapter();
        await adapter.exportSettingsToJson(filePath);
        console.log('[Main] Settings JSON export completed');
        return { success: true };
    } catch (error) {
        console.error('[Main] Settings JSON export error:', error);
        throw error;
    }
});

ipcMain.handle('export-settings-excel', async (_event, filePath: string) => {
    try {
        console.log('[Main] Settings Excel export started:', filePath);
        const adapter = await ensureDatabaseAdapter();
        await adapter.exportSettingsToExcel(filePath);
        console.log('[Main] Settings Excel export completed');
        return { success: true };
    } catch (error) {
        console.error('[Main] Settings Excel export error:', error);
        throw error;
    }
});

ipcMain.handle('create-settings-template', async (_event, filePath: string) => {
    try {
        console.log('[Main] Settings template creation started:', filePath);
        const adapter = await ensureDatabaseAdapter();
        await adapter.createSettingsTemplate(filePath);
        console.log('[Main] Settings template creation completed');
        return { success: true };
    } catch (error) {
        console.error('[Main] Settings template creation error:', error);
        throw error;
    }
});

// Roster Import handler
ipcMain.handle('import-duty-roster', async (_event, filePath: string, year: number, month?: number, options?: { mappings?: Record<string, number> }) => {
    try {
        console.log('[Main] Duty roster import started:', { filePath, year, month });
        const adapter = await ensureDatabaseAdapter();
        const result = await adapter.importDutyRoster(filePath, year, month, options);
        console.log('[Main] Duty roster import completed:', result);
        
        if (result.success) {
            // Notify all windows about the update
            BrowserWindow.getAllWindows().forEach(w => {
                try { w.webContents.send('duty-roster-updated'); } catch {}
            });
        }
        
        return result;
    } catch (error) {
        console.error('[Main] Duty roster import error:', error);
        const message = error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten.';
        return { success: false, message: `Fehler beim Import: ${message}`, importedCount: 0 };
    }
});

// Roster Import preview handler
ipcMain.handle('preview-duty-roster-import', async (_event, filePath: string, year: number, month?: number) => {
    try {
        const result = await previewDutyRosterImport(filePath, year, month);
        return result;
    } catch (error) {
        console.error('[Main] preview-duty-roster-import error:', error);
        const message = error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten.';
        return { success: false, message };
    }
});

// Window management functions
function openWindow(htmlFile: string, windowVar: string, width = 800, height = 600) {
    const win = new BrowserWindow({
        width,
        height,
        webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    const filePath = path.join(__dirname, `../renderer/${htmlFile}`);
    win.loadFile(filePath);

    win.on('closed', () => {
        (global as any)[windowVar] = null;
    });

    return win;
}

// Window opening handlers
ipcMain.handle('open-settings', () => {
    if (!settingsWindow) {
        settingsWindow = openWindow('settings.html', 'settingsWindow');
    } else {
        settingsWindow.focus();
    }
    return true;
});

ipcMain.handle('open-personnel', () => {
    if (!personnelWindow) {
        personnelWindow = openWindow('personnel.html', 'personnelWindow', 1000, 700);
    } else {
        personnelWindow.focus();
    }
    return true;
});

ipcMain.handle('open-duty-roster', () => {
    if (!dutyRosterWindow) {
        dutyRosterWindow = openWindow('dutyRoster.html', 'dutyRosterWindow', 1400, 900);
    } else {
        dutyRosterWindow.focus();
    }
    return true;
});

ipcMain.handle('open-azubis', () => {
    if (!azubiWindow) {
        azubiWindow = openWindow('azubis.html', 'azubiWindow', 800, 600);
    } else {
        azubiWindow.focus();
    }
    return true;
});

// App quit handler
ipcMain.on('quit-app', async () => {
    if (databaseAdapter) {
        await databaseAdapter.close();
    }
    app.quit();
});

// App event handlers
app.whenReady().then(async () => {
    // Enforce a Content-Security-Policy for all renderer responses to avoid
    // the Electron insecure-CSP warning. We set a reasonably strict policy
    // keeping 'unsafe-inline' for styles because some renderer pages rely on it.
    try {
        const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';";
        session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
            const responseHeaders = details.responseHeaders || {};
            // Overwrite or set CSP header
            responseHeaders['Content-Security-Policy'] = [csp];
            callback({ responseHeaders });
        });
    } catch (e) {
        console.warn('[Main] Failed to register CSP header handler', e);
    }

    await createWindow();
});

app.on('window-all-closed', async () => {
    if (databaseAdapter) {
        await databaseAdapter.close();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});