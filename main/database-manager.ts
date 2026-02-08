import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { AsyncDB, initializeDatabase as initSQLiteDatabase, QualificationType } from './database';
import { initializePostgreSQLDatabase, PostgresConfig } from './database-postgres';

export type DatabaseMode = 'sqlite' | 'central-sqlite' | 'postgresql';

export interface DatabaseConfig {
  mode: DatabaseMode;
  multiUser?: boolean;
  centralPath?: string;
  postgresConfig?: PostgresConfig;
}

export interface DatabaseAdapter {
  getPersonnel(includeInactive?: boolean, date?: string): Promise<any[]>;
  setPersonnelActive(id: number, active: boolean): Promise<void>;
  getPersonById(id: number): Promise<any | null>;
  addPersonnel(person: any): Promise<any>;
  updatePersonnel(person: any): Promise<void>;
  deletePersonnel(id: number): Promise<void>;
  updatePersonnelOrder(order: number[]): Promise<void>;

  getDutyRoster(year: number): Promise<any[]>;
  setDutyRosterEntry(entry: any): Promise<{ success: boolean; warning?: string; vehicleAssignment?: string }>;
  bulkSetDutyRosterEntries(entries: any[]): Promise<number>;
  bulkImportDutyRosterEntries(entries: any[], respectManualEdits?: boolean, deleteEmpty?: boolean): Promise<{ imported: number, skipped: number }>;

  getAzubiList(): Promise<any[]>;
  getAzubi(id: number): Promise<any | null>;
  addAzubi(azubi: any): Promise<any>;
  updateAzubi(azubi: any): Promise<void>;
  deleteAzubi(id: number): Promise<void>;
  updateAzubiOrder(order: number[]): Promise<void>;

  // Azubi Periods
  getAzubiPeriods(azubiId: number): Promise<any[]>;
  getAllAzubiPeriods(): Promise<any[]>;
  addAzubiPeriod(period: any): Promise<void>;
  updateAzubiPeriod(period: any): Promise<void>;
  deleteAzubiPeriod(id: number): Promise<void>;

  // Qualification Periods
  getQualificationPeriods(personId: number): Promise<any[]>;
  getAllQualificationPeriods(): Promise<any[]>;
  addQualificationPeriod(period: any): Promise<void>;
  updateQualificationPeriod(period: any): Promise<void>;
  deleteQualificationPeriod(id: number): Promise<void>;
  hasQualificationInMonth(personId: number, qualType: string, yearMonth: string): Promise<boolean>;
  getActiveQualifications(personId: number, yearMonth: string): Promise<any[]>;
  validateQualificationForShift(personId: number, shiftValue: string, date: string, cellType?: string): Promise<any>;

  // Personnel Active Periods
  getPersonnelActivePeriods(personId: number): Promise<any[]>;
  getAllPersonnelActivePeriods(): Promise<any[]>;
  addPersonnelActivePeriod(period: any): Promise<void>;
  updatePersonnelActivePeriod(period: any): Promise<void>;
  deletePersonnelActivePeriod(id: number): Promise<void>;
  isPersonnelActiveInMonth(personId: number, yearMonth: string): Promise<boolean>;

  // Qualification Types Management
  getQualificationTypes(activeOnly?: boolean): Promise<any[]>;
  addQualificationType(qualType: any): Promise<void>;
  updateQualificationType(qualType: QualificationType): Promise<void>;
  deleteQualificationType(id: number): Promise<void>;
  getQualifiedPersonsForPosition(position: string, date: string, cellType?: string): Promise<{ id: number; name: string; vorname: string; qualifications: string[]; isAzubi?: boolean; lehrjahr?: number }[]>;

  // NEF vehicles

  getItwDoctors(): Promise<any[]>;
  addItwDoctor(doc: any): Promise<void>;
  updateItwDoctor(doc: any): Promise<void>;
  deleteItwDoctor(id: number): Promise<void>;
  updateItwDoctorOrder(order: number[]): Promise<void>;

  getRtwVehicles(year?: number): Promise<any[]>;
  addRtwVehicle(v: { name: string }): Promise<void>;
  updateRtwVehicle(v: { id: number, name: string }): Promise<void>;
  deleteRtwVehicle(id: number, currentYear?: number): Promise<void>;
  updateRtwVehicleOrder(order: number[]): Promise<void>;
  getNefVehicles(year?: number): Promise<any[]>;
  addNefVehicle(v: { name: string, occupancyMode?: '24h' | 'tag' }): Promise<void>;
  updateNefVehicle(v: { id: number, name: string, occupancyMode?: '24h' | 'tag' }): Promise<void>;
  deleteNefVehicle(id: number, currentYear?: number): Promise<void>;
  updateNefVehicleOrder(order: number[]): Promise<void>;

  getItwVehicles(year?: number): Promise<any[]>;
  addItwVehicle(v: { name: string }): Promise<void>;
  updateItwVehicle(v: { id: number, name: string }): Promise<void>;
  deleteItwVehicle(id: number, currentYear?: number): Promise<void>;
  updateItwVehicleOrder(order: number[]): Promise<void>;

  getRtwVehicleActivations(year: number): Promise<any[]>;
  setRtwVehicleActivation(vehicleId: number, year: number, month: number, enabled: boolean): Promise<void>;
  getNefVehicleActivations(year: number): Promise<any[]>;
  setNefVehicleActivation(vehicleId: number, year: number, month: number, enabled: boolean): Promise<void>;
  setNefOccupancyMode(id: number, mode: '24h' | 'tag'): Promise<void>;

  // RTW/NEF Vehicle Periods
  getRtwVehiclePeriods(vehicleId: number): Promise<any[]>;
  getAllRtwVehiclePeriods(): Promise<any[]>;
  addRtwVehiclePeriod(period: any): Promise<void>;
  updateRtwVehiclePeriod(period: any): Promise<void>;
  deleteRtwVehiclePeriod(id: number): Promise<void>;
  getNefVehiclePeriods(vehicleId: number): Promise<any[]>;
  getAllNefVehiclePeriods(): Promise<any[]>;
  addNefVehiclePeriod(period: any): Promise<void>;
  updateNefVehiclePeriod(period: any): Promise<void>;
  deleteNefVehiclePeriod(id: number): Promise<void>;

  getItwVehiclePeriods(vehicleId: number): Promise<any[]>;
  getAllItwVehiclePeriods(): Promise<any[]>;
  addItwVehiclePeriod(period: any): Promise<void>;
  updateItwVehiclePeriod(period: any): Promise<void>;
  deleteItwVehiclePeriod(id: number): Promise<void>;

  // Vehicle Positions
  getVehiclePositions(vehicleType: string, vehicleId: number): Promise<any[]>;
  getVehiclePositionsWithQualifications(vehicleType: string, vehicleId: number): Promise<any[]>;
  addVehiclePosition(position: any): Promise<void>;
  updateVehiclePosition(position: any): Promise<void>;
  deleteVehiclePosition(id: number): Promise<void>;
  updateVehiclePositionOrder(order: number[]): Promise<void>;

  getHolidaysForYear(year: number): Promise<any[]>;
  setHolidaysForYear(year: number, dates: any[]): Promise<void>;
  addHoliday(date: string, name?: string): Promise<void>;
  deleteHoliday(date: string): Promise<void>;

  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;

  getShiftTypes(): Promise<any[]>;
  addShiftType(type: any): Promise<void>;
  updateShiftType(type: any): Promise<void>;
  deleteShiftType(id: number): Promise<void>;

  // Roster Import
  importDutyRoster(filePath: string, year: number, month?: number, options?: { mappings?: Record<string, number> }): Promise<{ success: boolean, message: string, importedCount: number }>;

  // Excel Import/Export für Personal
  importPersonnelFromExcel(filePath: string, replaceExisting: boolean): Promise<any>;
  exportPersonnelToExcel(filePath: string): Promise<void>;
  createPersonnelTemplate(filePath: string): Promise<void>;

