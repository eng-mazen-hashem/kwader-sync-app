import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { 
    ArrowLeft, Edit2, MoreHorizontal, BadgeAlert, 
    CalendarDays, Fingerprint, Banknote, 
    History, FolderOpen, PlaneTakeoff, FileText, 
    Eye, UserCheck,
    Briefcase, Hash, Building2, Phone, Clock,
    AlertTriangle, CheckCircle2, XCircle,
    Upload, Plus, Trash2, ExternalLink, FileCheck,
    DollarSign, CreditCard, Users, Shield, RefreshCw,
    PowerOff, Power, X, Save, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { logAudit } from '../utils/auditLogger';
import './EmployeeProfile.css';

// -------------------------------------------------------------------------
const AVATAR_COLORS = [
    'linear-gradient(135deg,#6366f1,#8b5cf6)',
    'linear-gradient(135deg,#8b5cf6,#c084fc)',
    'linear-gradient(135deg,#06b6d4,#6366f1)',
    'linear-gradient(135deg,#f59e0b,#ef4444)',
    'linear-gradient(135deg,#10b981,#06b6d4)',
];
const avatarColor = (name = '') =>
    AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

// -------------------------------------------------------------------------
const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return dateStr; }
};

const getDocStatus = (expiryDate) => {
    if (!expiryDate) return 'permanent';
    const days = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'expired';
    if (days <= 60) return 'expiring';
    return 'valid';
};

const DOC_TYPES = [
    { value: 'iqama', label: 'إقامة / Iqama', icon: Shield },
    { value: 'passport', label: 'جواز سفر / Passport', icon: PlaneTakeoff },
    { value: 'contract', label: 'عقد عمل / Contract', icon: FileText },
    { value: 'medical', label: 'فحص طبي / Medical', icon: FileCheck },
    { value: 'national_id', label: 'هوية / National ID', icon: Users },
    { value: 'other', label: 'أخرى / Other', icon: FolderOpen },
];

const DOC_STATUS_CONFIG = {
    expired:   { color: '#ff6e84', bg: 'rgba(255,110,132,0.1)', label: 'منتهية الصلاحية', badge: 'ep-doc-badge--expired' },
    expiring:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'تنتهي قريباً',    badge: 'ep-doc-badge--expiring' },
    valid:     { color: '#10b981', bg: 'rgba(16,185,129,0.1)',   label: 'سارية',           badge: 'ep-doc-badge--valid' },
    permanent: { color: '#9fa7ff', bg: 'rgba(159,167,255,0.1)',  label: 'دائمة',           badge: 'ep-doc-badge--permanent' },
};

const WEEKDAYS = ['الأح', 'الاث', 'الثل', 'الأر', 'الخم', 'الجم', 'السب'];

const LEAVE_TYPES_AR = {
    sick: 'إجازة مرضية',
    annual: 'إجازة سنوية',
    emergency: 'إجازة طارئة',
    unpaid: 'إجازة غير مدفوعة',
    maternity: 'إجازة أمومة',
    paternity: 'إجازة أبوة',
    marriage: 'إجازة زواج',
    compassionate: 'إجازة وفاة'
};

const translateLeaveType = (type) => {
    return LEAVE_TYPES_AR[type] || type || 'إجازة';
};

