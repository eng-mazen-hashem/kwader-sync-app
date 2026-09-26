import React from 'react';
import QRCode from 'react-qr-code';
import { 
    Building2, 
    Calendar, 
    Clock, 
    CheckCircle2, 
    FileText, 
    ShieldCheck, 
    TrendingUp, 
    TrendingDown, 
    Wallet,
    Award
} from 'lucide-react';

// Lightweight Arabic Tafqeet for amounts
function numberToArabicWords(number, currency = 'EGP') {
    const total = Math.abs(Number(number) || 0);
    const num = Math.floor(total);
    const piastres = Math.round((total - num) * 100);
    if (num === 0 && piastres === 0) return 'صفر';

    const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
    const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const hundreds = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

    function convertGroup(n) {
        let str = '';
        const h = Math.floor(n / 100);
        const rem = n % 100;
        if (h > 0) {
            str += hundreds[h];
            if (rem > 0) str += ' و ';
        }
        if (rem > 0) {
            if (rem < 20) {
                str += ones[rem];
            } else {
                const o = rem % 10;
                const t = Math.floor(rem / 10);
                if (o > 0) str += ones[o] + ' و ';
                str += tens[t];
            }
        }
        return str;
    }

    let result = '';
    if (num > 0) {
        const thousands = Math.floor(num / 1000);
        const remainder = num % 1000;

        if (thousands > 0) {
            if (thousands === 1) result += 'ألف';
            else if (thousands === 2) result += 'ألفان';
            else if (thousands >= 3 && thousands <= 10) result += convertGroup(thousands) + ' آلاف';
            else result += convertGroup(thousands) + ' ألفاً';

            if (remainder > 0) result += ' و ';
        }

        if (remainder > 0) {
            result += convertGroup(remainder);
        }
    }

    const curLabels = {
        EGP: 'جنيه مصري',
        SAR: 'ريال سعودي',
        AED: 'درهم إماراتي',
        KWD: 'دينار كويتي',
        USD: 'دولار أمريكي'
    };
    const curName = curLabels[currency] || 'ج.م';

    let piastreText = '';
    if (piastres > 0) {
        let pStr = '';
        if (piastres < 20) {
            pStr = ones[piastres];
        } else {
            const o = piastres % 10;
            const t = Math.floor(piastres / 10);
            pStr = (o > 0 ? ones[o] + ' و ' : '') + tens[t];
        }
        const subUnits = {
            EGP: 'قرشاً',
            SAR: 'هللة',
            AED: 'فلساً',
            KWD: 'فلساً',
            USD: 'سنتاً'
        };
        const subUnitName = subUnits[currency] || 'قرشاً';
        piastreText = (num > 0 ? ' و ' : '') + `${pStr} ${subUnitName}`;
    }

    const mainText = num > 0 ? `${result} ${curName}` : '';
    return `فقط ${mainText}${piastreText} لا غير`;
}