  // Settings Import/Export
  importSettingsFromJson(filePath: string, replaceExisting: boolean): Promise<any>;
  exportSettingsToJson(filePath: string): Promise<void>;
  exportSettingsToExcel(filePath: string): Promise<void>;
  createSettingsTemplate(filePath: string): Promise<void>;

  clearDutyRosterForYear(year: number): Promise<void>;
  clearDutyRosterForMonth(year: number, month: number): Promise<void>;
  clearSlotAssignments(): Promise<void>;
  assignSlot(entry: { personId: number, personType: string, date: string, slotType: string }): Promise<void>;

  getItwPatterns(): Promise<any[]>;
  setItwPatterns(patterns: any[]): Promise<void>;
  getDeptPatterns(): Promise<any[]>;
  setDeptPatterns(patterns: any[]): Promise<void>;

  // Year Plannings
  getYearPlannings(): Promise<{ year: number; filePath: string }[]>;
  getYearPlanningForYear(year: number): Promise<{ year: number; filePath: string } | undefined>;
  saveYearPlannings(plannings: { year: number; filePath: string }[]): Promise<void>;
  deleteYearPlanning(year: number): Promise<void>;

  // Excel Import/Export
  importPersonnelFromExcel(filePath: string, replaceExisting?: boolean): Promise<any>;
  exportPersonnelToExcel(filePath: string): Promise<void>;
  createPersonnelTemplate(filePath: string): Promise<void>;

  close(): Promise<void>;
}

class SQLiteAdapter implements DatabaseAdapter {
  constructor(private db: AsyncDB) { }

  async getPersonnel(includeInactive?: boolean, date?: string) {
    const { getPersonnel } = await import('./database');
    return getPersonnel(this.db, !!includeInactive, date);
  }
  async setPersonnelActive(id: number, active: boolean) {
    const { setPersonnelActive } = await import('./database');
    return setPersonnelActive(this.db, id, active);
  }
  async getPersonById(id: number) {
    const { getPersonById } = await import('./database');
    return getPersonById(this.db, id);
  }

  async addPersonnel(person: any) {
    const { addPersonnel } = await import('./database');
    return addPersonnel(this.db, person);
  }

  async updatePersonnel(person: any) {
    const { updatePersonnel } = await import('./database');
    return updatePersonnel(this.db, person);
  }

  async deletePersonnel(id: number) {
    const { deletePersonnel } = await import('./database');
    return deletePersonnel(this.db, id);
  }

  async updatePersonnelOrder(order: number[]) {
    const { updatePersonnelOrder } = await import('./database');
    return updatePersonnelOrder(this.db, order);
  }

  async getDutyRoster(year: number) {
    const { getDutyRoster } = await import('./database');
    return getDutyRoster(this.db, year);
  }

  async setDutyRosterEntry(entry: any) {
    const { setDutyRosterEntry } = await import('./database');
    return setDutyRosterEntry(this.db, entry);
  }

  async bulkSetDutyRosterEntries(entries: any[]) {
    const { bulkSetDutyRosterEntries } = await import('./database');
    return bulkSetDutyRosterEntries(this.db, entries);
  }

  async bulkImportDutyRosterEntries(entries: any[], respectManualEdits: boolean = true, deleteEmpty: boolean = true) {
    const { bulkImportDutyRosterEntries } = await import('./database');
    return bulkImportDutyRosterEntries(this.db, entries, respectManualEdits, deleteEmpty);
  }

  async getAzubiList() {
    const { getAzubiList } = await import('./database');
    return getAzubiList(this.db);
  }

  async getAzubi(id: number) {
    const { getAzubi } = await import('./database');
    return getAzubi(this.db, id);
  }

  async addAzubi(azubi: any) {
    const { addAzubi } = await import('./database');
    return addAzubi(this.db, azubi);
  }

  async updateAzubi(azubi: any) {
    const { updateAzubi } = await import('./database');
    return updateAzubi(this.db, azubi);
  }

  async deleteAzubi(id: number) {
    const { deleteAzubi } = await import('./database');
    return deleteAzubi(this.db, id);
  }

  async updateAzubiOrder(order: number[]) {
    const { updateAzubiOrder } = await import('./database');
    return updateAzubiOrder(this.db, order);
  }

  // Azubi Periods
  async getAzubiPeriods(azubiId: number) {
    const { getAzubiPeriods } = await import('./database');
    return getAzubiPeriods(this.db, azubiId);
  }

  async getAllAzubiPeriods() {
    const { getAllAzubiPeriods } = await import('./database');
    return getAllAzubiPeriods(this.db);
  }

  async addAzubiPeriod(period: any) {
    const { addAzubiPeriod } = await import('./database');
    return addAzubiPeriod(this.db, period);
  }

  async updateAzubiPeriod(period: any) {
    const { updateAzubiPeriod } = await import('./database');
    return updateAzubiPeriod(this.db, period);
  }

  async deleteAzubiPeriod(id: number) {
    const { deleteAzubiPeriod } = await import('./database');
    return deleteAzubiPeriod(this.db, id);
  }

  // Qualification Periods
  async getQualificationPeriods(personId: number) {
    const { getQualificationPeriods } = await import('./database');
    const result = await getQualificationPeriods(this.db, personId);
    return result;
  }

  async getAllQualificationPeriods() {
    const { getAllQualificationPeriods } = await import('./database');
    return getAllQualificationPeriods(this.db);
  }

  async addQualificationPeriod(period: any) {
    const { addQualificationPeriod } = await import('./database');
    return addQualificationPeriod(this.db, period);
  }

  async updateQualificationPeriod(period: any) {
    const { updateQualificationPeriod } = await import('./database');
    return updateQualificationPeriod(this.db, period);
  }

  async deleteQualificationPeriod(id: number) {
    const { deleteQualificationPeriod } = await import('./database');
    return deleteQualificationPeriod(this.db, id);
  }

  async validateQualificationForShift(personId: number, shiftValue: string, date: string, cellType?: string) {
    const { validateQualificationForShift } = await import('./database');
    return validateQualificationForShift(this.db, personId, shiftValue, date, cellType);
  }

  // Personnel Active Periods
  async getPersonnelActivePeriods(personId: number) {
    const { getPersonnelActivePeriods } = await import('./database');
    return getPersonnelActivePeriods(this.db, personId);
  }

  async getAllPersonnelActivePeriods() {
    const { getAllPersonnelActivePeriods } = await import('./database');
    return getAllPersonnelActivePeriods(this.db);
  }

  async addPersonnelActivePeriod(period: any) {
    const { addPersonnelActivePeriod } = await import('./database');
    return addPersonnelActivePeriod(this.db, period);
  }

  async updatePersonnelActivePeriod(period: any) {
    const { updatePersonnelActivePeriod } = await import('./database');
    return updatePersonnelActivePeriod(this.db, period);
  }

  async deletePersonnelActivePeriod(id: number) {
    const { deletePersonnelActivePeriod } = await import('./database');
    return deletePersonnelActivePeriod(this.db, id);
  }

  async isPersonnelActiveInMonth(personId: number, yearMonth: string) {
    const { isPersonnelActiveInMonth } = await import('./database');
    return isPersonnelActiveInMonth(this.db, personId, yearMonth);
  }

  async getQualificationTypes(activeOnly?: boolean) {
    const { getQualificationTypes } = await import('./database');
    return getQualificationTypes(this.db, activeOnly);
  }

  async addQualificationType(qualType: any) {
    const { addQualificationType } = await import('./database');
    return addQualificationType(this.db, qualType);
  }

  async updateQualificationType(qualType: any) {
    const { updateQualificationType } = await import('./database');
    return updateQualificationType(this.db, qualType);
  }

  async deleteQualificationType(id: number) {
    const { deleteQualificationType } = await import('./database');
    return deleteQualificationType(this.db, id);
  }

