// Payroll Simulation Calculator representing the mathematical logic of the system
function calculateNetSalary({
    baseSalary,
    housing = 0,
    transport = 0,
    daysWorked,
    totalDays,
    unpaidLeaveDays = 0,
    advancePaid = 0,
    bonuses = [],
    deductions = 0
}) {
    // 1. Calculate Daily Wage
    const dailyWage = baseSalary / totalDays;

    // 2. Unpaid Leave deduction
    const unpaidLeaveDeduction = dailyWage * unpaidLeaveDays;

    // 3. Absence deduction (excluding unpaid leaves if already calculated)
    const absentDays = Math.max(0, totalDays - daysWorked - unpaidLeaveDays);
    const absenceDeduction = dailyWage * absentDays;

    // 4. Sum of bonuses
    const totalBonuses = bonuses.reduce((sum, b) => {
        if (b.percentage) {
            return sum + (baseSalary * (b.percentage / 100));
        }
        return sum + (b.amount || 0);
    }, 0);

    // 5. Net Salary Calculation: Base + Housing + Transport + Bonuses - Deductions - Advance
    const totalAllowances = housing + transport;
    const totalDeductions = deductions + unpaidLeaveDeduction + absenceDeduction + advancePaid;

    let netSalary = baseSalary + totalAllowances + totalBonuses - totalDeductions;
    if (netSalary < 0) netSalary = 0;

    return {
        dailyWage: Math.round(dailyWage * 100) / 100,
        unpaidLeaveDeduction: Math.round(unpaidLeaveDeduction * 100) / 100,
        absenceDeduction: Math.round(absenceDeduction * 100) / 100,
        totalBonuses: Math.round(totalBonuses * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        netSalary: Math.round(netSalary * 100) / 100
    };
}

describe('Payroll, Loans & Leaves Integration Calculations', () => {
    const baseEmployee = {
        baseSalary: 6000,
        housing: 1000,
        transport: 500,
        daysWorked: 30,
        totalDays: 30,
        unpaidLeaveDays: 0,
        advancePaid: 0,
        bonuses: [],
        deductions: 0
    };

    it('Scenario P-01: Ideal Employee (Full presence, no loans/leaves)', () => {
        const result = calculateNetSalary(baseEmployee);
        // Net = 6000 (base) + 1000 (housing) + 500 (transport) = 7500
        expect(result.netSalary).toBe(7500);
        expect(result.absenceDeduction).toBe(0);
        expect(result.unpaidLeaveDeduction).toBe(0);
        expect(result.totalDeductions).toBe(0);
    });

    it('Scenario P-02: Absence deduction (2 days absent)', () => {
        const employee = {
            ...baseEmployee,
            daysWorked: 28 // Absent 2 days
        };
        const result = calculateNetSalary(employee);
        // Daily wage = 6000 / 30 = 200
        // Absence deduction = 200 * 2 = 400
        // Net = 7500 - 400 = 7100
        expect(result.dailyWage).toBe(200);
        expect(result.absenceDeduction).toBe(400);
        expect(result.netSalary).toBe(7100);
    });

    it('Scenario L-04: Unpaid Leave deduction (3 days unpaid leave)', () => {
        const employee = {
            ...baseEmployee,
            daysWorked: 27,
            unpaidLeaveDays: 3
        };
        const result = calculateNetSalary(employee);
        // Daily wage = 200
        // Unpaid leave deduction = 200 * 3 = 600
        // Absence deduction = 0 (since remaining 27 days are worked)
        // Net = 7500 - 600 = 6900
        expect(result.unpaidLeaveDeduction).toBe(600);
        expect(result.absenceDeduction).toBe(0);
        expect(result.netSalary).toBe(6900);
    });

    it('Scenario A-02: Loan/Advance deduction', () => {
        const employee = {
            ...baseEmployee,
            advancePaid: 1500 // Loan received
        };
        const result = calculateNetSalary(employee);
        // Net = 7500 - 1500 = 6000
        expect(result.totalDeductions).toBe(1500);
        expect(result.netSalary).toBe(6000);
    });

    it('Scenario P-04: Custom Performance Bonus (10% of base)', () => {
        const employee = {
            ...baseEmployee,
            bonuses: [{ percentage: 10, reason: 'Excellent performance' }]
        };
        const result = calculateNetSalary(employee);
        // Bonus = 10% of 6000 = 600
        // Net = 7500 + 600 = 8100
        expect(result.totalBonuses).toBe(600);
        expect(result.netSalary).toBe(8100);
    });

    it('Scenario Combined: Absence + Loan/Advance + Custom Bonus', () => {
        const employee = {
            ...baseEmployee,
            daysWorked: 29, // 1 day absent = -200
            advancePaid: 1000, // Loan = -1000
            bonuses: [{ amount: 400, reason: 'Special Reward' }] // Bonus = +400
        };
        const result = calculateNetSalary(employee);
        // Net = 6000 (base) + 1500 (allowances) + 400 (bonus) - 200 (absent) - 1000 (loan) = 6700
        expect(result.netSalary).toBe(6700);
        expect(result.totalDeductions).toBe(1200); // 200 absent + 1000 loan
    });

    it('Edge Case: Deductions exceed net salary (should not go negative)', () => {
        const employee = {
            ...baseEmployee,
            advancePaid: 10000 // Huge loan exceeding total wage
        };
        const result = calculateNetSalary(employee);
        expect(result.netSalary).toBe(0);
    });
});
