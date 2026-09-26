
export const getMins = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = String(timeStr).substring(0, 5).split(':').map(Number);
    return h * 60 + m;
};

export const getLocalDateStr = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export function calculateRecordMetrics(checkIn, checkOut, shift, companySettings, recordDate = null) {
    if (!checkIn && !checkOut) {
        return { 
            status: 'absent', 
            late_minutes: 0, 
            early_leave_minutes: 0, 
            work_hours: 0,
            overtime_minutes: 0,
            overtime_hours: 0,
            overtime_weighted_hours: 0,
            is_early_snapped: false,
            is_in_facility: false,
            effective_check_in: null
        };
    }

    const todayStr = getLocalDateStr();
    const dateStr = recordDate ? String(recordDate).split('T')[0] : null;
    const isToday = Boolean(dateStr && dateStr === todayStr);
    const isPastDate = Boolean(dateStr && dateStr < todayStr);

    const startStr = shift?.start_time || companySettings?.work_start || '08:00';
    const endStr = shift?.end_time || companySettings?.work_end || '17:00';
    const graceMins = shift ? (shift.grace_minutes || 0) : 0;

    const startMins = getMins(startStr);
    let endMins = getMins(endStr);
    if (endMins <= startMins) endMins += 24 * 60; // Cross-midnight shift

    // Check if shift has concluded/ended
    // If recordDate is omitted/null, treat as concluded (preserving backward compatibility with unit tests)
    let isShiftEnded = true;
    if (isToday) {
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();
        if (endMins > 1440) {
            // Cross-midnight shift starting today ends tomorrow morning
            isShiftEnded = false;
        } else {
            // Day shift: ended only if current time has passed end_time + 30 mins grace buffer
            isShiftEnded = currentMins >= (endMins + 30);
        }
    } else if (dateStr && dateStr > todayStr) {
        isShiftEnded = false;
    } else if (isPastDate) {
        isShiftEnded = true;
    } else {
        isShiftEnded = true;
    }

    // Check if any punch is missing (one present, one missing)
    const isMissingPunch = (!checkIn && checkOut) || (checkIn && !checkOut);

    // Only apply missing punch deduction if the shift has actually concluded
    if (isMissingPunch && shift?.deduct_half_on_missing && isShiftEnded) {
        let shiftHours = 8;
        if (shift?.shift_type === 'flexible') {
            shiftHours = Number(shift.target_hours || 8);
        } else {
            let durationMins = endMins - startMins;
            if (shift?.has_break && shift?.break_duration) {
                durationMins -= Number(shift.break_duration);
            }
            shiftHours = Math.max(0, durationMins / 60);
        }

        const halfWorkHours = Math.round((shiftHours / 2) * 100) / 100;
        const missingStatus = !checkIn ? 'missing_checkin' : 'missing_checkout';

        return {
            late_minutes: 0,
            early_leave_minutes: 0,
            work_hours: halfWorkHours,
            status: missingStatus,
            overtime_minutes: 0,
            overtime_hours: 0,
            overtime_weighted_hours: 0,
            is_early_snapped: false,
            is_in_facility: false,
            effective_check_in: checkIn
        };
    }

    if (!checkIn) {
        return { 
            status: 'missing_checkin', 
            late_minutes: 0, 
            early_leave_minutes: 0, 
            work_hours: 0,
            overtime_minutes: 0,
            overtime_hours: 0,
            overtime_weighted_hours: 0,
            is_early_snapped: false,
            effective_check_in: null
        };
    }

    let inMins = getMins(checkIn);
    let effectiveInMins = inMins;
    let isEarlySnapped = false;
    const earlyGraceMins = shift ? Number(shift.early_arrival_grace_minutes || 0) : 0;

    // 1. Calculate Late Minutes & Early Arrival Snapping
    let lateMins = 0;
    if (shift?.shift_type !== 'flexible') {
        let diff = inMins - startMins;
        if (diff < -720) {
            diff += 24 * 60; // Cross-midnight punch (e.g. 01:00 AM for 17:00 shift)
        }
        if (diff > graceMins) {
            lateMins = diff;
        }

        // Snap early arrival if within early_arrival_grace_minutes
        if (diff < 0 && Math.abs(diff) <= earlyGraceMins) {
            effectiveInMins = startMins;
            isEarlySnapped = true;
        }
    }

    // 2. Calculate Early Leave, Work Hours & Overtime
    let workHours = 0;
    let earlyLeaveMins = 0;
    let overtimeMins = 0;
    let overtimeHours = 0;
    let overtimeWeightedHours = 0;

    // Standard shift scheduled duration
    let scheduledDurationMins = endMins - startMins;
    if (shift?.has_break && shift?.break_duration) {
        scheduledDurationMins -= Number(shift.break_duration);
    }
    scheduledDurationMins = Math.max(0, scheduledDurationMins);
    const scheduledHours = shift?.shift_type === 'flexible'
        ? Number(shift.target_hours || 8)
        : Math.round((scheduledDurationMins / 60) * 100) / 100;
    
    if (checkOut) {
        const outMins = getMins(checkOut);
        
        // Work Hours calculation using effectiveInMins
        let diff = outMins - effectiveInMins;
        if (diff < 0) diff += 24 * 60; // Cross-midnight shift 
        
        if (shift?.has_break && shift?.break_duration) {
            diff -= Number(shift.break_duration);
        }
        diff = Math.max(0, diff);

        const rawWorkHours = Math.round((diff / 60) * 100) / 100;

        // Early leave calculation
        let shiftDuration = endMins - startMins;
        
        let outFromStart = outMins - startMins;
        if (outFromStart < 0) outFromStart += 24 * 60;
        
        if (outFromStart < shiftDuration) {
            earlyLeaveMins = shiftDuration - outFromStart;
        }

        // Overtime threshold calculation
        const otThresholdMins = shift ? Number(shift.overtime_start_after_minutes || 0) : 0;
        const otRate = shift ? Number(shift.overtime_rate || 1.5) : 1.5;
        const otTierStartHours = shift ? Number(shift.overtime_rate_start_hours || 0) : 0;

        let extraMins = 0;
        if (shift?.shift_type === 'flexible') {
            const targetMins = scheduledHours * 60;
            extraMins = Math.max(0, diff - targetMins);
        } else {
            extraMins = Math.max(0, diff - scheduledDurationMins);
        }

        if (extraMins > 0 && extraMins >= otThresholdMins) {
            overtimeMins = extraMins;
            overtimeHours = Math.round((overtimeMins / 60) * 100) / 100;

            if (otTierStartHours <= 0) {
                overtimeWeightedHours = Math.round((overtimeHours * otRate) * 100) / 100;
            } else {
                const tier1 = Math.min(overtimeHours, otTierStartHours);
                const tier2 = Math.max(0, overtimeHours - otTierStartHours);
                overtimeWeightedHours = Math.round((tier1 * 1.0 + tier2 * otRate) * 100) / 100;
            }

            workHours = rawWorkHours;
        } else if (extraMins > 0 && otThresholdMins > 0) {
            // Lingered after shift without qualifying for overtime:
            // Cap work hours to scheduled hours so lingering is not credited as overtime
            workHours = scheduledHours;
        } else {
            workHours = rawWorkHours;
        }
    }

    // Determine status priority
    let status = 'present';
    if (!checkOut) {
        if (isShiftEnded) {
            status = 'missing_checkout';
        } else {
            status = lateMins > 0 ? 'late' : 'present';
        }
    } else if (lateMins > 0) {
        status = 'late';
    } else if (earlyLeaveMins > 0) {
        status = 'early_leave';
    }

    const isInFacility = Boolean(checkIn && !checkOut && !isShiftEnded);

    return {
        late_minutes: lateMins,
        early_leave_minutes: earlyLeaveMins,
        work_hours: workHours,
        status: status,
        overtime_minutes: overtimeMins,
        overtime_hours: overtimeHours,
        overtime_weighted_hours: overtimeWeightedHours,
        is_early_snapped: isEarlySnapped,
        is_in_facility: isInFacility,
        effective_check_in: isEarlySnapped ? (shift?.start_time ? String(shift.start_time).substring(0, 5) : '08:00') : checkIn
    };
}