  async getQualifiedPersonsForPosition(position: string, date: string, cellType?: string) {
    const { getQualifiedPersonsForPosition } = await import('./database');
    return getQualifiedPersonsForPosition(this.db, position, date, cellType);
  }

  async hasQualificationInMonth(personId: number, qualType: string, yearMonth: string) {
    const { hasQualificationInMonth } = await import('./database');
    return hasQualificationInMonth(this.db, personId, qualType, yearMonth);
  }

  async getActiveQualifications(personId: number, yearMonth: string) {
    const { getActiveQualifications } = await import('./database');
    return getActiveQualifications(this.db, personId, yearMonth);
  }

  async getItwDoctors() {
    const { getItwDoctors } = await import('./database');
    return getItwDoctors(this.db);
  }

  async addItwDoctor(doc: any) {
    const { addItwDoctor } = await import('./database');
    return addItwDoctor(this.db, doc);
  }

  async updateItwDoctor(doc: any) {
    const { updateItwDoctor } = await import('./database');
    return updateItwDoctor(this.db, doc);
  }

  async deleteItwDoctor(id: number) {
    const { deleteItwDoctor } = await import('./database');
    return deleteItwDoctor(this.db, id);
  }

  async updateItwDoctorOrder(order: number[]) {
    const { updateItwDoctorOrder } = await import('./database');
    return updateItwDoctorOrder(this.db, order);
  }

  async getRtwVehicles(year?: number) {
    const { getRtwVehicles } = await import('./database');
    return getRtwVehicles(this.db, year);
  }

  async addRtwVehicle(v: { name: string }) {
    const { addRtwVehicle } = await import('./database');
    return addRtwVehicle(this.db, v);
  }

  async updateRtwVehicle(v: { id: number, name: string }) {
    const { updateRtwVehicle } = await import('./database');
    return updateRtwVehicle(this.db, v);
  }

  async deleteRtwVehicle(id: number, currentYear?: number) {
    const { deleteRtwVehicle } = await import('./database');
    return deleteRtwVehicle(this.db, id, currentYear);
  }

  async updateRtwVehicleOrder(order: number[]) {
    const { updateRtwVehicleOrder } = await import('./database');
    return updateRtwVehicleOrder(this.db, order);
  }

  async getNefVehicles(year?: number) {
    const { getNefVehicles } = await import('./database');
    return getNefVehicles(this.db, year);
  }

  async addNefVehicle(v: { name: string, occupancyMode?: '24h' | 'tag' }) {
    const { addNefVehicle } = await import('./database');
    return addNefVehicle(this.db, v);
  }

  async updateNefVehicle(v: { id: number, name: string, occupancyMode?: '24h' | 'tag' }) {
    const { updateNefVehicle } = await import('./database');
    return updateNefVehicle(this.db, v);
  }

  async deleteNefVehicle(id: number, currentYear?: number) {
    const { deleteNefVehicle } = await import('./database');
    return deleteNefVehicle(this.db, id, currentYear);
  }

  async updateNefVehicleOrder(order: number[]) {
    const { updateNefVehicleOrder } = await import('./database');
    return updateNefVehicleOrder(this.db, order);
  }

  async getItwVehicles(year?: number) {
    const { getItwVehicles } = await import('./database');
    return getItwVehicles(this.db, year);
  }

  async addItwVehicle(v: { name: string }) {
    const { addItwVehicle } = await import('./database');
    return addItwVehicle(this.db, v);
  }

  async updateItwVehicle(v: { id: number, name: string }) {
    const { updateItwVehicle } = await import('./database');
    return updateItwVehicle(this.db, v);
  }

  async deleteItwVehicle(id: number, currentYear?: number) {
    const { deleteItwVehicle } = await import('./database');
    return deleteItwVehicle(this.db, id, currentYear);
  }

  async updateItwVehicleOrder(order: number[]) {
    const { updateItwVehicleOrder } = await import('./database');
    return updateItwVehicleOrder(this.db, order);
  }

  async getRtwVehicleActivations(year: number) {
    const { getRtwVehicleActivations } = await import('./database');
    return getRtwVehicleActivations(this.db, year);
  }

  async setRtwVehicleActivation(vehicleId: number, year: number, month: number, enabled: boolean) {
    const { setRtwVehicleActivation } = await import('./database');
    return setRtwVehicleActivation(this.db, vehicleId, year, month, enabled);
  }

  async getNefVehicleActivations(year: number) {
    const { getNefVehicleActivations } = await import('./database');
    return getNefVehicleActivations(this.db, year);
  }

  async setNefVehicleActivation(vehicleId: number, year: number, month: number, enabled: boolean) {
    const { setNefVehicleActivation } = await import('./database');
    return setNefVehicleActivation(this.db, vehicleId, year, month, enabled);
  }

  async setNefOccupancyMode(id: number, mode: '24h' | 'tag') {
    const { setNefOccupancyMode } = await import('./database');
    return setNefOccupancyMode(this.db, id, mode);
  }

  // RTW Vehicle Periods
  async getRtwVehiclePeriods(vehicleId: number) {
    const { getRtwVehiclePeriods } = await import('./database');
    return getRtwVehiclePeriods(this.db, vehicleId);
  }

  async getAllRtwVehiclePeriods() {
    const { getAllRtwVehiclePeriods } = await import('./database');
    return getAllRtwVehiclePeriods(this.db);
  }

  async addRtwVehiclePeriod(period: any) {
    const { addRtwVehiclePeriod } = await import('./database');
    return addRtwVehiclePeriod(this.db, period);
  }

  async updateRtwVehiclePeriod(period: any) {
    const { updateRtwVehiclePeriod } = await import('./database');
    return updateRtwVehiclePeriod(this.db, period);
  }

  async deleteRtwVehiclePeriod(id: number) {
    const { deleteRtwVehiclePeriod } = await import('./database');
    return deleteRtwVehiclePeriod(this.db, id);
  }

  // NEF Vehicle Periods
  async getNefVehiclePeriods(vehicleId: number) {
    const { getNefVehiclePeriods } = await import('./database');
    return getNefVehiclePeriods(this.db, vehicleId);
  }

  async getAllNefVehiclePeriods() {
    const { getAllNefVehiclePeriods } = await import('./database');
    return getAllNefVehiclePeriods(this.db);
  }

  async addNefVehiclePeriod(period: any) {
    const { addNefVehiclePeriod } = await import('./database');
    return addNefVehiclePeriod(this.db, period);
  }

  async updateNefVehiclePeriod(period: any) {
    const { updateNefVehiclePeriod } = await import('./database');
    return updateNefVehiclePeriod(this.db, period);
  }

  async deleteNefVehiclePeriod(id: number) {
    const { deleteNefVehiclePeriod } = await import('./database');
    return deleteNefVehiclePeriod(this.db, id);
  }

  // ITW Vehicle Periods
  async getItwVehiclePeriods(vehicleId: number) {
    const { getItwVehiclePeriods } = await import('./database');
    return getItwVehiclePeriods(this.db, vehicleId);
  }

  async getAllItwVehiclePeriods() {
    const { getAllItwVehiclePeriods } = await import('./database');
    return getAllItwVehiclePeriods(this.db);
  }

  async addItwVehiclePeriod(period: any) {
    const { addItwVehiclePeriod } = await import('./database');
    return addItwVehiclePeriod(this.db, period);
  }

  async updateItwVehiclePeriod(period: any) {
    const { updateItwVehiclePeriod } = await import('./database');
    return updateItwVehiclePeriod(this.db, period);
  }

  async deleteItwVehiclePeriod(id: number) {
    const { deleteItwVehiclePeriod } = await import('./database');
    return deleteItwVehiclePeriod(this.db, id);
  }

