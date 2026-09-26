import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';
import SalarySlipCard from '../components/SalarySlipCard';
import './SalarySlip.css';

function BulkSalarySlip() {
    const [searchParams] = useSearchParams();
    const { company } = useAuth();
    const { currencySymbol, formatCurrency, language } = useLocale();

    const [payrolls, setPayrolls] = useState([]);
    const [loansMap, setLoansMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [companyName, setCompanyName] = useState('');

    const isRtl = language === 'ar';
    const idsParam = searchParams.get('ids') || '';

    const fetchData = useCallback(async () => {
        if (!company || !idsParam) {
            setLoading(false);
            return;
        }

        const idsArray = idsParam.split(',').map(id => id.trim()).filter(Boolean);
        if (idsArray.length === 0) {
            setLoading(false);
            return;
        }

        try {
            // Fetch all requested payrolls
            const { data, error } = await supabase
                .from('payrolls')
                .select(`
                    id, employee_id, start_date, end_date, base_salary, net_salary,
                    housing, transport, deductions, overtime_hours,
                    overtime_amount, advance_paid, breakdown, status, run_type, created_at,
                    days_worked, total_days, total_work_hours,
                    employees(id, name, position, base_salary, department_id, departments(name))
                `)
                .in('id', idsArray);

            if (error) throw error;
            setPayrolls(data || []);

            // Collect unique employee IDs
            const empIds = Array.from(new Set((data || []).map(p => p.employee_id).filter(Boolean)));
            if (empIds.length > 0) {
                const { data: loans } = await supabase
                    .from('employee_loans')
                    .select('id, employee_id, amount, remaining_amount, status, created_at, notes')
                    .in('employee_id', empIds)
                    .eq('company_id', company.id)
                    .in('status', ['active', 'paid'])
                    .order('created_at', { ascending: false });

                const map = {};
                (loans || []).forEach(l => {
                    if (!map[l.employee_id]) map[l.employee_id] = [];
                    map[l.employee_id].push(l);
                });
                setLoansMap(map);
            }

            setCompanyName(company.name || 'Kwader');
        } catch (err) {
            console.error('[BulkSalarySlip]', err.message);
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    }, [idsParam, company]);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (loading) {
        return (
            <div className="ss-loading">
                <div className="ss-spinner"></div>
                <p>{isRtl ? 'جارٍ تحميل القسائم...' : 'Loading salary slips...'}</p>
            </div>
        );
    }

    if (payrolls.length === 0) {
        return (
            <div className="ss-loading">
                <p style={{ color: '#e53e3e' }}>⚠️ {isRtl ? 'لم يتم العثور على قسائم مطابقة' : 'No matching salary slips found'}</p>
                <button className="ss-print-btn" onClick={() => window.close()}>
                    {isRtl ? 'إغلاق' : 'Close'}
                </button>
            </div>
        );
    }

    return (
        <div className="ss-page" dir={isRtl ? 'rtl' : 'ltr'}>
            {/* ── شريط الطباعة الجماعية ── */}
            <div className="ss-toolbar no-print">
                <div className="ss-toolbar-title">
                    <span className="ss-logo">⚡ Kwader</span>
                    <span className="ss-sep">/</span>
                    <span>
                        {isRtl
                            ? `طباعة جماعية (${payrolls.length} قسيمة)`
                            : `Bulk Print (${payrolls.length} Slips)`}
                    </span>
                </div>
                <button className="ss-print-btn" onClick={() => window.print()}>
                    🖨️ {isRtl ? `طباعة الكل (${payrolls.length}) / PDF` : `Print All (${payrolls.length}) / PDF`}
                </button>
            </div>

            {/* ════════ قائمة القسائم ════════ */}
            <div className="ss-bulk-container">
                {payrolls.map((payroll) => (
                    <div key={payroll.id} className="ss-bulk-item">
                        <SalarySlipCard
                            payrollData={payroll}
                            employeeLoans={loansMap[payroll.employee_id] || []}
                            companyName={companyName}
                            company={company}
                            isRtl={isRtl}
                            currencySymbol={currencySymbol}
                            formatCurrency={formatCurrency}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default BulkSalarySlip;
