export interface VehiclePeriod {
  id?: number;
  vehicleId?: number;
  startYM?: string;
  startDate?: string;
  endYM?: string;
  endDate?: string;
  active?: boolean | number;
  note?: string;
}

export interface VehicleSpecialDay {
  id?: number;
  vehicleType?: string;
  vehicleId?: number;
  date: string; // YYYY-MM-DD
  reason?: string;
  shiftMode?: '24h' | 'tag' | 'nacht';
  action?: 'add' | 'remove';
}

export interface VehicleDayStatus {
  active: boolean;
  shiftMode: '24h' | 'tag' | 'nacht' | 'default' | 'off';
  reason?: string;
  isSpecialDay: boolean;
}

/**
 * Determines whether a vehicle is active on a specific date (YYYY-MM-DD)
 * by evaluating day-precise special days (Spitzenabdeckung/Sonderlagen) and period ranges.
 */
export function isVehicleActiveOnDate(
  dateStr: string,
  periods: VehiclePeriod[] = [],
  specialDays: VehicleSpecialDay[] = [],
  isReserve?: boolean
): VehicleDayStatus {
  if (!dateStr) return { active: false, shiftMode: 'off', isSpecialDay: false };

  // 1. Check day-precise special days first
  const spec = (specialDays || []).find(s => s && s.date === dateStr);
  if (spec) {
    if (spec.action === 'remove') {
      return {
        active: false,
        shiftMode: 'off',
        reason: spec.reason,
        isSpecialDay: true
      };
    }
    return {
      active: true,
      shiftMode: spec.shiftMode || '24h',
      reason: spec.reason,
      isSpecialDay: true
    };
  }

  // 2. Check regular activity period ranges
  if (!periods || periods.length === 0) {
    // Wenn keine Grund-Zeiträume definiert sind, ist das Fahrzeug inaktiv (sofern kein Sondertag vorliegt).
    return { active: false, shiftMode: 'off', isSpecialDay: false };
  }

  const activePeriod = periods.find(p => {
    if (!p) return false;
    const isAct = p.active === 1 || p.active === true || (p.active as any) === '1';
    if (!isAct) return false;

    const start = (p.startDate || p.startYM || '').trim();
    const end = (p.endDate || p.endYM || '').trim();

    if (!start) return true;

    if (start.length === 7) {
      // YYYY-MM format
      const monthStr = dateStr.slice(0, 7);
      return start <= monthStr && (!end || end >= monthStr);
    } else {
      // YYYY-MM-DD format
      return start <= dateStr && (!end || end >= dateStr);
    }
  });

  if (activePeriod) {
    return {
      active: true,
      shiftMode: 'default',
      reason: activePeriod.note,
      isSpecialDay: false
    };
  }

  return { active: false, shiftMode: 'off', isSpecialDay: false };
}
