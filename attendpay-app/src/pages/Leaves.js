import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { logAudit } from '../utils/auditLogger';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LeaveSchema } from '../constants/commonSchemas';
import { useLocale } from '../context/LocaleContext';
import { 
  HiCalendar, HiCheck, HiX, HiClock, HiUser, HiDocumentText, 
  HiPlus, HiChevronLeft, HiChevronRight
} from 'react-icons/hi';
import { motion, AnimatePresence } from 'framer-motion';
import './Leaves.css';

const PAGE_SIZE = 10;

const LEAVE_TYPES = (t) => ({
  annual:    { label: t.leaveTypeAnnual, color: 'var(--obs-primary)' },
  sick:      { label: t.leaveTypeSick, color: 'var(--color-error)' },
  unpaid:    { label: t.leaveTypeUnpaid, color: 'var(--color-warning)' },
  emergency: { label: t.leaveTypeEmergency, color: 'var(--color-success)' },
});

export default function Leaves() {
  const { company } = useAuth();
  const { t, language } = useLocale();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const fetchEmployees = useCallback(async () => {
    if (!company?.id) return;
    const { data } = await supabase
      .from('employees')
      .select('id, name')
      .eq('company_id', company.id)
      .eq('status', 'active');
    setEmployees(data || []);
  }, [company?.id]);

  const fetchData = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      // 1. Fetch filtered and paginated data
      const { data, error, count } = await supabase
        .from('leave_requests')
        .select('id, status, leave_type, start_date, end_date, reason, attachment_url, created_at, employee_id, employee:employees(name)', { count: 'exact' })
        .eq('company_id', company.id)
        .eq('status', activeTab)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      setRequests(data || []);
      setTotalCount(count || 0);

      // 2. Fetch counts for tabs
      const { data: countData } = await supabase
        .from('leave_requests')
        .select('status')
        .eq('company_id', company?.id);
      
      const tally = { pending: 0, approved: 0, rejected: 0 };
      (countData || []).forEach(r => { if (tally[r.status] !== undefined) tally[r.status]++; });
      setCounts(tally);

    } catch (err) {
      console.error('[Leaves] fetchData:', err.message);
      toast.error(t.errorFetchLeaves);
    } finally {
      setLoading(false);
    }
  }, [company?.id, activeTab, page, t]);

  useEffect(() => { 
    fetchData(); 
    if (isModalOpen && employees.length === 0) fetchEmployees();
  }, [fetchData, isModalOpen, employees.length, fetchEmployees]);

  const handleAction = async (id, status) => {
    const req = requests.find(r => r.id === id);
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status })
        .eq('id', id)
        .eq('company_id', company?.id);

      if (error) throw error;

      toast.success(status === 'approved' ? t.leaveStatusApproved : status === 'pending' ? 'تمت إعادة الطلب للانتظار' : t.leaveStatusRejected);

      // Send notification to employee
      if (req && (status === 'approved' || status === 'rejected')) {
        const title = language === 'ar' 
          ? (status === 'approved' ? 'الموافقة على الإجازة' : 'رفض طلب الإجازة') 
          : (status === 'approved' ? 'Leave Approved' : 'Leave Request Rejected');
        const message = language === 'ar'
          ? `تمت ${status === 'approved' ? 'الموافقة على' : 'رفض'} طلب الإجازة الخاص بك للفترة من ${req.start_date} إلى ${req.end_date}.`
          : `Your leave request for the period ${req.start_date} to ${req.end_date} has been ${status === 'approved' ? 'approved' : 'rejected'}.`;

        await supabase.from('employee_notifications').insert([{
          employee_id: req.employee_id,
          title,
          message,
          type: status === 'approved' ? 'success' : 'warning'
        }]);
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      await logAudit({
        companyId: company?.id,
        userId: authUser?.id,
        action: status === 'approved' ? 'APPROVE_LEAVE' : status === 'pending' ? 'RESET_LEAVE' : 'REJECT_LEAVE',
        tableName: 'leave_requests',
        recordId: id,
        oldData: req ? { status: req.status } : null,
        newData: { status },
      });

      fetchData();
    } catch (err) {
      console.error('[Leaves] handleAction:', err.message);
      toast.error(t.errorUpdateLeave + ': ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    const req = requests.find(r => r.id === id);
    try {
      const { error } = await supabase
        .from('leave_requests')
        .delete()
        .eq('id', id)
        .eq('company_id', company?.id);

      if (error) throw error;

      toast.success(t.deleteSuccess || 'تم حذف الطلب بنجاح');

      const { data: { user: authUser } } = await supabase.auth.getUser();
      await logAudit({
        companyId: company?.id,
        userId: authUser?.id,
        action: 'DELETE_LEAVE',
        tableName: 'leave_requests',
        recordId: id,
        oldData: req,
      });

      fetchData();
    } catch (err) {
      console.error('[Leaves] handleDelete:', err.message);
      toast.error(t.errorDeleteLeave || 'فشل حذف الطلب');
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const types = LEAVE_TYPES(t);

  return (
    <div className={`leaves-page ${language === 'ar' ? 'rtl' : 'ltr'}`}>
      <div className="leaves-header">
        <div className="header-top">
          <div className="leaves-title">
            <h1>{t.leavesPageTitle}</h1>
            <p>{t.leavesPageSubtitle}</p>
          </div>
          <button className="btn-add-leave" onClick={() => setIsModalOpen(true)}>
            <HiPlus /> {t.addLeaveBtn}
          </button>
        </div>

        <div className="leaves-tabs-row">
          <div className="leaves-tabs">
            <button className={activeTab === 'pending' ? 'active' : ''} onClick={() => { setActiveTab('pending'); setPage(0); }}>
              {t.tabPending} <span className="count-badge">{counts.pending}</span>
            </button>
            <button className={activeTab === 'approved' ? 'active' : ''} onClick={() => { setActiveTab('approved'); setPage(0); }}>
              {t.tabApproved} <span className="count-badge">{counts.approved}</span>
            </button>
            <button className={activeTab === 'rejected' ? 'active' : ''} onClick={() => { setActiveTab('rejected'); setPage(0); }}>
              {t.tabRejected} <span className="count-badge">{counts.rejected}</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="leaves-loading">
          <div className="leaves-spinner"></div>
          <p>{t.loading}...</p>
        </div>
      ) : requests.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="leaves-empty"
        >
          <div className="empty-icon-wrapper">
            <HiCalendar size={64} />
          </div>
          <h3>{t.noLeavesFound}</h3>
          <p>{t.noResultsDesc || 'Try changing filters or adding a new record.'}</p>
        </motion.div> ) : (
        <>
          <div className="leaves-list">
            <AnimatePresence mode="popLayout">
              {requests.map((req, idx) => (
                <motion.div 
                  key={req.id} 
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                  className="leave-card"
                >
                  <div className="leave-card-side" style={{ background: types[req.leave_type]?.color || 'var(--text-muted)' }}></div>
                  <div className="leave-card-main">
                    <div className="leave-card-header">
                      <div className="leave-user-info">
                        <div className="leave-user-avatar">
                          <HiUser size={24} />
                        </div>
                        <div>
                          <h3>{req.employee?.name}</h3>
                          <span className="leave-type-tag" style={{ color: types[req.leave_type]?.color || 'inherit' }}>
                            {types[req.leave_type]?.label || req.leave_type}
                          </span>
                        </div>
                      </div>
                      <div className="leave-date-range">
                        <div className="date-box">
                          <span className="label">من</span>
                          <span className="value">{req.start_date}</span>
                        </div>
                        <HiClock className="date-sep" />
                        <div className="date-box">
                          <span className="label">إلى</span>
                          <span className="value">{req.end_date}</span>
                        </div>
                      </div>
                    </div>

                    <div className="leave-card-body">
                      <p className="leave-reason">
                        <strong>السبب:</strong> {req.reason || 'لم يتم ذكر سبب محدد.'}
                      </p>
                      {req.attachment_url && (
                        <a href={req.attachment_url} target="_blank" rel="noreferrer" className="leave-attach">
                          <HiDocumentText />
                          عرض المرفق
                        </a>
                      )}
                    </div>

                    <div className="leave-card-actions">
                      {req.status === 'pending' ? (
                        <div className="leave-status-actions">
                          <button className="btn-reject" onClick={() => handleAction(req.id, 'rejected')}>
                            <HiX /> {t.tabRejected}
                          </button>
                          <button className="btn-approve" onClick={() => handleAction(req.id, 'approved')}>
                            <HiCheck /> {t.tabApproved}
                          </button>
                        </div>
                      ) : (
                        <div className="leave-status-display">
                          <span className={`status-pill ${req.status}`}>
                            {req.status === 'approved' ? t.tabApproved : t.tabRejected}
                          </span>
                          <button 
                            className="btn-undo" 
                            onClick={() => handleAction(req.id, 'pending')}
                            title="إعادة للانتظار"
                          >
                            <HiClock />
                          </button>
                        </div>
                      )}
                      <button 
                        className="btn-delete-leave" 
                        onClick={() => {
                          // constitution §9: no window.confirm — use toast with action
                          toast(t.confirmDeleteLeave || 'هل أنت متأكد من حذف هذا الطلب؟', {
                            action: { label: t.delete || 'حذف', onClick: () => handleDelete(req.id) },
                            cancel: { label: t.cancel || 'إلغاء', onClick: () => {} },
                            duration: 6000,
                          });
                        }}
                        title={t.delete || 'حذف'}
                      >
                        <HiX />
                      </button>
                    </div>
                    </div>
                  </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button 
                disabled={page === 0} 
                onClick={() => setPage(p => p - 1)}
                className="pag-btn"
              >
                <HiChevronRight />
              </button>
              <span className="pag-info">{t.page || 'Page'} {page + 1} {t.of || 'of'} {totalPages}</span>
              <button 
                disabled={page >= totalPages - 1} 
                onClick={() => setPage(p => p + 1)}
                className="pag-btn"
              >
                <HiChevronLeft />
              </button>
            </div>
          )}
        </>
      )}

      {isModalOpen && (
        <LeaveModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSubmitSuccess={() => { setIsModalOpen(false); fetchData(); }}
          employees={employees}
          companyId={company?.id}
          t={t}
        />
      )}
    </div>
  );
}

