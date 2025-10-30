export interface Shift {
    id: number;
    date: string;
    time: string;
    ambulance: string;
    personnel: number[];
}

export interface Personnel {
    id: number;
    name: string;
    role: string;
    contact: string;
}

export interface MonthTab {
    month: string;
    year: number;
}

export interface AppSettings {
    theme: string;
    notificationsEnabled: boolean;
    lastUpdated: Date;
}

export type VersionInfo = {
    version: string;
    lastUpdated: Date;
};