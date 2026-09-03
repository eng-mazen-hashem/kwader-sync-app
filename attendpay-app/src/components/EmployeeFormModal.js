import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
    User, Phone, Hash, DollarSign, 
    Calendar, Landmark, X, Save, Navigation 
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';
import { logAudit } from '../utils/auditLogger';
import { motion, AnimatePresence } from 'motion/react';

export default function EmployeeFormModal({ isOpen, onClose, onSaved, editingEmployee, departments }) {
    const { company } = useAuth();
    const { t, currencySymbol, currency, language } = useLocale();
    const [logChoice, setLogChoice] = useState({ isOpen: false, pin: '', payload: null, loading: false });

    const employeeSchema = useMemo(() => z.object({
        name: z.string().min(3, { message: t.errNameMinLength || 'الاسم يجب أن يكون 3 أحرف على الأقل' }),
        phone: z.string().optional().or(z.literal('')),
        device_pin: z.string().min(1, { message: t.errRequired || 'مطلوب إدخال رقم البصمة' }),
        base_salary: z.coerce.number({ invalid_type_error: t.errInvalidValue || 'يجب إدخال رقم صالح' }).min(0, { message: t.errInvalidValue || 'يجب إدخال رقم صالح' }),
        joining_date: z.string().optional().or(z.literal('')),
        department_id: z.string().optional().or(z.literal('')),
        allow_gps_punch: z.boolean().default(false),
        exclude_from_weekly_advance: z.boolean().default(false)
    }), [t]);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting }
    } = useForm({
        resolver: zodResolver(employeeSchema),
        defaultValues: {
            name: '',
            phone: '',
            device_pin: '',
            base_salary: '',
            joining_date: '',
            department_id: '',
            allow_gps_punch: false,
            exclude_from_weekly_advance: false
        }
    });

    useEffect(() => {
        if (isOpen && editingEmployee) {
            reset({
                name: editingEmployee.name || '',
                phone: editingEmployee.phone || '',
                device_pin: editingEmployee.device_pin || '',
                base_salary: editingEmployee.base_salary || 0,
                joining_date: editingEmployee.joining_date || '',
                department_id: editingEmployee.department_id || '',
                allow_gps_punch: editingEmployee.allow_gps_punch || false,
                exclude_from_weekly_advance: editingEmployee.exclude_from_weekly_advance || false
            });
        } else if (isOpen) {
            reset({ name: '', phone: '', device_pin: '', base_salary: '', joining_date: '', department_id: '', allow_gps_punch: false, exclude_from_weekly_advance: false });
        }
    }, [isOpen, editingEmployee, reset]);

    const saveEmployeeAndLogAudit = async (payload) => {
        let empId = editingEmployee?.id;
        if (editingEmployee) {
            const { error } = await supabase
                .from('employees')
                .update(payload)
                .eq('id', editingEmployee.id)
                .eq('company_id', company.id);

            if (error) throw error;
            toast.success(t.msgEmployeeUpdated);
            
            const user = await supabase.auth.getUser();
            await logAudit({
                companyId: company.id,
                userId: user.data.user?.id,
                action: 'UPDATE_EMPLOYEE',
                tableName: 'employees',
                recordId: editingEmployee.id,
                oldData: editingEmployee,
                newData: payload,
            });
        } else {
            const { error, data: newRec } = await supabase
                .from('employees')
                .insert({
                    company_id: company.id,
                    ...payload
                })
                .select('id')
                .single();

            if (error) throw error;
            empId = newRec?.id;
            toast.success(t.msgEmployeeAdded);

            const user = await supabase.auth.getUser();
            await logAudit({
                companyId: company.id,
                userId: user.data.user?.id,
                action: 'ADD_EMPLOYEE',
                tableName: 'employees',
                recordId: newRec?.id,
                oldData: null,
                newData: payload,
            });
        }
        return empId;
    };

    const handleResolveLogChoice = async (choice) => {
        if (!company || !logChoice.payload) return;
        setLogChoice(prev => ({ ...prev, loading: true }));
        try {
            const { pin, payload } = logChoice;

            if (choice === 'delete') {
                const { error: delError } = await supabase
                    .from('raw_attendance_logs')
                    .delete()
                    .eq('company_id', company.id)
                    .eq('user_pin', pin);
                if (delError) throw delError;
                
                toast.success(language === 'ar' ? 'تم حذف السجلات القديمة بنجاح' : 'Old logs deleted successfully');
            }

            const empId = await saveEmployeeAndLogAudit(payload);

            if (choice === 'keep') {
                const { error: touchError } = await supabase
                    .from('raw_attendance_logs')
                    .update({ is_processed: false })
                    .eq('company_id', company.id)
                    .eq('user_pin', pin);
                if (touchError) throw touchError;
                
                toast.success(language === 'ar' ? 'تم ربط البصمات وإعادة معالجتها للموظف الجديد بنجاح' : 'Logs linked and reprocessed successfully');
            }

            setLogChoice({ isOpen: false, pin: '', payload: null, loading: false });
            onSaved();
            onClose();
        } catch (err) {
            console.error('[EmployeeFormModal] handleResolveLogChoice:', err.message);
            toast.error(language === 'ar' ? 'حدث خطأ أثناء معالجة القرار' : 'Error resolving decision');
        } finally {
            setLogChoice(prev => ({ ...prev, loading: false }));
        }
    };

    const onSubmit = async (data) => {
        if (!company) return;
        try {
            const payload = {
                name: data.name,
                phone: data.phone || null,
                device_pin: data.device_pin,
                base_salary: data.base_salary,
                joining_date: data.joining_date || null,
                department_id: data.department_id || null,
                allow_gps_punch: data.allow_gps_punch,
                exclude_from_weekly_advance: data.exclude_from_weekly_advance,
            };

            const pinChanged = !editingEmployee || editingEmployee.device_pin !== data.device_pin;
            if (pinChanged) {
                const { data: logsExist, error: logsError } = await supabase
                    .from('raw_attendance_logs')
                    .select('id')
                    .eq('company_id', company.id)
                    .eq('user_pin', data.device_pin)
                    .limit(1);

                if (!logsError && logsExist && logsExist.length > 0) {
                    setLogChoice({
                        isOpen: true,
                        pin: data.device_pin,
                        payload: payload,
                        loading: false
                    });
                    return;
                }
            }

            await saveEmployeeAndLogAudit(payload);
            onSaved();
            onClose();
        } catch (err) {
            console.error('[EmployeeFormModal] onSubmit:', err.message);
            toast.error(editingEmployee ? t.errorUpdateEmployee : t.errorAddEmployee);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="emp-modal-overlay" onClick={onClose}>
                    <motion.div 
                        className="emp-modal-card" 
                        onClick={(e) => e.stopPropagation()}
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                        <div className="emp-modal-accent" />
                        
                        <div className="emp-modal-header">
                            <div className="emp-modal-title-group">
                                <h3 className="emp-modal-title">
                                    {editingEmployee ? t.editEmployeeModalTitle : t.addEmployeeModalTitle}
                                </h3>
                                <p className="emp-modal-subtitle">
                                    {editingEmployee ? 'تعديل بيانات الموظف الحالي' : 'إضافة عضو جديد إلى فريق العمل'}
                                </p>
                            </div>
                            <button className="emp-modal-close" onClick={onClose} aria-label="Close">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="emp-modal-body">
                            {/* Name Field */}
                            <div className="emp-form-group">
                                <label className="emp-label">
                                    <User size={14} />
                                    {t.employeeNameLabel}
                                    <span style={{ color: '#ef4444', marginInlineStart: 4 }}>*</span>
                                </label>
                                <div className="emp-input-wrapper">
                                    <User className="emp-input-icon" size={16} />
                                    <input
                                        className={`emp-input ${errors.name ? 'error' : ''}`}
                                        type="text"
                                        placeholder={t.employeeNamePlaceholder}
                                        {...register('name')}
                                    />
                                </div>
                                {errors.name && <span className="emp-error-text">{errors.name.message}</span>}
                            </div>

                            {/* Phone Field */}
                            <div className="emp-form-group">
                                <label className="emp-label">
                                    <Phone size={14} />
                                    {t.phoneNumberLabel}
                                </label>
                                <div className="emp-input-wrapper">
                                    <Phone className="emp-input-icon" size={16} />
                                    <input
                                        className="emp-input"
                                        type="text"
                                        placeholder="05XXXXXXXX"
                                        {...register('phone')}
                                    />
                                </div>
                            </div>

                            {/* PIN & Salary Grid */}
                            <div className="emp-form-grid">
                                <div className="emp-form-group">
                                    <label className="emp-label">
                                        <Hash size={14} />
                                        {t.fingerprintPinLabel}
                                        <span style={{ color: '#ef4444', marginInlineStart: 4 }}>*</span>
                                    </label>
                                    <div className="emp-input-wrapper">
                                        <Hash className="emp-input-icon" size={16} />
                                        <input
                                            className={`emp-input ${errors.device_pin ? 'error' : ''}`}
                                            type="tel"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            placeholder="001"
                                            {...register('device_pin')}
                                            onInput={(e) => {
                                                e.target.value = e.target.value.replace(/[^0-9]/g, '');
                                            }}
                                        />
                                    </div>
                                    {errors.device_pin && <span className="emp-error-text">{errors.device_pin.message}</span>}
                                </div>

                                <div className="emp-form-group">
                                    <label className="emp-label">
                                        <span className="emp-currency-tag" style={{ color: '#8b5cf6', fontWeight: 600 }}>({currencySymbol})</span>
                                        {t.baseSalaryLabel}
                                    </label>
                                    <div className="emp-input-wrapper">
                                        <span className="emp-input-currency-addon" style={{
                                            position: 'absolute',
                                            insetInlineStart: '12px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            color: 'var(--text-muted)',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            pointerEvents: 'none'
                                        }}>{currency || 'SAR'}</span>
                                        <input
                                            className={`emp-input ${errors.base_salary ? 'error' : ''}`}
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            {...register('base_salary')}
                                            style={{ paddingInlineStart: '46px' }}
                                        />
                                    </div>
                                    {errors.base_salary && <span className="emp-error-text">{errors.base_salary.message}</span>}
                                </div>
                            </div>

                            {/* Date & Department Grid */}
                            <div className="emp-form-grid">
                                <div className="emp-form-group">
                                    <label className="emp-label">
                                        <Calendar size={14} />
                                        {t.joiningDateLabel}
                                    </label>
                                    <div className="emp-input-wrapper">
                                        <Calendar className="emp-input-icon" size={16} />
                                        <input
                                            className="emp-input"
                                            type="date"
                                            {...register('joining_date')}
                                        />
                                    </div>
                                </div>

                                <div className="emp-form-group">
                                    <label className="emp-label">
                                        <Landmark size={14} />
                                        {t.departmentLabel}
                                    </label>
                                    <div className="emp-input-wrapper">
                                        <Landmark className="emp-input-icon" size={16} />
                                        <select className="emp-input" {...register('department_id')}>
                                            <option value="">{t.noDepartment}</option>
                                            {departments.map((dep) => (
                                                <option key={dep.id} value={dep.id}>{dep.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* GPS Punch Toggle */}
                            <div className="emp-form-group mt-4" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                                <label className="emp-label" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                                    <input 
                                        type="checkbox" 
                                        {...register('allow_gps_punch')} 
                                        style={{ width: '18px', height: '18px', accentColor: '#6366f1' }}
                                    />
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e2e8f0' }}>
                                        <Navigation size={16} className="text-indigo-400" />
                                        السماح بالبصمة عبر الموقع (GPS)
                                    </span>
                                </label>
                                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 26px' }}>
                                    تفعيل هذا الخيار سيسمح للموظف بتسجيل الحضور والانصراف من خلال تطبيق الموظفين باستخدام موقعه الجغرافي.
                                </p>
                            </div>

                            {/* Weekly Advance Exclusion Toggle */}
                            <div className="emp-form-group mt-2" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                <label className="emp-label" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                                    <input 
                                        type="checkbox" 
                                        {...register('exclude_from_weekly_advance')} 
                                        style={{ width: '18px', height: '18px', accentColor: '#f59e0b' }}
                                    />
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e2e8f0' }}>
                                        <Landmark size={16} style={{ color: '#f59e0b' }} />
                                        {language === 'ar' ? 'استبعاد من السلف الأسبوعية' : 'Exclude from Weekly Advances'}
                                    </span>
                                </label>
                                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 26px' }}>
                                    {language === 'ar' 
                                        ? 'تفعيل هذا الخيار سيمنع دفع أي سلفة للموظف خلال المسيرات الأسبوعية، وسيتم تسليمه راتبه كاملاً بنهاية الشهر.'
                                        : 'Enabling this prevents paying advances weekly; they will receive their full monthly salary at month-end.'}
                                </p>
                            </div>
                        </form>

                        <div className="emp-modal-footer">
                            <button type="button" className="emp-btn-cancel" onClick={onClose} disabled={isSubmitting}>
                                {t.cancelBtn}
                            </button>
                            <button 
                                type="button" 
                                className="emp-btn-save" 
                                disabled={isSubmitting}
                                onClick={handleSubmit(onSubmit)}
                            >
                                {isSubmitting ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span className="sh-spinner-small" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'sh-spin 0.6s linear infinite' }} />
                                        {t.loading}
                                    </span>
                                ) : (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Save size={16} />
                                        {editingEmployee ? t.saveChangesBtn : t.saveEmployeeBtn}
                                    </span>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
            {logChoice.isOpen && (
                <div className="emp-modal-overlay" style={{ zIndex: 1100 }} onClick={() => setLogChoice({ isOpen: false, pin: '', payload: null, loading: false })}>
                    <motion.div 
                        className="emp-modal-card"
                        onClick={(e) => e.stopPropagation()}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        style={{ maxWidth: '480px', border: '1px solid rgba(239, 68, 68, 0.2)', position: 'relative' }}
                    >
                        <div className="emp-modal-accent" style={{ background: 'linear-gradient(90deg, #f59e0b, #ef4444)' }} />
                        <div className="emp-modal-header">
                            <div className="emp-modal-title-group">
                                <h3 className="emp-modal-title" style={{ color: '#f87171' }}>
                                    {language === 'ar' ? 'تنبيه: سجلات بصمة قديمة' : 'Warning: Existing Attendance Logs'}
                                </h3>
                                <p className="emp-modal-subtitle">
                                    {language === 'ar' ? `رقم البصمة (${logChoice.pin}) يحتوي على سجلات حضور وانصراف سابقة` : `Fingerprint PIN (${logChoice.pin}) has existing attendance logs`}
                                </p>
                            </div>
                        </div>
                        <div className="emp-modal-body" style={{ padding: '20px', color: '#e2e8f0', fontSize: '0.9rem', lineHeight: '1.6' }}>
                            <p style={{ marginBottom: '16px' }}>
                                {language === 'ar' 
                                    ? 'تم العثور على سجلات بصمة خام قديمة مرتبطة بهذا الرقم في قاعدة البيانات. يرجى اختيار الإجراء المناسب للموظف الجديد:'
                                    : 'Existing raw attendance logs were found for this PIN. Please select the action for the new employee:'}
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => handleResolveLogChoice('delete')}
                                    disabled={logChoice.loading}
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.08)',
                                        border: '1px solid rgba(239, 68, 68, 0.2)',
                                        borderRadius: '12px',
                                        padding: '12px 16px',
                                        color: '#f87171',
                                        textAlign: 'right',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '4px'
                                    }}
                                    className="emp-choice-btn"
                                >
                                    <span style={{ fontWeight: 700 }}>{language === 'ar' ? '🗑️ حذف البصمات القديمة' : '🗑️ Delete Old Logs'}</span>
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                        {language === 'ar' ? 'سيتم مسح كافة سجلات الحضور والانصراف السابقة نهائياً والبدء بسجل نظيف.' : 'Permanently erase all historical attendance logs and start fresh.'}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleResolveLogChoice('keep')}
                                    disabled={logChoice.loading}
                                    style={{
                                        background: 'rgba(99, 102, 241, 0.08)',
                                        border: '1px solid rgba(99, 102, 241, 0.2)',
                                        borderRadius: '12px',
                                        padding: '12px 16px',
                                        color: '#818cf8',
                                        textAlign: 'right',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '4px'
                                    }}
                                    className="emp-choice-btn"
                                >
                                    <span style={{ fontWeight: 700 }}>{language === 'ar' ? '🔄 استعادة وربط السجلات بالموظف الجديد' : '🔄 Keep & Link Existing Logs'}</span>
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                        {language === 'ar' ? 'سيتم الاحتفاظ بالبصمات القديمة وربطها بالموظف الحالي وإعادة احتسابها له.' : 'Keep old logs, link them to the new employee, and recalculate.'}
                                    </span>
                                </button>
                            </div>
                        </div>
                        <div className="emp-modal-footer">
                            <button
                                type="button"
                                className="emp-btn-cancel"
                                onClick={() => setLogChoice({ isOpen: false, pin: '', payload: null, loading: false })}
                                disabled={logChoice.loading}
                            >
                                {t.cancelBtn}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
