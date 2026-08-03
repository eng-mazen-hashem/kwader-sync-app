import { calculateRecordMetrics, getMins } from '../attendanceCalculator';

describe('Attendance Calculator Utilities', () => {
    describe('getMins helper function', () => {
        it('should correctly convert HH:MM to minutes', () => {
            expect(getMins('08:00')).toBe(480);
            expect(getMins('17:30')).toBe(1050);
            expect(getMins('00:00')).toBe(0);
        });

        it('should handle empty or null values safely', () => {
            expect(getMins(null)).toBe(0);
            expect(getMins('')).toBe(0);
        });
    });

    describe('calculateRecordMetrics function', () => {
        const defaultShift = {
            start_time: '08:00',
            end_time: '17:00',
            grace_minutes: 15,
            has_break: true,
            break_duration: 60 // 1 hour break
        };

        const defaultCompanySettings = {
            work_start: '08:00',
            work_end: '17:00'
        };

        it('should return absent status if checkIn is missing', () => {
            const result = calculateRecordMetrics(null, null, defaultShift, defaultCompanySettings);
            expect(result).toEqual({
                status: 'absent',
                late_minutes: 0,
                early_leave_minutes: 0,
                work_hours: 0
            });
        });

        it('should calculate perfect present shift (no lateness, no early leave)', () => {
            // Checked in at 08:00, checked out at 17:00 (9 hours total - 1 hour break = 8 hours)
            const result = calculateRecordMetrics('08:00', '17:00', defaultShift, defaultCompanySettings);
            expect(result.status).toBe('present');
            expect(result.late_minutes).toBe(0);
            expect(result.early_leave_minutes).toBe(0);
            expect(result.work_hours).toBe(8);
        });

        it('should respect grace period for lateness', () => {
            // Check-in at 08:10 (within 15 mins grace). Should not count as late.
            const result = calculateRecordMetrics('08:10', '17:00', defaultShift, defaultCompanySettings);
            expect(result.status).toBe('present');
            expect(result.late_minutes).toBe(0);
            expect(result.work_hours).toBe(7.83); // 9 hours - 10 mins - 1 hour break = 7.83 hours
        });

        it('should apply late penalty starting from shift start if grace period is exceeded', () => {
            // Check-in at 08:20 (exceeds 15 mins grace). Late minutes should be 20, not 5.
            const result = calculateRecordMetrics('08:20', '17:00', defaultShift, defaultCompanySettings);
            expect(result.status).toBe('late');
            expect(result.late_minutes).toBe(20);
            expect(result.work_hours).toBe(7.67);
        });

        it('should calculate early leave correctly', () => {
            // Checked out at 16:30 (30 minutes early)
            const result = calculateRecordMetrics('08:00', '16:30', defaultShift, defaultCompanySettings);
            expect(result.status).toBe('early_leave');
            expect(result.early_leave_minutes).toBe(30);
            expect(result.work_hours).toBe(7.5);
        });

        it('should handle cross-midnight overnight shifts correctly', () => {
            const overnightShift = {
                start_time: '22:00',
                end_time: '06:00',
                grace_minutes: 0,
                has_break: false
            };
            // Check-in 22:00, Check-out 06:00 next day (8 hours)
            const result = calculateRecordMetrics('22:00', '06:00', overnightShift, defaultCompanySettings);
            expect(result.status).toBe('present');
            expect(result.work_hours).toBe(8);
            expect(result.early_leave_minutes).toBe(0);
        });

        it('should deduct break duration correctly', () => {
            const noBreakShift = {
                start_time: '08:00',
                end_time: '17:00',
                grace_minutes: 0,
                has_break: false
            };
            const result = calculateRecordMetrics('08:00', '17:00', noBreakShift, defaultCompanySettings);
            expect(result.work_hours).toBe(9); // No break, full 9 hours
        });

        it('should calculate 50% shift hours for missing checkout when deduct_half_on_missing is true', () => {
            const deductHalfShift = {
                ...defaultShift,
                deduct_half_on_missing: true
            };
            // Total net shift hours = (17:00 - 08:00) - 1 hour break = 8 hours. 50% = 4 hours.
            const result = calculateRecordMetrics('08:00', null, deductHalfShift, defaultCompanySettings);
            expect(result.status).toBe('missing_checkout');
            expect(result.work_hours).toBe(4);
        });

        it('should calculate 50% shift hours for missing checkin when deduct_half_on_missing is true', () => {
            const deductHalfShift = {
                ...defaultShift,
                deduct_half_on_missing: true
            };
            const result = calculateRecordMetrics(null, '17:00', deductHalfShift, defaultCompanySettings);
            expect(result.status).toBe('missing_checkin');
            expect(result.work_hours).toBe(4);
        });

        it('should return 0 work_hours for missing checkout when deduct_half_on_missing is false', () => {
            const result = calculateRecordMetrics('08:00', null, defaultShift, defaultCompanySettings);
            expect(result.status).toBe('missing_checkout');
            expect(result.work_hours).toBe(0);
        });
    });
});