// -------------------------------------------------------------------------
function DocumentModal({ isOpen, onClose, onSaved, editingDoc, employeeId, companyId }) {
    const [form, setForm] = useState({ doc_name: '', doc_type: 'iqama', expiry_date: '', issue_date: '', notes: '' });
    const [file, setFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (isOpen && editingDoc) {
            setForm({
                doc_name: editingDoc.doc_name || '',
                doc_type: editingDoc.doc_type || 'iqama',
                expiry_date: editingDoc.expiry_date || '',
                issue_date: editingDoc.issue_date || '',
                notes: editingDoc.notes || '',
            });
            setFile(null);
        } else if (isOpen) {
            setForm({ doc_name: '', doc_type: 'iqama', expiry_date: '', issue_date: '', notes: '' });
            setFile(null);
        }
    }, [isOpen, editingDoc]);

    const handleSave = async () => {
        if (!form.doc_name.trim()) { toast.error('اسم المستند مطلوب'); return; }
        setSaving(true);
        try {
            let fileUrl = editingDoc?.file_url || null;

            // Handle file upload if a new file is selected
            if (file) {
                setUploading(true);
                const fileExt = file.name.split('.').pop();
                const fileName = `${companyId}/${employeeId}/${Date.now()}.${fileExt}`;
                
                const { error: uploadError, data } = await supabase.storage
                    .from('employee-docs')
                    .upload(fileName, file, { upsert: true });

                if (uploadError) {
                    if (uploadError.message.includes('bucket not found')) {
                        throw new Error('Storage bucket (employee-docs) not found. Please create it in Supabase.');
                    }
                    throw uploadError;
                }

                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('employee-docs')
                    .getPublicUrl(fileName);
                
                fileUrl = publicUrl;
                setUploading(false);
            }

            const payload = { 
                ...form, 
                employee_id: employeeId, 
                company_id: companyId, 
                file_url: fileUrl,
                updated_at: new Date().toISOString() 
            };

            let error;
            if (editingDoc) {
                ({ error } = await supabase.from('employee_documents').update(payload).eq('id', editingDoc.id));
            } else {
                ({ error } = await supabase.from('employee_documents').insert([payload]));
            }

            if (error) throw error;

            toast.success(editingDoc ? 'تم تحديث المستند' : 'تمت إضافة المستند بنجاح');
            onSaved();
        } catch (err) {
            if (err.code === '42P01') {
                toast.error('جدول المستندات غير موجود - يرجى تطبيق Migration');
            } else {
                toast.error('حدث خطأ: ' + err.message);
            }
        } finally {
            setSaving(false);
            setUploading(false);
        }
    };

    if (!isOpen) return null;
    return (
        <div className="ep-modal-overlay" onClick={onClose}>
            <div className="ep-modal-card" onClick={e => e.stopPropagation()}>
                <div className="ep-modal-header">
                    <div className="ep-modal-icon-header">
                        {editingDoc ? <Edit2 size={24} /> : <Plus size={24} />}
                    </div>
                    <h3>{editingDoc ? 'تعديل المستند' : 'إضافة مستند جديد'}</h3>
                    <button className="ep-modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="ep-modal-body">
                    <div className="ep-form-row">
                        <label>نوع المستند</label>
                        <select value={form.doc_type} onChange={e => setForm(f => ({ ...f, doc_type: e.target.value }))}>
                            {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>
                    <div className="ep-form-row">
                        <label>اسم المستند *</label>
                        <input
                            type="text"
                            placeholder="مثال: إقامة الموظف، عقد 2024..."
                            value={form.doc_name}
                            onChange={e => setForm(f => ({ ...f, doc_name: e.target.value }))}
                        />
                    </div>
                    <div className="ep-form-grid-2">
                        <div className="ep-form-row">
                            <label>تاريخ الإصدار</label>
                            <input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
                        </div>
                        <div className="ep-form-row">
                            <label>تاريخ الانتهاء</label>
                            <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
                        </div>
                    </div>

                    <div className="ep-form-row">
                        <label>إرفاق ملف (اختياري)</label>
                        <div className="ep-file-upload-zone" onClick={() => document.getElementById('ep-doc-file').click()}>
                            <Upload size={20} />
                            <span>{file ? file.name : editingDoc?.file_url ? 'تغيير الملف الحالي' : 'اختر ملفاً (PDF, JPG, PNG)'}</span>
                            <input
                                id="ep-doc-file"
                                type="file"
                                hidden
                                onChange={e => setFile(e.target.files[0])}
                                accept=".pdf,.jpg,.jpeg,.png"
                            />
                        </div>
                        {editingDoc?.file_url && !file && (
                            <p className="ep-file-hint">يوجد ملف مرفوع بالفعل. ارفع ملف جديد لاستبداله.</p>
                        )}
                    </div>

                    <div className="ep-form-row">
                        <label>ملاحظات</label>
                        <textarea placeholder="ملاحظات إضافية..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                </div>
                <div className="ep-modal-footer">
                    <button className="ep-btn-cancel" onClick={onClose}>إلغاء</button>
                    <button className="ep-btn-save" onClick={handleSave} disabled={saving || uploading}>
                        {(saving || uploading) ? <Loader2 size={16} className="ep-spin" /> : <Save size={16} />}
                        {uploading ? 'جاري الرفع...' : editingDoc ? 'حفظ التعديلات' : 'إضافة المستند'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// -------------------------------------------------------------------------
function StatusModal({ isOpen, onClose, onConfirm, employee }) {
    const isActive = employee?.status === 'active';
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => { if (isOpen) setReason(''); }, [isOpen]);

    const handleConfirm = async () => {
        setSaving(true);
        await onConfirm(isActive ? 'inactive' : 'active', reason);
        setSaving(false);
    };

    if (!isOpen || !employee) return null;
    return (
        <div className="ep-modal-overlay" onClick={onClose}>
            <div className="ep-modal-card ep-modal-sm" onClick={e => e.stopPropagation()}>
                <div className="ep-modal-header">
                    <div className="ep-modal-icon-header" style={{ color: isActive ? '#ff6e84' : '#10b981' }}>
                        {isActive ? <PowerOff size={24} /> : <Power size={24} />}
                    </div>
                    <h3>{isActive ? 'إيقاف الموظف' : 'تفعيل الموظف'}</h3>
                    <button className="ep-modal-close" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="ep-modal-body">
                    <p className="ep-modal-desc">
                        {isActive
                            ? `سيتم إيقاف ${employee.name} مع الاحتفاظ بجميع بياناته. يمكن إعادة تفعيله في أي وقت.`
                            : `سيتم تفعيل ${employee.name} وإعادته للعمل.`}
                    </p>
                    {isActive && (
                        <div className="ep-form-row">
                            <label>سبب الإيقاف (اختياري)</label>
                            <input
                                type="text"
                                placeholder="مثال: انتهاء عقد دوري، إجازة طارئة..."
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                            />
                        </div>
                    )}
                </div>
                <div className="ep-modal-footer">
                    <button className="ep-btn-cancel" onClick={onClose}>إلغاء</button>
                    <button
                        className={`ep-btn-save ${isActive ? 'danger' : 'success'}`}
                        onClick={handleConfirm}
                        disabled={saving}
                    >
                        {saving ? <Loader2 size={16} className="ep-spin" /> : isActive ? <PowerOff size={16} /> : <Power size={16} />}
                        {isActive ? 'تأكيد الإيقاف' : 'تأكيد التفعيل'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// -------------------------------------------------------------------------
export default function EmployeeProfile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { company } = useAuth();
    const { formatCurrency } = useLocale();

// -------------------------------------------------------------------------
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('basic');

    // Stats
    const [leaveBalance, setLeaveBalance] = useState(null);
    const [monthlyHours, setMonthlyHours] = useState(null);
    const [attendanceStats, setAttendanceStats] = useState({ present: 0, late: 0, absent: 0 });

    // Attendance chart (last 7 working days)
    const [weekAttendance, setWeekAttendance] = useState([]);

    // Documents
    const [documents, setDocuments] = useState([]);
    const [docsLoading, setDocsLoading] = useState(false);
    const [docModal, setDocModal] = useState({ open: false, editing: null });

    // Payroll
    const [payrolls, setPayrolls] = useState([]);
    const [payrollLoading, setPayrollLoading] = useState(false);

    // Leaves
    const [leaves, setLeaves] = useState([]);

    // Loans
    const [loans, setLoans] = useState([]);
    const [loansLoading, setLoansLoading] = useState(false);

    // UI
    const [statusModal, setStatusModal] = useState(false);
    const [moreMenu, setMoreMenu] = useState(false); // eslint-disable-line no-unused-vars
    const [editMode, setEditMode] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [editSaving, setEditSaving] = useState(false);
    const [departments, setDepartments] = useState([]);

// -------------------------------------------------------------------------
    const fetchEmployee = useCallback(async () => {
        if (!company || !id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('employees')
                .select(`
                    id, name, phone, device_pin, base_salary, joining_date,
                    department_id, status, employment_type, position,
                    national_id, notes, inactive_reason, termination_date,
                    exclude_from_weekly_advance, departments(name)
                `)
                .eq('id', id)
                .eq('company_id', company.id)
                .single();

            if (error) throw error;
            setEmployee(data);
            setEditForm({
                name: data.name || '',
                phone: data.phone || '',
                position: data.position || '',
                national_id: data.national_id || '',
                base_salary: data.base_salary || 0,
                joining_date: data.joining_date || '',
                department_id: data.department_id || '',
                employment_type: data.employment_type || 'permanent',
                notes: data.notes || '',
                exclude_from_weekly_advance: data.exclude_from_weekly_advance || false,
            });
        } catch (err) {
            console.error('[EmployeeProfile] fetchEmployee:', err.message);
            toast.error('فشل تحميل بيانات الموظف');
        } finally {
            setLoading(false);
        }
    }, [id, company]);

// -------------------------------------------------------------------------
    const fetchStats = useCallback(async () => {
        if (!company || !id) return;
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const today = now.toISOString().split('T')[0];

        try {
            // Monthly attendance stats
            const { data: attData } = await supabase
                .from('processed_attendance')
                .select('status, work_hours, date')
                .eq('employee_id', id)
                .eq('company_id', company.id)
                .gte('date', firstDay)
                .lte('date', today);

            if (attData) {
                const present = attData.filter(a => a.status === 'present' || a.status === 'late').length;
                const late    = attData.filter(a => a.status === 'late').length;
                const absent  = attData.filter(a => a.status === 'absent').length;
                const totalDays = present + absent;
                const unauthorizedAbsencePct = totalDays > 0 ? Math.round((absent / totalDays) * 100) : 0;
                const hours   = attData.reduce((sum, a) => sum + (parseFloat(a.work_hours) || 0), 0);
                setAttendanceStats({ present, late, absent, unauthorizedAbsencePct });
                setMonthlyHours(Math.round(hours * 10) / 10);
            }

            // Last 7 days attendance for chart
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
            const weekStart = sevenDaysAgo.toISOString().split('T')[0];

            const { data: weekData } = await supabase
                .from('processed_attendance')
                .select('date, status, work_hours')
                .eq('employee_id', id)
                .eq('company_id', company.id)
                .gte('date', weekStart)
                .lte('date', today)
                .order('date', { ascending: true });

            setWeekAttendance(weekData || []);

            // Leave balance
            const { data: leaveData } = await supabase
                .from('leave_requests')
                .select('id, status, start_date, end_date, leave_type')
                .eq('employee_id', id)
                .eq('company_id', company.id);

            if (leaveData) {
                setLeaves(leaveData);
                const used = leaveData
                    .filter(l => l.status === 'approved')
                    .reduce((sum, l) => {
                        const s = new Date(l.start_date);
                        const e = new Date(l.end_date);
                        return sum + Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
                    }, 0);
                setLeaveBalance(Math.max(0, 21 - used)); // assuming 21 days annual
            }
        } catch (err) {
            console.error('[EmployeeProfile] fetchStats:', err.message);
        }
    }, [id, company]);

// -------------------------------------------------------------------------
    const fetchDocuments = useCallback(async () => {
        if (!company || !id) return;
        setDocsLoading(true);
        try {
            const { data, error } = await supabase
                .from('employee_documents')
                .select('id, employee_id, company_id, doc_type, doc_name, issue_date, expiry_date, notes, file_url, created_at')
                .eq('employee_id', id)
                .eq('company_id', company.id)
                .order('created_at', { ascending: false });
            if (error && error.code !== '42P01') throw error;
            setDocuments(data || []);
        } catch (err) {
            console.error('[EmployeeProfile] fetchDocuments:', err.message);
        } finally {
            setDocsLoading(false);
        }
    }, [id, company]);

// -------------------------------------------------------------------------
    const fetchPayrolls = useCallback(async () => {
        if (!company || !id) return;
        setPayrollLoading(true);
        try {
            const { data, error } = await supabase
                .from('payrolls')
                .select('id, start_date, end_date, base_salary, net_salary, overtime_hours, deductions, status')
                .eq('employee_id', id)
                .eq('company_id', company.id)
                .order('start_date', { ascending: false })
                .limit(12);
            if (error) throw error;
            setPayrolls(data || []);
        } catch (err) {
            console.error('[EmployeeProfile] fetchPayrolls:', err.message);
        } finally {
            setPayrollLoading(false);
        }
    }, [id, company]);

// -------------------------------------------------------------------------
    const fetchDepartments = useCallback(async () => {
        if (!company) return;
        const { data } = await supabase.from('departments').select('id, name').eq('company_id', company.id);
        setDepartments(data || []);
    }, [company]);

// -------------------------------------------------------------------------
    const fetchLoans = useCallback(async () => {
        if (!company || !id) return;
        setLoansLoading(true);
        try {
            const { data, error } = await supabase
                .from('employee_loans')
                .select('id, employee_id, company_id, amount, remaining_amount, monthly_deduction, notes, status, created_at')
                .eq('employee_id', id)
                .eq('company_id', company.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setLoans(data || []);
        } catch (err) {
            console.error('[EmployeeProfile] fetchLoans:', err.message);
        } finally {
            setLoansLoading(false);
        }
    }, [id, company]);

// -------------------------------------------------------------------------
    useEffect(() => { fetchEmployee(); }, [fetchEmployee]);
    useEffect(() => { fetchStats(); }, [fetchStats]);
    useEffect(() => { fetchDocuments(); }, [fetchDocuments]);
    useEffect(() => { fetchPayrolls(); }, [fetchPayrolls]);
    useEffect(() => { fetchDepartments(); }, [fetchDepartments]);
    useEffect(() => { fetchLoans(); }, [fetchLoans]);

// -------------------------------------------------------------------------
    const handleToggleStatus = async (newStatus, reason) => {
        try {
            const updates = {
                status: newStatus,
                inactive_reason: newStatus === 'inactive' ? (reason || null) : null,
                termination_date: newStatus === 'inactive' ? new Date().toISOString().split('T')[0] : null,
            };
            const { error } = await supabase
                .from('employees')
                .update(updates)
                .eq('id', id)
                .eq('company_id', company.id);
            if (error) throw error;
            toast.success(newStatus === 'active' ? '✅ تم تفعيل الموظف بنجاح' : '⏸️ تم إيقاف الموظف مع الاحتفاظ ببياناته');
            setEmployee(prev => ({ ...prev, ...updates }));
            setStatusModal(false);
        } catch (err) {
            toast.error('حدث خطأ: ' + err.message);
        }
    };

// -------------------------------------------------------------------------
    const handleSaveEdit = async () => {
        setEditSaving(true);
        try {
            const { error } = await supabase
                .from('employees')
                .update({
                    name: editForm.name,
                    phone: editForm.phone || null,
                    position: editForm.position || null,
                    national_id: editForm.national_id || null,
                    base_salary: parseFloat(editForm.base_salary) || 0,
                    joining_date: editForm.joining_date || null,
                    department_id: editForm.department_id || null,
                    employment_type: editForm.employment_type || 'permanent',
                    notes: editForm.notes || null,
                    exclude_from_weekly_advance: editForm.exclude_from_weekly_advance || false,
                })
                .eq('id', id)
                .eq('company_id', company.id);
            if (error) throw error;
            toast.success('✅ تم حفظ بيانات الموظف');
            setEditMode(false);
            fetchEmployee();
        } catch (err) {
            toast.error('حدث خطأ: ' + err.message);
        } finally {
            setEditSaving(false);
        }
    };

// -------------------------------------------------------------------------
    const handleDeleteDoc = useCallback(async (docId) => {
        // constitution §9: no window.confirm — use toast with action button
        toast('هل تريد حذف هذا المستند نهائياً؟', {
            action: {
                label: 'حذف',
                onClick: async () => {
                    try {
                        const { error } = await supabase
                            .from('employee_documents')
                            .delete()
                            .eq('id', docId)
                            .eq('company_id', company.id);
                        if (error) throw error;
                        toast.success('تم حذف المستند');
                        await logAudit({
                            company_id: company.id,
                            action: 'DELETE_EMPLOYEE_DOCUMENT',
                            table_name: 'employee_documents',
                            record_id: docId,
                        });
                        fetchDocuments();
                    } catch (err) {
                        console.error('[EmployeeProfile] handleDeleteDoc:', err.message);
                        toast.error('فشل الحذف');
                    }
                }
            },
            cancel: { label: 'إلغاء', onClick: () => {} },
            duration: 6000,
        });
    }, [company, fetchDocuments]);

// -------------------------------------------------------------------------
    if (loading) {
        return (
            <div className="ep-loading-state">
                <div className="ep-spinner" />
                <p>جاري تحميل ملف الموظف...</p>
            </div>
        );
    }

    if (!employee) {
        return (
            <div className="ep-empty-state">
                <BadgeAlert size={48} />
                <h2>الموظف غير موجود</h2>
                <button onClick={() => navigate('/employees')}>العودة للقائمة</button>
            </div>
        );
    }

    const isActive = employee.status === 'active';
    const isRotational = employee.employment_type === 'rotational';

    // Chart: build last 7 days array
    const chartDays = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const record = weekAttendance.find(a => a.date === dateStr);
        chartDays.push({
            label: WEEKDAYS[d.getDay()],
            date: dateStr,
            status: record?.status || 'no_data',
            hours: parseFloat(record?.work_hours || 0),
        });
    }
    const maxHours = Math.max(...chartDays.map(d => d.hours), 8);

// -------------------------------------------------------------------------
    return (
        <div className="ep-container" dir="rtl">


            <section className="ep-hero">
                <button className="ep-back-btn" onClick={() => navigate('/employees')}>
                    <ArrowLeft size={16} />
                    <span>العودة للقائمة</span>
                </button>

                <div className="ep-hero-banner">
                    <div className="ep-hero-gradient" />
                    <img
                        alt="Abstract Office"
                        className="ep-hero-bg"
                        src="https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2000&auto=format&fit=crop"
                    />
                </div>

                <div className="ep-hero-content">
                    {/* Avatar */}
                    <div className="ep-avatar-wrap">
                        <div className="ep-avatar" style={{ background: avatarColor(employee.name) }}>
                            {employee.name.charAt(0).toUpperCase()}
                        </div>
                        {isActive && <div className="ep-online-badge" />}
                    </div>

                    {/* Name & info */}
                    <div className="ep-hero-info">
                        <div className="ep-name-row">
                            <h1 className="ep-name">{employee.name}</h1>
                            <span className={`ep-status-pill ${isActive ? 'active' : 'inactive'}`}>
                                <span className="ep-status-dot" />
                                {isActive ? 'نشط' : 'موقوف'}
                            </span>
                            {isRotational && (
                                <span className="ep-type-pill rotational">
                                    <RefreshCw size={11} />
                                    دوري
                                </span>
                            )}
                        </div>
                        <p className="ep-role">
                            {employee.position || 'موظف'}
                            {employee.departments?.name && <> · <span>{employee.departments.name}</span></>}
                        </p>
                        {!isActive && employee.inactive_reason && (
                            <p className="ep-inactive-note">
                                <AlertTriangle size={13} />
                                {employee.inactive_reason}
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="ep-hero-actions">
                        {editMode ? (
                            <>
                                <button className="ep-btn ep-btn--primary" onClick={handleSaveEdit} disabled={editSaving}>
                                    {editSaving ? <Loader2 size={15} className="ep-spin" /> : <Save size={15} />}
                                    حفظ
                                </button>
                                <button className="ep-btn ep-btn--ghost" onClick={() => setEditMode(false)}>
                                    <X size={15} /> إلغاء
                                </button>
                            </>
                        ) : (
                            <>
                                <button className="ep-btn ep-btn--primary" onClick={() => setEditMode(true)}>
                                    <Edit2 size={15} />
                                    تعديل البيانات
                                </button>
                                <button
                                    className={`ep-btn ${isActive ? 'ep-btn--danger' : 'ep-btn--success'}`}
                                    onClick={() => setStatusModal(true)}
                                >
                                    {isActive ? <PowerOff size={15} /> : <Power size={15} />}
                                    {isActive ? 'إيقاف' : 'تفعيل'}
                                </button>
                                <button className="ep-btn ep-btn--ghost" onClick={() => setMoreMenu(m => !m)}>
                                    <MoreHorizontal size={18} />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </section>


            <div className="ep-stats-row">
                <div className="ep-stat-card">
                    <div className="ep-stat-icon" style={{ background: 'rgba(159,167,255,0.15)', color: '#9fa7ff' }}>
                        <PlaneTakeoff size={20} />
                    </div>
                    <div>
                        <p className="ep-stat-label">رصيد الإجازات</p>
                        <p className="ep-stat-val" style={{ color: '#9fa7ff' }}>
                            {leaveBalance !== null ? leaveBalance : '—'}
                            <span> يوم</span>
                        </p>
                    </div>
                    <div className="ep-stat-pbar">
                        <div className="ep-stat-pfill" style={{ width: `${Math.min(100, (leaveBalance || 0) / 21 * 100)}%`, background: '#9fa7ff' }} />
                    </div>
                </div>

                <div className="ep-stat-card">
                    <div className="ep-stat-icon" style={{ background: 'rgba(193,128,255,0.15)', color: '#c180ff' }}>
                        <Clock size={20} />
                    </div>
                    <div>
                        <p className="ep-stat-label">ساعات هذا الشهر</p>
                        <p className="ep-stat-val" style={{ color: '#c180ff' }}>
                            {monthlyHours !== null ? monthlyHours : '—'}
                            <span> ساعة</span>
                        </p>
                    </div>
                    <div className="ep-stat-pbar">
                        <div className="ep-stat-pfill" style={{ width: `${Math.min(100, (monthlyHours || 0) / 200 * 100)}%`, background: '#c180ff' }} />
                    </div>
                </div>

                <div className="ep-stat-card">
                    <div className="ep-stat-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                        <UserCheck size={20} />
                    </div>
                    <div>
                        <p className="ep-stat-label">حضور هذا الشهر</p>
                        <p className="ep-stat-val" style={{ color: '#10b981' }}>
                            {attendanceStats.present}
                            <span> يوم</span>
                        </p>
                    </div>
                    <div className="ep-stat-chips">
                        {attendanceStats.late > 0 && <span className="ep-chip warning">{attendanceStats.late} تأخير</span>}
                        {attendanceStats.absent > 0 && <span className="ep-chip danger">{attendanceStats.absent} غياب</span>}
                    </div>
                </div>

                <div className="ep-stat-card">
                    <div className="ep-stat-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                        <DollarSign size={20} />
                    </div>
                    <div>
                        <p className="ep-stat-label">الراتب الأساسي</p>
                        <p className="ep-stat-val privacy-blur" style={{ color: '#f59e0b' }}>
                            {formatCurrency(employee.base_salary)}
                        </p>
                    </div>
                    <p className="ep-stat-hint">شهرياً</p>
                </div>
            </div>


            <div className="ep-tabs-bar">
                {[
                    { key: 'basic',        label: 'البيانات الأساسية', icon: Briefcase },
                    { key: 'attendance',   label: 'سجل الحضور',        icon: History },
                    { key: 'loans',        label: 'السلف والقروض',      icon: Banknote },
                    { key: 'documents',    label: 'المستندات',          icon: FolderOpen },
                    { key: 'payroll',      label: 'كشوف الرواتب',       icon: CreditCard },
                ].map(tab => (
                    <button
                        key={tab.key}
                        className={`ep-tab ${activeTab === tab.key ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                TAB 1: BASIC DATA
            ═══════════════════════════════════════════════════════════════ */}
            {activeTab === 'basic' && (
                <div className="ep-tab-content">
                    <div className="ep-two-col">
                        {/* Column 1: Core Info */}
                        <div className="ep-card">
                            <h3 className="ep-card-title"><Shield size={18} /> المعلومات الأساسية</h3>
                            <div className="ep-info-grid">
                                {editMode ? (
                                    <>
                                        <div className="ep-form-row">
                                            <label>الاسم الكامل</label>
                                            <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                                        </div>
                                        <div className="ep-form-row">
                                            <label>المسمى الوظيفي</label>
                                            <input value={editForm.position} onChange={e => setEditForm(f => ({ ...f, position: e.target.value }))} placeholder="مثال: مهندس، محاسب..." />
                                        </div>
                                        <div className="ep-form-row">
                                            <label>نوع العمالة</label>
                                            <select value={editForm.employment_type} onChange={e => setEditForm(f => ({ ...f, employment_type: e.target.value }))}>
                                                <option value="permanent">دائمة</option>
                                                <option value="rotational">دورية</option>
                                            </select>
                                        </div>
                                        <div className="ep-form-row">
                                            <label>رقم الهاتف</label>
                                            <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="05XXXXXXXX" />
                                        </div>
                                        <div className="ep-form-row">
                                            <label>رقم الهوية / الإقامة</label>
                                            <input value={editForm.national_id} onChange={e => setEditForm(f => ({ ...f, national_id: e.target.value }))} />
                                        </div>
                                        <div className="ep-form-row">
                                            <label>الراتب الأساسي</label>
                                            <input type="number" value={editForm.base_salary} onChange={e => setEditForm(f => ({ ...f, base_salary: e.target.value }))} />
                                        </div>
                                        <div className="ep-form-row">
                                            <label>تاريخ التعيين</label>
                                            <input type="date" value={editForm.joining_date} onChange={e => setEditForm(f => ({ ...f, joining_date: e.target.value }))} />
                                        </div>
                                        <div className="ep-form-row">
                                            <label>القسم</label>
                                            <select value={editForm.department_id} onChange={e => setEditForm(f => ({ ...f, department_id: e.target.value }))}>
                                                <option value="">— بدون قسم —</option>
                                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="ep-form-row" style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                                            <input 
                                                id="exclude-weekly-advance"
                                                type="checkbox" 
                                                checked={editForm.exclude_from_weekly_advance || false} 
                                                onChange={e => setEditForm(f => ({ ...f, exclude_from_weekly_advance: e.target.checked }))} 
                                                style={{ width: '18px', height: '18px', accentColor: '#f59e0b', cursor: 'pointer' }}
                                            />
                                            <label htmlFor="exclude-weekly-advance" style={{ margin: 0, cursor: 'pointer', fontWeight: 600 }}>استبعاد من السلف الأسبوعية (يُصرف راتبه كاملاً شهرياً)</label>
                                        </div>
                                        <div className="ep-form-row" style={{ gridColumn: '1/-1' }}>
                                            <label>ملاحظات</label>
                                            <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات خاصة بالموظف..." />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <InfoRow icon={Briefcase}  label="المسمى الوظيفي"    val={employee.position || '—'} />
                                        <InfoRow icon={RefreshCw}  label="نوع العمالة"        val={employee.employment_type === 'rotational' ? 'دورية' : 'دائمة'} highlight={employee.employment_type === 'rotational'} />
                                        <InfoRow icon={Phone}      label="رقم الهاتف"          val={employee.phone || '—'} />
                                        <InfoRow icon={Hash}       label="هوية / إقامة"         val={employee.national_id || '—'} />
                                        <InfoRow icon={Fingerprint} label="رقم البصمة (PIN)"  val={employee.device_pin} mono />
                                        <InfoRow icon={Banknote}   label="الراتب الأساسي"     val={formatCurrency(employee.base_salary)} accent privacy />
                                        <InfoRow icon={CalendarDays} label="تاريخ التعيين"    val={formatDate(employee.joining_date)} />
                                        <InfoRow icon={Building2}  label="القسم"               val={employee.departments?.name || '—'} />
                                        <InfoRow 
                                            icon={Shield} 
                                            label="نظام السلف الأسبوعية" 
                                            val={employee.exclude_from_weekly_advance ? '❌ مستبعد (يُصرف شهرياً بالكامل)' : '✅ مشمول بالمسيرات الأسبوعية'} 
                                            highlight={employee.exclude_from_weekly_advance} 
                                        />
                                        {employee.notes && <InfoRow icon={FileText} label="ملاحظات" val={employee.notes} fullWidth />}
                                        {!isActive && employee.termination_date && (
                                            <InfoRow icon={XCircle} label="تاريخ الإيقاف" val={formatDate(employee.termination_date)} danger />
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Column 2: Leave Summary */}
                        <div className="ep-card">
                            <h3 className="ep-card-title"><PlaneTakeoff size={18} /> سجل الإجازات</h3>
                            {leaves.length === 0 ? (
                                <div className="ep-empty-inner">
                                    <PlaneTakeoff size={32} opacity={0.3} />
                                    <p>لا توجد إجازات مسجلة</p>
                                </div>
                            ) : (
                                <div className="ep-leaves-list">
                                    {leaves.slice(0, 8).map(lv => (
                                        <div key={lv.id} className="ep-leave-item">
                                            <div>
                                                <p className="ep-leave-type">{translateLeaveType(lv.leave_type)}</p>
                                                <p className="ep-leave-dates">{formatDate(lv.start_date)} — {formatDate(lv.end_date)}</p>
                                            </div>
                                            <span className={`ep-leave-badge ep-leave-badge--${lv.status}`}>
                                                {lv.status === 'approved' ? 'مقبولة' : lv.status === 'pending' ? 'معلقة' : 'مرفوضة'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                TAB 2: ATTENDANCE
            ═══════════════════════════════════════════════════════════════ */}
            {activeTab === 'attendance' && (
                <div className="ep-tab-content">
                    <div className="ep-card ep-card--wide">
                        <div className="ep-card-header-row">
                            <h3 className="ep-card-title"><History size={18} /> نبض الحضور - آخر 7 أيام</h3>
                            <span className="ep-card-hint">الأسبوع الحالي</span>
                        </div>

                        {/* Bar Chart */}
                        <div className="ep-chart-wrap">
                            {chartDays.map((day, i) => {
                                const pct = maxHours > 0 ? (day.hours / maxHours) * 100 : 0;
                                const barCls = day.status === 'present' ? 'regular' :
                                               day.status === 'late' ? 'warning' :
                                               day.status === 'absent' ? 'error' : 'empty';
                                return (
                                    <div key={i} className="ep-chart-col">
                                        <div className="ep-chart-val">{day.hours > 0 ? `${day.hours}س` : ''}</div>
                                        <div className={`ep-bar-wrap ${barCls}`} style={{ height: '140px' }}>
                                            <div className={`ep-bar-fill ${barCls}`} style={{ height: `${Math.max(pct, day.status === 'absent' ? 8 : 0)}%` }} />
                                        </div>
                                        <span className="ep-chart-label">{day.label}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Legend */}
                        <div className="ep-legend">
                            {[
                                { cls: 'regular', label: 'حاضر' },
                                { cls: 'warning', label: 'متأخر' },
                                { cls: 'error',   label: 'غائب' },
                                { cls: 'empty',   label: 'لا بيانات' },
                            ].map(l => (
                                <div key={l.cls} className="ep-legend-item">
                                    <span className={`ep-legend-dot ${l.cls}`} />
                                    <span>{l.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Monthly summary */}
                    <div className="ep-att-summary-grid">
                        {[
                            { label: 'أيام الحضور', val: attendanceStats.present, color: '#10b981', icon: CheckCircle2 },
                            { label: 'أيام التأخير', val: attendanceStats.late,   color: '#f59e0b', icon: AlertTriangle },
                            { label: 'أيام الغياب',  val: attendanceStats.absent, color: '#ff6e84', icon: XCircle },
                            { label: 'إجمالي الساعات', val: monthlyHours ? `${monthlyHours}س` : '—', color: '#9fa7ff', icon: Clock },
                        ].map((s, i) => (
                            <div key={i} className="ep-att-mini-card" style={{ borderColor: s.color }}>
                                <s.icon size={20} color={s.color} />
                                <p className="ep-att-mini-val" style={{ color: s.color }}>{s.val}</p>
                                <p className="ep-att-mini-label">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                TAB 3: DOCUMENTS
            ═══════════════════════════════════════════════════════════════ */}
            {activeTab === 'documents' && (
                <div className="ep-tab-content">
                    <div className="ep-docs-header">
                        <h3 className="ep-card-title"><FolderOpen size={18} /> خزنة المستندات الرقمية</h3>
                        <button className="ep-btn ep-btn--primary" onClick={() => setDocModal({ open: true, editing: null })}>
                            <Plus size={16} />
                            إضافة مستند
                        </button>
                    </div>

                    {docsLoading ? (
                        <div className="ep-loading-inner"><div className="ep-spinner-sm" /></div>
                    ) : documents.length === 0 ? (
                        <div className="ep-empty-docs">
                            <FolderOpen size={48} opacity={0.3} />
                            <h4>لا توجد مستندات بعد</h4>
                            <p>أضف مستندات الموظف مثل الإقامة، جواز السفر، عقد العمل...</p>
                            <button className="ep-btn ep-btn--primary" onClick={() => setDocModal({ open: true, editing: null })}>
                                <Upload size={15} />
                                إضافة أول مستند
                            </button>
                        </div>
                    ) : (
                        <div className="ep-docs-grid">
                            {documents.map(doc => {
                                const st = getDocStatus(doc.expiry_date);
                                const cfg = DOC_STATUS_CONFIG[st];
                                const DocIcon = DOC_TYPES.find(t => t.value === doc.doc_type)?.icon || FileText;
                                return (
                                    <div key={doc.id} className={`ep-doc-card ep-doc-card--${st}`}>
                                        <div className="ep-doc-card-top">
                                            <div className="ep-doc-icon" style={{ background: cfg.bg, color: cfg.color }}>
                                                <DocIcon size={22} />
                                            </div>
                                            <span className={`ep-doc-badge ${cfg.badge}`}>{cfg.label}</span>
                                        </div>
                                        <div className="ep-doc-info">
                                            <h4>{doc.doc_name}</h4>
                                            {doc.issue_date && <p>الإصدار: {formatDate(doc.issue_date)}</p>}
                                            {doc.expiry_date && <p>الانتهاء: {formatDate(doc.expiry_date)}</p>}
                                            {doc.notes && <p className="ep-doc-notes">{doc.notes}</p>}
                                        </div>
                                        <div className="ep-doc-actions">
                                            {doc.file_url && (
                                                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="ep-doc-btn">
                                                    <Eye size={14} /> عرض
                                                </a>
                                            )}
                                            <button className="ep-doc-btn" onClick={() => setDocModal({ open: true, editing: doc })}>
                                                <Edit2 size={14} /> تعديل
                                            </button>
                                            <button className="ep-doc-btn danger" onClick={() => handleDeleteDoc(doc.id)}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                TAB 4: PAYROLL HISTORY
            ═══════════════════════════════════════════════════════════════ */}
            {activeTab === 'payroll' && (
                <div className="ep-tab-content">
                    <div className="ep-card ep-card--wide">
                        <h3 className="ep-card-title"><CreditCard size={18} /> سجل الرواتب</h3>
                        {payrollLoading ? (
                            <div className="ep-loading-inner"><div className="ep-spinner-sm" /></div>
                        ) : payrolls.length === 0 ? (
                            <div className="ep-empty-inner">
                                <CreditCard size={36} opacity={0.3} />
                                <p>لا توجد كشوفات راتب مسجلة لهذا الموظف</p>
                            </div>
                        ) : (
                            <div className="ep-payroll-table-wrap">
                                <table className="ep-payroll-table">
                                    <thead>
                                        <tr>
                                            <th>الفترة</th>
                                            <th>الراتب الأساسي</th>
                                            <th>ساعات إضافية</th>
                                            <th>الخصومات</th>
                                            <th>الصافي</th>
                                            <th>الحالة</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payrolls.map(pay => (
                                            <tr key={pay.id} className="ep-payroll-row">
                                                <td>
                                                    <p className="ep-pay-period">{formatDate(pay.start_date)} — {formatDate(pay.end_date)}</p>
                                                </td>
                                                <td>{formatCurrency(pay.base_salary)}</td>
                                                <td>{pay.overtime_hours ? `${pay.overtime_hours}س` : '—'}</td>
                                                <td className="ep-deduction">{pay.deductions ? formatCurrency(pay.deductions) : '—'}</td>
                                                <td className="ep-net-salary">{formatCurrency(pay.net_salary)}</td>
                                                <td>
                                                    <span className={`ep-pay-status ep-pay-status--${pay.status || 'pending'}`}>
                                                        {pay.status === 'paid' ? 'مدفوع' : pay.status === 'processing' ? 'جاري' : 'معلق'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button className="ep-pay-download" title="تحميل كشف الراتب" onClick={() => navigate(`/salary-slip/${pay.id}`)}>
                                                        <ExternalLink size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                TAB 5: LOANS/ADVANCES HISTORY
            ═══════════════════════════════════════════════════════════════ */}
            {activeTab === 'loans' && (() => {
                const activeLoans = loans.filter(l => l.status === 'active' || l.status === 'approved');
                const totalLoansVal = activeLoans.reduce((sum, l) => sum + (parseFloat(l.total_amount) || 0), 0);
                const remainingLoansVal = activeLoans.reduce((sum, l) => sum + (parseFloat(l.remaining_amount) || 0), 0);
                const paidLoansVal = totalLoansVal - remainingLoansVal;
                const monthlyInstallmentVal = activeLoans.reduce((sum, l) => sum + (parseFloat(l.monthly_installment) || 0), 0);

                return (
                    <div className="ep-tab-content">
                        {/* Loans stats */}
                        <div className="ep-stats-row">
                            <div className="ep-stat-card">
                                <div className="ep-stat-icon" style={{ background: 'rgba(255,110,132,0.15)', color: '#ff6e84' }}>
                                    <Banknote size={20} />
                                </div>
                                <div>
                                    <p className="ep-stat-label">المتبقي من السلف</p>
                                    <p className="ep-stat-val" style={{ color: '#ff6e84' }}>
                                        {formatCurrency(remainingLoansVal)}
                                    </p>
                                </div>
                                <p className="ep-stat-hint">قيد السداد</p>
                            </div>

                            <div className="ep-stat-card">
                                <div className="ep-stat-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                                    <FileCheck size={20} />
                                </div>
                                <div>
                                    <p className="ep-stat-label">المبلغ المسدد</p>
                                    <p className="ep-stat-val" style={{ color: '#10b981' }}>
                                        {formatCurrency(paidLoansVal)}
                                    </p>
                                </div>
                                <p className="ep-stat-hint">تم دفعه</p>
                            </div>

                            <div className="ep-stat-card">
                                <div className="ep-stat-icon" style={{ background: 'rgba(159,167,255,0.15)', color: '#9fa7ff' }}>
                                    <DollarSign size={20} />
                                </div>
                                <div>
                                    <p className="ep-stat-label">القسط الشهري الإجمالي</p>
                                    <p className="ep-stat-val" style={{ color: '#9fa7ff' }}>
                                        {formatCurrency(monthlyInstallmentVal)}
                                    </p>
                                </div>
                                <p className="ep-stat-hint">يخصم شهرياً من الراتب</p>
                            </div>

                            <div className="ep-stat-card">
                                <div className="ep-stat-icon" style={{ background: 'rgba(193,128,255,0.15)', color: '#c180ff' }}>
                                    <Users size={20} />
                                </div>
                                <div>
                                    <p className="ep-stat-label">السلف النشطة</p>
                                    <p className="ep-stat-val" style={{ color: '#c180ff' }}>
                                        {activeLoans.length}
                                        <span> سلفة</span>
                                    </p>
                                </div>
                                <p className="ep-stat-hint">نشطة الآن</p>
                            </div>
                        </div>

                        <div className="ep-card ep-card--wide">
                            <h3 className="ep-card-title"><Banknote size={18} /> تفاصيل السلف والقروض</h3>
                            {loansLoading ? (
                                <div className="ep-loading-inner"><div className="ep-spinner-sm" /></div>
                            ) : loans.length === 0 ? (
                                <div className="ep-empty-inner">
                                    <Banknote size={36} opacity={0.3} />
                                    <p>لا توجد سلف أو قروض مسجلة لهذا الموظف</p>
                                </div>
                            ) : (
                                <div className="ep-payroll-table-wrap">
                                    <table className="ep-payroll-table">
                                        <thead>
                                            <tr>
                                                <th>تاريخ الطلب</th>
                                                <th>المبلغ الإجمالي</th>
                                                <th>القسط الشهري</th>
                                                <th>مدة السداد</th>
                                                <th>المبلغ المتبقي</th>
                                                <th>نوع السلفة</th>
                                                <th>الحالة</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loans.map(loan => (
                                                <tr key={loan.id} className="ep-payroll-row">
                                                    <td>
                                                        <p className="ep-pay-period">{formatDate(loan.created_at)}</p>
                                                    </td>
                                                    <td>{formatCurrency(loan.total_amount)}</td>
                                                    <td>{formatCurrency(loan.monthly_installment)}</td>
                                                    <td>{loan.repayment_months ? `${loan.repayment_months} شهر` : '—'}</td>
                                                    <td style={{ fontWeight: '700', color: parseFloat(loan.remaining_amount) > 0 ? '#ff6e84' : '#10b981' }}>
                                                        {formatCurrency(loan.remaining_amount)}
                                                    </td>
                                                    <td>
                                                        <span className={`ep-type-pill ${loan.is_fixed ? 'rotational' : ''}`} style={{ borderColor: loan.is_fixed ? 'rgba(245,158,11,0.3)' : 'rgba(159,167,255,0.3)', color: loan.is_fixed ? '#f59e0b' : '#9fa7ff', background: loan.is_fixed ? 'rgba(245,158,11,0.05)' : 'rgba(159,167,255,0.05)' }}>
                                                            {loan.is_fixed ? 'ثابتة' : 'مرنة'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`ep-leave-badge ep-leave-badge--${loan.status === 'active' || loan.status === 'approved' ? 'approved' : loan.status === 'pending' ? 'pending' : 'rejected'}`}>
                                                            {loan.status === 'active' ? 'نشطة' : loan.status === 'approved' ? 'موافقة' : loan.status === 'paid' ? 'مسددة بالكامل' : loan.status === 'pending' ? 'معلقة' : 'مرفوضة'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}


            <DocumentModal
                isOpen={docModal.open}
                onClose={() => setDocModal({ open: false, editing: null })}
                onSaved={() => { fetchDocuments(); setDocModal({ open: false, editing: null }); }}
                editingDoc={docModal.editing}
                employeeId={id}
                companyId={company?.id}
            />

            <StatusModal
                isOpen={statusModal}
                onClose={() => setStatusModal(false)}
                onConfirm={handleToggleStatus}
                employee={employee}
            />
        </div>
    );
}

// -------------------------------------------------------------------------
function InfoRow({ icon: Icon, label, val, accent, highlight, mono, danger, fullWidth, privacy }) {
    return (
        <div className={`ep-info-row ${fullWidth ? 'full-width' : ''}`}>
            <div className="ep-info-row-label">
                <Icon size={15} />
                <span>{label}</span>
            </div>
            <p className={`ep-info-row-val ${accent ? 'accent' : ''} ${highlight ? 'highlight' : ''} ${mono ? 'mono' : ''} ${danger ? 'danger' : ''} ${privacy ? 'privacy-blur' : ''}`}>
                {val}
            </p>
        </div>
    );
}
