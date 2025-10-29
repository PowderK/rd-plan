import React from 'react';
import ShiftAssignment from './ShiftAssignment';
import PersonnelList from './PersonnelList';
import MonthTabs from './MonthTabs';
import './Body.css';

interface BodyProps {
    currentMonth: number;
    onMonthChange: (month: number) => void;
    personnel: { id: number; name: string; vorname: string; fahrzeugfuehrer?: boolean }[];
    azubis: { id: number; name: string; vorname: string; lehrjahr: number }[];
    roster: Record<string, Record<string, { value: string, type: string }>>;
    year: number;
    shiftPattern: string[];
}

const Body: React.FC<BodyProps & { onRosterChanged?: () => void; onEntryAssigned?: (key: string, date: string, value: string, type: string) => void }> = ({ currentMonth, onMonthChange, personnel, azubis, roster, year, shiftPattern, onRosterChanged, onEntryAssigned }) => {
    console.log('[Body] Render', { currentMonth, year, rosterKeys: Object.keys(roster) });
    return (
        <div className="body-container">
            <div className="month-tabs">
                <MonthTabs
                    currentMonth={currentMonth}
                    onMonthChange={onMonthChange}
                    personnel={personnel}
                    azubis={azubis}
                    roster={roster}
                    year={year}
                    shiftPattern={shiftPattern}
                    onRosterChanged={onRosterChanged}
                    onEntryAssigned={onEntryAssigned}
                />
            </div>
            <div className="content">
                <div className="shift-assignment">
                    <ShiftAssignment />
                </div>
                <div className="personnel-list">
                    <PersonnelList />
                </div>
            </div>
        </div>
    );
};

export default Body;