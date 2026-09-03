import { employeeStatus, deviceStatus, attendanceStatus, getStatusBadgeClass, statusLabel } from '../statusMaps';

describe('Status Mappings Helper Tests', () => {
    describe('Status dictionaries', () => {
        it('should have exact Arabic labels for employee status', () => {
            expect(employeeStatus.active).toBe('نشط');
            expect(employeeStatus.inactive).toBe('غير نشط');
        });

        it('should have exact Arabic labels for device status', () => {
            expect(deviceStatus.connected).toBe('متصل');
            expect(deviceStatus.disconnected).toBe('غير متصل');
        });

        it('should have exact Arabic labels for attendance status', () => {
            expect(attendanceStatus.present).toBe('حاضر');
            expect(attendanceStatus.late).toBe('متأخر');
            expect(attendanceStatus.absent).toBe('غائب');
            expect(attendanceStatus.leave).toBe('إجازة');
            expect(attendanceStatus.early_leave).toBe('انصراف مبكر');
        });
    });

    describe('getStatusBadgeClass utility', () => {
        it('should map active, present, connected to success theme', () => {
            expect(getStatusBadgeClass('present')).toBe('success');
            expect(getStatusBadgeClass('active')).toBe('success');
            expect(getStatusBadgeClass('connected')).toBe('success');
        });

        it('should map absent and disconnected to danger theme', () => {
            expect(getStatusBadgeClass('absent')).toBe('danger');
            expect(getStatusBadgeClass('disconnected')).toBe('danger');
        });

        it('should map late to warning theme', () => {
            expect(getStatusBadgeClass('late')).toBe('warning');
        });

        it('should map unknown status to neutral theme', () => {
            expect(getStatusBadgeClass('unknown_status_xyz')).toBe('neutral');
        });
    });

    describe('statusLabel translation utility', () => {
        it('should translate known statuses to Arabic', () => {
            expect(statusLabel('active')).toBe('نشط');
            expect(statusLabel('late')).toBe('متأخر');
            expect(statusLabel('connected')).toBe('متصل');
        });

        it('should fallback to raw input for unknown status values', () => {
            expect(statusLabel('custom_value')).toBe('custom_value');
        });
    });
});
