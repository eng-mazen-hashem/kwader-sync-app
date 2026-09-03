import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    Plus, Clock, Users, Layers,
    RefreshCcw, Search, Edit2, Trash2, X, Check,
    Moon, Sun, AlertTriangle, Calendar, ChevronLeft,
    LayoutGrid, Activity, TableProperties
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';
import { logAudit } from '../utils/auditLogger';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import ConfirmModal from '../components/ConfirmModal';
import './Shifts.css';

// -------------------------------------------------------------------------
const ALL_DAYS = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
const ALL_DAYS_SHORT = ['سبت', 'أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع'];

const translateDay = (day, lang) => {
    const map = {
        'السبت': lang === 'en' ? 'Saturday' : 'السبت',
        'الأحد': lang === 'en' ? 'Sunday' : 'الأحد',
        'الإثنين': lang === 'en' ? 'Monday' : 'الإثنين',
        'الثلاثاء': lang === 'en' ? 'Tuesday' : 'الثلاثاء',
        'الأربعاء': lang === 'en' ? 'Wednesday' : 'الأربعاء',
        'الخميس': lang === 'en' ? 'Thursday' : 'الخميس',
        'الجمعة': lang === 'en' ? 'Friday' : 'الجمعة',
    };
    return map[day] || day;
};

const translateDayShort = (day, lang) => {
    const map = {
        'السبت': lang === 'en' ? 'Sat' : 'سبت',
        'الأحد': lang === 'en' ? 'Sun' : 'أحد',
        'الإثنين': lang === 'en' ? 'Mon' : 'إثن',
        'الثلاثاء': lang === 'en' ? 'Tue' : 'ثلا',
        'الأربعاء': lang === 'en' ? 'Wed' : 'أرب',
        'الخميس': lang === 'en' ? 'Thu' : 'خمي',
        'الجمعة': lang === 'en' ? 'Fri' : 'جمع',
    };
    return map[day] || day;
};

const SHIFT_COLORS = [
    '#818cf8', '#a855f7', '#ec4899', '#10b981',
    '#3b82f6', '#f59e0b', '#ef4444', '#06b6d4',
];

const getBreakPolicies = (t) => [
    {
        value: 'ignore_temp',
        label: t.sh_ignore_temp_label || 'تجاهل الخروج المؤقت',
        desc: t.sh_ignore_temp_desc || 'أول دخول + آخر خروج — الأبسط والأكثر استخداماً',
        icon: '⏩',
        color: '#818cf8',
    },
    {
        value: 'deduct_actual',
        label: t.sh_deduct_actual_label || 'خصم الغياب الفعلي',
        desc: t.sh_deduct_actual_desc || 'مجموع كل الجلسات الحقيقية — الأدق للحساب الفعلي',
        icon: '🎯',
        color: '#10b981',
    },
    {
        value: 'early_leave',
        label: t.sh_early_leave_label || 'خروج = انصراف مبكر',
        desc: t.sh_early_leave_desc || 'أي خروج خارج نافذة الاستراحة يُعدّ انصرافاً مبكراً',
        icon: '🚪',
        color: '#f59e0b',
    },
];

const EMPTY_SHIFT = {
    name: '', color: '#818cf8',
    shift_type: 'fixed', target_hours: 8,
    start_time: '08:00', end_time: '16:00',
    work_days: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
    has_break: false, break_start: '12:00', break_duration: 30,
    break_policy: 'ignore_temp',
    overtime_rate: 1.5, grace_minutes: 5, is_active: true,
    deduct_half_on_missing: false,
};

// -------------------------------------------------------------------------
const calcHours = (start, end) => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60;
    return (mins / 60).toFixed(1);
};

const fmtTime = (t, lang = 'ar') => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 
        ? (lang === 'en' ? 'PM' : 'م') 
        : (lang === 'en' ? 'AM' : 'ص');
    const hh = h % 12 || 12;
    return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
};

