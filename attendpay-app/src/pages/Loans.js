import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';
import { logAudit } from '../utils/auditLogger';
import { 
  HiCash, HiUser, HiPlus, HiSearch, HiTrendingUp, 
  HiCheck, HiX, HiChevronRight, HiChevronLeft, HiChevronDown,
  HiClipboardList, HiExclamation
} from 'react-icons/hi';
import { motion, AnimatePresence } from 'framer-motion';
import './Loans.css';

const PAGE_SIZE = 12;

export default function Loans() {
  const { company } = useAuth();
  const { t, language, formatCurrency } = useLocale();
  const [loans, setLoans] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // History modal state
  const [historyLoan, setHistoryLoan] = useState(null);
  const [historyPayments, setHistoryPayments] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Settle confirm state
  const [settlingLoanId, setSettlingLoanId] = useState(null);

  // Tabs state for loan requests workflow
  const [activeTab, setActiveTab] = useState('active'); // 'active', 'pending', 'rejected'
  const [counts, setCounts] = useState({ active: 0, pending: 0, rejected: 0 });

  const fetchData = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const { data: emps } = await supabase
        .from('employees')
        .select('id, name')
        .eq('company_id', company.id)
        .eq('status', 'active');
      setEmployees(emps || []);

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('employee_loans')
        .select('*, employee:employees!inner(name)', { count: 'exact' })
        .eq('company_id', company.id);

      if (activeTab === 'active') {
        query = query.in('status', ['active', 'paid']);
      } else {
        query = query.eq('status', activeTab);
      }

      if (search) {
        query = query.ilike('employee.name', `%${search}%`);
      }

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setLoans(data || []);
      setTotalCount(count || 0);

      // Fetch counts for tabs
      const { data: countData } = await supabase
        .from('employee_loans')
        .select('status')
        .eq('company_id', company.id);

      const tally = { active: 0, pending: 0, rejected: 0 };
      (countData || []).forEach(l => {
        if (l.status === 'active' || l.status === 'paid') tally.active++;
        else if (l.status === 'pending') tally.pending++;
        else if (l.status === 'rejected') tally.rejected++;
      });
      setCounts(tally);

    } catch (err) {
      console.error('[Loans] fetchData:', err.message);
      toast.error(t.errorRead);
    } finally {
      setLoading(false);
    }
  }, [company?.id, page, search, activeTab, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setPage(1);
  };

  const handleSaveLoan = async (data) => {
    try {
      const payload = {
        company_id: company.id,
        employee_id: data.employee_id,
        total_amount: Number(data.total_amount),
        monthly_installment: Number(data.monthly_installment),
        repayment_months: data.repayment_months ? Number(data.repayment_months) : null,
        remaining_amount: Number(data.total_amount),
        status: 'active',
      };

      const { error } = await supabase.from('employee_loans').insert([payload]);
      if (error) throw error;

      toast.success(t.loanSaveSuccess);
      setShowModal(false);

      const { data: { user: authUser } } = await supabase.auth.getUser();
      await logAudit({
        companyId: company.id,
        userId: authUser?.id,
        action: 'CREATE_LOAN',
        tableName: 'employee_loans',
        newData: payload,
      });

      fetchData();
    } catch (err) {
      console.error('[Loans] handleSaveLoan:', err.message);
      toast.error((t.loanSaveError) + ': ' + err.message);
    }
  };

  const handleSettleLoan = async (loanId) => {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    try {
      const { error } = await supabase
        .from('employee_loans')
        .update({ remaining_amount: 0, status: 'paid' })
        .eq('id', loanId)
        .eq('company_id', company.id);

      if (error) throw error;

      toast.success(t.loanSettleSuccess);
      setSettlingLoanId(null);

      const { data: { user: authUser } } = await supabase.auth.getUser();
      await logAudit({
        companyId: company.id,
        userId: authUser?.id,
        action: 'SETTLE_LOAN',
        tableName: 'employee_loans',
        recordId: loanId,
        oldData: { remaining_amount: loan.remaining_amount, status: loan.status },
        newData: { remaining_amount: 0, status: 'paid' },
      });

      fetchData();
    } catch (err) {
      console.error('[Loans] handleSettleLoan:', err.message);
      toast.error(t.loanSettleError + ': ' + err.message);
    }
  };

  const handleApproveLoan = async (loanId) => {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    try {
      const { error } = await supabase
        .from('employee_loans')
        .update({ status: 'active' })
        .eq('id', loanId)
        .eq('company_id', company.id);

      if (error) throw error;

      toast.success(language === 'ar' ? 'تمت الموافقة على السلفة بنجاح' : 'Loan request approved successfully');

      // Send notification to employee
      await supabase.from('employee_notifications').insert([{
        employee_id: loan.employee_id,
        title: language === 'ar' ? 'الموافقة على السلفة' : 'Loan Request Approved',
        message: language === 'ar' 
          ? `تمت الموافقة على طلب السلفة الخاص بك بقيمة ${formatCurrency(loan.total_amount)}.`
          : `Your loan request of ${formatCurrency(loan.total_amount)} has been approved.`,
        type: 'success'
      }]);

      const { data: { user: authUser } } = await supabase.auth.getUser();
      await logAudit({
        companyId: company.id,
        userId: authUser?.id,
        action: 'APPROVE_LOAN_REQUEST',
        tableName: 'employee_loans',
        recordId: loanId,
        newData: { status: 'active' },
      });

      fetchData();
    } catch (err) {
      console.error('[Loans] handleApproveLoan:', err.message);
      toast.error(language === 'ar' ? 'فشل الموافقة على السلفة' : 'Failed to approve loan');
    }
  };

  const handleRejectLoan = async (loanId) => {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    try {
      const { error } = await supabase
        .from('employee_loans')
        .update({ status: 'rejected' })
        .eq('id', loanId)
        .eq('company_id', company.id);

      if (error) throw error;

      toast.success(language === 'ar' ? 'تم رفض طلب السلفة' : 'Loan request rejected');

      // Send notification to employee
      await supabase.from('employee_notifications').insert([{
        employee_id: loan.employee_id,
        title: language === 'ar' ? 'رفض السلفة' : 'Loan Request Rejected',
        message: language === 'ar' 
          ? `تم رفض طلب السلفة الخاص بك بقيمة ${formatCurrency(loan.total_amount)}.`
          : `Your loan request of ${formatCurrency(loan.total_amount)} has been rejected.`,
        type: 'warning'
      }]);

      const { data: { user: authUser } } = await supabase.auth.getUser();
      await logAudit({
        companyId: company.id,
        userId: authUser?.id,
        action: 'REJECT_LOAN_REQUEST',
        tableName: 'employee_loans',
        recordId: loanId,
        newData: { status: 'rejected' },
      });

      fetchData();
    } catch (err) {
      console.error('[Loans] handleRejectLoan:', err.message);
      toast.error(language === 'ar' ? 'فشل رفض طلب السلفة' : 'Failed to reject loan');
    }
  };

  const openHistory = async (loan) => {
    setHistoryLoan(loan);
    setHistoryPayments([]);
    setHistoryLoading(true);
    try {
      const { data: payrolls, error } = await supabase
        .from('payrolls')
        .select('start_date, end_date, breakdown, deductions')
        .eq('company_id', company.id)
        .eq('employee_id', loan.employee_id)
        .order('start_date', { ascending: false });

      if (error) throw error;

      const payments = [];
      for (const payroll of (payrolls || [])) {
        let bd = [];
        try {
          bd = typeof payroll.breakdown === 'string'
            ? JSON.parse(payroll.breakdown)
            : (payroll.breakdown || []);
        } catch (_) { bd = []; }

        const loanEntries = (Array.isArray(bd) ? bd : [])
          .filter(item => item.action_type === 'deduct_loan' && (!item.loan_id || item.loan_id === loan.id));

        if (loanEntries.length > 0) {
          const totalDeducted = loanEntries.reduce((s, e) => s + Number(e.amount || 0), 0);
          payments.push({
            period: `${payroll.start_date} ← ${payroll.end_date}`,
            amount: totalDeducted,
          });
        }
      }
      setHistoryPayments(payments);
    } catch (err) {
      console.error('[Loans] openHistory:', err.message);
      toast.error(t.loanHistoryError);
    } finally {
      setHistoryLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const totalOutstanding = loans.reduce((s, l) => s + Number(l.remaining_amount), 0);
  const activeCount = loans.filter(l => l.status === 'active').length;

  return (
    <div className={`loans-page ${language === 'ar' ? 'rtl' : 'ltr'}`}>
      <div className="loans-header">
        <div className="loans-title-area">
          <h1>{t.loansPageTitle}</h1>
          <p>{t.loansPageSubtitle}</p>
        </div>
        <button className="btn-add-loan" onClick={() => setShowModal(true)}>
          <HiPlus />
          {t.addLoanBtn}
        </button>
      </div>

      <div className="loans-stats">
        <div className="loan-stat-pill">
          <div className="pill-icon"><HiCash /></div>
          <div className="pill-content">
            <span className="label">{t.loanStatTotal}</span>
            <span className="value privacy-blur">{formatCurrency(totalOutstanding)}</span>
          </div>
        </div>
        <div className="loan-stat-pill">
          <div className="pill-icon"><HiTrendingUp /></div>
          <div className="pill-content">
            <span className="label">{t.loanStatCount}</span>
            <span className="value">{activeCount}</span>
          </div>
        </div>
      </div>

      <div className="loans-tabs-row">
        <div className="loans-tabs">
          <button 
            className={activeTab === 'active' ? 'active' : ''} 
            onClick={() => handleTabChange('active')}
          >
            {language === 'ar' ? 'السلف النشطة والمكتملة' : 'Active & Paid'} 
            <span className="count-badge">{counts.active}</span>
          </button>
          <button 
            className={activeTab === 'pending' ? 'active' : ''} 
            onClick={() => handleTabChange('pending')}
          >
            {language === 'ar' ? 'الطلبات المعلقة' : 'Pending Requests'} 
            <span className="count-badge">{counts.pending}</span>
          </button>
          <button 
            className={activeTab === 'rejected' ? 'active' : ''} 
            onClick={() => handleTabChange('rejected')}
          >
            {language === 'ar' ? 'الطلبات المرفوضة' : 'Rejected'} 
            <span className="count-badge">{counts.rejected}</span>
          </button>
        </div>
      </div>

      <div className="loans-search-bar">
        <div className="search-input-wrapper">
          <HiSearch className="search-icon" />
          <input 
            placeholder={t.loanSearchPlaceholder} 
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {loading ? (
        <div className="loans-loading">
          <div className="spinner"></div>
          <p>{t.loading}...</p>
        </div>
      ) : loans.length === 0 ? (
        <div className="loans-empty">
          <HiCash size={64} />
          <h3>{t.noResults}</h3>
          <p>{t.noLoansDesc}</p>
        </div>
      ) : (
        <>
          <div className="loans-grid">
            <AnimatePresence mode="popLayout">
              {loans.map((loan, idx) => {
                const paidAmount = Number(loan.total_amount) - Number(loan.remaining_amount);
                const progress = Number(loan.total_amount) > 0
                  ? (paidAmount / Number(loan.total_amount)) * 100
                  : 0;

                return (
                  <motion.div 
                    key={loan.id} 
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="loan-card"
                  >
                    <div className="loan-card-header">
                      <div className="loan-employee">
                        <div className="avatar-mini"><HiUser /></div>
                        <h3>{loan.employee?.name}</h3>
                      </div>
                      <span className={`loan-status-tag ${loan.status}`}>
                        {loan.status === 'active' ? t.loanStatusActive 
                          : loan.status === 'paid' ? t.loanStatusCompleted 
                          : loan.status === 'pending' ? (language === 'ar' ? 'طلب معلق' : 'Pending') 
                          : loan.status === 'rejected' ? (language === 'ar' ? 'مرفوض' : 'Rejected') 
                          : loan.status}
                      </span>
                    </div>

                    <div className="loan-card-details">
                      <div className="detail-row">
                        <span>{t.loanTotalAmount}:</span>
                        <strong className="privacy-blur">{formatCurrency(loan.total_amount)}</strong>
                      </div>
                      <div className="detail-row">
                        <span>{t.loanMonthlyInstallment}:</span>
                        <strong className="privacy-blur">{formatCurrency(loan.monthly_installment)}</strong>
                      </div>
                      {loan.repayment_months && (
                        <div className="detail-row">
                          <span>{t.totalMonths}</span>
                          <strong>{loan.repayment_months} {t.monthsLabel}</strong>
                        </div>
                      )}
                      <div className="detail-row highlight">
                        <span>{t.loanRemainingAmount}:</span>
                        <strong className="danger privacy-blur">{formatCurrency(loan.remaining_amount)}</strong>
                      </div>
                    </div>

                    {['active', 'paid'].includes(loan.status) && (
                      <div className="loan-progress-container">
                        <div className="progress-labels">
                          <span>{t.loanProgressLabel}</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="progress-track">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className="progress-bar"
                          ></motion.div>
                        </div>
                      </div>
                    )}

                    <div className="loan-card-footer">
                      {loan.status === 'pending' ? (
                        <>
                          <button
                            className="btn-reject"
                            onClick={() => handleRejectLoan(loan.id)}
                            style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                          >
                            <HiX />
                            {language === 'ar' ? 'رفض' : 'Reject'}
                          </button>
                          <button
                            className="btn-approve-request"
                            onClick={() => handleApproveLoan(loan.id)}
                            style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                          >
                            <HiCheck />
                            {language === 'ar' ? 'موافقة' : 'Approve'}
                          </button>
                        </>
                      ) : loan.status === 'rejected' ? (
                        <div style={{ color: '#ef4444', fontWeight: 'bold', textAlign: 'center', width: '100%', padding: '0.8rem' }}>
                          {language === 'ar' ? 'تم رفض طلب السلفة' : 'Loan request rejected'}
                        </div>
                      ) : (
                        <>
                          <button
                            className="btn-view-history"
                            onClick={() => openHistory(loan)}
                          >
                            <HiClipboardList />
                            {t.loanHistoryBtn}
                          </button>
                          {loan.status === 'active' && (
                            <button
                              className="btn-settle"
                              onClick={() => setSettlingLoanId(loan.id)}
                            >
                              <HiCheck />
                              {t.loanSettleBtn}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="pag-btn"
              >
                {language === 'ar' ? <HiChevronRight /> : <HiChevronLeft />}
              </button>
              <span className="pag-info">
                {t.pageLabel} {page} {t.ofLabel} {totalPages}
              </span>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="pag-btn"
              >
                {language === 'ar' ? <HiChevronLeft /> : <HiChevronRight />}
              </button>
            </div>
          )}
        </>
      )}

      {showModal && (
        <LoanModal 
          employees={employees} 
          onClose={() => setShowModal(false)} 
          onSave={handleSaveLoan} 
          t={t}
        />
      )}

      <AnimatePresence>
        {settlingLoanId && (
          <div className="modal-overlay" onClick={() => setSettlingLoanId(null)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="modal-content settle-confirm-modal"
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>{t.confirmSettleTitle}</h2>
                <button className="close-btn" onClick={() => setSettlingLoanId(null)}><HiX /></button>
              </div>
              <div className="settle-confirm-body">
                <div className="settle-icon-wrap">
                  <HiExclamation size={40} />
                </div>
                <p>{t.confirmSettleBody}</p>
                <p className="settle-sub">{t.confirmSettleSub}</p>
              </div>
              <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setSettlingLoanId(null)}>
                  {t.cancelBtn}
                </button>
                <button className="btn-submit btn-danger" onClick={() => handleSettleLoan(settlingLoanId)}>
                  <HiCheck /> {t.confirmSettleBtn}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {historyLoan && (
          <div className="modal-overlay" onClick={() => setHistoryLoan(null)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="modal-content history-modal"
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <div>
                  <h2>{t.paymentHistoryTitle}</h2>
                  <p className="history-sub">{historyLoan.employee?.name}</p>
                </div>
                <button className="close-btn" onClick={() => setHistoryLoan(null)}><HiX /></button>
              </div>

              <div className="history-summary">
                <div className="history-summary-item">
                  <span>{t.loanAmountLabel}</span>
                  <strong className="privacy-blur">{formatCurrency(historyLoan.total_amount)}</strong>
                </div>
                <div className="history-summary-item">
                  <span>{t.paidAmountLabel}</span>
                  <strong className="paid privacy-blur">
                    {formatCurrency(Number(historyLoan.total_amount) - Number(historyLoan.remaining_amount))}
                  </strong>
                </div>
                <div className="history-summary-item">
                  <span>{t.remainingAmountLabel}</span>
                  <strong className="danger privacy-blur">{formatCurrency(historyLoan.remaining_amount)}</strong>
                </div>
              </div>

              <div className="history-list-wrap">
                {historyLoading ? (
                  <div className="loans-loading">
                    <div className="spinner"></div>
                    <p>{t.loadingHistory}</p>
                  </div>
                ) : historyPayments.length === 0 ? (
                  <div className="history-empty">
                    <HiClipboardList size={40} />
                    <p>{t.noPaymentsRecorded}</p>
                    <span>{t.historyDesc}</span>
                  </div>
                ) : (
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{t.periodLabel}</th>
                        <th>{t.deductedAmountLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyPayments.map((p, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td dir="ltr">{p.period}</td>
                          <td className="paid privacy-blur">{formatCurrency(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2}><strong>{t.totalDeductedLabel}</strong></td>
                        <td className="paid">
                          <strong className="privacy-blur">
                            {formatCurrency(historyPayments.reduce((s, p) => s + p.amount, 0))}
                          </strong>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// -------------------------------------------------------------------------
function LoanModal({ employees, onClose, onSave, t }) {
  const { language } = useLocale();
  const [employeeId, setEmployeeId]     = useState('');
  const [totalAmount, setTotalAmount]   = useState('');
  const [inputMode, setInputMode]       = useState('by_months');
  const [repayMonths, setRepayMonths]   = useState('');
  const [monthlyAmt, setMonthlyAmt]     = useState('');
  const [isFixed, setIsFixed]           = useState(false);
  const [formErrors, setFormErrors]     = useState({});
  const [isSaving, setIsSaving]         = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const selectedName = employees.find(e => e.id === employeeId)?.name;

  const autoInstallment = (inputMode === 'by_months' && +totalAmount > 0 && +repayMonths > 0)
    ? (+totalAmount / +repayMonths).toFixed(2) : null;

  const estimatedMonths = (inputMode === 'by_amount' && +totalAmount > 0 && +monthlyAmt > 0)
    ? Math.ceil(+totalAmount / +monthlyAmt) : null;

  const validate = () => {
    const errs = {};
    if (!employeeId)              errs.employee_id        = t.errNoEmployee;
    if (!totalAmount || +totalAmount <= 0) errs.total_amount = t.errAmountPositive;
    if (inputMode === 'by_months') {
      if (!repayMonths || +repayMonths < 1) errs.repayment_months = t.errSelectMonths;
    } else {
      if (!monthlyAmt || +monthlyAmt <= 0)     errs.monthly_installment = t.errInstallmentPositive;
      if (+monthlyAmt > +totalAmount)          errs.monthly_installment = t.errInstallmentExceeds;
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }
    setFormErrors({});
    setIsSaving(true);
    await onSave({
      employee_id:         employeeId,
      total_amount:        parseFloat(totalAmount),
      monthly_installment: inputMode === 'by_months' ? parseFloat(autoInstallment) : parseFloat(monthlyAmt),
      repayment_months:    inputMode === 'by_months' ? parseInt(repayMonths, 10) : (estimatedMonths || null),
      is_fixed:            isFixed,
    });
    setIsSaving(false);
  };

  const rtl = language === 'ar';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="modal-content"
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{t.addLoanBtn}</h2>
          <button className="close-btn" onClick={onClose}><HiX /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>{t.employeeNameLabel} *</label>
            <div className="custom-select-container">
              <div
                className={`custom-select-trigger${formErrors.employee_id ? ' has-error' : ''}`}
                onClick={() => setDropdownOpen(o => !o)}
              >
                <span className={employeeId ? 'selected-text' : 'placeholder-text'}>
                  {selectedName || t.employeeSelectPlaceholder}
                </span>
                <HiChevronDown className={`select-icon${dropdownOpen ? ' open' : ''}`} />
              </div>
              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }} className="custom-select-dropdown"
                  >
                    <div className="custom-select-option" onClick={() => { setEmployeeId(''); setDropdownOpen(false); }}>
                      {t.employeeSelectPlaceholder}
                    </div>
                    {employees.map(emp => (
                      <div
                        key={emp.id}
                        className={`custom-select-option${employeeId === emp.id ? ' selected' : ''}`}
                        onClick={() => { setEmployeeId(emp.id); setDropdownOpen(false); setFormErrors(p => ({...p, employee_id: undefined})); }}
                      >
                        {emp.name}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {formErrors.employee_id && <span className="error-text">{formErrors.employee_id}</span>}
          </div>

          <div className="form-group">
            <label>{t.loanTotalAmount} *</label>
            <input
              type="number" min="1" step="0.01" placeholder="0.00"
              value={totalAmount}
              onChange={e => { setTotalAmount(e.target.value); setFormErrors(p => ({...p, total_amount: undefined})); }}
              className={formErrors.total_amount ? 'has-error' : ''}
            />
            {formErrors.total_amount && <span className="error-text">{formErrors.total_amount}</span>}
          </div>

          <div className="form-group">
            <label>{t.loanModeInstallmentLabel}</label>
            <div className="loan-mode-toggle">
              <button type="button" className={`mode-btn${inputMode === 'by_months' ? ' active' : ''}`}
                onClick={() => { setInputMode('by_months'); setFormErrors({}); }}>
                {t.modeByMonths}
              </button>
              <button type="button" className={`mode-btn${inputMode === 'by_amount' ? ' active' : ''}`}
                onClick={() => { setInputMode('by_amount'); setFormErrors({}); }}>
                {t.modeByAmount}
              </button>
            </div>
          </div>

          {inputMode === 'by_months' ? (
            <div className="form-group">
              <label>{t.repaymentMonthsCount} *</label>
              <input
                type="number" min="1" max="120"
                placeholder={t.repaymentMonthsPlaceholder}
                value={repayMonths}
                onChange={e => { setRepayMonths(e.target.value); setFormErrors(p => ({...p, repayment_months: undefined})); }}
                className={formErrors.repayment_months ? 'has-error' : ''}
              />
              {formErrors.repayment_months && <span className="error-text">{formErrors.repayment_months}</span>}
              {autoInstallment && (
                <div className="loan-auto-hint">
                  <span>{t.calcInstallmentHint}</span>
                  <strong>{parseFloat(autoInstallment).toLocaleString()} {t.perMonth}</strong>
                </div>
              )}
            </div>
          ) : (
            <div className="form-group">
              <label>{t.loanMonthlyInstallment} *</label>
              <input
                type="number" min="1" step="0.01" placeholder="0.00"
                value={monthlyAmt}
                onChange={e => { setMonthlyAmt(e.target.value); setFormErrors(p => ({...p, monthly_installment: undefined})); }}
                className={formErrors.monthly_installment ? 'has-error' : ''}
              />
              {formErrors.monthly_installment && <span className="error-text">{formErrors.monthly_installment}</span>}
              {estimatedMonths && (
                <div className="loan-auto-hint">
                  <span>{t.estimatedDurationHint}</span>
                  <strong>{estimatedMonths} {t.monthsLabel}</strong>
                </div>
              )}
            </div>
          )}

          <div className="form-group checkbox-group" style={{ marginTop: '12px', background: 'rgba(59,130,246,0.06)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.15)' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', margin: 0 }}>
              <input 
                type="checkbox" 
                checked={isFixed} 
                onChange={(e) => setIsFixed(e.target.checked)} 
                style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: '#3b82f6' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong style={{ fontSize: '13.5px', color: '#cbd5e1' }}>
                  {t.fixedDeductionToggle}
                </strong>
                <span style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', lineHeight: 1.4 }}>
                  {t.fixedDeductionDesc}
                </span>
              </div>
            </label>
          </div>

          <div className="modal-footer" style={{ marginTop: '24px' }}>
            <button type="button" className="btn-cancel" onClick={onClose}>
              {t.cancelBtn}
            </button>
            <button type="submit" className="btn-submit" disabled={isSaving}>
              {isSaving ? t.savingText : t.saveLoanSubmitBtn}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
