
export const getMins = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = String(timeStr).substring(0, 5).split(':').map(Number);
    return h * 60 + m;
};

export function calculateRecordMetrics(checkIn, checkOut, shift, companySettings) {
    if (!checkIn && !checkOut) {
        return { status: 'absent', late_minutes: 0, early_leave_minutes: 0, work_hours: 0 };
    }

    const startStr = shift?.start_time || companySettings?.work_start || '08:00';
    const endStr = shift?.end_time || companySettings?.work_end || '17:00';
    const graceMins = shift ? (shift.grace_minutes || 0) : 0;

    const startMins = getMins(startStr);
    let endMins = getMins(endStr);
    if (endMins <= startMins) endMins += 24 * 60; // Cross-midnight shift

    // Check if any punch is missing (one present, one missing)
    const isMissingPunch = (!checkIn && checkOut) || (checkIn && !checkOut);

    if (isMissingPunch && shift?.deduct_half_on_missing) {
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
            status: missingStatus
        };
    }

    if (!checkIn) {
        return { status: 'missing_checkin', late_minutes: 0, early_leave_minutes: 0, work_hours: 0 };
    }

    let inMins = getMins(checkIn);
    
    // 1. Calculate Late Minutes
    let lateMins = 0;
    if (shift?.shift_type !== 'flexible') {
        let diff = inMins - startMins;
        if (diff < -720) {
            diff += 24 * 60; // Cross-midnight punch (e.g. 01:00 AM for 17:00 shift)
        }
        if (diff > graceMins) {
            lateMins = diff;
        }
    }

    // 2. Calculate Early Leave & Work Hours
    let workHours = 0;
    let earlyLeaveMins = 0;
    
    if (checkOut) {
        const outMins = getMins(checkOut);
        
        // Work Hours calculation
        let diff = outMins - inMins;
        if (diff < 0) diff += 24 * 60; // Cross-midnight shift 
        
        if (shift?.has_break && shift?.break_duration) {
            diff -= shift.break_duration;
        }

        workHours = Math.round(Math.max(0, diff / 60) * 100) / 100;

        // Early leave calculation
        let shiftDuration = endMins - startMins;
        
        let outFromStart = outMins - startMins;
        if (outFromStart < 0) outFromStart += 24 * 60;
        
        if (outFromStart < shiftDuration) {
            earlyLeaveMins = shiftDuration - outFromStart;
        }
    }

    // Determine status priority
    let status = 'present';
    if (!checkOut) {
        status = 'missing_checkout';
    } else if (lateMins > 0) {
        status = 'late';
    } else if (earlyLeaveMins > 0) {
        status = 'early_leave';
    }

    return {
        late_minutes: lateMins,
        early_leave_minutes: earlyLeaveMins,
        work_hours: workHours,
        status: status
    };
}
