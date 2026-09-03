import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { logAudit } from '../utils/auditLogger';
import {
    DollarSign, TrendingDown, Users, CheckCircle,
    Download, Play, RefreshCcw, MoreVertical,
    Eye, Printer,
    Square, CheckSquare, Minus, X, FileCheck,
    ArrowUpRight, Calendar
} from 'lucide-react';
import './Payroll.css';

// -------------------------------------------------------------------------
const STATUSES = {
    draft:    { label: 'Draft',    color: 'warning', icon: '●' },
    approved: { label: 'Approved', color: 'info',    icon: '✓' },
    paid:     { label: 'Paid',     color: 'success', icon: '✦' },
};

const RUN_TYPE_LABELS = {
    regular:        { ar: 'عادية',           en: 'Regular',        icon: '📅', color: '#6366f1' },
    weekly_advance: { ar: 'أسبوعية (سلفة)', en: 'Weekly Advance',  icon: '💸', color: '#f59e0b' },
    monthly_final:  { ar: 'شهرية نهائية',   en: 'Monthly Final',   icon: '✅', color: '#10b981' },
};

function Payroll() {
    const { company } = useAuth();
    const { t, formatCurrency, language } = useLocale();

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(lastDay);
    const [monthPayrolls, setMonthPayrolls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [calculating, setCalculating] = useState(false);

    // Grid state
    const [selectedRows, setSelectedRows] = useState(new Set());
    const [activeSlipId, setActiveSlipId] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [openMenuId, setOpenMenuId] = useState(null);

    // Status map — UI-only, persisted in memory
    const [statusMap, setStatusMap] = useState({});

    // Custom Performance Bonus states
    const [bonusPercentage, setBonusPercentage] = useState(10);
    const [bonusReason, setBonusReason] = useState('');
    const [isApplyingBonus, setIsApplyingBonus] = useState(false);
    const [customPercentActive, setCustomPercentActive] = useState(false);

    // Bulk Performance Bonus states
    const [bulkModalOpen, setBulkModalOpen] = useState(false);
    const [bulkBonusPercentage, setBulkBonusPercentage] = useState(10);
    const [bulkBonusReason, setBulkBonusReason] = useState('');
    const [bulkCustomPercentActive, setBulkCustomPercentActive] = useState(false);
    const [isApplyingBulkBonus, setIsApplyingBulkBonus] = useState(false);

    // Reset bonus inputs when active slip changes
    useEffect(() => {
        setBonusPercentage(10);
        setBonusReason('');
        setCustomPercentActive(false);
    }, [activeSlipId]);

    const menuRef = useRef(null);

// -------------------------------------------------------------------------
    const fetchPayrolls = useCallback(async () => {
        if (!company) { setLoading(false); return; }
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('payrolls')
                .select('*, employees(name)')
                .eq('company_id', company.id)
                .eq('start_date', startDate)
                .eq('end_date', endDate)
                .order('created_at', { ascending: true });

            if (error) throw error;
            const initialMap = {};
            const rows = (data || []).map(p => {
                initialMap[p.id] = p.status || 'draft';
                return {
                    ...p,
                    employee_name: p.employees?.name || t.employee,
                };
            });
            setMonthPayrolls(rows);
            setStatusMap(initialMap);
            setSelectedRows(new Set());
            setActiveSlipId(rows[0]?.id || null);
        } catch (err) {
            console.error('[Payroll] fetchPayrolls:', err.message);
            toast.error(t.errFetchFailed || 'Failed to fetch payrolls');
        } finally {
            setLoading(false);
        }
    }, [company, startDate, endDate, t]);

    useEffect(() => { fetchPayrolls(); }, [fetchPayrolls]);

    // Close menu on outside click
    useEffect(() => {
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

// -------------------------------------------------------------------------
    const totalNet        = monthPayrolls.reduce((s, p) => s + Number(p.net_salary), 0);
    const totalDeductions = monthPayrolls.reduce((s, p) => s + Number(p.deductions), 0);
    const totalBase       = monthPayrolls.reduce((s, p) => s + Number(p.base_salary), 0);
    const paidCount       = Object.values(statusMap).filter(s => s === 'paid').length;
    const activeSlip      = monthPayrolls.find(p => p.id === activeSlipId);

// -------------------------------------------------------------------------
    const handleCalculatePayroll = async () => {
        if (!company) return;
        if (new Date(startDate) > new Date(endDate)) { toast.error(t.dateErrorMsg); return; }
        setCalculating(true);
        try {
            const { data, error } = await supabase.functions.invoke('process-payroll', {
                body: {
                    company_id: company.id,
                    start_date: startDate,
                    end_date: endDate,
                }
            });

            // FunctionsHttpError carries the response body in context.body
            if (error) {
                let errMsg = error.message || t.errUnknown;
                try {
                    // Try to parse the body for a more specific backend error message
                    const body = typeof error.context?.body === 'string'
                        ? JSON.parse(error.context.body)
                        : error.context?.body;
                    if (body?.error) errMsg = body.error;
                } catch (_) { /* ignore parse errors */ }
                toast.error(t.errCalcPayroll + ': ' + errMsg);
                console.error('[Payroll] Edge Function error:', errMsg);
                return;
            }

            if (data?.success) {
                const count = data.processed_employees ?? 0;
                toast.success(t.payrollSuccessMsg?.replace('{count}', count));
                await logAudit({
                    companyId: company.id,
                    userId: (await supabase.auth.getUser()).data.user?.id,
                    action: 'GENERATE_PAYROLL_V2',
                    tableName: 'payrolls',
                    recordId: null,
                    oldData: null,
                    newData: { startDate, endDate, processed: count }
                });
                fetchPayrolls();
            } else {
                // Backend returned success:false with an error message
                const backendErr = data?.error || t.errBackend;
                toast.error('Error: ' + backendErr);
                console.error('[Payroll] Backend returned error:', backendErr);
            }
        } catch (err) {
            console.error('[Payroll] handleCalculatePayroll unexpected error:', err);
            toast.error(t.errUnexpected + ' ' + (err?.message || String(err)));
        } finally {
            setCalculating(false);
        }
    };

    const handleExportExcel = () => {
        const exportData = monthPayrolls.map((p, i) => ({
            [t.thNumber]: i + 1,
            [t.thEmployeeName]: p.employee_name,
            [t.thWorkingDays]: `${p.days_worked}/${p.total_days}`,
            [t.thWorkHours]: p.total_work_hours,
            [t.thEarnedWage]: p.base_salary,
            [t.thHousing]: p.housing,
            [t.thTransport]: p.transport,
            [t.thDeductions]: p.deductions,
            [t.thNetSalary]: p.net_salary,
            'Status': statusMap[p.id] || 'draft',
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, t.excelSheetName);
        ws['!cols'] = Object.keys(exportData[0] || {}).map(() => ({ wch: 18 }));
        XLSX.writeFile(wb, `${t.excelFileName}_${startDate}.xlsx`);
    };

    // Row selection
    const toggleRow = (id) => {
        setSelectedRows(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAllRows = () => {
        if (selectedRows.size === monthPayrolls.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(monthPayrolls.map(p => p.id)));
        }
    };

    // Status actions
    const setStatus = async (id, status) => {
        try {
            const { error } = await supabase
                .from('payrolls')
                .update({ status })
                .eq('id', id);
            if (error) throw error;

            setStatusMap(prev => ({ ...prev, [id]: status }));
            setOpenMenuId(null);
            toast.success(language === 'ar' ? 'تم تحديث حالة الراتب بنجاح' : 'Salary status updated successfully');

            // Send notification
            const payrollItem = monthPayrolls.find(p => p.id === id);
            if (payrollItem && (status === 'approved' || status === 'paid')) {
                const title = language === 'ar' 
                    ? (status === 'approved' ? 'تأكيد الراتب' : 'صرف الراتب') 
                    : (status === 'approved' ? 'Salary Confirmed' : 'Salary Paid');
                const message = language === 'ar'
                    ? `تم ${status === 'approved' ? 'تأكيد' : 'صرف'} راتبك بقيمة ${formatCurrency(payrollItem.net_salary)} للفترة من ${payrollItem.start_date} إلى ${payrollItem.end_date}.`
                    : `Your salary of ${formatCurrency(payrollItem.net_salary)} has been ${status === 'approved' ? 'confirmed' : 'paid'} for the period ${payrollItem.start_date} to ${payrollItem.end_date}.`;

                await supabase.from('employee_notifications').insert([{
                    employee_id: payrollItem.employee_id,
                    title,
                    message,
                    type: status === 'paid' ? 'success' : 'info'
                }]);
            }
        } catch (err) {
            console.error('[Payroll] setStatus error:', err);
            toast.error(language === 'ar' ? 'فشل تحديث الحالة في قاعدة البيانات' : 'Failed to update status in database');
        }
    };

    const bulkApprove = async () => {
        const selectedIds = Array.from(selectedRows);
        try {
            const updates = selectedIds.map(async (id) => {
                const { error } = await supabase
                    .from('payrolls')
                    .update({ status: 'approved' })
                    .eq('id', id);
                if (error) throw error;

                const payrollItem = monthPayrolls.find(p => p.id === id);
                if (payrollItem) {
                    const title = language === 'ar' ? 'تأكيد الراتب' : 'Salary Confirmed';
                    const message = language === 'ar'
                        ? `تم تأكيد راتبك بقيمة ${formatCurrency(payrollItem.net_salary)} للفترة من ${payrollItem.start_date} إلى ${payrollItem.end_date}.`
                        : `Your salary of ${formatCurrency(payrollItem.net_salary)} has been confirmed for the period ${payrollItem.start_date} to ${payrollItem.end_date}.`;

                    await supabase.from('employee_notifications').insert([{
                        employee_id: payrollItem.employee_id,
                        title,
                        message,
                        type: 'info'
                    }]);
                }
            });
            await Promise.all(updates);

            const statusUpdates = {};
            selectedIds.forEach(id => { statusUpdates[id] = 'approved'; });
            setStatusMap(prev => ({ ...prev, ...statusUpdates }));
            
            toast.success(t.bulkApproveSuccess?.replace('{count}', selectedIds.length));
            setSelectedRows(new Set());
        } catch (err) {
            console.error('[Payroll] bulkApprove error:', err);
            toast.error(language === 'ar' ? 'فشل تحديث حالة الرواتب المحددة' : 'Failed to approve selected payrolls');
        }
    };

    const openDrawer = (id) => {
        setActiveSlipId(id);
        setDrawerOpen(true);
        setOpenMenuId(null);
    };

    // Apply custom performance bonus to individual employee
    const handleApplyBonus = async (payroll, percentageVal, reasonVal) => {
        if (!company || !payroll) return;
        const pct = Number(percentageVal);
        if (isNaN(pct) || pct <= 0 || pct > 100) {
            toast.error(language === 'ar' ? 'الرجاء إدخال نسبة صحيحة بين 1 و 100' : 'Please enter a valid percentage between 1 and 100');
            return;
        }
        const reason = (reasonVal || '').trim() || (language === 'ar' ? 'مكافأة أداء متميز' : 'Performance Bonus');

        setIsApplyingBonus(true);
        try {
            const baseSalary = Number(payroll.base_salary);
            const amount = Math.round((baseSalary * pct / 100) * 100) / 100;

            const { data: latestPayroll, error: getErr } = await supabase
                .from('payrolls')
                .select('*')
                .eq('id', payroll.id)
                .single();

            if (getErr) throw getErr;

            let currentBreakdown = [];
            try {
                currentBreakdown = typeof latestPayroll.breakdown === 'string' 
                    ? JSON.parse(latestPayroll.breakdown) 
                    : (latestPayroll.breakdown || []);
            } catch (e) { currentBreakdown = []; }

            currentBreakdown = currentBreakdown.filter(item => item.action_type !== 'custom_bonus');

            const newBonusItem = {
                date: startDate,
                rule_name: reason,
                action_type: 'custom_bonus',
                amount: amount,
                percentage: pct,
                is_deduction: false,
            };
            currentBreakdown.push(newBonusItem);

            const ruleBonusesSum = currentBreakdown
                .filter(item => !item.is_deduction && item.action_type !== 'paid_leave')
                .reduce((sum, item) => sum + Number(item.amount), 0);

            const totalDeductions = currentBreakdown
                .filter(item => item.is_deduction)
                .reduce((sum, item) => sum + Number(item.amount), 0);

            let newNet = 0;
            if (latestPayroll.run_type === 'weekly_advance') {
                newNet = Number(latestPayroll.advance_paid) + amount;
            } else {
                newNet = Number(latestPayroll.base_salary) + Number(latestPayroll.housing) + Number(latestPayroll.transport) + ruleBonusesSum - totalDeductions;
            }
            if (newNet < 0) newNet = 0;

            const { data: updatedPayroll, error: updateErr } = await supabase
                .from('payrolls')
                .update({
                    breakdown: currentBreakdown,
                    overtime_amount: ruleBonusesSum,
                    net_salary: Math.round(newNet * 100) / 100,
                    extra_allowances: currentBreakdown.filter(item => !item.is_deduction)
                })
                .eq('id', payroll.id)
                .select()
                .single();

            if (updateErr) throw updateErr;

            setMonthPayrolls(prev => prev.map(p => p.id === payroll.id ? { ...p, ...updatedPayroll } : p));
            toast.success(language === 'ar' ? 'تم تطبيق المكافأة بنجاح' : 'Bonus applied successfully');
            
            await logAudit({
                companyId: company.id,
                userId: (await supabase.auth.getUser()).data.user?.id,
                action: 'APPLY_PAYROLL_BONUS',
                tableName: 'payrolls',
                recordId: payroll.id,
                oldData: { breakdown: latestPayroll.breakdown, net_salary: latestPayroll.net_salary },
                newData: { breakdown: currentBreakdown, net_salary: updatedPayroll.net_salary }
            });
        } catch (err) {
            console.error('[Payroll] handleApplyBonus error:', err);
            toast.error(language === 'ar' ? 'فشل تطبيق المكافأة' : 'Failed to apply bonus');
        } finally {
            setIsApplyingBonus(false);
        }
    };

    // Remove custom performance bonus
    const handleRemoveBonus = async (payroll) => {
        if (!company || !payroll) return;
        setIsApplyingBonus(true);
        try {
            const { data: latestPayroll, error: getErr } = await supabase
                .from('payrolls')
                .select('*')
                .eq('id', payroll.id)
                .single();

            if (getErr) throw getErr;

            let currentBreakdown = [];
            try {
                currentBreakdown = typeof latestPayroll.breakdown === 'string' 
                    ? JSON.parse(latestPayroll.breakdown) 
                    : (latestPayroll.breakdown || []);
            } catch (e) { currentBreakdown = []; }

            currentBreakdown = currentBreakdown.filter(item => item.action_type !== 'custom_bonus');

            const ruleBonusesSum = currentBreakdown
                .filter(item => !item.is_deduction && item.action_type !== 'paid_leave')
                .reduce((sum, item) => sum + Number(item.amount), 0);

            const totalDeductions = currentBreakdown
                .filter(item => item.is_deduction)
                .reduce((sum, item) => sum + Number(item.amount), 0);

            let newNet = 0;
            if (latestPayroll.run_type === 'weekly_advance') {
                newNet = Number(latestPayroll.advance_paid);
            } else {
                newNet = Number(latestPayroll.base_salary) + Number(latestPayroll.housing) + Number(latestPayroll.transport) + ruleBonusesSum - totalDeductions;
            }
            if (newNet < 0) newNet = 0;

            const { data: updatedPayroll, error: updateErr } = await supabase
                .from('payrolls')
                .update({
                    breakdown: currentBreakdown,
                    overtime_amount: ruleBonusesSum,
                    net_salary: Math.round(newNet * 100) / 100,
                    extra_allowances: currentBreakdown.filter(item => !item.is_deduction)
                })
                .eq('id', payroll.id)
                .select()
                .single();

            if (updateErr) throw updateErr;

            setMonthPayrolls(prev => prev.map(p => p.id === payroll.id ? { ...p, ...updatedPayroll } : p));
            toast.success(language === 'ar' ? 'تم إزالة المكافأة بنجاح' : 'Bonus removed successfully');
        } catch (err) {
            console.error('[Payroll] handleRemoveBonus error:', err);
            toast.error(language === 'ar' ? 'فشل إزالة المكافأة' : 'Failed to remove bonus');
        } finally {
            setIsApplyingBonus(false);
        }
    };

    // Apply performance bonus to multiple selected employees
    const handleApplyBulkBonus = async () => {
        if (!company || selectedRows.size === 0) return;
        const pct = Number(bulkBonusPercentage);
        if (isNaN(pct) || pct <= 0 || pct > 100) {
            toast.error(language === 'ar' ? 'الرجاء إدخال نسبة صحيحة بين 1 و 100' : 'Please enter a valid percentage between 1 and 100');
            return;
        }
        const reason = (bulkBonusReason || '').trim() || (language === 'ar' ? 'مكافأة تميز جماعية' : 'Bulk Performance Bonus');

        setIsApplyingBulkBonus(true);
        try {
            const selectedIds = Array.from(selectedRows);
            
            const updates = selectedIds.map(async (id) => {
                const payroll = monthPayrolls.find(p => p.id === id);
                if (!payroll) return;

                const baseSalary = Number(payroll.base_salary);
                const amount = Math.round((baseSalary * pct / 100) * 100) / 100;

                let currentBreakdown = [];
                try {
                    currentBreakdown = typeof payroll.breakdown === 'string' 
                        ? JSON.parse(payroll.breakdown) 
                        : (payroll.breakdown || []);
                } catch (e) { currentBreakdown = []; }

                currentBreakdown = currentBreakdown.filter(item => item.action_type !== 'custom_bonus');

                currentBreakdown.push({
                    date: startDate,
                    rule_name: reason,
                    action_type: 'custom_bonus',
                    amount: amount,
                    percentage: pct,
                    is_deduction: false,
                });

                const ruleBonusesSum = currentBreakdown
                    .filter(item => !item.is_deduction && item.action_type !== 'paid_leave')
                    .reduce((sum, item) => sum + Number(item.amount), 0);

                const totalDeductions = currentBreakdown
                    .filter(item => item.is_deduction)
                    .reduce((sum, item) => sum + Number(item.amount), 0);

                let newNet = 0;
                if (payroll.run_type === 'weekly_advance') {
                    newNet = Number(payroll.advance_paid) + amount;
                } else {
                    newNet = Number(payroll.base_salary) + Number(payroll.housing) + Number(payroll.transport) + ruleBonusesSum - totalDeductions;
                }
                if (newNet < 0) newNet = 0;

                const { data, error } = await supabase
                    .from('payrolls')
                    .update({
                        breakdown: currentBreakdown,
                        overtime_amount: ruleBonusesSum,
                        net_salary: Math.round(newNet * 100) / 100,
                        extra_allowances: currentBreakdown.filter(item => !item.is_deduction)
                    })
                    .eq('id', id)
                    .select()
                    .single();

                if (error) throw error;
                return data;
            });

            const results = await Promise.all(updates);
            
            setMonthPayrolls(prev => prev.map(p => {
                const updated = results.find(r => r && r.id === p.id);
                return updated ? { ...p, ...updated } : p;
            }));

            toast.success(language === 'ar' ? `تم تطبيق المكافأة بنجاح لـ ${selectedRows.size} موظف` : `Bonus applied successfully to ${selectedRows.size} employees`);
            setSelectedRows(new Set());
            setBulkModalOpen(false);
            setBulkBonusReason('');
        } catch (err) {
            console.error('[Payroll] handleApplyBulkBonus error:', err);
            toast.error(language === 'ar' ? 'فشل تطبيق المكافأة الجماعية' : 'Failed to apply bulk bonus');
        } finally {
            setIsApplyingBulkBonus(false);
        }
    };

    const allSelected    = monthPayrolls.length > 0 && selectedRows.size === monthPayrolls.length;
    const someSelected   = selectedRows.size > 0 && !allSelected;

// -------------------------------------------------------------------------
    const kpiCards = [
        {
            label: t.statTotalNetLabel,
            value: formatCurrency(totalNet),
            icon: DollarSign,
            accent: '#6366f1',
            bg: 'rgba(99,102,241,0.08)',
            delta: '+2.4%',
            deltaUp: true,
            privacy: true,
        },
        {
            label: t.statTotalDeductionsLabel,
            value: formatCurrency(totalDeductions),
            icon: TrendingDown,
            accent: '#ef4444',
            bg: 'rgba(239,68,68,0.08)',
            delta: null,
            privacy: true,
        },
        {
            label: t.statTotalBaseLabel,
            value: formatCurrency(totalBase),
            icon: FileCheck,
            accent: '#3b82f6',
            bg: 'rgba(59,130,246,0.08)',
            delta: null,
            privacy: true,
        },
        {
            label: t.statHeadcountLabel,
            value: monthPayrolls.length,
            icon: Users,
            accent: '#10b981',
            bg: 'rgba(16,185,129,0.08)',
            delta: `${paidCount} paid`,
            deltaUp: true,
        },
    ];

    return (
        <div className="pr-page">


            <motion.div
                className="pr-header"
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="pr-header-left">
                    <div className="pr-title-wrap">
                        <div className="pr-title-icon">
                            <DollarSign size={22} />
                        </div>
                        <div>
                            <h1 className="pr-title">{t.payrollSettingsTitle}</h1>
                            <p className="pr-subtitle">{t.payrollPageSubtitle}</p>
                        </div>
                    </div>
                </div>
                <div className="pr-header-right">
                    {/* Date range */}
                    <div className="pr-date-group">
                        <Calendar size={14} className="pr-date-icon" />
                        <input
                            type="date"
                            className="pr-date-input"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                        />
                        <span className="pr-date-sep">→</span>
                        <input
                            type="date"
                            className="pr-date-input"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                        />
                    </div>

                    <button
                        className="pr-btn-ghost"
                        onClick={handleExportExcel}
                        disabled={monthPayrolls.length === 0}
                        title="Export to Excel"
                    >
                        <Download size={16} />
                        <span>{t.exportBtn}</span>
                    </button>

                    <button
                        className="pr-btn-primary"
                        onClick={handleCalculatePayroll}
                        disabled={calculating}
                    >
                        {calculating
                            ? <RefreshCcw size={16} className="pr-spin" />
                            : <Play size={16} />}
                        <span>{calculating ? t.calculatingBtn : t.runPayrollBtn}</span>
                    </button>
                </div>
            </motion.div>


            <motion.div
                className="pr-kpi-grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.08 }}
            >
                {kpiCards.map((card, i) => (
                    <motion.div
                        key={card.label}
                        className="pr-kpi-card"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.05 }}
                    >
                        <div className="pr-kpi-left">
                            <span className="pr-kpi-label">{card.label}</span>
                            <span className={`pr-kpi-value ${card.privacy ? 'privacy-blur' : ''}`}>{card.value}</span>
                            {card.delta && (
                                <span className={`pr-kpi-delta ${card.deltaUp ? 'up' : 'down'}`}>
                                    <ArrowUpRight size={11} />
                                    {card.delta}
                                </span>
                            )}
                        </div>
                        <div className="pr-kpi-icon" style={{ background: card.bg, color: card.accent }}>
                            <card.icon size={22} />
                        </div>
                    </motion.div>
                ))}
            </motion.div>


            <motion.div
                className="pr-grid-container"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
            >
                {/* Grid toolbar */}
                <div className="pr-grid-toolbar">
                    <h3 className="pr-grid-title">
                        <Users size={16} />
                        {t.payrollRosterTitle}
                        <span className="pr-grid-count">{monthPayrolls.length}</span>
                    </h3>
                </div>

                {/* Table wrapper — sticky headers */}
                <div className="pr-table-wrap">
                    <table className="pr-table">
                        <thead>
                            <tr>
                                <th className="pr-th pr-th-check">
                                    <button
                                        className="pr-checkbox"
                                        onClick={toggleAllRows}
                                        aria-label="Select all"
                                    >
                                        {allSelected
                                            ? <CheckSquare size={16} className="pr-check-icon active" />
                                            : someSelected
                                                ? <Minus size={16} className="pr-check-icon partial" />
                                                : <Square size={16} className="pr-check-icon" />}
                                    </button>
                                </th>
                                <th className="pr-th">{t.thNumber}</th>
                                <th className="pr-th">{t.thEmployeeName}</th>
                                <th className="pr-th pr-num">{t.thEarnedWage}</th>
                                <th className="pr-th pr-num">{t.thHousing}</th>
                                <th className="pr-th pr-num">{t.thTransport}</th>
                                <th className="pr-th pr-num">{t.thDeductions}</th>
                                <th className="pr-th pr-num pr-net-col">{t.thNetPay}</th>
                                <th className="pr-th">{t.thAttendance}</th>
                                <th className="pr-th">{t.thStatus}</th>
                                <th className="pr-th">النوع</th>
                                <th className="pr-th pr-th-actions"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr>
                                    <td colSpan={11} className="pr-td-empty">
                                        <div className="pr-loading">
                                            <RefreshCcw size={20} className="pr-spin" />
                                            <span>{t.loadingPayrollData}</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {!loading && monthPayrolls.length === 0 && (
                                <tr>
                                    <td colSpan={11} className="pr-td-empty">
                                        <div className="pr-empty-state">
                                            <DollarSign size={40} opacity={0.2} />
                                            <p>{t.noPayrollData}</p>
                                            <span>{t.runPayrollHint}</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {!loading && monthPayrolls.map((p, idx) => {
                                const status = statusMap[p.id] || 'draft';
                                const statusCfg = STATUSES[status];
                                const isSelected = selectedRows.has(p.id);

                                return (
                                    <tr
                                        key={p.id}
                                        className={`pr-tr ${isSelected ? 'selected' : ''}`}
                                        onClick={() => openDrawer(p.id)}
                                    >
                                        <td className="pr-td pr-td-check" onClick={e => { e.stopPropagation(); toggleRow(p.id); }}>
                                            <button className="pr-checkbox" aria-label="Select row">
                                                {isSelected
                                                    ? <CheckSquare size={16} className="pr-check-icon active" />
                                                    : <Square size={16} className="pr-check-icon" />}
                                            </button>
                                        </td>
                                        <td className="pr-td pr-td-num">{idx + 1}</td>
                                        <td className="pr-td">
                                            <div className="pr-employee-cell">
                                                <div className="pr-avatar" style={{ background: `hsl(${(idx * 47) % 360}, 65%, 55%)` }}>
                                                    {p.employee_name.charAt(0)}
                                                </div>
                                                <span className="pr-emp-name">{p.employee_name}</span>
                                            </div>
                                        </td>
                                        <td className="pr-td pr-td-num privacy-blur">{formatCurrency(Number(p.base_salary))}</td>
                                        <td className="pr-td pr-td-num positive privacy-blur">+{formatCurrency(Number(p.housing))}</td>
                                        <td className="pr-td pr-td-num positive privacy-blur">+{formatCurrency(Number(p.transport))}</td>
                                        <td className="pr-td pr-td-num negative privacy-blur">
                                            {Number(p.deductions) > 0 ? `-${formatCurrency(Number(p.deductions))}` : '—'}
                                        </td>
                                        <td className="pr-td pr-td-num pr-net-cell privacy-blur">
                                            {formatCurrency(Number(p.net_salary))}
                                            {p.run_type === 'weekly_advance' && Number(p.advance_paid) > 0 && (
                                                <div style={{ fontSize: '0.68rem', color: '#f59e0b', marginTop: 2 }}>
                                                    سلفة: {formatCurrency(Number(p.advance_paid))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="pr-td">
                                            <div className="pr-attendance-cell">
                                                <div
                                                    className="pr-att-bar-bg"
                                                    title={`${p.days_worked} / ${p.total_days} days`}
                                                >
                                                    <div
                                                        className="pr-att-bar-fill"
                                                        style={{ width: `${Math.round((p.days_worked / p.total_days) * 100)}%` }}
                                                    />
                                                </div>
                                                <span className="pr-att-label">{p.days_worked}/{p.total_days}</span>
                                            </div>
                                        </td>
                                        <td className="pr-td">
                                            <span className={`pr-status-badge pr-status-${statusCfg.color}`}>
                                                {statusCfg.icon} {statusCfg.label}
                                            </span>
                                        </td>
                                        <td className="pr-td">
                                            {(() => {
                                                const rt = RUN_TYPE_LABELS[p.run_type] || RUN_TYPE_LABELS.regular;
                                                return (
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 600,
                                                        color: rt.color,
                                                        background: rt.color + '18',
                                                        borderRadius: '6px',
                                                        padding: '3px 8px',
                                                        border: `1px solid ${rt.color}33`,
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {rt.icon} {language === 'ar' ? rt.ar : rt.en}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="pr-td pr-td-actions" onClick={e => e.stopPropagation()} ref={openMenuId === p.id ? menuRef : null}>
                                            <button
                                                className="pr-menu-btn"
                                                onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
                                                aria-label="Row actions"
                                            >
                                                <MoreVertical size={16} />
                                            </button>
                                            <AnimatePresence>
                                                {openMenuId === p.id && (
                                                    <motion.div
                                                        className="pr-dropdown"
                                                        initial={{ opacity: 0, scale: 0.92, y: -4 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.92, y: -4 }}
                                                        transition={{ duration: 0.15 }}
                                                    >
                                                        <button className="pr-dropdown-item" onClick={() => openDrawer(p.id)}>
                                                            <Eye size={14} /> {t.viewPayslip}
                                                        </button>
                                                        <button className="pr-dropdown-item" onClick={() => window.open(`/salary-slip/${p.id}`, '_blank')}>
                                                            <Printer size={14} /> {t.printSlip}
                                                        </button>
                                                        <div className="pr-dropdown-divider" />
                                                        <button className="pr-dropdown-item" onClick={() => setStatus(p.id, 'approved')}>
                                                            <CheckCircle size={14} /> {t.markApproved}
                                                        </button>
                                                        <button className="pr-dropdown-item success" onClick={() => setStatus(p.id, 'paid')}>
                                                            <DollarSign size={14} /> {t.markPaid}
                                                        </button>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </motion.div>


            <AnimatePresence>
                {selectedRows.size > 0 && (
                    <motion.div
                        className="pr-bulk-bar"
                        initial={{ opacity: 0, y: 80 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 80 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    >
                        <span className="pr-bulk-count">{selectedRows.size} {t.selectedCount}</span>
                        <div className="pr-bulk-actions">
                            <button className="pr-bulk-btn" onClick={bulkApprove}>
                                <CheckCircle size={15} /> {t.approveAll}
                            </button>
                            <button className="pr-bulk-btn success" onClick={async () => {
                                const selectedIds = Array.from(selectedRows);
                                try {
                                    const updates = selectedIds.map(async (id) => {
                                        const { error } = await supabase
                                            .from('payrolls')
                                            .update({ status: 'paid' })
                                            .eq('id', id);
                                        if (error) throw error;

                                        const payrollItem = monthPayrolls.find(p => p.id === id);
                                        if (payrollItem) {
                                            const title = language === 'ar' ? 'صرف الراتب' : 'Salary Paid';
                                            const message = language === 'ar'
                                                ? `تم صرف راتبك بقيمة ${formatCurrency(payrollItem.net_salary)} للفترة من ${payrollItem.start_date} إلى ${payrollItem.end_date}.`
                                                : `Your salary of ${formatCurrency(payrollItem.net_salary)} has been paid for the period ${payrollItem.start_date} to ${payrollItem.end_date}.`;

                                            await supabase.from('employee_notifications').insert([{
                                                employee_id: payrollItem.employee_id,
                                                title,
                                                message,
                                                type: 'success'
                                            }]);
                                        }
                                    });
                                    await Promise.all(updates);

                                    const statusUpdates = {};
                                    selectedIds.forEach(id => { statusUpdates[id] = 'paid'; });
                                    setStatusMap(prev => ({ ...prev, ...statusUpdates }));
                                    
                                    toast.success(t.payrollsMarkedPaid);
                                    setSelectedRows(new Set());
                                } catch (err) {
                                    console.error('[Payroll] bulkPaid error:', err);
                                    toast.error(language === 'ar' ? 'فشل تحديث حالة الرواتب المحددة' : 'Failed to mark selected payrolls as paid');
                                }
                            }}>
                                <DollarSign size={15} /> {t.markPaid}
                            </button>
                            <button className="pr-bulk-btn" style={{ borderColor: 'rgba(139, 92, 246, 0.3)' }} onClick={() => setBulkModalOpen(true)}>
                                <ArrowUpRight size={15} style={{ color: '#a78bfa' }} />
                                <span>{language === 'ar' ? 'مكافأة مئوية جماعية' : 'Bulk % Bonus'}</span>
                            </button>
                        </div>
                        <button className="pr-bulk-close" onClick={() => setSelectedRows(new Set())}>
                            <X size={16} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>


            <AnimatePresence>
                {drawerOpen && activeSlip && (
                    <>
                        <motion.div
                            className="pr-drawer-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setDrawerOpen(false)}
                        />
                        <motion.div
                            className="pr-drawer"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
                        >
                            <div className="pr-drawer-accent" />
                            <div className="pr-drawer-header">
                                <div>
                                    <h3 className="pr-drawer-title">{t.salaryDetailsTitle}</h3>
                                    <p className="pr-drawer-sub" dir="ltr">{startDate} → {endDate}</p>
                                </div>
                                <button className="pr-drawer-close" onClick={() => setDrawerOpen(false)}>
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="pr-drawer-body">
                                {(() => {
                                    // Pre-parse breakdown for use in sections
                                    let breakdownItems = [];
                                    try {
                                        breakdownItems = typeof activeSlip.breakdown === 'string' ? JSON.parse(activeSlip.breakdown) : (activeSlip.breakdown || []);
                                    } catch (e) { breakdownItems = []; }
                                    if (!Array.isArray(breakdownItems)) breakdownItems = [];

                                    const earnings = breakdownItems.filter(i => !i.is_deduction);
                                    const deductions = breakdownItems.filter(i => i.is_deduction);

                                    return (
                                        <>
                                            {/* Employee info */}
                                            <div className="pr-slip-hero">
                                                <div className="pr-slip-avatar">
                                                    {activeSlip.employee_name.charAt(0)}
                                                </div>
                                                <div>
                                                    <h2 className="pr-slip-name">{activeSlip.employee_name}</h2>
                                                    <span className="pr-slip-id">{t.empIdLabel} {activeSlip.id.split('-')[0].toUpperCase()}</span>
                                                </div>
                                                <div className="pr-slip-net-block">
                                                    <span className="pr-slip-net-label">{t.netSalaryEarned}</span>
                                                    <span className="pr-slip-net privacy-blur" dir="ltr">{formatCurrency(Number(activeSlip.net_salary))}</span>
                                                </div>
                                            </div>

                                            {/* Earnings Section */}
                                            <div className="pr-slip-section">
                                                <div className="pr-slip-section-header">
                                                    <h4 className="pr-slip-section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <ArrowUpRight size={14} color="#10b981" /> {t.earningsTitle}
                                                    </h4>
                                                </div>
                                                <div className="pr-slip-row"><span>{t.baseSalaryLabel}</span><span className="privacy-blur" dir="ltr">{formatCurrency(Number(activeSlip.base_salary))}</span></div>
                                                {activeSlip.housing > 0 && <div className="pr-slip-row positive"><span>{t.housingAllowLabel}</span><span className="privacy-blur" dir="ltr">+{formatCurrency(Number(activeSlip.housing))}</span></div>}
                                                {activeSlip.transport > 0 && <div className="pr-slip-row positive"><span>{t.transportAllowLabel}</span><span className="privacy-blur" dir="ltr">+{formatCurrency(Number(activeSlip.transport))}</span></div>}
                                                
                                                {earnings.map((item, idx) => {
                                                    const isCustom = item.action_type === 'custom_bonus';
                                                    const status = statusMap[activeSlip.id] || 'draft';
                                                    const isDraft = status === 'draft';
                                                    return (
                                                        <div key={`add-${idx}`} className="pr-slip-row positive" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                {isCustom && <span style={{ fontSize: '0.9rem' }}>✨</span>}
                                                                <span>{item.reason} {item.percentage ? `(${item.percentage}%)` : ''}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span className="privacy-blur" dir="ltr">+{formatCurrency(Number(item.amount))}</span>
                                                                {isCustom && isDraft && (
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); handleRemoveBonus(activeSlip); }} 
                                                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                                                                        title={language === 'ar' ? 'حذف المكافأة' : 'Remove Bonus'}
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Performance Bonus Panel */}
                                            {(() => {
                                                const status = statusMap[activeSlip.id] || 'draft';
                                                const isDraft = status === 'draft';
                                                const hasCustomBonus = earnings.some(i => i.action_type === 'custom_bonus');
                                                if (!isDraft || hasCustomBonus) return null;

                                                return (
                                                    <div className="pr-bonus-card">
                                                        <div className="pr-bonus-title">
                                                            <span>✨</span> {language === 'ar' ? 'إضافة مكافأة تميز مئوية' : 'Add Performance Bonus'}
                                                        </div>
                                                        <div className="pr-bonus-presets">
                                                            {[5, 10, 15, 25].map(pct => (
                                                                <button
                                                                    key={pct}
                                                                    type="button"
                                                                    className={`pr-bonus-pill ${bonusPercentage === pct && !customPercentActive ? 'active' : ''}`}
                                                                    onClick={() => {
                                                                        setBonusPercentage(pct);
                                                                        setCustomPercentActive(false);
                                                                    }}
                                                                >
                                                                    {pct}%
                                                                </button>
                                                            ))}
                                                            <button
                                                                type="button"
                                                                className={`pr-bonus-pill ${customPercentActive ? 'active' : ''}`}
                                                                onClick={() => {
                                                                    setCustomPercentActive(true);
                                                                }}
                                                            >
                                                                {language === 'ar' ? 'مخصصة' : 'Custom'}
                                                            </button>
                                                        </div>

                                                        {customPercentActive && (
                                                            <div className="pr-bonus-input-wrapper">
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    max="100"
                                                                    className="pr-bonus-input"
                                                                    placeholder={language === 'ar' ? 'النسبة %' : 'Percentage %'}
                                                                    value={bonusPercentage}
                                                                    onChange={e => setBonusPercentage(Math.min(100, Math.max(1, Number(e.target.value))))}
                                                                />
                                                                <span className="pr-bonus-input-symbol">%</span>
                                                            </div>
                                                        )}

                                                        <div className="pr-bonus-calc-preview">
                                                            <span>{language === 'ar' ? 'مبلغ المكافأة المتوقع:' : 'Expected Bonus Amount:'}</span>
                                                            <strong className="privacy-blur">
                                                                +{formatCurrency(Math.round((Number(activeSlip.base_salary) * bonusPercentage / 100) * 100) / 100)}
                                                            </strong>
                                                        </div>

                                                        <input
                                                            type="text"
                                                            className="pr-bonus-reason-input"
                                                            placeholder={language === 'ar' ? 'سبب المكافأة (مثال: أداء ممتاز)...' : 'Reason for bonus (e.g. Excellent performance)...'}
                                                            value={bonusReason}
                                                            onChange={e => setBonusReason(e.target.value)}
                                                        />

                                                        <button
                                                            type="button"
                                                            className="pr-bonus-apply-btn"
                                                            disabled={isApplyingBonus}
                                                            onClick={() => handleApplyBonus(activeSlip, bonusPercentage, bonusReason)}
                                                        >
                                                            {isApplyingBonus 
                                                                ? (language === 'ar' ? 'جاري التطبيق...' : 'Applying...') 
                                                                : (language === 'ar' ? 'تطبيق المكافأة' : 'Apply Bonus')}
                                                        </button>
                                                    </div>
                                                );
                                            })()}

                                            {/* Deductions Section */}
                                            <div className="pr-slip-section">
                                                <div className="pr-slip-section-header">
                                                    <h4 className="pr-slip-section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <TrendingDown size={14} color="#ef4444" /> {t.deductionsTitle}
                                                    </h4>
                                                </div>
                                                {deductions.length === 0 && Number(activeSlip.deductions) > 0 ? (
                                                    <div className="pr-slip-row negative"><span>{t.totalDeductionsCombined}</span><span className="privacy-blur" dir="ltr">-{formatCurrency(Number(activeSlip.deductions))}</span></div>
                                                ) : (
                                                    deductions.map((item, idx) => (
                                                        <div key={`ded-${idx}`} className="pr-slip-row negative">
                                                            <span>{item.reason}</span>
                                                            <span className="privacy-blur" dir="ltr">-{formatCurrency(Number(item.amount))}</span>
                                                        </div>
                                                    ))
                                                )}

                                                {Number(activeSlip.deductions) > 0 && (
                                                    <div className="pr-slip-row total-deduct" style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', marginTop: '4px' }}>
                                                        <span style={{ opacity: 0.7 }}>{t.totalDeductions}</span>
                                                        <span className="privacy-blur" dir="ltr">-{formatCurrency(Number(activeSlip.deductions))}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="pr-slip-section">
                                                <div className="pr-slip-section-header">
                                                    <h4 className="pr-slip-section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Calendar size={14} color="#3b82f6" /> {t.attSummaryTitle}
                                                    </h4>
                                                </div>
                                                <div className="pr-slip-row"><span>{t.actualWorkDays}</span><span dir="ltr">{activeSlip.days_worked} / {activeSlip.total_days} {t.daysWord}</span></div>
                                                <div className="pr-slip-row"><span>{t.totalHoursLabel}</span><span dir="ltr">{activeSlip.total_work_hours} {t.hoursWord}</span></div>
                                            </div>

                                            {/* Progress bar towards net salary goal */}
                                            <div className="pr-slip-summary-footer">
                                                <div className="pr-slip-bar-wrap">
                                                    <div
                                                        className="pr-slip-bar-fill"
                                                        style={{ width: `${Math.min(100, Math.round(((Number(activeSlip.net_salary)) / (Number(activeSlip.base_salary) || 1)) * 100))}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>

                            <div className="pr-drawer-footer">
                                <a
                                    href={`/salary-slip/${activeSlip.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="pr-btn-primary pr-drawer-print"
                                    style={{ gap: '8px' }}
                                >
                                    <Printer size={15} />
                                    <span>{t.printPdfBtn}</span>
                                </a>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Bulk Bonus Modal */}
            <AnimatePresence>
                {bulkModalOpen && (
                    <>
                        <div className="pr-modal-overlay" onClick={() => setBulkModalOpen(false)} />
                        <motion.div
                            className="pr-modal"
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <div className="pr-modal-header">
                                <h3 className="pr-modal-title">
                                    🎉 {language === 'ar' ? `إضافة مكافأة جماعية مئوية (${selectedRows.size} موظف)` : `Add Bulk % Bonus (${selectedRows.size} employees)`}
                                </h3>
                                <button className="pr-modal-close" onClick={() => setBulkModalOpen(false)}>
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="pr-modal-body">
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.2rem' }}>
                                    {language === 'ar' 
                                        ? 'سيتم احتساب المكافأة كنسبة مئوية من الراتب الأساسي المستحق لكل موظف وتضاف تلقائياً للصافي.'
                                        : 'The bonus will be calculated as a percentage of each employee\'s basic salary and added to their net pay.'}
                                </p>
                                
                                <div className="pr-bonus-presets" style={{ marginBottom: '1rem' }}>
                                    {[5, 10, 15, 25].map(pct => (
                                        <button
                                            key={pct}
                                            type="button"
                                            className={`pr-bonus-pill ${bulkBonusPercentage === pct && !bulkCustomPercentActive ? 'active' : ''}`}
                                            onClick={() => {
                                                setBulkBonusPercentage(pct);
                                                setBulkCustomPercentActive(false);
                                            }}
                                        >
                                            {pct}%
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        className={`pr-bonus-pill ${bulkCustomPercentActive ? 'active' : ''}`}
                                        onClick={() => {
                                            setBulkCustomPercentActive(true);
                                        }}
                                    >
                                        {language === 'ar' ? 'مخصصة' : 'Custom'}
                                    </button>
                                </div>

                                {bulkCustomPercentActive && (
                                    <div className="pr-bonus-input-wrapper" style={{ marginBottom: '1rem' }}>
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            className="pr-bonus-input"
                                            placeholder={language === 'ar' ? 'النسبة %' : 'Percentage %'}
                                            value={bulkBonusPercentage}
                                            onChange={e => setBulkBonusPercentage(Math.min(100, Math.max(1, Number(e.target.value))))}
                                        />
                                        <span className="pr-bonus-input-symbol">%</span>
                                    </div>
                                )}

                                <input
                                    type="text"
                                    className="pr-bonus-reason-input"
                                    style={{ marginBottom: '1.2rem' }}
                                    placeholder={language === 'ar' ? 'سبب المكافأة (مثال: مكافأة رمضان، أداء ممتاز)...' : 'Reason for bonus...'}
                                    value={bulkBonusReason}
                                    onChange={e => setBulkBonusReason(e.target.value)}
                                />
                            </div>
                            <div className="pr-modal-footer">
                                <button 
                                    className="pr-btn-ghost" 
                                    onClick={() => setBulkModalOpen(false)}
                                    disabled={isApplyingBulkBonus}
                                >
                                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                                </button>
                                <button 
                                    className="pr-btn-primary" 
                                    onClick={handleApplyBulkBonus}
                                    disabled={isApplyingBulkBonus}
                                >
                                    {isApplyingBulkBonus 
                                        ? (language === 'ar' ? 'جاري التطبيق...' : 'Applying...') 
                                        : (language === 'ar' ? 'تطبيق المكافأة' : 'Apply')}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}

export default Payroll;