  // Vehicle Positions
  async getVehiclePositions(vehicleType: string, vehicleId: number) {
    const { getVehiclePositions } = await import('./database');
    return getVehiclePositions(this.db, vehicleType, vehicleId);
  }

  async getVehiclePositionsWithQualifications(vehicleType: string, vehicleId: number) {
    const { getVehiclePositionsWithQualifications } = await import('./database');
    return getVehiclePositionsWithQualifications(this.db, vehicleType, vehicleId);
  }

  async addVehiclePosition(position: any) {
    const { addVehiclePosition } = await import('./database');
    return addVehiclePosition(this.db, position);
  }

  async updateVehiclePosition(position: any) {
    const { updateVehiclePosition } = await import('./database');
    return updateVehiclePosition(this.db, position);
  }

  async deleteVehiclePosition(id: number) {
    const { deleteVehiclePosition } = await import('./database');
    return deleteVehiclePosition(this.db, id);
  }

  async updateVehiclePositionOrder(order: number[]) {
    const { updateVehiclePositionOrder } = await import('./database');
    return updateVehiclePositionOrder(this.db, order);
  }

  async getHolidaysForYear(year: number) {
    const { getHolidaysForYear } = await import('./database');
    return getHolidaysForYear(this.db, year);
  }

  async setHolidaysForYear(year: number, dates: any[]) {
    const { setHolidaysForYear } = await import('./database');
    return setHolidaysForYear(this.db, year, dates);
  }

  async addHoliday(date: string, name?: string) {
    const { addHoliday } = await import('./database');
    return addHoliday(this.db, date, name ?? '');
  }

  async deleteHoliday(date: string) {
    const { deleteHoliday } = await import('./database');
    return deleteHoliday(this.db, date);
  }

  async getSetting(key: string) {
    const { getSetting } = await import('./database');
    return getSetting(this.db, key);
  }

  async setSetting(key: string, value: string) {
    const { setSetting } = await import('./database');
    return setSetting(this.db, key, value);
  }

  async getShiftTypes() {
    const { getShiftTypes } = await import('./database');
    return getShiftTypes(this.db);
  }

  async addShiftType(type: any) {
    const { addShiftType } = await import('./database');
    return addShiftType(this.db, type);
  }

  async updateShiftType(type: any) {
    const { updateShiftType } = await import('./database');
    return updateShiftType(this.db, type);
  }

  async deleteShiftType(id: number) {
    const { deleteShiftType } = await import('./database');
    return deleteShiftType(this.db, id);
  }

  async clearDutyRosterForYear(year: number) {
    const { clearDutyRosterForYear } = await import('./database');
    return clearDutyRosterForYear(this.db, year);
  }

  async clearDutyRosterForMonth(year: number, month: number) {
    const { clearDutyRosterForMonth } = await import('./database');
    return clearDutyRosterForMonth(this.db, year, month);
  }

  async clearSlotAssignments() {
    const { clearSlotAssignments } = await import('./database');
    return clearSlotAssignments(this.db);
  }

  async assignSlot(entry: { personId: number, personType: string, date: string, slotType: string }) {
    const { assignSlot } = await import('./database');
    return assignSlot(this.db, entry);
  }

  async getItwPatterns() {
    const { getItwPatterns } = await import('./database');
    return getItwPatterns(this.db);
  }

  async setItwPatterns(patterns: any[]) {
    const { setItwPatterns } = await import('./database');
    return setItwPatterns(this.db, patterns);
  }

  async getDeptPatterns() {
    const { getDeptPatterns } = await import('./database');
    return getDeptPatterns(this.db);
  }

  async setDeptPatterns(patterns: any[]) {
    const { setDeptPatterns } = await import('./database');
    return setDeptPatterns(this.db, patterns);
  }

  async importPersonnelFromExcel(filePath: string, replaceExisting = false) {
    const { ExcelPersonnelImporter } = await import('./excel-importer');
    const importer = new ExcelPersonnelImporter(this.db);
    const { personnel, azubis } = importer.parseExcelFile(filePath);
    return await importer.importPersonnelData(personnel, azubis, replaceExisting);
  }

  async exportPersonnelToExcel(filePath: string) {
    const { ExcelPersonnelImporter } = await import('./excel-importer');
    const importer = new ExcelPersonnelImporter(this.db);
    return await importer.exportToExcel(filePath);
  }

  async createPersonnelTemplate(filePath: string) {
    const { ExcelPersonnelImporter } = await import('./excel-importer');
    ExcelPersonnelImporter.createTemplate(filePath);
  }

  async importDutyRoster(filePath: string, year: number, month?: number, options?: { mappings?: Record<string, number> }): Promise<{ success: boolean, message: string, importedCount: number }> {
    const { RosterImporter } = await import('./roster-importer');
    const importer = new RosterImporter(this);
    return importer.importDutyRoster(filePath, year, month, options);
  }

  // Settings Import/Export Methoden
  async importSettingsFromJson(filePath: string, replaceExisting: boolean) {
    const { SettingsImporter } = await import('./settings-importer');
    const importer = new SettingsImporter(this.db);
    return await importer.importSettingsFromJson(filePath, replaceExisting);
  }

  async exportSettingsToJson(filePath: string) {
    const { SettingsImporter } = await import('./settings-importer');
    const importer = new SettingsImporter(this.db);
    return await importer.exportSettingsToJson(filePath);
  }

  async exportSettingsToExcel(filePath: string) {
    const { SettingsImporter } = await import('./settings-importer');
    const importer = new SettingsImporter(this.db);
    return await importer.exportSettingsToExcel(filePath);
  }

  async createSettingsTemplate(filePath: string) {
    const { SettingsImporter } = await import('./settings-importer');
    const importer = new SettingsImporter(this.db);
    return await importer.createSettingsTemplate(filePath);
  }

  async getYearPlannings() {
    const { getYearPlannings } = await import('./database');
    return getYearPlannings(this.db);
  }

  async getYearPlanningForYear(year: number) {
    const { getYearPlanningForYear } = await import('./database');
    return getYearPlanningForYear(this.db, year);
  }

  async saveYearPlannings(plannings: { year: number; filePath: string }[]) {
    const { saveYearPlannings } = await import('./database');
    return saveYearPlannings(this.db, plannings);
  }

  async deleteYearPlanning(year: number) {
    const { deleteYearPlanning } = await import('./database');
    return deleteYearPlanning(this.db, year);
  }

  async close() {
    // SQLite database is closed automatically
  }
}

export class DatabaseManager {
  private adapter?: DatabaseAdapter;
  private config: DatabaseConfig;
  private currentDbPath?: string;
  private lastDiagnostics: any = null;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async initialize(): Promise<DatabaseAdapter> {
    console.log('[DatabaseManager] Initializing database with mode:', this.config.mode);

    if (this.config.mode === 'postgresql') {
      return this.initializePostgreSQL();
    }

    return this.initializeSQLite();
  }

  private async initializePostgreSQL(): Promise<DatabaseAdapter> {
    console.log('[DatabaseManager] Starting PostgreSQL database');

    if (!this.config.postgresConfig) {
      throw new Error('PostgreSQL configuration is required for postgresql mode');
    }

    const db = await initializePostgreSQLDatabase(this.config.postgresConfig);

    // Collect diagnostics
    try {
      this.lastDiagnostics = {
        timestamp: new Date().toISOString(),
        platform: process.platform,
        node: process.versions?.node,
        electron: process.versions?.electron,
        mode: this.config.mode,
        multiUser: !!this.config.multiUser,
        postgresConfig: {
          host: this.config.postgresConfig.host || 'from connection string',
          database: this.config.postgresConfig.database || 'from connection string',
          port: this.config.postgresConfig.port || 5432
        }
      };
    } catch { }

    this.adapter = new SQLiteAdapter(db); // Same adapter works for both!
    return this.adapter;
  }

