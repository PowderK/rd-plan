"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const database_manager_1 = require("./database-manager");
let databaseAdapter = null;
let settingsWindow = null;
let personnelWindow = null;
let addPersonWindow = null;
let editPersonWindow = null;
let confirmDeleteWindow = null;
let dutyRosterWindow = null;
let azubiWindow = null;
let itwWindow = null;
let vehiclesWindow = null;
let addRtwWindow = null;
let addNefWindow = null;
// Helper function to ensure database is initialized
async function ensureDatabaseAdapter() {
    if (!databaseAdapter) {
        databaseAdapter = await (0, database_manager_1.initializeDatabaseManager)();
    }
    return databaseAdapter;
}
// Print renderer logs forwarded via preload
electron_1.ipcMain.on('renderer-log', (_event, { level, args }) => {
    try {
        const payload = Array.isArray(args) ? args.join(' ') : String(args);
        if (level === 'error')
            console.error(`[Renderer] ${payload}`);
        else if (level === 'warn')
            console.warn(`[Renderer] ${payload}`);
        else
            console.log(`[Renderer] ${payload}`);
    }
    catch (e) {
        console.log('[Renderer] <log parse error>');
    }
});
// Clear duty roster for year/month
electron_1.ipcMain.handle('clear-duty-roster-year', async (_event, year) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.clearDutyRosterForYear(year);
    electron_1.BrowserWindow.getAllWindows().forEach(w => { try {
        w.webContents.send('duty-roster-updated');
    }
    catch { } });
    return true;
});
electron_1.ipcMain.handle('clear-duty-roster-month', async (_event, year, month) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.clearDutyRosterForMonth(year, month);
    electron_1.BrowserWindow.getAllWindows().forEach(w => { try {
        w.webContents.send('duty-roster-updated');
    }
    catch { } });
    return true;
});
async function createWindow() {
    databaseAdapter = await (0, database_manager_1.initializeDatabaseManager)();
    const mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path_1.default.join(__dirname, '../preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    const isDev = process.argv.includes('--dev');
    if (isDev) {
        mainWindow.loadFile(path_1.default.join(__dirname, '../renderer/index.html'));
        mainWindow.webContents.openDevTools();
    }
    else {
        const filePath = path_1.default.join(__dirname, '../renderer/index.html');
        mainWindow.loadFile(filePath);
    }
    mainWindow.on('closed', () => {
        // Handled by app.on('window-all-closed')
    });
}
// Settings handlers
electron_1.ipcMain.handle('get-setting', async (_event, key) => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getSetting(key);
});
electron_1.ipcMain.handle('set-setting', async (_event, key, value) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.setSetting(key, value);
    return true;
});
// Personnel handlers
electron_1.ipcMain.handle('get-personnel', async () => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getPersonnel();
});
electron_1.ipcMain.handle('get-personnel-list', async () => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getPersonnel();
});
electron_1.ipcMain.handle('add-personnel', async (_event, person) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.addPersonnel(person);
    electron_1.BrowserWindow.getAllWindows().forEach(w => { try {
        w.webContents.send('personnel-updated');
    }
    catch { } });
    return true;
});
electron_1.ipcMain.handle('update-personnel', async (_event, person) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.updatePersonnel(person);
    electron_1.BrowserWindow.getAllWindows().forEach(w => { try {
        w.webContents.send('personnel-updated');
    }
    catch { } });
    return true;
});
electron_1.ipcMain.handle('delete-personnel', async (_event, id) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.deletePersonnel(id);
    electron_1.BrowserWindow.getAllWindows().forEach(w => { try {
        w.webContents.send('personnel-updated');
    }
    catch { } });
    return true;
});
electron_1.ipcMain.handle('update-personnel-order', async (_event, order) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.updatePersonnelOrder(order);
    electron_1.BrowserWindow.getAllWindows().forEach(w => { try {
        w.webContents.send('personnel-updated');
    }
    catch { } });
    return true;
});
// Shift type handlers
electron_1.ipcMain.handle('get-shift-types', async () => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getShiftTypes();
});
electron_1.ipcMain.handle('add-shift-type', async (_event, type) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.addShiftType(type);
    return true;
});
electron_1.ipcMain.handle('update-shift-type', async (_event, type) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.updateShiftType(type);
    return true;
});
electron_1.ipcMain.handle('delete-shift-type', async (_event, id) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.deleteShiftType(id);
    return true;
});
// Duty roster handlers
electron_1.ipcMain.handle('get-duty-roster', async (_event, year) => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getDutyRoster(year);
});
electron_1.ipcMain.handle('set-duty-roster-entry', async (_event, entry) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.setDutyRosterEntry(entry);
    electron_1.BrowserWindow.getAllWindows().forEach(w => { try {
        w.webContents.send('duty-roster-updated');
    }
    catch { } });
    return true;
});
electron_1.ipcMain.handle('bulk-set-duty-roster-entries', async (_event, entries) => {
    const adapter = await ensureDatabaseAdapter();
    const result = await adapter.bulkSetDutyRosterEntries(entries);
    electron_1.BrowserWindow.getAllWindows().forEach(w => { try {
        w.webContents.send('duty-roster-updated');
    }
    catch { } });
    return result;
});
// Azubi handlers
electron_1.ipcMain.handle('get-azubi-list', async () => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getAzubiList();
});
electron_1.ipcMain.handle('add-azubi', async (_event, azubi) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.addAzubi(azubi);
    electron_1.BrowserWindow.getAllWindows().forEach(w => { try {
        w.webContents.send('azubi-updated');
    }
    catch { } });
    return true;
});
electron_1.ipcMain.handle('update-azubi', async (_event, azubi) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.updateAzubi(azubi);
    electron_1.BrowserWindow.getAllWindows().forEach(w => { try {
        w.webContents.send('azubi-updated');
    }
    catch { } });
    return true;
});
electron_1.ipcMain.handle('delete-azubi', async (_event, id) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.deleteAzubi(id);
    electron_1.BrowserWindow.getAllWindows().forEach(w => { try {
        w.webContents.send('azubi-updated');
    }
    catch { } });
    return true;
});
// ITW Doctor handlers
electron_1.ipcMain.handle('get-itw-doctors', async () => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getItwDoctors();
});
electron_1.ipcMain.handle('add-itw-doctor', async (_event, doctor) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.addItwDoctor(doctor);
    electron_1.BrowserWindow.getAllWindows().forEach(w => { try {
        w.webContents.send('itw-doctors-updated');
    }
    catch { } });
    return true;
});
electron_1.ipcMain.handle('update-itw-doctor', async (_event, doctor) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.updateItwDoctor(doctor);
    electron_1.BrowserWindow.getAllWindows().forEach(w => { try {
        w.webContents.send('itw-doctors-updated');
    }
    catch { } });
    return true;
});
electron_1.ipcMain.handle('delete-itw-doctor', async (_event, id) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.deleteItwDoctor(id);
    electron_1.BrowserWindow.getAllWindows().forEach(w => { try {
        w.webContents.send('itw-doctors-updated');
    }
    catch { } });
    return true;
});
// Vehicle handlers
electron_1.ipcMain.handle('get-rtw-vehicles', async (_event, year) => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getRtwVehicles(year);
});
electron_1.ipcMain.handle('get-nef-vehicles', async (_event, year) => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getNefVehicles(year);
});
electron_1.ipcMain.handle('get-rtw-vehicle-activations', async (_event, year) => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getRtwVehicleActivations(year);
});
electron_1.ipcMain.handle('set-rtw-vehicle-activation', async (_event, vehicleId, year, month, enabled) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.setRtwVehicleActivation(vehicleId, year, month, enabled);
    return true;
});
electron_1.ipcMain.handle('get-nef-vehicle-activations', async (_event, year) => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getNefVehicleActivations(year);
});
electron_1.ipcMain.handle('set-nef-vehicle-activation', async (_event, vehicleId, year, month, enabled) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.setNefVehicleActivation(vehicleId, year, month, enabled);
    return true;
});
// Holiday handlers
electron_1.ipcMain.handle('get-holidays-for-year', async (_event, year) => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getHolidaysForYear(year);
});
electron_1.ipcMain.handle('get-holidays', async (_event, year) => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getHolidaysForYear(year);
});
electron_1.ipcMain.handle('set-holidays-for-year', async (_event, year, dates) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.setHolidaysForYear(year, dates);
    return true;
});
// Pattern handlers
electron_1.ipcMain.handle('get-itw-patterns', async () => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getItwPatterns();
});
electron_1.ipcMain.handle('set-itw-patterns', async (_event, patterns) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.setItwPatterns(patterns);
    return true;
});
electron_1.ipcMain.handle('get-dept-patterns', async () => {
    const adapter = await ensureDatabaseAdapter();
    return await adapter.getDeptPatterns();
});
electron_1.ipcMain.handle('set-dept-patterns', async (_event, patterns) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.setDeptPatterns(patterns);
    return true;
});
// Excel Import/Export handlers
electron_1.ipcMain.handle('import-personnel-excel', async (_event, filePath, replaceExisting = false) => {
    const adapter = await ensureDatabaseAdapter();
    const result = await adapter.importPersonnelFromExcel(filePath, replaceExisting);
    if (result.success) {
        electron_1.BrowserWindow.getAllWindows().forEach(w => { try {
            w.webContents.send('personnel-updated');
        }
        catch { } });
    }
    return result;
});
electron_1.ipcMain.handle('export-personnel-excel', async (_event, filePath) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.exportPersonnelToExcel(filePath);
    return true;
});
electron_1.ipcMain.handle('create-personnel-template', async (_event, filePath) => {
    const adapter = await ensureDatabaseAdapter();
    await adapter.createPersonnelTemplate(filePath);
    return true;
});
// File dialog handlers
electron_1.ipcMain.handle('show-open-dialog', async (_event, options) => {
    const result = await electron_1.dialog.showOpenDialog(options);
    return result;
});
electron_1.ipcMain.handle('show-save-dialog', async (_event, options) => {
    const result = await electron_1.dialog.showSaveDialog(options);
    return result;
});
// Settings Import/Export handlers
electron_1.ipcMain.handle('import-settings-json', async (_event, filePath, replaceExisting = false) => {
    try {
        console.log('[Main] Settings JSON import started:', { filePath, replaceExisting });
        const adapter = await ensureDatabaseAdapter();
        const result = await adapter.importSettingsFromJson(filePath, replaceExisting);
        console.log('[Main] Settings JSON import completed:', result);
        // Notify all windows about settings update
        electron_1.BrowserWindow.getAllWindows().forEach(w => {
            try {
                w.webContents.send('settings-updated');
            }
            catch { }
        });
        return result;
    }
    catch (error) {
        console.error('[Main] Settings JSON import error:', error);
        throw error;
    }
});
electron_1.ipcMain.handle('export-settings-json', async (_event, filePath) => {
    try {
        console.log('[Main] Settings JSON export started:', filePath);
        const adapter = await ensureDatabaseAdapter();
        await adapter.exportSettingsToJson(filePath);
        console.log('[Main] Settings JSON export completed');
        return { success: true };
    }
    catch (error) {
        console.error('[Main] Settings JSON export error:', error);
        throw error;
    }
});
electron_1.ipcMain.handle('export-settings-excel', async (_event, filePath) => {
    try {
        console.log('[Main] Settings Excel export started:', filePath);
        const adapter = await ensureDatabaseAdapter();
        await adapter.exportSettingsToExcel(filePath);
        console.log('[Main] Settings Excel export completed');
        return { success: true };
    }
    catch (error) {
        console.error('[Main] Settings Excel export error:', error);
        throw error;
    }
});
electron_1.ipcMain.handle('create-settings-template', async (_event, filePath) => {
    try {
        console.log('[Main] Settings template creation started:', filePath);
        const adapter = await ensureDatabaseAdapter();
        await adapter.createSettingsTemplate(filePath);
        console.log('[Main] Settings template creation completed');
        return { success: true };
    }
    catch (error) {
        console.error('[Main] Settings template creation error:', error);
        throw error;
    }
});
// Window management functions
function openWindow(htmlFile, windowVar, width = 800, height = 600) {
    const win = new electron_1.BrowserWindow({
        width,
        height,
        webPreferences: {
            preload: path_1.default.join(__dirname, '../preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    const filePath = path_1.default.join(__dirname, `../renderer/${htmlFile}`);
    win.loadFile(filePath);
    win.on('closed', () => {
        global[windowVar] = null;
    });
    return win;
}
// Window opening handlers
electron_1.ipcMain.handle('open-settings', () => {
    if (!settingsWindow) {
        settingsWindow = openWindow('settings.html', 'settingsWindow');
    }
    else {
        settingsWindow.focus();
    }
    return true;
});
electron_1.ipcMain.handle('open-personnel', () => {
    if (!personnelWindow) {
        personnelWindow = openWindow('personnel.html', 'personnelWindow', 1000, 700);
    }
    else {
        personnelWindow.focus();
    }
    return true;
});
electron_1.ipcMain.handle('open-duty-roster', () => {
    if (!dutyRosterWindow) {
        dutyRosterWindow = openWindow('dutyRoster.html', 'dutyRosterWindow', 1400, 900);
    }
    else {
        dutyRosterWindow.focus();
    }
    return true;
});
electron_1.ipcMain.handle('open-azubis', () => {
    if (!azubiWindow) {
        azubiWindow = openWindow('azubis.html', 'azubiWindow', 800, 600);
    }
    else {
        azubiWindow.focus();
    }
    return true;
});
// App quit handler
electron_1.ipcMain.on('quit-app', async () => {
    if (databaseAdapter) {
        await databaseAdapter.close();
    }
    electron_1.app.quit();
});
// App event handlers
electron_1.app.whenReady().then(createWindow);
electron_1.app.on('window-all-closed', async () => {
    if (databaseAdapter) {
        await databaseAdapter.close();
    }
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
