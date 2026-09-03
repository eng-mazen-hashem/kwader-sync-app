import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';
import './SalarySlip.css';

function SalarySlip() {
    const { id: payrollId } = useParams();
    // navigate removed — unused (no navigation needed in salary slip view)
    const { company } = useAuth();
    const { t, currencySymbol, formatCurrency, language } = useLocale();

    const [payrollData, setPayrollData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchPayroll() {
            if (!company || !payrollId) return;

            try {
                const { data, error } = await supabase
                    .from('payrolls')
                    .select(`
                        id, employee_id, start_date, end_date, base_salary, net_salary,
                        housing, transport, allowances, deductions, overtime_hours,
                        breakdown, status, created_at,
                        employees(id, name, phone, department_id, position)
                    `)
                    .eq('id', payrollId)
                    .single();

                if (error) throw error;
                if (!data) {
                    toast.error(t.noPayrollData || 'No data found');
                    return;
                }
                setPayrollData(data);
            } catch (err) {
                console.error('[SalarySlip] Fetch error:', err.message);
                toast.error(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchPayroll();
    }, [payrollId, company, t]);

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-muted)' }}>{t.loading || 'Loading...'}</div>;
    }

    if (!payrollData) {
        return (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                <h2>No data</h2>
                <button className="btn btn-secondary" onClick={() => window.close()}>Close Tab</button>
            </div>
        );
    }

    const { employees, start_date, end_date } = payrollData;
    const isRtl = language === 'ar';

    // Parse breakdown correctly whether it's a string or array
    let breakdownDetails = [];
    try {
        if (payrollData.breakdown) {
            breakdownDetails = typeof payrollData.breakdown === 'string' ? JSON.parse(payrollData.breakdown) : payrollData.breakdown;
        }
    } catch(e) { console.error('Error parsing breakdown', e); }

    const additionDetails = breakdownDetails.filter(b => !b.is_deduction);
    const deductionDetails = breakdownDetails.filter(b => b.is_deduction);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="salary-slip-page" dir={isRtl ? 'rtl' : 'ltr'}>
            
            {/* Header / Top Navigation (if wanted inside the printable page) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                    Kwader Finance <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>/</span> 
                    <span style={{ color: 'var(--color-primary)' }}>{new Date(start_date).toLocaleDateString(language, { month: 'long', year: 'numeric' })}</span>
                </h1>
            </div>

            {/* Employee Header Card */}
            <section className="slip-header-card">
                <div className="slip-header-glow"></div>
                <div className="slip-employee-info">
                    <div className="slip-avatar-placeholder">
                        {employees?.name?.charAt(0) || 'E'}
                    </div>
                    <div>
                        <h2 className="slip-employee-title">{employees?.name || 'Unknown Employee'}</h2>
                        <div className="slip-meta-tags">
                            <div className="slip-meta-tag">
                                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>badge</span>
                                ID: {employees?.id?.slice(0, 8).toUpperCase() || 'N/A'}
                            </div>
                            <div className="slip-meta-tag">
                                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>account_tree</span>
                                {employees?.department || 'General'}
                            </div>
                            <div className="slip-meta-tag">
                                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>calendar_month</span>
                                {start_date} - {end_date}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="slip-actions">
                    <span className="slip-status-paid">Status: Paid</span>
                    <button onClick={handlePrint} className="btn" style={{ background: 'var(--color-primary)', color: 'white', marginTop: '0.5rem', boxShadow: '0 10px 20px rgba(159,167,255,0.2)' }}>
                        <span className="material-symbols-outlined">download</span>
                        Export PDF
                    </button>
                </div>
            </section>

            {/* Bento Grid: Earnings & Deductions */}
            <div className="slip-bento-grid">
                {/* Earnings */}
                <div className="slip-card">
                    <div className="slip-card-header">
                        <h3 className="slip-card-title earnings">
                            <span className="material-symbols-outlined">add_circle</span>
                            Earnings
                        </h3>
                        <span className="slip-card-badge">Credits</span>
                    </div>
                    <div className="slip-card-content">
                        <div className="slip-line-item">
                            <div>
                                <p className="slip-item-name">Basic Salary</p>
                                <p className="slip-item-desc">Core monthly compensation</p>
                            </div>
                            <span className="slip-item-value privacy-blur">{formatCurrency(payrollData.base_salary)} <span className="slip-currency">{currencySymbol}</span></span>
                        </div>
                        
                        {Number(payrollData.housing) > 0 && (
                            <div className="slip-line-item">
                                <div>
                                    <p className="slip-item-name">Housing Allowance</p>
                                    <p className="slip-item-desc">Fixed residential support</p>
                                </div>
                                <span className="slip-item-value privacy-blur">{formatCurrency(payrollData.housing)} <span className="slip-currency">{currencySymbol}</span></span>
                            </div>
                        )}

                        {Number(payrollData.transport) > 0 && (
                            <div className="slip-line-item">
                                <div>
                                    <p className="slip-item-name">Transport Allowance</p>
                                    <p className="slip-item-desc">Commuter monthly benefit</p>
                                </div>
                                <span className="slip-item-value privacy-blur">{formatCurrency(payrollData.transport)} <span className="slip-currency">{currencySymbol}</span></span>
                            </div>
                        )}

                        {additionDetails.map((add, idx) => (
                            <div className="slip-line-item" key={`add-${idx}`}>
                                <div>
                                    <p className="slip-item-name">{add.rule_name || 'Bonus Additions'}</p>
                                    <p className="slip-item-desc">{add.date || 'Rule adjustment'}</p>
                                </div>
                                <span className="slip-item-value privacy-blur">{formatCurrency(add.amount)} <span className="slip-currency">{currencySymbol}</span></span>
                            </div>
                        ))}

                        <div className="slip-card-total">
                            <span className="slip-total-label">Total Earnings</span>
                            <span className="slip-total-value privacy-blur">
                                {formatCurrency(Number(payrollData.base_salary) + Number(payrollData.housing || 0) + Number(payrollData.transport || 0) + Number(payrollData.allowances || 0))} <span className="slip-currency">{currencySymbol}</span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Deductions */}
                <div className="slip-card">
                    <div className="slip-card-header">
                        <h3 className="slip-card-title deductions">
                            <span className="material-symbols-outlined">remove_circle</span>
                            Deductions
                        </h3>
                        <span className="slip-card-badge">Debits</span>
                    </div>
                    <div className="slip-card-content">

                        {/* Regular deductions (non-weekly-advance type) */}
                        {deductionDetails.filter(d => d.action_type !== 'deduct_weekly_advance').length > 0 ? (
                            deductionDetails
                                .filter(d => d.action_type !== 'deduct_weekly_advance')
                                .map((ded, idx) => (
                                <div className="slip-line-item" key={`ded-${idx}`}>
                                    <div>
                                        <p className="slip-item-name">{ded.rule_name || 'Rule Penalty'}</p>
                                        <p className="slip-item-desc">Date: {ded.date || 'N/A'}</p>
                                    </div>
                                    <span className="slip-item-value deduct privacy-blur">({formatCurrency(ded.amount)}) <span className="slip-currency">{currencySymbol}</span></span>
                                </div>
                            ))
                        ) : (
                            <div className="slip-line-item">
                                <div>
                                    <p className="slip-item-name">All Clear</p>
                                    <p className="slip-item-desc">No deductions applied this period</p>
                                </div>
                                <span className="slip-item-value deduct privacy-blur">0 <span className="slip-currency">{currencySymbol}</span></span>
                            </div>
                        )}

                        <div className="slip-card-total" style={{ marginTop: 'auto' }}>
                            <span className="slip-total-label">Total Deductions</span>
                            <span className="slip-total-value privacy-blur">
                                {formatCurrency(payrollData.deductions)} <span className="slip-currency" style={{fontWeight:'normal'}}>{currencySymbol}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── قسم السلف الأسبوعية (يظهر فقط في المسيرة الشهرية النهائية) ── */}
            {payrollData.run_type === 'monthly_final' && (() => {
                const weeklyAdvances = deductionDetails.filter(d => d.action_type === 'deduct_weekly_advance');
                if (weeklyAdvances.length === 0) return null;
                const totalAdvances = weeklyAdvances.reduce((sum, d) => sum + Number(d.amount), 0);

                return (
                    <div style={{
                        margin: '1.5rem 0',
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.07) 0%, rgba(245,158,11,0.03) 100%)',
                        border: '1px solid rgba(245,158,11,0.25)',
                        borderRadius: '16px',
                        overflow: 'hidden',
                    }}>
                        {/* Header */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            padding: '1rem 1.25rem 0.75rem',
                            borderBottom: '1px solid rgba(245,158,11,0.15)',
                        }}>
                            <span style={{ fontSize: '1.1rem' }}>💸</span>
                            <div>
                                <p style={{ margin: 0, fontWeight: 700, color: '#f59e0b', fontSize: '0.9rem' }}>
                                    {isRtl ? 'السلف الأسبوعية المدفوعة مسبقاً' : 'Previously Paid Weekly Advances'}
                                </p>
                                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {isRtl
                                        ? `تم خصم هذه السلف من الراتب الشهري النهائي — إجمالي ${weeklyAdvances.length} سلفة`
                                        : `These advances are deducted from the final monthly salary — ${weeklyAdvances.length} advance(s)`}
                                </p>
                            </div>
                        </div>

                        {/* Each weekly advance row */}
                        <div style={{ padding: '0.5rem 1.25rem' }}>
                            {weeklyAdvances.map((wa, idx) => (
                                <div key={`wa-${idx}`} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.65rem 0',
                                    borderBottom: idx < weeklyAdvances.length - 1 ? '1px dashed rgba(245,158,11,0.15)' : 'none',
                                }}>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                                            {isRtl ? `سلفة الأسبوع ${idx + 1}` : `Week ${idx + 1} Advance`}
                                        </p>
                                        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', direction: 'ltr', marginTop: '2px' }}>
                                            📅 {wa.date}
                                        </p>
                                    </div>
                                    <span style={{
                                        fontWeight: 700,
                                        color: '#f59e0b',
                                        fontSize: '0.9rem',
                                        direction: 'ltr',
                                    }} className="privacy-blur">
                                        - {formatCurrency(wa.amount)} {currencySymbol}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Total advances deducted */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.85rem 1.25rem',
                            background: 'rgba(245,158,11,0.08)',
                            borderTop: '1px solid rgba(245,158,11,0.2)',
                        }}>
                            <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: '0.85rem' }}>
                                {isRtl ? 'إجمالي السلف المخصومة' : 'Total Advances Deducted'}
                            </span>
                            <span style={{ fontWeight: 800, color: '#ef4444', fontSize: '1rem', direction: 'ltr' }} className="privacy-blur">
                                - {formatCurrency(totalAdvances)} {currencySymbol}
                            </span>
                        </div>
                    </div>
                );
            })()}



            {/* Net Footer */}
            <div className="slip-net-footer">
                <div className="slip-net-footer-glow"></div>
                <div className="slip-net-content">
                    <div>
                        <p className="slip-net-label">Net Payable Amount</p>
                        <h4 className="slip-net-amount privacy-blur">
                            {formatCurrency(payrollData.net_salary)} <span className="slip-net-currency">{currencySymbol}</span>
                        </h4>
                    </div>

                    <div className="slip-net-divider"></div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="slip-bank-details">
                            <div className="slip-bank-icon">
                                <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>account_balance</span>
                            </div>
                            <div>
                                <p className="slip-bank-label">Bank Transfer</p>
                                <p className="slip-bank-acc">**** **** **** 1234</p>
                            </div>
                        </div>
                        <div className="slip-encryption">
                            <span className="material-symbols-outlined" style={{ color: 'var(--accent-secondary)' }}>verified_user</span>
                            <span className="slip-encryption-text">Encrypted & Verified by Kwader Protocol</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Compliance Footer */}
            <div className="slip-footer-compliance">
                <p>© {new Date().getFullYear()} Kwader. All Rights Reserved.</p>
            <div className="slip-footer-links">
                    {/* constitution §a11y: use <button> not invalid <a href="#"> */}
                    <button
                        className="slip-footer-link-btn"
                        onClick={() => window.open('/privacy', '_blank')}
                    >Privacy Policy</button>
                    <button
                        className="slip-footer-link-btn"
                        onClick={() => window.open('/support', '_blank')}
                    >Support Center</button>
                </div>
            </div>

        </div>
    );
}

export default SalarySlip;