  private async initializeSQLite(): Promise<DatabaseAdapter> {
    console.log('[DatabaseManager] Starting SQLite database');

    let dbPath: string;
    const attempts: Array<{ kind: string; dir: string; file?: string; exists?: boolean; canWrite?: boolean; note?: string }> = [];

    if (this.config.mode === 'central-sqlite' && this.config.centralPath) {
      // Use central path for multi-user scenarios
      dbPath = this.config.centralPath;
      // Ensure target directory exists (especially on Windows)
      try { fs.mkdirSync(path.dirname(dbPath), { recursive: true }); } catch { }
      try {
        fs.accessSync(path.dirname(dbPath), fs.constants.W_OK);
        attempts.push({ kind: 'central', dir: path.dirname(dbPath), file: dbPath, exists: true, canWrite: true });
      } catch {
        attempts.push({ kind: 'central', dir: path.dirname(dbPath), file: dbPath, exists: true, canWrite: false, note: 'no write access' });
      }
      console.log('[DatabaseManager] Using central SQLite database at:', dbPath);
    } else {
      // Use DB folder in the application root (portable builds or installed app)
      // Determine app root from the executable path and place DB in <appRoot>/DB/rd-plan.db
      try {
        // 1) Optional: explicit override via env RD_PLAN_DB_DIR
        const envDir = (process.env.RD_PLAN_DB_DIR || '').trim();
        const exePath = app.getPath ? app.getPath('exe') : process.execPath;
        const appRoot = path.dirname(exePath);
        const tmpDir = os.tmpdir ? os.tmpdir() : '';
        const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase();
        const isLikelyTemp = (!!tmpDir && norm(appRoot).startsWith(norm(tmpDir))) || norm(appRoot).includes('/appdata/local/temp/');
        const portableDir = (process.env.PORTABLE_EXECUTABLE_DIR || '').trim();
        // 0) User config in userData/db-config.json
        let cfgDbDir = '';
        try {
          const cfgPath = path.join(app.getPath('userData'), 'db-config.json');
          if (fs.existsSync(cfgPath)) {
            const raw = fs.readFileSync(cfgPath, 'utf-8');
            const json = JSON.parse(raw || '{}');
            if (json && typeof json.dbDir === 'string' && json.dbDir.trim()) {
              cfgDbDir = String(json.dbDir).trim();
              // Validate
              try { fs.mkdirSync(cfgDbDir, { recursive: true }); } catch { }
              let can = false; try { fs.accessSync(cfgDbDir, fs.constants.W_OK); can = true; } catch { }
              attempts.push({ kind: 'userConfig', dir: cfgDbDir, exists: true, canWrite: can, note: 'db-config.json' });
              if (!can) cfgDbDir = '';
            }
          }
        } catch { }

        let dbDir = '';
        if (cfgDbDir) {
          dbDir = cfgDbDir;
        } else if (envDir) {
          dbDir = envDir;
          try { fs.mkdirSync(dbDir, { recursive: true }); } catch { }
          let canWriteEnv = false;
          try { fs.accessSync(dbDir, fs.constants.W_OK); canWriteEnv = true; } catch { canWriteEnv = false; }
          attempts.push({ kind: 'env', dir: dbDir, exists: true, canWrite: canWriteEnv, note: 'RD_PLAN_DB_DIR' });
          if (!canWriteEnv) {
            // If explicit env is not writable, fall back later
            dbDir = '';
          }
        }

        if (!dbDir && portableDir) {
          const pdir = path.join(portableDir, 'DB');
          try { fs.mkdirSync(pdir, { recursive: true }); } catch { }
          let canPortable = false;
          try { fs.accessSync(pdir, fs.constants.W_OK); canPortable = true; } catch { canPortable = false; }
          attempts.push({ kind: 'portableDir', dir: pdir, exists: true, canWrite: canPortable, note: 'PORTABLE_EXECUTABLE_DIR' });
          if (canPortable) dbDir = pdir;
        }

        if (!dbDir) {
          dbDir = path.join(appRoot, 'DB');
          // Ensure directory exists
          try { fs.mkdirSync(dbDir, { recursive: true }); } catch { }
          // Verify write access; if not writable (e.g., Program Files on Windows) OR appRoot looks temp, fallback to userData
          let canWrite = false;
          try { fs.accessSync(dbDir, fs.constants.W_OK); canWrite = true; } catch { canWrite = false; }
          if (isLikelyTemp) {
            attempts.push({ kind: 'appRoot', dir: dbDir, exists: true, canWrite, note: 'appRoot looks like temp, avoid portable here' });
            canWrite = false; // force fallback when in temp
          } else {
            attempts.push({ kind: 'appRoot', dir: dbDir, exists: true, canWrite });
          }
          // Optional: allow forcing portable via CLI/env
          const forcePortable = (process.argv || []).includes('--portable') || String(process.env.RD_PLAN_FORCE_PORTABLE).toLowerCase() === 'true';
          if (forcePortable && !canWrite && !isLikelyTemp) {
            attempts.push({ kind: 'forcePortable', dir: dbDir, exists: true, canWrite, note: 'forced but no write access' });
          }
          if (!canWrite) {
            const userDataPath = app.getPath('userData');
            dbDir = path.join(userDataPath, 'DB');
            try { fs.mkdirSync(dbDir, { recursive: true }); } catch { }
            let canWriteUser = false;
            try { fs.accessSync(dbDir, fs.constants.W_OK); canWriteUser = true; } catch { canWriteUser = false; }
            attempts.push({ kind: 'userData', dir: dbDir, exists: true, canWrite: canWriteUser, note: isLikelyTemp ? 'fallback because appRoot is temp' : 'fallback from appRoot' });
          }
        } else {
          // envDir chosen
        }
        dbPath = path.join(dbDir, 'rd-plan.db');
        console.log('[DatabaseManager] Using local SQLite database at:', dbPath);
      } catch (e) {
        // Fallback to userData if any error occurs
        const userDataPath = app.getPath('userData');
        const dbDir = path.join(userDataPath, 'DB');
        try { fs.mkdirSync(dbDir, { recursive: true }); } catch { }
        try { fs.accessSync(dbDir, fs.constants.W_OK); attempts.push({ kind: 'userData-catch', dir: dbDir, exists: true, canWrite: true, note: 'exception fallback' }); } catch { attempts.push({ kind: 'userData-catch', dir: dbDir, exists: true, canWrite: false, note: 'exception fallback no write' }); }
        dbPath = path.join(dbDir, 'rd-plan.db');
        console.log('[DatabaseManager] Fallback: Using local SQLite database at userData:', dbPath);
      }
    }

    const db = await this.initializeSQLiteWithPath(dbPath);
    this.currentDbPath = dbPath;
    // Collect diagnostics
    try {
      const exePath = app.getPath ? app.getPath('exe') : process.execPath;
      const appRoot = path.dirname(exePath);
      this.lastDiagnostics = {
        timestamp: new Date().toISOString(),
        platform: process.platform,
        node: process.versions?.node,
        electron: process.versions?.electron,
        mode: this.config.mode,
        multiUser: !!this.config.multiUser,
        centralPath: this.config.centralPath || null,
        exePath,
        appRoot,
        portableDir: process.env.PORTABLE_EXECUTABLE_DIR || null,
        userData: app.getPath('userData'),
        attempts,
        chosenDbPath: dbPath,
      };
    } catch { }
    this.adapter = new SQLiteAdapter(db);
    return this.adapter;
  }

