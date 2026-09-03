// Status mappings: DB value → Arabic display

export const employeeStatus = {
    active: 'نشط',
    inactive: 'غير نشط',
};

export const deviceStatus = {
    connected: 'متصل',
    disconnected: 'غير متصل',
};

export const attendanceStatus = {
    present: 'حاضر',
    late: 'متأخر',
    absent: 'غائب',
    leave: 'إجازة',
    early_leave: 'انصراف مبكر',
};

export const getStatusBadgeClass = (status) => {
    const map = {
        present: 'success',
        late: 'warning',
        absent: 'danger',
        early_leave: 'info',
        leave: 'neutral',
        active: 'success',
        inactive: 'neutral',
        connected: 'success',
        disconnected: 'danger',
    };
    return map[status] || 'neutral';
};

// Convert DB status to Arabic label
export const statusLabel = (status) => {
    return (
        employeeStatus[status] ||
        deviceStatus[status] ||
        attendanceStatus[status] ||
        status
    );
};