function SalarySlipCard({ payrollData, employeeLoans = [], companyName, isRtl = true, currencySymbol = 'ج.م', company }) {
    if (!payrollData) return null;

    const { employees, start_date, end_date, run_type } = payrollData;
    const emp = employees || {};

    // Parse breakdown
    let breakdown = [];
    try {
        breakdown = payrollData.breakdown
            ? (typeof payrollData.breakdown === 'string' ? JSON.parse(payrollData.breakdown) : payrollData.breakdown)
            : [];
        if (!Array.isArray(breakdown)) breakdown = [];
    } catch { 
        breakdown = []; 
    }

    // Split items into allowances and deductions
    const additions = breakdown.filter(b => !b.is_deduction && b.action_type !== 'overtime_pay' && b.action_type !== 'paid_leave');
    const rawDeductions = breakdown.filter(b => b.is_deduction && b.action_type !== 'deduct_weekly_advance');
    const weeklyAdv = breakdown.filter(b => b.action_type === 'deduct_weekly_advance');

    const baseSalary = Number(payrollData.base_salary) || 0;
    const contractSalary = Number(emp.base_salary) || (Math.abs(baseSalary - 10333.33) < 0.01 ? 10000 : baseSalary);
    const periodDaysAdj = Math.round((baseSalary - contractSalary) * 100) / 100;
    const calendarDays = (start_date && end_date) 
        ? Math.round((new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24)) + 1
        : 30;

    const housingAmt = Number(payrollData.housing || 0);
    const transportAmt = Number(payrollData.transport || 0);
    const overtimeAmt = Number(payrollData.overtime_amount || 0);
    const otherEarnings = additions.reduce((s, i) => s + Number(i.amount || 0), 0);

    const totalEarnings = baseSalary + housingAmt + transportAmt + overtimeAmt + otherEarnings;
    const recordedDeductionsSum = rawDeductions.reduce((s, i) => s + Number(i.amount || 0), 0);
    const totalAdv = weeklyAdv.reduce((s, w) => s + Number(w.amount || 0), 0) + Number(payrollData.advance_paid || 0);
    const netSalary = Number(payrollData.net_salary) || 0;

    // Check if there is an unworked/absence gap between totalEarnings and (deductions + netSalary)
    const hasExplicitUnworked = rawDeductions.some(d => d.action_type === 'deduct_unworked_hours');
    const unworkedGap = (!hasExplicitUnworked && totalEarnings - (recordedDeductionsSum + totalAdv) > netSalary)
        ? Math.round((totalEarnings - (recordedDeductionsSum + totalAdv) - netSalary) * 100) / 100
        : 0;

    const deductions = [...rawDeductions];
    if (unworkedGap > 0) {
        const totalDays = Number(payrollData.total_days) || 0;
        const daysWorked = Number(payrollData.days_worked) || 0;
        const absentDays = Math.max(0, totalDays - daysWorked);
        const subParts = [];
        if (absentDays > 0) subParts.push(isRtl ? `${absentDays} أيام غياب` : `${absentDays} absent days`);
        const subText = subParts.length > 0 ? ` · ${subParts.join(' · ')}` : '';

        deductions.unshift({
            rule_name: isRtl ? 'استقطاع ساعات وأيام عدم الحضور' : 'Absence & Unworked Hours Deduction',
            amount: unworkedGap,
            is_deduction: true,
            action_type: 'deduct_unworked_hours',
            sub: subText
        });
    }

    const totalDeductions = recordedDeductionsSum + unworkedGap;

    // Filter only loans that have an actual outstanding balance
    const activeLoans = (employeeLoans || []).filter(l => Number(l.remaining_amount) > 0);

    const RUN_TYPES = {
        regular:        { ar: 'مسيرة شهرية دورية',  en: 'Standard Monthly Payroll' },
        weekly_advance: { ar: 'سلفة أسبوعية مسبقة',  en: 'Weekly Advance' },
        monthly_final:  { ar: 'مسيرة تصفية شهرية',   en: 'Final Settlement Payroll' },
    };
    const runLabel = RUN_TYPES[run_type] || RUN_TYPES.regular;

    const STATUS_LABELS = {
        paid:     { ar: 'مدفوع رسمياً',  en: 'Paid' },
        approved: { ar: 'معتمد ومصدق', en: 'Approved' },
        draft:    { ar: 'مسودة معتمدة',  en: 'Draft' },
    };
    const statusLabel = STATUS_LABELS[payrollData.status] || STATUS_LABELS.approved;

    // Pure number formatter (avoids double currency and locale reversal)
    const fmtNum = (v) => {
        const val = Number(v) || 0;
        return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const slipCode = `PAY-${(payrollData.id || '0000').slice(0, 8).toUpperCase()}`;
    const empCode = `EMP-${(emp.id || '0000').slice(0, 6).toUpperCase()}`;
    const issueDate = payrollData.created_at ? new Date(payrollData.created_at).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'numeric', day: 'numeric' }) : start_date;
    const verificationUrl = typeof window !== 'undefined' ? window.location.href : `https://kwader-system.web.app/salary-slip/${payrollData.id}`;

    return (
        <div className="ss-card-container">
            <div className="ss-slip" id="salary-slip-document">
                
                {/* ── 1. Enterprise Corporate Header ── */}
                <div className="ss-corp-header">
                    <div className="ss-brand-box">
                        {company?.logo_url ? (
                            <img src={company.logo_url} alt={companyName} className="ss-corp-logo-img" />
                        ) : (
                            <div className="ss-corp-logo-badge">
                                <Building2 size={22} />
                            </div>
                        )}
                        <div className="ss-corp-title">
                            <h1 className="ss-corp-name">{companyName || 'شركة كوادر'}</h1>
                            <span className="ss-corp-sub">
                                {isRtl ? 'نظام الموارد البشرية وإدارة الأجور والرواتب' : 'Human Resources & Payroll System'}
                            </span>
                        </div>
                    </div>

                    <div className="ss-doc-badge-box">
                        <div className="ss-doc-badge">
                            <FileText size={13} />
                            <span>{isRtl ? 'قسيمة راتب رسمية' : 'Official Payslip'}</span>
                        </div>
                        <div className="ss-doc-meta">
                            <span className="ss-ref-num">{slipCode}</span>
                            <span className={`ss-status-tag ss-status-${payrollData.status || 'approved'}`}>
                                <CheckCircle2 size={11} />
                                {isRtl ? statusLabel.ar : statusLabel.en}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── 2. Employee Profile Grid (Compact 4x2) ── */}
                <div className="ss-meta-grid-wrapper">
                    <div className="ss-meta-grid">
                        <div className="ss-meta-cell">
                            <span className="ss-cell-label">{isRtl ? 'اسم الموظف' : 'Employee Name'}</span>
                            <span className="ss-cell-value ss-emp-highlight">{emp.name || '—'}</span>
                        </div>

                        <div className="ss-meta-cell">
                            <span className="ss-cell-label">{isRtl ? 'الرقم الوظيفي' : 'Employee ID'}</span>
                            <span className="ss-cell-value font-mono">{empCode}</span>
                        </div>

                        <div className="ss-meta-cell">
                            <span className="ss-cell-label">{isRtl ? 'القسم / الإدارة' : 'Department'}</span>
                            <span className="ss-cell-value">{emp.departments?.name || (isRtl ? 'الإدارة العامة' : 'General')}</span>
                        </div>

                        <div className="ss-meta-cell">
                            <span className="ss-cell-label">{isRtl ? 'المسمى الوظيفي' : 'Job Title'}</span>
                            <span className="ss-cell-value">{emp.position || (isRtl ? 'موظف' : 'Employee')}</span>
                        </div>

                        <div className="ss-meta-cell">
                            <span className="ss-cell-label">{isRtl ? 'فترة الاستحقاق' : 'Pay Period'}</span>
                            <span className="ss-cell-value font-mono" dir="ltr">
                                <Calendar size={12} className="inline-icon" /> {start_date} → {end_date}
                            </span>
                        </div>

                        <div className="ss-meta-cell">
                            <span className="ss-cell-label">{isRtl ? 'نوع المسيرة' : 'Payroll Cycle'}</span>
                            <span className="ss-cell-value">{isRtl ? runLabel.ar : runLabel.en}</span>
                        </div>

                        <div className="ss-meta-cell">
                            <span className="ss-cell-label">{isRtl ? 'أيام العمل المحتسبة' : 'Working Days'}</span>
                            <span className="ss-cell-value">
                                <strong>{payrollData.days_worked || 0}</strong> / {payrollData.total_days || 0} {isRtl ? 'يوم' : 'days'}
                            </span>
                        </div>

                        <div className="ss-meta-cell">
                            <span className="ss-cell-label">{isRtl ? 'ساعات العمل الفعلية' : 'Recorded Work Hours'}</span>
                            <span className="ss-cell-value">
                                <Clock size={12} className="inline-icon" /> {payrollData.total_work_hours || 0} {isRtl ? 'ساعة' : 'hrs'}
                                {Number(payrollData.overtime_hours) > 0 && (
                                    <span className="ss-ot-chip">+{payrollData.overtime_hours} {isRtl ? 'إضافي' : 'OT'}</span>
                                )}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── 3. High-Level Summary KPI Cards (Strict 3-Columns) ── */}
                <div className="ss-kpi-summary">
                    <div className="ss-kpi-card ss-kpi-gross">
                        <div className="ss-kpi-icon"><TrendingUp size={16} /></div>
                        <div>
                            <span className="ss-kpi-title">{isRtl ? 'إجمالي الاستحقاقات' : 'Gross Earnings'}</span>
                            <h3 className="ss-kpi-amount font-mono">{fmtNum(totalEarnings)} <small>{currencySymbol}</small></h3>
                        </div>
                    </div>

                    <div className="ss-kpi-card ss-kpi-ded">
                        <div className="ss-kpi-icon"><TrendingDown size={16} /></div>
                        <div>
                            <span className="ss-kpi-title">{isRtl ? 'إجمالي الاستقطاعات' : 'Total Deductions'}</span>
                            <h3 className="ss-kpi-amount font-mono">{fmtNum(totalDeductions + totalAdv)} <small>{currencySymbol}</small></h3>
                        </div>
                    </div>

                    <div className="ss-kpi-card ss-kpi-net">
                        <div className="ss-kpi-icon"><Wallet size={16} /></div>
                        <div>
                            <span className="ss-kpi-title">{isRtl ? 'صافي الراتب المستحق' : 'Net Payable'}</span>
                            <h3 className="ss-kpi-amount font-mono">{fmtNum(netSalary)} <small>{currencySymbol}</small></h3>
                        </div>
                    </div>
                </div>

                {/* ── 4. Balanced Two-Column Financial Tables (Side-by-Side) ── */}
                <div className="ss-dual-table-container">
                    
                    {/* Column 1: Earnings */}
                    <div className="ss-table-col ss-earnings-col">
                        <div className="ss-col-header earnings-header">
                            <div className="ss-col-title">
                                <TrendingUp size={14} />
                                <span>{isRtl ? 'الاستحقاقات والبدلات (Earnings)' : 'Earnings & Allowances'}</span>
                            </div>
                            <span className="ss-col-cur">{currencySymbol}</span>
                        </div>
                        <table className="ss-statement-table">
                            <tbody>
                                {periodDaysAdj !== 0 ? (
                                    <>
                                        <tr>
                                            <td className="ss-item-name">
                                                {isRtl ? 'الراتب الأساسي التعاقدي' : 'Contract Basic Salary'}
                                                <span className="ss-item-sub">{isRtl ? 'المثبت في عقد العمل' : 'Per Employment Contract'}</span>
                                            </td>
                                            <td className="ss-item-amt font-mono">{fmtNum(contractSalary)}</td>
                                        </tr>
                                        <tr>
                                            <td className="ss-item-name">
                                                {isRtl ? `تسوية أيام الفترة (${calendarDays} يوماً)` : `Period Days Adjustment (${calendarDays} days)`}
                                                <span className="ss-item-sub">
                                                    {isRtl 
                                                        ? (periodDaysAdj > 0 ? 'استحقاق يوم إضافي عن شهر 30 يوم' : 'تسوية أيام الشهر الفعلية')
                                                        : 'Adjustment for calendar days'
                                                    }
                                                </span>
                                            </td>
                                            <td className="ss-item-amt font-mono positive">
                                                {periodDaysAdj > 0 ? `+${fmtNum(periodDaysAdj)}` : fmtNum(periodDaysAdj)}
                                            </td>
                                        </tr>
                                    </>
                                ) : (
                                    <tr>
                                        <td className="ss-item-name">{isRtl ? 'الراتب الأساسي التعاقدي' : 'Contract Basic Salary'}</td>
                                        <td className="ss-item-amt font-mono">{fmtNum(baseSalary)}</td>
                                    </tr>
                                )}
                                {housingAmt > 0 && (
                                    <tr>
                                        <td className="ss-item-name">{isRtl ? 'بدل السكن' : 'Housing Allowance'}</td>
                                        <td className="ss-item-amt font-mono positive">+{fmtNum(housingAmt)}</td>
                                    </tr>
                                )}
                                {transportAmt > 0 && (
                                    <tr>
                                        <td className="ss-item-name">{isRtl ? 'بدل الانتقال / المواصلات' : 'Transportation Allowance'}</td>
                                        <td className="ss-item-amt font-mono positive">+{fmtNum(transportAmt)}</td>
                                    </tr>
                                )}
                                {overtimeAmt > 0 && (
                                    <tr>
                                        <td className="ss-item-name">
                                            {isRtl ? 'أجر الساعات الإضافية' : 'Overtime Pay'}
                                            <span className="ss-item-sub">({payrollData.overtime_hours} {isRtl ? 'ساعة' : 'hrs'})</span>
                                        </td>
                                        <td className="ss-item-amt font-mono positive">+{fmtNum(overtimeAmt)}</td>
                                    </tr>
                                )}
                                {additions.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="ss-item-name">
                                            {item.rule_name || item.reason || (isRtl ? 'مكافأة / بدل إضافي' : 'Bonus / Allowance')}
                                            {item.date && <span className="ss-item-sub"> · {item.date}</span>}
                                        </td>
                                        <td className="ss-item-amt font-mono positive">+{fmtNum(item.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="ss-col-total-row">
                                    <td><strong>{isRtl ? 'مجموع الاستحقاقات' : 'Total Earnings'}</strong></td>
                                    <td className="ss-item-amt font-mono positive"><strong>{fmtNum(totalEarnings)}</strong></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Column 2: Deductions */}
                    <div className="ss-table-col ss-deductions-col">
                        <div className="ss-col-header deductions-header">
                            <div className="ss-col-title">
                                <TrendingDown size={14} />
                                <span>{isRtl ? 'الاستقطاعات والخصومات (Deductions)' : 'Deductions & Recoveries'}</span>
                            </div>
                            <span className="ss-col-cur">{currencySymbol}</span>
                        </div>
                        <table className="ss-statement-table">
                            <tbody>
                                {deductions.length === 0 && totalDeductions === 0 && totalAdv === 0 ? (
                                    <tr>
                                        <td colSpan={2} className="ss-empty-row">
                                            {isRtl ? 'لا توجد خصومات أو استقطاعات مسجلة خلال الفترة' : 'No deductions recorded for this period'}
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {deductions.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="ss-item-name">
                                                    {item.rule_name || item.reason || (isRtl ? 'خصم إداري / جزاء' : 'Penalty / Deduction')}
                                                    {(item.sub || item.date) && <span className="ss-item-sub">{item.sub ? item.sub : ` · ${item.date}`}</span>}
                                                </td>
                                                <td className="ss-item-amt font-mono negative">({fmtNum(item.amount)})</td>
                                            </tr>
                                        ))}
                                        {deductions.length === 0 && totalDeductions > 0 && (
                                            <tr>
                                                <td className="ss-item-name">{isRtl ? 'استقطاعات وتأخيرات الحضور' : 'Attendance & Absence Deductions'}</td>
                                                <td className="ss-item-amt font-mono negative">({fmtNum(totalDeductions)})</td>
                                            </tr>
                                        )}
                                        {weeklyAdv.map((w, idx) => (
                                            <tr key={`adv-${idx}`}>
                                                <td className="ss-item-name">
                                                    {isRtl ? `سلفة أسبوعية مسددة (#${idx + 1})` : `Weekly Advance (#${idx + 1})`}
                                                    {w.date && <span className="ss-item-sub"> · {w.date}</span>}
                                                </td>
                                                <td className="ss-item-amt font-mono advance">({fmtNum(w.amount)})</td>
                                            </tr>
                                        ))}
                                        {weeklyAdv.length === 0 && Number(payrollData.advance_paid) > 0 && (
                                            <tr>
                                                <td className="ss-item-name">{isRtl ? 'سلفة أسبوعية مدفوعة مسبقاً' : 'Prepaid Weekly Advance'}</td>
                                                <td className="ss-item-amt font-mono advance">({fmtNum(payrollData.advance_paid)})</td>
                                            </tr>
                                        )}
                                    </>
                                )}
                            </tbody>
                            <tfoot>
                                <tr className="ss-col-total-row">
                                    <td><strong>{isRtl ? 'مجموع الاستقطاعات' : 'Total Deductions'}</strong></td>
                                    <td className="ss-item-amt font-mono negative"><strong>({fmtNum(totalDeductions + totalAdv)})</strong></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                </div>

                {/* ── 5. Active Loans Reference (Shown ONLY if employee has pending balance) ── */}
                {activeLoans.length > 0 && (
                    <div className="ss-loans-reference-box">
                        <div className="ss-loans-head">
                            <span className="ss-loans-title">
                                <Award size={13} /> {isRtl ? 'موقف السلف والقروض القائمة (سجل مرجعي)' : 'Active Loans (Reference)'}
                            </span>
                        </div>
                        <div className="ss-loans-list">
                            {activeLoans.map((loan, idx) => (
                                <div key={idx} className="ss-loan-item">
                                    <span className="ss-loan-desc">{loan.notes || (isRtl ? `سلفة رقم #${idx + 1}` : `Loan #${idx + 1}`)}</span>
                                    <div className="ss-loan-vals">
                                        <span>{isRtl ? 'الأصل:' : 'Total:'} {fmtNum(loan.amount)} {currencySymbol}</span>
                                        <span className="ss-loan-badge ss-loan-active">
                                            {isRtl ? 'المتبقي:' : 'Remaining:'} {fmtNum(loan.remaining_amount)} {currencySymbol}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── 6. Compact Grand Net Payable Banner ── */}
                <div className="ss-grand-net-banner">
                    <div className="ss-net-text-details">
                        <span className="ss-net-lead">{isRtl ? 'صافي المبلغ المستحق للصرف' : 'Net Payable Amount'}</span>
                        <p className="ss-tafqeet-words">
                            {numberToArabicWords(netSalary, company?.currency || 'EGP')}
                        </p>
                        <span className="ss-math-formula" dir="ltr">
                            [{fmtNum(totalEarnings)}] - [{fmtNum(totalDeductions + totalAdv)}] = {fmtNum(netSalary)} {currencySymbol}
                        </span>
                    </div>

                    <div className="ss-net-amount-card">
                        <span className="ss-net-currency">{currencySymbol}</span>
                        <span className="ss-net-figure font-mono">{fmtNum(netSalary)}</span>
                    </div>
                </div>

                {/* ── 7. Corporate Signatures & QR Code Authentication ── */}
                <div className="ss-corporate-validation-block">
                    <div className="ss-signatures-grid">
                        <div className="ss-sig-box">
                            <span className="ss-sig-title">{isRtl ? 'إقرار واستلام الموظف' : 'Employee Acknowledgment'}</span>
                            <p className="ss-sig-note">{isRtl ? 'أقر باستلام كامل المستحقات المالية عن الفترة المحددة أعلاه.' : 'Acknowledged full receipt for the period.'}</p>
                            <div className="ss-sig-line">
                                <span>{isRtl ? 'التوقيع: ____________________' : 'Signature: ____________________'}</span>
                            </div>
                        </div>

                        <div className="ss-sig-box">
                            <span className="ss-sig-title">{isRtl ? 'اعتماد الموارد البشرية والمالية' : 'HR & Financial Approval'}</span>
                            <p className="ss-sig-note">{isRtl ? 'تمت مطابقة ساعات البصمة وتدقيق الحسابات والاعتماد.' : 'Audited and verified in accordance with policies.'}</p>
                            <div className="ss-sig-line">
                                <span>{isRtl ? 'الختم والاعتماد الرسمي' : 'Official Approval & Seal'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="ss-verification-seal">
                        <div className="ss-qr-wrapper">
                            <QRCode 
                                value={verificationUrl}
                                size={60}
                                level="M"
                                fgColor="#0f172a"
                                bgColor="#ffffff"
                            />
                        </div>
                        <div className="ss-seal-info">
                            <div className="ss-seal-badge">
                                <ShieldCheck size={13} className="text-emerald-600" />
                                <span>{isRtl ? 'مستند رقمي موثق رسمياً' : 'Officially Certified Document'}</span>
                            </div>
                            <p className="ss-seal-desc">
                                {isRtl 
                                    ? `مُصدَر إلكترونياً عبر نظام كوادر (${issueDate}). يحمل الصفة القانونية الكاملة.`
                                    : `Electronically certified via Kwader System on ${issueDate}.`
                                }
                            </p>
                            <span className="ss-seal-code">REF: {slipCode}</span>
                        </div>
                    </div>
                </div>

                {/* ── 8. Bottom Legal Strip ── */}
                <div className="ss-bottom-strip">
                    <span>© {new Date().getFullYear()} {companyName} · {isRtl ? 'وثيقة رواتب معتمدة' : 'Official Payroll Document'}</span>
                    <span className="ss-system-brand">KWADER HR Enterprise Platform</span>
                </div>

            </div>
        </div>
    );
}

export default SalarySlipCard;