  private async initializeSQLiteWithPath(dbPath: string): Promise<AsyncDB> {
    // Import BetterSqlite3 dynamically to create a custom AsyncDB with specific path
    const BetterSqlite3 = (await import('better-sqlite3')).default;
    const raw = new BetterSqlite3(dbPath);

    const db: AsyncDB = {
      exec: async (sql: string) => { raw.exec(sql); },
      run: async (sql: string, params: any[] = []) => {
        const stmt = raw.prepare(sql);
        return Array.isArray(params) ? stmt.run(...params) : stmt.run(params);
      },
      get: async <T = any>(sql: string, params: any[] = []) => {
        const stmt = raw.prepare(sql);
        return Array.isArray(params) ? (stmt.get(...params) as T | undefined) : (stmt.get(params) as T | undefined);
      },
      all: async <T = any>(sql: string, params: any[] = []) => {
        const stmt = raw.prepare(sql);
        return Array.isArray(params) ? (stmt.all(...params) as T[]) : (stmt.all(params) as T[]);
      },
      prepare: async (sql: string) => {
        const stmt = raw.prepare(sql);
        return {
          run: async (...params: any[]) => stmt.run(...params),
          get: async <T = any>(...params: any[]) => stmt.get(...params) as T | undefined,
          all: async <T = any>(...params: any[]) => stmt.all(...params) as T[],
          finalize: async () => { /* no-op for better-sqlite3 */ },
        };
      },
    };

    // Initialize database schema (copied from existing database.ts)
    await this.initializeSQLiteSchema(db);

    // Run migrations after schema initialization
    await this.runMigrations(db);

    return db;
  }

