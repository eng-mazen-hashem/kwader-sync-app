import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';
import SalarySlipCard from '../components/SalarySlipCard';
import './SalarySlip.css';

function SalarySlip() {
    const { id: payrollId } = useParams();
    const { company } = useAuth();
    const { currencySymbol, formatCurrency, language } = useLocale();

    const [payrollData, setPayrollData] = useState(null);
    const [employeeLoans, setEmployeeLoans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [companyName, setCompanyName] = useState('');
    const [publicCompany, setPublicCompany] = useState(null);

    const isRtl = language === 'ar';

    const fetchData = useCallback(async () => {
        if (!payrollId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            // 1. Primary path: Call secure public RPC function (works without login for QR verification)
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_public_salary_slip', { p_id: payrollId });

            if (!rpcError && rpcData && rpcData.payroll) {
                const p = rpcData.payroll;
                p.employees = rpcData.employee;
                setPayrollData(p);
                setEmployeeLoans(rpcData.loans || []);
                setCompanyName(rpcData.company?.name || company?.name || 'Kwader');
                setPublicCompany(rpcData.company || null);
                setLoading(false);
                return;
            }

            // 2. Fallback: Standard authenticated Supabase query
            let { data, error } = await supabase
                .from('payrolls')
                .select(`
                    id, employee_id, start_date, end_date, base_salary, net_salary,
                    housing, transport, deductions, overtime_hours,
                    overtime_amount, advance_paid, breakdown, status, run_type, created_at,
                    days_worked, total_days, total_work_hours,
                    employees(id, name, position, base_salary, department_id, departments(name))
                `)
                .eq('id', payrollId)
                .maybeSingle();

            // Fallback: If not found by payroll id, check if the ID passed was an employee_id
            if (!data) {
                const { data: empPayroll } = await supabase
                    .from('payrolls')
                    .select(`
                        id, employee_id, start_date, end_date, base_salary, net_salary,
                        housing, transport, deductions, overtime_hours,
                        overtime_amount, advance_paid, breakdown, status, run_type, created_at,
                        days_worked, total_days, total_work_hours,
                        employees(id, name, position, base_salary, department_id, departments(name))
                    `)
                    .eq('employee_id', payrollId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                if (empPayroll) {
                    data = empPayroll;
                }
            }

            if (!data) {
                setPayrollData(null);
                setLoading(false);
                return;
            }

            setPayrollData(data);

            // سلف الموظف النشطة
            const { data: loans } = await supabase
                .from('employee_loans')
                .select('id, amount, remaining_amount, status, created_at, notes')
                .eq('employee_id', data.employee_id)
                .in('status', ['active', 'paid'])
                .order('created_at', { ascending: false });
            setEmployeeLoans(loans || []);

            setCompanyName(company?.name || 'Kwader');
        } catch (err) {
            console.error('[SalarySlip]', err.message);
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    }, [payrollId, company]);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (loading) {
        return (
            <div className="ss-loading">
                <div className="ss-spinner"></div>
                <p>{isRtl ? 'جارٍ التحميل...' : 'Loading...'}</p>
            </div>
        );
    }

    if (!payrollData) {
        return (
            <div className="ss-loading" style={{ textAlign: 'center', padding: '40px 20px' }}>
                <p style={{ color: '#ef4444', fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>
                    ⚠️ {isRtl ? 'لم يتم العثور على قسيمة الراتب' : 'Salary slip not found'}
                </p>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px' }}>
                    {isRtl ? 'تأكد من تشغيل مسير الرواتب أولاً للفترة المطلوبة، أو فتح القسيمة مباشرة من شاشة مسيرات الرواتب.' : 'Please ensure payroll has been generated or open it directly from the Payroll page.'}
                </p>
                <button className="ss-print-btn" onClick={() => window.close()}>
                    {isRtl ? 'إغلاق الصفحة' : 'Close'}
                </button>
            </div>
        );
    }

    return (
        <div className="ss-page" dir={isRtl ? 'rtl' : 'ltr'}>
            {/* ── شريط الطباعة — يختفي عند الطباعة ── */}
            <div className="ss-toolbar no-print">
                <div className="ss-toolbar-title">
                    <span className="ss-logo">⚡ Kwader</span>
                    <span className="ss-sep">/</span>
                    <span>{isRtl ? 'قسيمة الراتب' : 'Salary Slip'}</span>
                </div>
                <button className="ss-print-btn" onClick={() => window.print()}>
                    🖨️ {isRtl ? 'طباعة / PDF' : 'Print / PDF'}
                </button>
            </div>

            {/* ════════ القسيمة ════════ */}
            <SalarySlipCard
                payrollData={payrollData}
                employeeLoans={employeeLoans}
                companyName={companyName}
                company={publicCompany || company}
                isRtl={isRtl}
                currencySymbol={currencySymbol}
                formatCurrency={formatCurrency}
            />
        </div>
    );
}

export default SalarySlip;