// -------------------------------------------------------------------------
function PolicySelector({ value, onChange, shiftColor, t }) {
    const breakPolicies = getBreakPolicies(t);
    return (
        <div className="sh-policy-container">
            <label className="sh-label">
                🔧 {t.sh_policy_label || 'سياسة حساب البصمات المتعددة'}
            </label>
            <div className="sh-policy-grid">
                {breakPolicies.map(p => {
                    const isActive = value === p.value;
                    const cColor = shiftColor || p.color;
                    return (
                        <div
                            key={p.value}
                            onClick={() => onChange(p.value)}
                            className={`sh-policy-item ${isActive ? 'active' : ''}`}
                            style={{ '--active-color': cColor }}
                        >
                            <span className="sh-policy-icon">{p.icon}</span>
                            <div className="sh-policy-content">
                                <div className="sh-policy-label">{p.label}</div>
                                <div className="sh-policy-desc">{p.desc}</div>
                            </div>
                            <div className={`sh-policy-check ${isActive ? 'active' : ''}`} style={{ 
                                backgroundColor: isActive ? cColor : 'transparent',
                                borderColor: isActive ? cColor : 'rgba(255,255,255,0.1)'
                            }}>
                                {isActive && <Check size={12} />}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// -------------------------------------------------------------------------
function PolicyExplainer({ policy, t }) {
    const explanations = {
        ignore_temp: {
            result: t.sh_ignore_temp_result || 'مثال: 08:00 ← 17:00 (دخول/خروج) = 9 ساعات',
            note: t.sh_ignore_temp_note || 'يُحسب الوقت بين أول بصمة دخول وآخر بصمة خروج، ويتم خصم مدة الاستراحة المحددة تلقائياً.',
            color: '#818cf8',
        },
        deduct_actual: {
            result: t.sh_deduct_actual_result || 'مثال: (08-12) + (13-17) = 8 ساعات فعلية',
            note: t.sh_deduct_actual_note || 'يتم حساب الوقت الفعلي الذي قضاه الموظف داخل المؤسسة بين كل دخول وخروج.',
            color: '#10b981',
        },
        early_leave: {
            result: t.sh_early_leave_result || 'خروج الموظف قبل موعده = انصراف مبكر',
            note: t.sh_early_leave_note || 'أي بصمة خروج تتم خارج وقت الاستراحة الرسمي تُعتبر نهاية يوم العمل لهذا الموظف.',
            color: '#f59e0b',
        },
    };
    const exp = explanations[policy] || explanations.ignore_temp;

    return (
        <div className="sh-policy-explainer" style={{ '--exp-color': exp.color }}>
            <div className="sh-explainer-result">{exp.result}</div>
            <div className="sh-explainer-note">{exp.note}</div>
        </div>
    );
}

// -------------------------------------------------------------------------
function ShiftModal({ shift, onClose, onSave }) {
    const { t, language } = useLocale();

    const shiftSchema = useMemo(() => z.object({
        name: z.string().min(1, t.sh_err_name || 'يرجى إدخال اسم الوردية'),
        color: z.string(),
        shift_type: z.enum(['fixed', 'flexible']).default('fixed'),
        target_hours: z.coerce.number().min(1, t.sh_err_hours || 'يجب أن يكون ساعة واحدة على الأقل').optional(),
        start_time: z.string(),
        end_time: z.string(),
        work_days: z.array(z.string()).min(1, t.sh_err_days || 'يرجى اختيار يوم عمل واحد على الأقل'),
        has_break: z.boolean(),
        break_start: z.string(),
        break_duration: z.coerce.number().optional(),
        break_policy: z.string(),
        grace_minutes: z.coerce.number().min(0).max(60),
        overtime_rate: z.coerce.number().min(1).max(3),
        is_active: z.boolean(),
        deduct_half_on_missing: z.boolean().default(false),
    }).superRefine((data, ctx) => {
        if (data.has_break && !data.break_duration) {
            ctx.addIssue({
                path: ['break_duration'],
                code: z.ZodIssueCode.custom,
                message: t.sh_err_break || 'يرجى تحديد مدة الاستراحة',
            });
        }
    }), [t]);

    const { register, handleSubmit, watch, setValue, formState: { isSubmitting, errors } } = useForm({
        resolver: zodResolver(shiftSchema),
        defaultValues: shift ? { ...EMPTY_SHIFT, ...shift } : { ...EMPTY_SHIFT },
    });

    const formValues = watch();
    const totalHours = formValues.shift_type === 'flexible' 
        ? Number(formValues.target_hours || 0).toFixed(1)
        : calcHours(formValues.start_time, formValues.end_time);
    const netHours = formValues.shift_type === 'flexible'
        ? totalHours
        : (formValues.has_break && formValues.break_duration
            ? (totalHours - formValues.break_duration / 60).toFixed(1)
            : totalHours);

    const toggleDay = (day) => {
        const current = formValues.work_days || [];
        const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
        setValue('work_days', next, { shouldValidate: true });
    };

    // Determine if shift spans overnight
    const isOvernight = formValues.start_time > formValues.end_time;

    return (
        <div className="sh-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="sh-form-card" style={{ '--modal-accent': formValues.color }}>
                {/* Colored top accent bar */}
                <div className="sh-modal-accent-bar" style={{ background: formValues.color }} />
                
                <header className="sh-modal-header">
                    <div className="sh-modal-title-group">
                        <div className="sh-modal-icon" style={{ background: `${formValues.color}22`, color: formValues.color }}>
                            <Clock size={22} />
                        </div>
                        <div>
                            <h2 className="sh-modal-title">{shift ? (t.sh_update_title || 'تحديث الوردية') : (t.sh_new_title || 'وردية جديدة')}</h2>
                            <p className="sh-modal-subtitle">{t.sh_modal_subtitle || 'إعدادات الوقت المتقدمة وسياسات الحضور'}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="sh-btn-close"><X size={18} /></button>
                </header>

                <form onSubmit={handleSubmit(onSave)} className="sh-form-body">
                    {/* Name + Color */}
                    <div className="sh-form-row">
                        <div style={{ flex: 1 }}>
                            <label className="sh-label">{t.sh_name_label || 'الاسم التعريفي'}</label>
                            <input className={`sh-input ${errors.name ? 'error' : ''}`} placeholder={t.sh_name_placeholder || "مثل: وردية الصباح"} {...register('name')} />
                            {errors.name && <span className="sh-field-error">{errors.name.message}</span>}
                        </div>
                        <div>
                            <label className="sh-label">{t.sh_color_label || 'اللون'}</label>
                            <div className="sh-color-picker">
                                {SHIFT_COLORS.map(c => (
                                    <button type="button" key={c} onClick={() => setValue('color', c)} 
                                        className={`sh-color-option ${formValues.color === c ? 'active' : ''}`}
                                        style={{ background: c, '--choice-color': c }} />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Shift Type */}
                    <div className="sh-form-row">
                        <div style={{ flex: 1 }}>
                            <label className="sh-label">{t.sh_system_label || 'نظام الوردية'}</label>
                            <div className="sh-radio-group" style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                                    <input type="radio" value="fixed" {...register('shift_type')} style={{ accentColor: formValues.color }} />
                                    <span>{t.sh_fixed_option || 'ثابتة (أوقات محددة)'}</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                                    <input type="radio" value="flexible" {...register('shift_type')} style={{ accentColor: formValues.color }} />
                                    <span>{t.sh_flexible_option || 'مرنة (بالساعات)'}</span>
                                </label>
                            </div>
                        </div>
                        {formValues.shift_type === 'flexible' && (
                            <div style={{ flex: 1 }}>
                                <label className="sh-label">{t.sh_target_hours || 'الساعات المستهدفة (يومياً)'}</label>
                                <div className="sh-input-wrapper">
                                    <Clock className="sh-input-icon" size={16} />
                                    <input type="number" step="0.5" className={`sh-input ${errors.target_hours ? 'error' : ''}`} {...register('target_hours')} />
                                </div>
                                {errors.target_hours && <span className="sh-field-error">{errors.target_hours.message}</span>}
                            </div>
                        )}
                    </div>

                    {/* Time inputs */}
                    <div className="sh-form-grid-3">
                        <div className="form-group">
                            <label className="sh-label">{formValues.shift_type === 'flexible' ? (t.sh_start_guide || 'وقت دخول استرشادي') : (t.sh_start_fixed || 'وقت الدخول')}</label>
                            <div className="sh-input-wrapper">
                                <Sun className="sh-input-icon" size={16} />
                                <input type="time" className="sh-input" {...register('start_time')} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="sh-label">{formValues.shift_type === 'flexible' ? (t.sh_end_guide || 'وقت انصراف استرشادي') : (t.sh_end_fixed || 'وقت الانصراف')}</label>
                            <div className="sh-input-wrapper">
                                <Moon className="sh-input-icon" size={16} />
                                <input type="time" className="sh-input" {...register('end_time')} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="sh-label">{t.sh_grace_minutes || 'السماحية (دقيقة)'}</label>
                            <div className="sh-input-wrapper">
                                <AlertTriangle className="sh-input-icon" size={16} />
                                <input type="number" className="sh-input" {...register('grace_minutes')} />
                            </div>
                        </div>
                    </div>

                    {/* Duration Banner */}
                    <div className="sh-duration-banner" style={{ '--banner-color': formValues.color }}>
                        <div className="sh-banner-item">
                            <span>{formValues.shift_type === 'flexible' ? (t.sh_target_hours || 'الساعات المستهدفة') : (t.sh_total_hours || 'إجمالي الوقت')}</span>
                            <strong>{totalHours} {t.sh_hours_short || 'ساعة'}</strong>
                        </div>
                        {formValues.has_break && formValues.shift_type !== 'flexible' && (
                            <div className="sh-banner-item">
                                <span>{t.sh_net_hours || 'صافي العمل'}</span>
                                <strong>{netHours} {t.sh_hours_short || 'ساعة'}</strong>
                            </div>
                        )}
                        {isOvernight && (
                            <div className="sh-banner-item overnight">
                                <span>🌙 {t.sh_overnight || 'وردية ليلية'}</span>
                            </div>
                        )}
                    </div>

                    {/* Days */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label className="sh-label">{t.sh_work_days || 'أيام العمل'}</label>
                        <div className="sh-days-grid">
                            {ALL_DAYS.map(day => (
                                <button type="button" key={day} onClick={() => toggleDay(day)}
                                    className={`sh-day-btn ${formValues.work_days.includes(day) ? 'active' : ''}`}
                                    style={{ '--active-color': formValues.color }}>
                                    {translateDay(day, language)}
                                </button>
                            ))}
                        </div>
                        {errors.work_days && <span className="sh-field-error">{errors.work_days.message}</span>}
                    </div>

                    {/* Break section */}
                    <div className="sh-section-card">
                        <div className="sh-section-card-inside">
                            <div className="sh-section-header">
                                <div className="sh-section-title">☕ {t.sh_break_title || 'وقت الاستراحة'}</div>
                                <div className={`sh-switch ${formValues.has_break ? 'active' : ''}`}
                                    onClick={() => setValue('has_break', !formValues.has_break)}
                                    style={{ '--switch-color': formValues.color }}>
                                    <div className="sh-switch-handle" />
                                </div>
                            </div>
                            {formValues.has_break && (
                                <div className="sh-form-row" style={{ marginTop: '1.25rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <label className="sh-label">{t.sh_break_start || 'بداية الاستراحة'}</label>
                                        <input type="time" className="sh-input" {...register('break_start')} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label className="sh-label">{t.sh_break_duration || 'المدة المخصومة (د)'}</label>
                                        <input type="number" className="sh-input" {...register('break_duration')} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Policy */}
                    <div className="sh-section-card">
                        <PolicySelector 
                            value={formValues.break_policy} 
                            onChange={v => setValue('break_policy', v)} 
                            shiftColor={formValues.color}
                            t={t}
                        />
                        <PolicyExplainer policy={formValues.break_policy} t={t} />
                    </div>

                    {/* Missing Punch Half Deduction Setting */}
                    <div className="sh-section-card">
                        <div className="sh-section-card-inside">
                            <div className="sh-section-header">
                                <div>
                                    <div className="sh-section-title">✂️ {t.sh_deduct_half_missing_label || 'خصم نصف الشيفت عند وجود بصمة مفقودة'}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.25rem' }}>
                                        {t.sh_deduct_half_missing_desc || 'عند تفعيل هذا الخيار، يتم احتساب 50% من ساعات الشيفت فقط في حال نسيان بصمة الدخول أو الانصراف.'}
                                    </div>
                                </div>
                                <div className={`sh-switch ${formValues.deduct_half_on_missing ? 'active' : ''}`}
                                    onClick={() => setValue('deduct_half_on_missing', !formValues.deduct_half_on_missing)}
                                    style={{ '--switch-color': formValues.color }}>
                                    <div className="sh-switch-handle" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="sh-modal-actions">
                        <button type="button" onClick={onClose} className="sh-btn-secondary">{t.cancelBtn || 'إلغاء'}</button>
                        <button type="submit" disabled={isSubmitting} className="sh-btn-submit"
                             style={{ '--btn-color': formValues.color }}>
                            {isSubmitting ? (t.sh_saving_btn || 'جاري الحفظ...') : (shift ? (t.sh_save_btn || 'حفظ التعديلات') : (t.sh_create_btn || 'إنشاء الوردية'))}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// -------------------------------------------------------------------------
// -------------------------------------------------------------------------
function EmployeesModal({ shift, allEmployees, assignedIds, onClose, onSave }) {
    const { t, language } = useLocale();
    const [selected, setSelected] = useState(new Set(assignedIds));
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');

    const filtered = allEmployees.filter(e => !search || e.name?.toLowerCase().includes(search.toLowerCase()));

    const toggle = (id) => setSelected(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const selectAll = () => setSelected(new Set(filtered.map(e => e.id)));
    const clearAll = () => setSelected(new Set());

    return (
        <div className="sh-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="sh-form-card sh-emp-modal" style={{ '--modal-accent': shift.color }}>
                <div className="sh-modal-accent-bar" style={{ background: shift.color }} />
                
                <header className="sh-modal-header">
                    <div className="sh-modal-title-group">
                        <div className="sh-modal-icon" style={{ background: `${shift.color}22`, color: shift.color }}>
                            <Users size={22} />
                        </div>
                        <div>
                            <h2 className="sh-modal-title">{t.sh_assign_title || 'تعيين الموظفين'}</h2>
                            <p className="sh-modal-subtitle">{(t.sh_assign_subtitle || 'وردية: {name}').replace('{name}', shift.name)}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="sh-btn-close"><X size={18} /></button>
                </header>

                {/* Search + bulk actions */}
                <div className="sh-emp-search-row">
                    <div className="sh-search-box">
                        <Search size={16} className="sh-search-icon" />
                        <input className="sh-input sh-search-input" placeholder={t.sh_search_employees || "البحث بالاسم..."} 
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div className="sh-bulk-btns">
                        <button type="button" className="sh-bulk-btn" onClick={selectAll}>{t.sh_all_btn || 'الكل'}</button>
                        <button type="button" className="sh-bulk-btn" onClick={clearAll}>{t.sh_clear_btn || 'إلغاء'}</button>
                    </div>
                </div>

                {/* Count indicator */}
                <div className="sh-emp-count" style={{ color: shift.color }}>
                    {(t.sh_selected_count || '{selected} من {total} موظف محدد')
                        .replace('{selected}', selected.size)
                        .replace('{total}', allEmployees.length)}
                </div>

                <div className="sh-emp-list">
                    {filtered.length === 0 ? (
                        <div className="sh-emp-empty">{t.sh_empty_employees || 'لا يوجد موظفون مطابقون'}</div>
                    ) : (
                        filtered.map(emp => {
                            const isSel = selected.has(emp.id);
                            return (
                                <div key={emp.id} onClick={() => toggle(emp.id)}
                                    className={`sh-emp-list-item ${isSel ? 'selected' : ''}`} 
                                    style={{ '--shift-color': shift.color }}>
                                    <div className="sh-emp-avatar" style={{ background: isSel ? `${shift.color}22` : undefined, color: isSel ? shift.color : undefined }}>
                                        {emp.name?.charAt(0)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div className="sh-emp-name">{emp.name}</div>
                                        <div className="sh-emp-id">#{emp.id.slice(0, 8).toUpperCase()}</div>
                                    </div>
                                    <div className={`sh-policy-check ${isSel ? 'active' : ''}`} style={{ 
                                        backgroundColor: isSel ? shift.color : 'transparent',
                                        borderColor: isSel ? shift.color : 'rgba(255,255,255,0.15)'
                                    }}>
                                        {isSel && <Check size={11} />}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <footer className="sh-modal-footer">
                    <button onClick={onClose} className="sh-btn-secondary">{t.cancelBtn || 'إلغاء'}</button>
                    <button onClick={async () => {
                        setSaving(true);
                        await onSave(shift.id, [...selected]);
                        setSaving(false);
                    }} disabled={saving} className="sh-btn-submit" style={{ '--btn-color': shift.color }}>
                        {saving ? (t.sh_saving_btn || 'جاري الحفظ...') : (t.sh_save_assignments || 'حفظ التعيينات ({count})').replace('{count}', selected.size)}
                    </button>
                </footer>
            </div>
        </div>
    );
}

// -------------------------------------------------------------------------
function ShiftCard({ shift, employeeCount, onEdit, onDelete, onManageEmployees }) {
    const { t, language } = useLocale();
    const isFlexible = shift.shift_type === 'flexible';
    const hours = isFlexible ? Number(shift.target_hours || 0).toFixed(1) : calcHours(shift.start_time, shift.end_time);
    const netHours = isFlexible ? hours : (shift.has_break ? (hours - shift.break_duration / 60).toFixed(1) : hours);
    
    const [h1, m1] = shift.start_time?.split(':').map(Number) || [0, 0];
    const [h2, m2] = shift.end_time?.split(':').map(Number) || [16, 0];
    const startMins = h1 * 60 + m1;
    let endMins = h2 * 60 + m2;
    if (endMins < startMins) endMins += 1440;
    const progress = Math.min(((endMins - startMins) / 1440) * 100, 100);

    const activeDays = ALL_DAYS.filter(d => shift.work_days?.includes(d));
    const breakPolicies = getBreakPolicies(t);
    const policyObj = breakPolicies.find(p => p.value === shift.break_policy);

    return (
        <div className="shift-card" style={{ '--shift-color': shift.color }}>
            {/* Left accent stripe */}
            <div className="shift-card-stripe" />
            
            {/* Header */}
            <div className="shift-card-header">
                <div className="shift-card-icon-wrap">
                    <Clock size={18} />
                </div>
                <div className="shift-card-title-block">
                    <h3 className="shift-card-title">
                        {shift.name}
                        {isFlexible && <span style={{ marginInlineStart: '0.5rem', fontSize: '0.75rem', background: `${shift.color}22`, color: shift.color, padding: '2px 6px', borderRadius: '4px' }}>{t.sh_flexible_badge || 'مرنة'}</span>}
                    </h3>
                    <span className={`shift-status-badge ${shift.is_active ? 'active' : 'inactive'}`}>
                        <span className="shift-status-dot" />
                        {shift.is_active ? (t.sh_status_active || 'نشطة') : (t.sh_status_inactive || 'متوقفة')}
                    </span>
                </div>
                <div className="shift-card-menu">
                    <button className="shift-btn-icon" onClick={() => onEdit(shift)} title={t.sh_edit_tooltip || 'تعديل'}>
                        <Edit2 size={15} />
                    </button>
                    <button className="shift-btn-icon danger" onClick={() => onDelete(shift.id)} title={t.sh_delete_tooltip || 'حذف'}>
                        <Trash2 size={15} />
                    </button>
                </div>
            </div>

            {/* Time Arc Display */}
            <div className="shift-time-display">
                <div className="shift-time-col">
                    <span className="shift-time-label">{t.sh_time_in || 'دخول'}</span>
                    <span className="shift-time-val">{fmtTime(shift.start_time, language)}</span>
                </div>
                <div className="shift-timeline-bar">
                    {isFlexible ? (
                        <div className="shift-timeline-fill flexible" style={{ width: '100%', opacity: 0.4 }} />
                    ) : (() => {
                        const [h1, m1] = (shift.start_time || "00:00").split(':').map(Number);
                        const [h2, m2] = (shift.end_time || "00:00").split(':').map(Number);
                        const startMins = h1 * 60 + m1;
                        let endMins = h2 * 60 + m2;
                        const isOvernight = endMins < startMins;
                        const startPct = (startMins / 1440) * 100;
                        
                        if (!isOvernight) {
                            const durationPct = ((endMins - startMins) / 1440) * 100;
                            return (
                                <>
                                    <div className="shift-timeline-fill" style={{ 
                                        insetInlineStart: `${startPct}%`, 
                                        width: `${Math.max(durationPct, 2)}%` 
                                    }} />
                                    <div className="shift-timeline-dot start" style={{ insetInlineStart: `${startPct}%` }} />
                                    <div className="shift-timeline-dot end" style={{ insetInlineStart: `${startPct + durationPct}%` }} />
                                </>
                            );
                        } else {
                            const segment1Pct = ((1440 - startMins) / 1440) * 100;
                            const segment2Pct = (endMins / 1440) * 100;
                            return (
                                <>
                                    <div className="shift-timeline-fill" style={{ insetInlineStart: `${startPct}%`, width: `${segment1Pct}%` }} />
                                    <div className="shift-timeline-fill" style={{ insetInlineStart: '0%', width: `${segment2Pct}%` }} />
                                    <div className="shift-timeline-dot start" style={{ insetInlineStart: `${startPct}%` }} />
                                    <div className="shift-timeline-dot end" style={{ insetInlineStart: `${segment2Pct}%` }} />
                                </>
                            );
                        }
                    })()}
                </div>
                <div className="shift-time-col end">
                    <span className="shift-time-label">{t.sh_time_out || 'انصراف'}</span>
                    <span className="shift-time-val">{fmtTime(shift.end_time, language)}</span>
                </div>
            </div>

            {/* Stats row */}
            <div className="shift-stats-row">
                <div className="shift-stat-item">
                    <span className="shift-stat-val">{hours}{t.sh_mins_short || 'h'}</span>
                    <span className="shift-stat-lbl">{isFlexible ? (t.sh_target_hours || 'مستهدفة') : (t.sh_total_hours_badge || 'إجمالي')}</span>
                </div>
                {!isFlexible && (
                    <>
                        <div className="shift-stat-divider" />
                        <div className="shift-stat-item">
                            <span className="shift-stat-val">{netHours}{t.sh_mins_short || 'h'}</span>
                            <span className="shift-stat-lbl">{t.sh_net_hours_badge || 'صافي'}</span>
                        </div>
                    </>
                )}
                <div className="shift-stat-divider" />
                <div className="shift-stat-item">
                    <span className="shift-stat-val">{shift.grace_minutes}{t.sh_mins_short || 'د'}</span>
                    <span className="shift-stat-lbl">{t.sh_grace_badge || 'سماحية'}</span>
                </div>
                <div className="shift-stat-divider" />
                <div className="shift-stat-item">
                    <span className="shift-stat-val" style={{ color: employeeCount > 0 ? shift.color : undefined }}>{employeeCount}</span>
                    <span className="shift-stat-lbl">{t.sh_employees_badge || 'موظف'}</span>
                </div>
            </div>

            {/* Day pills */}
            <div className="shift-days-row">
                {ALL_DAYS.map((d, i) => (
                    <span key={d} className={`shift-day-pip ${shift.work_days?.includes(d) ? 'on' : ''}`}
                        style={shift.work_days?.includes(d) ? { background: `${shift.color}22`, color: shift.color, borderColor: `${shift.color}44` } : {}}>
                        {translateDayShort(d, language)}
                    </span>
                ))}
            </div>

            {/* Policy chip */}
            {shift.break_policy && (
                <div className="shift-policy-chip">
                    <span>{policyObj?.icon}</span>
                    <span>{policyObj?.label}</span>
                    {shift.has_break && <span className="shift-break-badge">{shift.break_duration}{t.sh_mins_short || 'د'} {t.sh_break_title || 'استراحة'}</span>}
                </div>
            )}

            {shift.deduct_half_on_missing && (
                <div className="shift-policy-chip" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.25)', color: '#f87171', marginTop: '0.4rem' }}>
                    <span>✂️</span>
                    <span>{t.sh_deduct_half_badge || 'خصم 50% عند البصمة المفقودة'}</span>
                </div>
            )}

            {/* Manage employees CTA */}
            <button className="shift-manage-btn" onClick={() => onManageEmployees(shift)}>
                <Users size={16} />
                <span>{t.sh_manage_btn || 'إدارة الموظفين'} ({employeeCount})</span>
                <ChevronLeft size={14} className="shift-manage-arrow" />
            </button>
        </div>
    );
}

// -------------------------------------------------------------------------
function WeeklyView({ shifts, employees, assignments }) {
    const { t, language } = useLocale();
    const activeDays = useMemo(() => {
        const daysSet = new Set();
        shifts.forEach(s => (s.work_days || []).forEach(d => daysSet.add(d)));
        return ALL_DAYS.filter(d => daysSet.has(d));
    }, [shifts]);

    if (shifts.length === 0) return null;

    return (
        <div className="sh-weekly-view">
            <div className="sh-weekly-header">
                <div className="sh-weekly-corner">{t.sh_table_header || 'وردية \ يوم'}</div>
                {activeDays.map(d => (
                    <div key={d} className="sh-weekly-day-col">{translateDay(d, language)}</div>
                ))}
            </div>
            <div className="sh-weekly-body">
                {shifts.map(shift => (
                    <div key={shift.id} className="sh-weekly-row" style={{ '--shift-color': shift.color }}>
                        <div className="sh-weekly-shift-name">
                            <span className="sh-weekly-color-dot" style={{ background: shift.color }} />
                            <span>
                                {shift.name}
                                {shift.shift_type === 'flexible' && <span style={{ marginInlineStart: '0.5rem', fontSize: '0.7rem', color: shift.color, border: `1px solid ${shift.color}44`, padding: '0 4px', borderRadius: '4px' }}>{t.sh_flexible_badge || 'مرنة'}</span>}
                            </span>
                            <span className="sh-weekly-time">
                                {shift.shift_type === 'flexible' ? `${shift.target_hours}h` : `${fmtTime(shift.start_time, language)} – ${fmtTime(shift.end_time, language)}`}
                            </span>
                        </div>
                        {activeDays.map(d => {
                            const isWorking = shift.work_days?.includes(d);
                            const empCount = assignments[shift.id]?.length || 0;
                            return (
                                <div key={d} className={`sh-weekly-cell ${isWorking ? 'active' : 'off'}`}>
                                    {isWorking ? (
                                        <div className="sh-weekly-cell-content">
                                            <span className="sh-weekly-cell-badge">{empCount} 👤</span>
                                        </div>
                                    ) : (
                                        <span className="sh-weekly-off">—</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}

// -------------------------------------------------------------------------
function CalendarView({ shifts, assignments }) {
    const { t, language } = useLocale();
    return (
        <div className="sh-calendar-view">
            <div className="sh-cal-header">
                {ALL_DAYS.map((d, i) => (
                    <div key={d} className="sh-cal-day-head">
                        <span className="sh-cal-day-full">{translateDay(d, language)}</span>
                        <span className="sh-cal-day-short">{translateDayShort(d, language)}</span>
                    </div>
                ))}
            </div>
            <div className="sh-cal-body">
                {ALL_DAYS.map((day) => {
                    const dayShifts = shifts.filter(s => s.work_days?.includes(day) && s.is_active);
                    const offShifts = shifts.filter(s => !s.work_days?.includes(day) || !s.is_active);
                    return (
                        <div key={day} className={`sh-cal-col ${dayShifts.length === 0 ? 'empty' : ''}`}>
                            {dayShifts.length === 0 && (
                                <div className="sh-cal-off-label">{t.sh_day_off || 'يوم إجازة'}</div>
                            )}
                            {dayShifts.map(s => (
                                <div
                                    key={s.id}
                                    className="sh-cal-shift-block"
                                    style={{ '--shift-color': s.color }}
                                >
                                    <div className="sh-cal-block-top-bar" style={{ background: s.color }} />
                                    <div className="sh-cal-block-body">
                                        <span className="sh-cal-shift-name">
                                            {s.name}
                                            {s.shift_type === 'flexible' && <span style={{ marginInlineStart: '0.25rem', fontSize: '0.7rem', opacity: 0.8 }}>({t.sh_flexible_badge || 'مرنة'})</span>}
                                        </span>
                                        <span className="sh-cal-shift-time">
                                            {s.shift_type === 'flexible' ? `${s.target_hours}h` : `${fmtTime(s.start_time, language)} – ${fmtTime(s.end_time, language)}`}
                                        </span>
                                        <span className="sh-cal-shift-emp" style={{ color: s.color }}>
                                            {assignments[s.id]?.length || 0} {t.sh_employees_badge || 'موظف'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {offShifts.length > 0 && dayShifts.length > 0 && (
                                <div className="sh-cal-off-count">
                                    + {offShifts.length} {t.sh_on_leave || 'في إجازة'}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// -------------------------------------------------------------------------
// -------------------------------------------------------------------------
function Shifts() {
    const { company } = useAuth();
    const { t, language } = useLocale();
    const [shifts, setShifts] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [assignments, setAssignments] = useState({});
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingShift, setEditingShift] = useState(null);
    const [shiftToDelete, setShiftToDelete] = useState(null);
    const [empModal, setEmpModal] = useState(null);
    const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'weekly' | 'calendar'
    const [searchQuery, setSearchQuery] = useState('');
    const [filterActive, setFilterActive] = useState('all'); // 'all' | 'active' | 'inactive'

    const fetchAll = useCallback(async () => {
        if (!company) return;
        setLoading(true);
        try {
            const { data: shiftIds } = await supabase.from('shifts').select('id').eq('company_id', company.id);
            const ids = (shiftIds || []).map(s => s.id);

            const [{ data: sData }, { data: eData }, { data: seData }] = await Promise.all([
                supabase.from('shifts').select('id, name, color, start_time, end_time, work_days, has_break, break_start, break_duration, break_policy, grace_minutes, is_active, shift_type, target_hours, deduct_half_on_missing').eq('company_id', company.id).order('created_at'),
                supabase.from('employees').select('id,name').eq('company_id', company.id).eq('status', 'active'),
                ids.length > 0 ? supabase.from('shift_employees').select('shift_id,employee_id').in('shift_id', ids) : Promise.resolve({ data: [] }),
            ]);

            setShifts(sData || []);
            setEmployees(eData || []);
            const map = {};
            (seData || []).forEach(se => {
                if (!map[se.shift_id]) map[se.shift_id] = [];
                map[se.shift_id].push(se.employee_id);
            });
            setAssignments(map);
        } catch (e) {
            console.error(e);
            toast.error(t.errFetchFailed || 'أخفق النظام في جلب البيانات');
        } finally {
            setLoading(false);
        }
    }, [company, t]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleSaveShift = async (form) => {
        try {
            const payload = { ...form, company_id: company.id };
            let savedShiftId = editingShift?.id;
            if (editingShift) {
                await supabase.from('shifts').update(payload).eq('id', editingShift.id);
                toast.success(t.sh_toast_save_success || 'تم التحديث بنجاح');
                await logAudit({
                    companyId: company.id,
                    userId: (await supabase.auth.getUser()).data.user?.id,
                    action: 'UPDATE_SHIFT',
                    tableName: 'shifts',
                    recordId: editingShift.id,
                    oldData: editingShift,
                    newData: payload,
                });
            } else {
                const { data: inserted } = await supabase.from('shifts').insert(payload).select('id').single();
                savedShiftId = inserted?.id;
                toast.success(t.sh_toast_save_success || 'تم الإنشاء بنجاح');
                await logAudit({
                    companyId: company.id,
                    userId: (await supabase.auth.getUser()).data.user?.id,
                    action: 'ADD_SHIFT',
                    tableName: 'shifts',
                    recordId: inserted?.id,
                    oldData: null,
                    newData: payload,
                });
            }
            if (savedShiftId) {
                try {
                    await supabase.rpc('reprocess_deduct_half_shifts', { p_shift_id: savedShiftId });
                } catch (err) {
                    console.error('[Shifts] reprocess_deduct_half_shifts error:', err);
                }
            }
            setShowModal(false); setEditingShift(null); fetchAll();
        } catch (e) { toast.error(t.sh_toast_save_error || 'فشل حفظ البيانات'); }
    };

    const handleDelete = async () => {
        if (!shiftToDelete) return;
        try {
            const shiftToDeleteObj = shifts.find(s => s.id === shiftToDelete);
            await supabase.from('shifts').delete().eq('id', shiftToDelete);
            toast.success(t.sh_toast_delete_success || 'تم الحذف');
            await logAudit({
                companyId: company.id,
                userId: (await supabase.auth.getUser()).data.user?.id,
                action: 'DELETE_SHIFT',
                tableName: 'shifts',
                recordId: shiftToDelete,
                oldData: shiftToDeleteObj,
                newData: null,
            });
            fetchAll();
        } catch (e) { toast.error(t.sh_toast_delete_error || 'فشل الحذف'); }
        setShiftToDelete(null);
    };

    const handleSaveAssignments = async (shiftId, empIds) => {
        try {
            const oldAssignments = assignments[shiftId] || [];
            await supabase.from('shift_employees').delete().eq('shift_id', shiftId);
            if (empIds.length > 0) {
                await supabase.from('shift_employees').insert(empIds.map(eid => ({ shift_id: shiftId, employee_id: eid })));
            }

            const targetShift = shifts.find(s => s.id === shiftId);
            if (targetShift?.deduct_half_on_missing) {
                supabase.rpc('reprocess_deduct_half_shifts', { p_shift_id: shiftId }).then();
            }

            toast.success(t.sh_toast_assign_success || 'تم تحديث قائمة الموظفين');
            await logAudit({
                companyId: company.id,
                userId: (await supabase.auth.getUser()).data.user?.id,
                action: 'UPDATE_SHIFT_ASSIGNMENTS',
                tableName: 'shift_employees',
                recordId: shiftId,
                oldData: { employeeIds: oldAssignments },
                newData: { employeeIds: empIds },
            });
            setEmpModal(null); fetchAll();
        } catch (e) { toast.error(t.sh_toast_assign_error || 'فشل التعيين'); }
    };

    // Derived: filtered shifts
    const filteredShifts = useMemo(() => {
        return shifts.filter(s => {
            const matchSearch = !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchFilter = filterActive === 'all' || (filterActive === 'active' ? s.is_active : !s.is_active);
            return matchSearch && matchFilter;
        });
    }, [shifts, searchQuery, filterActive]);

    const assignedCount = useMemo(() =>
        new Set(Object.values(assignments).flat()).size,
    [assignments]);

    const activeShiftsCount = useMemo(() => shifts.filter(s => s.is_active).length, [shifts]);
    const unassignedCount = employees.length - assignedCount;

    if (loading) return (
        <div className="sh-loading-screen">
            <div className="sh-loading-spinner" />
            <p>{t.sh_loading || 'تحميل الورديات...'}</p>
        </div>
    );

    return (
        <div className="shifts-container">

            <header className="sh-page-header">
                <div className="sh-page-title-group">
                    <div className="sh-page-icon">
                        <Clock size={22} />
                    </div>
                    <div>
                        <h1 className="sh-page-title">{t.sh_page_title || 'نوبات العمل'}</h1>
                        <p className="sh-page-subtitle">{t.sh_page_subtitle || 'جدولة الورديات وتوزيع الموظفين بدقة عالية'}</p>
                    </div>
                </div>
                <div className="sh-header-actions">
                    <button className="sh-btn-icon-round" onClick={fetchAll} title={t.refreshTooltip || 'تحديث'}>
                        <RefreshCcw size={17} />
                    </button>
                    <button className="sh-btn-primary" onClick={() => { setEditingShift(null); setShowModal(true); }}>
                        <Plus size={18} />
                        <span>{t.sh_create_btn || 'وردية جديدة'}</span>
                    </button>
                </div>
            </header>


            <section className="sh-kpi-row">
                <div className="sh-kpi-card primary">
                    <div className="sh-kpi-icon">
                        <Layers size={22} />
                    </div>
                    <div className="sh-kpi-body">
                        <div className="sh-kpi-value">{shifts.length}</div>
                        <div className="sh-kpi-label">{t.sh_total_kpi || 'إجمالي الورديات'}</div>
                    </div>
                    <div className="sh-kpi-sub">{activeShiftsCount} {t.sh_status_active || 'نشطة'}</div>
                </div>
                <div className="sh-kpi-card success">
                    <div className="sh-kpi-icon">
                        <Users size={22} />
                    </div>
                    <div className="sh-kpi-body">
                        <div className="sh-kpi-value">{assignedCount}</div>
                        <div className="sh-kpi-label">{t.sh_assigned_kpi || 'موظفون مُعيَّنون'}</div>
                    </div>
                    <div className="sh-kpi-sub">{t.sh_assigned_sub || 'ضمن وردية'}</div>
                </div>
                <div className="sh-kpi-card warning">
                    <div className="sh-kpi-icon">
                        <AlertTriangle size={22} />
                    </div>
                    <div className="sh-kpi-body">
                        <div className="sh-kpi-value">{unassignedCount}</div>
                        <div className="sh-kpi-label">{t.sh_unassigned_kpi || 'بدون وردية'}</div>
                    </div>
                    <div className="sh-kpi-sub">{t.sh_unassigned_sub || 'يحتاجون تعيين'}</div>
                </div>
                <div className="sh-kpi-card info">
                    <div className="sh-kpi-icon">
                        <Activity size={22} />
                    </div>
                    <div className="sh-kpi-body">
                        <div className="sh-kpi-value">{employees.length}</div>
                        <div className="sh-kpi-label">{t.sh_active_kpi || 'موظفون نشطون'}</div>
                    </div>
                    <div className="sh-kpi-sub">{t.sh_active_sub || 'إجمالي'}</div>
                </div>
            </section>


            <div className="sh-toolbar">
                {/* Search */}
                <div className="sh-search-box">
                    <Search size={15} className="sh-search-icon" />
                    <input
                        className="sh-search-input"
                        placeholder={t.sh_search_shifts || "بحث عن وردية..."}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button className="sh-search-clear" onClick={() => setSearchQuery('')}>
                            <X size={13} />
                        </button>
                    )}
                </div>

                {/* Filter pills */}
                <div className="sh-filter-pills">
                    {[
                        { key: 'all', label: t.sh_filter_all || 'الكل' },
                        { key: 'active', label: t.sh_filter_active || 'النشطة' },
                        { key: 'inactive', label: t.sh_filter_inactive || 'المتوقفة' },
                    ].map(f => (
                        <button key={f.key} onClick={() => setFilterActive(f.key)}
                            className={`sh-filter-pill ${filterActive === f.key ? 'active' : ''}`}>
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* View switcher */}
                <div className="sh-view-switcher">
                    <button onClick={() => setViewMode('cards')}
                        className={`sh-view-btn ${viewMode === 'cards' ? 'active' : ''}`}
                        title={t.sh_view_cards || "عرض البطاقات"}>
                        <LayoutGrid size={16} />
                    </button>
                    <button onClick={() => setViewMode('calendar')}
                        className={`sh-view-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                        title={t.sh_view_calendar || "التقويم الأسبوعي"}>
                        <Calendar size={16} />
                    </button>
                    <button onClick={() => setViewMode('weekly')}
                        className={`sh-view-btn ${viewMode === 'weekly' ? 'active' : ''}`}
                        title={t.sh_view_weekly || "جدول الأيام"}>
                        <TableProperties size={16} />
                    </button>
                </div>
            </div>


            {filteredShifts.length === 0 ? (
                <div className="sh-empty-state">
                    <div className="sh-empty-icon-wrap">
                        <Clock size={40} />
                    </div>
                    <h3>{searchQuery ? (t.sh_empty_results || 'لا توجد نتائج') : (t.sh_empty_shifts || 'لا توجد ورديات حتى الآن')}</h3>
                    <p>{searchQuery ? (t.sh_empty_search_desc || 'جرب بحثاً مختلفاً') : (t.sh_empty_shifts_desc || 'ابدأ بإنشاء أول وردية عمل لتنظيم حضور الموظفين')}</p>
                    {!searchQuery && (
                        <button className="sh-btn-primary" style={{ marginTop: '1.5rem' }}
                            onClick={() => { setEditingShift(null); setShowModal(true); }}>
                            <Plus size={18} /> {t.sh_create_btn || 'إنشاء وردية'}
                        </button>
                    )}
                </div>
            ) : viewMode === 'cards' ? (
                <main className="shifts-grid">
                    {filteredShifts.map(s => (
                        <ShiftCard 
                            key={s.id} 
                            shift={s} 
                            employeeCount={assignments[s.id]?.length || 0}
                            onEdit={sh => { setEditingShift(sh); setShowModal(true); }}
                            onDelete={id => setShiftToDelete(id)}
                            onManageEmployees={sh => setEmpModal(sh)}
                        />
                    ))}
                </main>
            ) : viewMode === 'calendar' ? (
                <CalendarView shifts={filteredShifts} assignments={assignments} />
            ) : (
                <WeeklyView shifts={filteredShifts} employees={employees} assignments={assignments} />
            )}


            {showModal && (
                <ShiftModal 
                    shift={editingShift} 
                    onClose={() => { setShowModal(false); setEditingShift(null); }} 
                    onSave={handleSaveShift} 
                />
            )}
            {empModal && (
                <EmployeesModal 
                    shift={empModal} 
                    allEmployees={employees} 
                    assignedIds={assignments[empModal.id] || []} 
                    onClose={() => setEmpModal(null)} 
                    onSave={handleSaveAssignments} 
                />
            )}
            <ConfirmModal 
                isOpen={!!shiftToDelete} 
                onClose={() => setShiftToDelete(null)} 
                onConfirm={handleDelete} 
                title={t.sh_delete_confirm_title || "حذف الوردية"} 
                message={t.sh_delete_confirm_msg || "هل أنت متأكد من حذف هذه الوردية؟ سيتم إزالة جميع الموظفين المعينين لها."} 
            />
        </div>
    );
}

export default Shifts;