  private async runMigrations(db: AsyncDB) {
    // Migration: add 'lehrjahr' column to azubi_periods if missing
    const azubiPeriodsCols = await db.all("PRAGMA table_info('azubi_periods')");
    if (!azubiPeriodsCols.some((c: any) => c.name === 'lehrjahr')) {
      console.log('[DatabaseManager] Adding lehrjahr to azubi_periods');
      await db.exec("ALTER TABLE azubi_periods ADD COLUMN lehrjahr INTEGER DEFAULT 1");
    }

    // Migration: add 'personnelNumber' and 'roleId' columns to personnel if missing
    const personnelCols = await db.all("PRAGMA table_info('personnel')");
    if (!personnelCols.some((c: any) => c.name === 'personnelNumber')) {
      console.log('[DatabaseManager] Adding personnelNumber to personnel');
      await db.exec("ALTER TABLE personnel ADD COLUMN personnelNumber TEXT");
    }
    if (!personnelCols.some((c: any) => c.name === 'roleId')) {
      console.log('[DatabaseManager] Adding roleId to personnel');
      await db.exec("ALTER TABLE personnel ADD COLUMN roleId INTEGER");
    }

    // Migration: add 'old_rtw_shifts' if missing
    if (!personnelCols.some((c: any) => c.name === 'old_rtw_shifts')) {
      console.log('[DatabaseManager] Adding old_rtw_shifts to personnel');
      await db.exec("ALTER TABLE personnel ADD COLUMN old_rtw_shifts INTEGER DEFAULT 0");
      await db.exec("UPDATE personnel SET old_rtw_shifts = 0 WHERE old_rtw_shifts IS NULL");
    }

    // Migration: create roles table if missing
    const rolesTableExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='roles'");
    if (!rolesTableExists) {
      console.log('[DatabaseManager] Creating roles table');
      await db.exec(`
            CREATE TABLE roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                canEditPersonnel INTEGER DEFAULT 0,
                canEditVehicles INTEGER DEFAULT 0,
                canEditSettings INTEGER DEFAULT 0,
                canEditRoster INTEGER DEFAULT 0,
                canViewReports INTEGER DEFAULT 0,
                canExportData INTEGER DEFAULT 0,
                canManageUsers INTEGER DEFAULT 0,
                sort INTEGER DEFAULT 0
            )
        `);
      console.log('[DatabaseManager] Roles table created successfully');
    }

    // Migration: migrate roles from settings JSON to roles table
    const rolesCount = await db.get("SELECT COUNT(*) as count FROM roles");
    if (rolesCount.count === 0) {
      console.log('[DatabaseManager] Migrating roles from settings to roles table...');
      const rolesSetting = await db.get("SELECT value FROM settings WHERE key='roles'");
      if (rolesSetting && rolesSetting.value) {
        try {
          const oldRoles = JSON.parse(rolesSetting.value);
          for (const role of oldRoles) {
            // Mapping der alten permissions zu neuen Feldern
            const perms = role.permissions || {};
            await db.run(`
                        INSERT OR IGNORE INTO roles (id, name, description, canEditPersonnel, canEditVehicles, canEditSettings, canEditRoster, canViewReports, canExportData, canManageUsers, sort)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
              role.id,
              role.name,
              role.description || '',
              perms.personal === 'write' ? 1 : 0,
              perms.fahrzeuge === 'write' ? 1 : 0,
              perms.einstellungen === 'write' ? 1 : 0,
              perms.einteilung === 'write' || perms.dienstplan === 'write' ? 1 : 0,
              perms.werte === 'read' || perms.werte === 'write' ? 1 : 0,
              perms.werte === 'write' || perms.personal === 'write' || perms.fahrzeuge === 'write' ? 1 : 0,
              perms.personal === 'write' || perms.einstellungen === 'write' ? 1 : 0,
              role.id
            ]);
            console.log(`[DatabaseManager] ✓ Migrated role: ${role.name} (ID: ${role.id})`);
          }
          console.log('[DatabaseManager] Roles migration completed');
        } catch (e) {
          console.error('[DatabaseManager] Error migrating roles:', e);
        }
      }
    }
  }

  private async initializeSQLiteSchema(db: AsyncDB) {
    await db.exec(`
        CREATE TABLE IF NOT EXISTS shifts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            shiftType TEXT NOT NULL,
            personnel TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS personnel (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            vorname TEXT NOT NULL,
            teilzeit INTEGER NOT NULL,
            fahrzeugfuehrer INTEGER NOT NULL,
            fahrzeugfuehrerHLFB INTEGER NOT NULL,
            nef INTEGER NOT NULL DEFAULT 0,
            itwMaschinist INTEGER NOT NULL DEFAULT 0,
            itwFahrzeugfuehrer INTEGER NOT NULL DEFAULT 0,
      sort INTEGER NOT NULL DEFAULT '0',
      active INTEGER NOT NULL DEFAULT '1'
        );
        
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS holidays (
            date TEXT PRIMARY KEY,
            name TEXT NOT NULL DEFAULT ''
        );
        
        CREATE TABLE IF NOT EXISTS itw_patterns (
            start_date TEXT PRIMARY KEY,
            pattern TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS dept_patterns (
            start_date TEXT PRIMARY KEY,
            pattern TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS shift_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            description TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS duty_roster (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            personId INTEGER NOT NULL,
            personType TEXT NOT NULL DEFAULT 'person',
            date TEXT NOT NULL,
            value TEXT NOT NULL,
            type TEXT NOT NULL,
            manual_edit INTEGER DEFAULT 0,
            UNIQUE(personId, personType, date)
        );
        
        CREATE TABLE IF NOT EXISTS azubis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            vorname TEXT NOT NULL,
            lehrjahr INTEGER NOT NULL,
            sort INTEGER NOT NULL DEFAULT 0
        );
        
        CREATE TABLE IF NOT EXISTS azubi_periods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            azubi_id INTEGER NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            description TEXT,
            FOREIGN KEY (azubi_id) REFERENCES azubis (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS itw_doctors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            vorname TEXT NOT NULL,
            sort INTEGER NOT NULL DEFAULT 0
        );
        
        CREATE TABLE IF NOT EXISTS rtw_vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sort INTEGER NOT NULL DEFAULT 0,
            archived_year INTEGER
        );
        
        CREATE TABLE IF NOT EXISTS nef_vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sort INTEGER NOT NULL DEFAULT 0,
            archived_year INTEGER,
            occupancy_mode TEXT NOT NULL DEFAULT '24h'
        );

        CREATE TABLE IF NOT EXISTS itw_vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sort INTEGER NOT NULL DEFAULT 0,
            archived_year INTEGER
        );
        
        CREATE TABLE IF NOT EXISTS rtw_vehicle_months (
            vehicleId INTEGER NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY(vehicleId, year, month)
        );
        
        CREATE TABLE IF NOT EXISTS nef_vehicle_months (
            vehicleId INTEGER NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY(vehicleId, year, month)
        );

        CREATE TABLE IF NOT EXISTS rtw_vehicle_periods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicleId INTEGER NOT NULL,
            startYM TEXT NOT NULL,
            endYM TEXT,
            active INTEGER DEFAULT 1,
            FOREIGN KEY (vehicleId) REFERENCES rtw_vehicles (id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_rtw_vehicle_periods_vehicle ON rtw_vehicle_periods (vehicleId);

        CREATE TABLE IF NOT EXISTS nef_vehicle_periods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicleId INTEGER NOT NULL,
            startYM TEXT NOT NULL,
            endYM TEXT,
            active INTEGER DEFAULT 1,
            FOREIGN KEY (vehicleId) REFERENCES nef_vehicles (id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_nef_vehicle_periods_vehicle ON nef_vehicle_periods (vehicleId);

        CREATE TABLE IF NOT EXISTS itw_vehicle_periods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicleId INTEGER NOT NULL,
            startYM TEXT NOT NULL,
            endYM TEXT,
            active INTEGER DEFAULT 1,
            FOREIGN KEY (vehicleId) REFERENCES itw_vehicles (id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_itw_vehicle_periods_vehicle ON itw_vehicle_periods (vehicleId);

        CREATE TABLE IF NOT EXISTS qualification_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            category TEXT,
            active INTEGER DEFAULT 1,
            sort INTEGER DEFAULT 0,
            excludeFromStats INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS qualification_periods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            personId INTEGER NOT NULL,
            qualType TEXT NOT NULL,
            startYM TEXT NOT NULL,
            endYM TEXT,
            active INTEGER DEFAULT 1,
            FOREIGN KEY (personId) REFERENCES personnel (id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_qualification_periods_person ON qualification_periods (personId);
        CREATE INDEX IF NOT EXISTS idx_qualification_periods_type ON qualification_periods (qualType);
        CREATE INDEX IF NOT EXISTS idx_qualification_periods_period ON qualification_periods (startYM, endYM);

        CREATE TABLE IF NOT EXISTS personnel_active_periods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            personId INTEGER NOT NULL,
            startYM TEXT NOT NULL,
            endYM TEXT,
            description TEXT,
            active INTEGER DEFAULT 1,
            FOREIGN KEY (personId) REFERENCES personnel (id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_personnel_active_periods_person ON personnel_active_periods (personId);
        CREATE INDEX IF NOT EXISTS idx_personnel_active_periods_period ON personnel_active_periods (startYM, endYM);

        CREATE TABLE IF NOT EXISTS vehicle_positions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicleType TEXT NOT NULL,
            vehicleId INTEGER NOT NULL,
            positionName TEXT NOT NULL,
            qualificationTypeId INTEGER,
            sort INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (qualificationTypeId) REFERENCES qualification_types(id) ON DELETE SET NULL,
            UNIQUE(vehicleType, vehicleId, positionName)
        );
        CREATE INDEX IF NOT EXISTS idx_vehicle_positions_vehicle ON vehicle_positions (vehicleType, vehicleId);
        CREATE INDEX IF NOT EXISTS idx_vehicle_positions_qual ON vehicle_positions (qualificationTypeId);
    `);

    // Initialize default qualification types if empty
    try {
      const count = await db.get('SELECT COUNT(*) as count FROM qualification_types');
      if (count && count.count === 0) {
        const defaultQualifications = [
          { name: 'RTW Fahrzeugführer', description: 'Fahrzeugführer Rettungswagen', category: 'Fahrzeugführung', sort: 1 },
          { name: 'HLF-B Fahrzeugführer', description: 'Hilfeleistungslöschfahrzeug B', category: 'Fahrzeugführung', sort: 2 },
          { name: 'NEF Assistent', description: 'Notarzteinsatzfahrzeug Assistent', category: 'Notfall', sort: 3 },
          { name: 'ITW Maschinist', description: 'Maschinist Intensivtransportwagen', category: 'Transport', sort: 4 },
          { name: 'ITW Fahrzeugführer', description: 'Fahrzeugführer Intensivtransportwagen', category: 'Fahrzeugführung', sort: 5 },
          { name: 'Ü50', description: 'Über 50 Jahre', category: 'Sonstiges', sort: 6 },
          { name: 'Leitender PAL', description: 'Leitender Praxisanleiter', category: 'Leitung', sort: 7 }
        ];

        for (const qual of defaultQualifications) {
          await db.run(
            'INSERT INTO qualification_types (name, description, category, active, sort) VALUES (?, ?, ?, 1, ?)',
            [qual.name, qual.description, qual.category, qual.sort]
          );
        }
        console.log('[DatabaseManager] Initialized default qualification types');
      }
    } catch (e) {
      console.warn('[DatabaseManager] Error initializing qualification types:', e);
    }

    console.log('[DatabaseManager] SQLite schema initialized');
    // --- Lightweight migrations to ensure columns exist ---
    try {
      const cols: any[] = await db.all("PRAGMA table_info('personnel')");
      const hasActive = cols.some((c: any) => c.name === 'active');
      if (!hasActive) {
        console.log('[DatabaseManager] Adding missing column "active" to personnel table');
        await db.exec("ALTER TABLE personnel ADD COLUMN active INTEGER DEFAULT 1");
        try { await db.exec("UPDATE personnel SET active = 1 WHERE active IS NULL"); } catch { }
      }
    } catch (e) {
      console.warn('[DatabaseManager] Warning while ensuring personnel.active column', e);
    }
  }

  getAdapter(): DatabaseAdapter {
    if (!this.adapter) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.adapter;
  }

  isInitialized(): boolean {
    return this.adapter !== null;
  }

  getConfig(): DatabaseConfig {
    return this.config;
  }

  async close() {
    if (this.adapter) {
      await this.adapter.close();
    }
  }

  getDiagnostics() {
    return this.lastDiagnostics || {};
  }

  /**
   * Creates a timestamped backup of the current SQLite database next to the DB location.
   * Returns the directory path containing the backup.
   */
  async createBackup(opts?: { year?: number; month?: number; label?: string }): Promise<string> {
    if (!this.currentDbPath) throw new Error('Database path unknown');
    const fs = await import('fs');
    const dir = path.dirname(this.currentDbPath);
    // If DB is in <appRoot>/DB, put backups in <appRoot>/backups/<ts>; otherwise dir/backups/<ts>
    const parent = path.basename(dir).toLowerCase() === 'db' ? path.join(dir, '..') : dir;
    const now = new Date();
    const y = opts?.year ?? now.getFullYear();
    const yStr = String(y);
    // Unterscheide: Monatsbackup vs. Jahresbackup (ALL)
    let folderYM: string;
    if (opts?.month != null) {
      const m1 = (opts.month) + 1; // month index is 0-based in callers, store as 1-12
      const mStr = String(m1).padStart(2, '0');
      folderYM = `${yStr}-${mStr}`;
    } else {
      folderYM = `${yStr}-ALL`;
    }
    const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 15); // YYYYMMDDHHMMSS
    // Create short auto label if not provided
    const autoLabel = opts?.month != null ? `preimport-${folderYM}` : `preimport-${yStr}`;
    const rawLabel = (opts?.label || autoLabel).toLowerCase();
    const label = rawLabel.replace(/[^a-z0-9-_]/g, '').slice(0, 40);
    // Structure: backups/<YYYY>/<YYYY-MM|YYYY-ALL>/<YYYYMMDDHHMMSS>-<label>
    const backupDir = path.join(parent, 'backups', yStr, folderYM, `${ts}-${label}`);
    try { fs.mkdirSync(backupDir, { recursive: true }); } catch { }
    const target = path.join(backupDir, 'rd-plan.db');
    fs.copyFileSync(this.currentDbPath, target);
    console.log('[DatabaseManager] Backup erstellt:', target);
    try { fs.writeFileSync(path.join(backupDir, 'label.txt'), label, 'utf-8'); } catch { }
    return backupDir;
  }

  private getBackupRoot(): string {
    if (!this.currentDbPath) throw new Error('Database path unknown');
    const dir = path.dirname(this.currentDbPath);
    const parent = path.basename(dir).toLowerCase() === 'db' ? path.join(dir, '..') : dir;
    return path.join(parent, 'backups');
  }

  async listBackups(limit = 50): Promise<Array<{ path: string; year: string; ym: string; timestamp: string; label: string }>> {
    const fs = await import('fs');
    const root = this.getBackupRoot();
    const items: Array<{ path: string; year: string; ym: string; timestamp: string; label: string }> = [];
    if (!fs.existsSync(root)) return items;
    for (const y of (fs.readdirSync(root) || []).sort().reverse()) {
      const yDir = path.join(root, y);
      if (!fs.lstatSync(yDir).isDirectory()) continue;
      for (const ym of (fs.readdirSync(yDir) || []).sort().reverse()) {
        const ymDir = path.join(yDir, ym);
        if (!fs.lstatSync(ymDir).isDirectory()) continue;
        for (const tsLab of (fs.readdirSync(ymDir) || []).sort().reverse()) {
          const dir = path.join(ymDir, tsLab);
          if (!fs.lstatSync(dir).isDirectory()) continue;
          const dbp = path.join(dir, 'rd-plan.db');
          if (!fs.existsSync(dbp)) continue;
          const m = tsLab.match(/^(\d{8,14})(?:[-_](.+))?$/);
          const timestamp = m ? m[1] : tsLab;
          const label = (m && m[2]) ? m[2] : (fs.existsSync(path.join(dir, 'label.txt')) ? (fs.readFileSync(path.join(dir, 'label.txt'), 'utf-8') || '').trim() : '');
          items.push({ path: dir, year: y, ym, timestamp, label });
          if (items.length >= limit) return items;
        }
      }
    }
    return items;
  }

  async getBackupSummary(backupDir: string, year?: number, month?: number): Promise<{ personnel: number; azubis: number; dutyRoster: number }> {
    const BetterSqlite3 = (await import('better-sqlite3')).default;
    const dbPath = path.join(backupDir, 'rd-plan.db');
    const raw = new BetterSqlite3(dbPath, { readonly: true });
    const getCount = (sql: string, params: any[] = []) => {
      try { const row = raw.prepare(sql).get(...params) as any; return Number(row?.cnt || 0); } catch { return 0; }
    };
    const personnel = getCount('SELECT COUNT(*) as cnt FROM personnel');
    const azubis = getCount('SELECT COUNT(*) as cnt FROM azubis');
    let dutyRoster = 0;
    if (typeof year === 'number' && typeof month === 'number') {
      const y = String(year);
      const mm = String(month + 1).padStart(2, '0');
      dutyRoster = getCount("SELECT COUNT(*) as cnt FROM duty_roster WHERE substr(date,1,4)=? AND substr(date,6,2)=?", [y, mm]);
    } else if (typeof year === 'number') {
      const y = String(year);
      dutyRoster = getCount("SELECT COUNT(*) as cnt FROM duty_roster WHERE substr(date,1,4)=?", [y]);
    } else {
      dutyRoster = getCount('SELECT COUNT(*) as cnt FROM duty_roster');
    }
    try { raw.close(); } catch { }
    return { personnel, azubis, dutyRoster };
  }

  async restoreBackup(backupDir: string): Promise<void> {
    if (!this.currentDbPath) throw new Error('Database path unknown');
    const fs = await import('fs');
    const src = path.join(backupDir, 'rd-plan.db');
    if (!fs.existsSync(src)) throw new Error('Backup file not found');
    // Copy backup over current DB; note: active connection will still point to same file
    fs.copyFileSync(src, this.currentDbPath);
    console.log('[DatabaseManager] Backup wiederhergestellt von:', src);
  }
}

// Global database manager instance
let globalDatabaseManager: DatabaseManager | null = null;

export async function initializeDatabaseManager(config?: DatabaseConfig): Promise<DatabaseAdapter> {
  if (globalDatabaseManager && globalDatabaseManager.isInitialized()) {
    return globalDatabaseManager.getAdapter();
  }

  // Check for PostgreSQL environment variable
  const pgConnectionString = process.env.RD_PLAN_PG_CONNECTION;

  // Default configuration
  const defaultConfig: DatabaseConfig = {
    mode: pgConnectionString
      ? 'postgresql'
      : (process.env.RD_PLAN_DB_MODE === 'central-sqlite' ? 'central-sqlite' : 'sqlite'),
    multiUser: process.env.RD_PLAN_MULTI_USER === 'true',
    centralPath: process.env.RD_PLAN_CENTRAL_DB_PATH,
    postgresConfig: pgConnectionString ? { connectionString: pgConnectionString } : undefined
  };

  const finalConfig = { ...defaultConfig, ...config };

  // PostgreSQL mode enables multi-user by default
  if (finalConfig.mode === 'postgresql') {
    finalConfig.multiUser = true;
  }

  // Auto-detect multi-user scenario and central path for SQLite
  if (finalConfig.mode !== 'postgresql' && !finalConfig.centralPath) {
    const userDataPath = app.getPath('userData');

    // Check if we're running in a network/shared environment
    if (userDataPath.includes('network') || userDataPath.includes('shared') || userDataPath.includes('smb')) {
      finalConfig.multiUser = true;
      finalConfig.mode = 'central-sqlite';
      // Try to use a central location in the same network directory
      finalConfig.centralPath = path.join(path.dirname(userDataPath), 'rd-plan-shared.db');
      console.log('[DatabaseManager] Auto-detected network environment, using central database:', finalConfig.centralPath);
    }
  }

  // Switch to central SQLite for multi-user scenarios
  if (finalConfig.multiUser && finalConfig.mode === 'sqlite') {
    console.log('[DatabaseManager] Multi-user detected, switching to central SQLite');
    finalConfig.mode = 'central-sqlite';
    if (!finalConfig.centralPath) {
      const documentsPath = app.getPath('documents');
      finalConfig.centralPath = path.join(documentsPath, 'RD-Plan-Shared', 'rd-plan.db');
    }
  }

  globalDatabaseManager = new DatabaseManager(finalConfig);
  return globalDatabaseManager.initialize();
}

export function getDatabaseManager(): DatabaseManager {
  if (!globalDatabaseManager) {
    throw new Error('Database manager not initialized. Call initializeDatabaseManager() first.');
  }
  return globalDatabaseManager;
}

export async function closeDatabaseManager() {
  if (globalDatabaseManager) {
    await globalDatabaseManager.close();
    globalDatabaseManager = null;
  }
}

export async function createDatabaseBackup(opts?: { year?: number; month?: number }): Promise<string> {
  const mgr = getDatabaseManager();
  return mgr.createBackup(opts);
}

export async function listDatabaseBackups(limit?: number) {
  const mgr = getDatabaseManager();
  return mgr.listBackups(limit);
}

export async function getSummaryForBackup(backupDir: string, year?: number, month?: number) {
  const mgr = getDatabaseManager();
  return mgr.getBackupSummary(backupDir, year, month);
}

export async function restoreDatabaseFromBackup(backupDir: string) {
  const mgr = getDatabaseManager();
  return mgr.restoreBackup(backupDir);
}

// Preview duty roster import without writing
export async function previewDutyRosterImport(filePath: string, year: number, month?: number) {
  const mgr = getDatabaseManager();
  const { RosterImporter } = await import('./roster-importer');
  const importer = new RosterImporter(mgr.getAdapter());
  return importer.previewDutyRoster(filePath, year, month);
}