function LeaveModal({ isOpen, onClose, onSubmitSuccess, employees, companyId, t }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(LeaveSchema)
  });

  const onSubmit = async (data) => {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .insert([{
          ...data,
          company_id: companyId,
          status: 'pending' // Default status
        }]);

      if (error) throw error;

      toast.success(t.leaveSaveSuccess || 'تم تسجيل طلب الإجازة بنجاح');

      const { data: { user } } = await supabase.auth.getUser();
      await logAudit({
        companyId,
        userId: user?.id,
        action: 'CREATE_LEAVE_REQUEST',
        tableName: 'leave_requests',
        newData: data
      });

      onSubmitSuccess();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="modal-content" 
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{t.addLeaveBtn}</h2>
          <button className="close-btn" onClick={onClose}><HiX /></button>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="modal-form">
          <div className="form-group">
            <label>{t.employeeName || 'Employee'}</label>
            <select {...register('employee_id')}>
              <option value="">{t.selectEmployee || 'Select Employee'}</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
            {errors.employee_id && <span className="error-text">{errors.employee_id.message}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t.leaveTypeLabel}</label>
              <select {...register('leave_type')}>
                <option value="annual">{t.leaveTypeAnnual}</option>
                <option value="sick">{t.leaveTypeSick}</option>
                <option value="unpaid">{t.leaveTypeUnpaid}</option>
                <option value="emergency">{t.leaveTypeEmergency}</option>
              </select>
              {errors.leave_type && <span className="error-text">{errors.leave_type.message}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t.leaveStartLabel}</label>
              <input type="date" {...register('start_date')} />
              {errors.start_date && <span className="error-text">{errors.start_date.message}</span>}
            </div>
            <div className="form-group">
              <label>{t.leaveEndLabel}</label>
              <input type="date" {...register('end_date')} />
              {errors.end_date && <span className="error-text">{errors.end_date.message}</span>}
            </div>
          </div>

          <div className="form-group">
            <label>{t.leaveReasonLabel}</label>
            <textarea 
              {...register('reason')} 
              placeholder={t.leaveReasonPlaceholder}
            />
            {errors.reason && <span className="error-text">{errors.reason.message}</span>}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>{t.cancel || 'Cancel'}</button>
            <button type="submit" className="btn-submit" disabled={isSubmitting}>
              {isSubmitting ? (t.saving || 'Saving...') : (t.save || 'Save')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
