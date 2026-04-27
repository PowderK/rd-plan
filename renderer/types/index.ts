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
    department?: string;
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

export interface QualificationPeriod {
    id: number;
    personId: number;
    qualType: string;
    startYM: string;
    endYM: string;
    active: boolean;
}

export interface AzubiPeriod {
    id: number;
    azubi_id: number;
    start_date: string;
    end_date: string;
    description?: string;
}