import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    HiOutlinePlus, HiOutlineTrash, HiOutlinePencil,
    HiOutlineX, HiOutlineCheck, HiOutlineDuplicate,
    HiOutlineRefresh, HiOutlineChevronDown, HiOutlineChevronUp,
    HiOutlinePause, HiOutlinePlay,
    HiOutlineCash, HiOutlineBell, HiOutlineGift, HiOutlineFlag,
} from 'react-icons/hi';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';
import { logAudit } from '../utils/auditLogger';
import ConfirmModal from '../components/ConfirmModal';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
    TRIGGER_EVENTS, CONDITION_FIELDS, OPERATORS, 
    ACTION_TYPES, RULE_CATEGORIES, RULE_COLORS, 
    RULE_ICONS, DAYS_OF_WEEK, RuleSchema
} from '../constants/rulesSchema';
import './RuleBuilder.css';

// ═══════════════════════════════════════════════════════════════════════════════
// UI MAPPINGS AND LOCALIZATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const getTranslatedTriggerEvents = (t, lang) => [
    { value: 'late_arrival', label: t.rb_trigger_late_arrival || (lang === 'en' ? 'Late Arrival' : 'تأخر في الدخول'), icon: '⏰', color: 'var(--color-warning)' },
    { value: 'early_leave', label: t.rb_trigger_early_departure || (lang === 'en' ? 'Early Departure' : 'انصراف مبكر'), icon: '🚪', color: 'var(--color-error)' },
    { value: 'absence', label: t.rb_trigger_absence || (lang === 'en' ? 'Employee Absence' : 'غياب'), icon: '❌', color: 'var(--color-danger)' },
    { value: 'overtime', label: t.rb_trigger_overtime || (lang === 'en' ? 'Overtime Work' : 'عمل إضافي'), icon: '⚡', color: 'var(--color-success)' },
    { value: 'incomplete_punch', label: lang === 'en' ? 'Incomplete Punch' : 'بصمة ناقصة', icon: '👆', color: 'var(--obs-secondary)' },
    { value: 'consecutive_late', label: lang === 'en' ? 'Consecutive Late' : 'تأخر متكرر', icon: '🔁', color: 'var(--color-warning)' },
    { value: 'consecutive_absence', label: lang === 'en' ? 'Consecutive Absence' : 'غياب متكرر', icon: '📅', color: 'var(--color-danger)' },
    { value: 'work_hours', label: lang === 'en' ? 'Actual Work Hours' : 'ساعات العمل الفعلية', icon: '🕐', color: 'var(--obs-primary)' },
];

const getTranslatedConditionFields = (t, lang) => ({
    late_arrival: [
        { value: 'late_minutes', label: t.rb_field_late_minutes || (lang === 'en' ? 'Late Minutes' : 'دقائق التأخر'), unit: t.rb_unit_minutes || (lang === 'en' ? 'minutes' : 'دقيقة') },
        { value: 'occurrence_in_month', label: t.rb_field_times_per_month || (lang === 'en' ? 'Times per Month' : 'عدد مرات التأخر في الشهر'), unit: t.rb_unit_times || (lang === 'en' ? 'times' : 'مرة') },
        { value: 'day_of_week', label: t.rb_field_day_of_week || (lang === 'en' ? 'Work Day' : 'يوم الأسبوع'), unit: '' },
    ],
    early_leave: [
        { value: 'early_leave_minutes', label: t.rb_field_early_minutes || (lang === 'en' ? 'Early Exit Minutes' : 'دقائق الانصراف المبكر'), unit: t.rb_unit_minutes || (lang === 'en' ? 'minutes' : 'دقيقة') },
        { value: 'occurrence_in_month', label: t.rb_field_times_per_month || (lang === 'en' ? 'Times per Month' : 'عدد مرات الانصراف المبكر'), unit: t.rb_unit_times || (lang === 'en' ? 'times' : 'مرة') },
    ],
    absence: [
        { value: 'absence_days', label: lang === 'en' ? 'Absence Days in Month' : 'أيام الغياب في الشهر', unit: t.rb_unit_days || (lang === 'en' ? 'days' : 'يوم') },
        { value: 'consecutive_days', label: t.rb_field_consecutive_days || (lang === 'en' ? 'Consecutive Days' : 'أيام غياب متتالية'), unit: t.rb_unit_days || (lang === 'en' ? 'days' : 'يوم') },
        { value: 'day_of_week', label: t.rb_field_day_of_week || (lang === 'en' ? 'Work Day' : 'يوم الأسبوع'), unit: '' },
    ],
    overtime: [
        { value: 'overtime_hours', label: lang === 'en' ? 'Overtime Hours' : 'ساعات العمل الإضافي', unit: lang === 'en' ? 'hours' : 'ساعة' },
        { value: 'overtime_minutes', label: t.rb_field_overtime_minutes || (lang === 'en' ? 'Overtime Minutes' : 'دقائق العمل الإضافي'), unit: t.rb_unit_minutes || (lang === 'en' ? 'minutes' : 'دقيقة') },
    ],
    incomplete_punch: [
        { value: 'occurrence_in_month', label: t.rb_field_times_per_month || (lang === 'en' ? 'Times per Month' : 'عدد المرات في الشهر'), unit: t.rb_unit_times || (lang === 'en' ? 'times' : 'مرة') },
    ],
    consecutive_late: [
        { value: 'consecutive_count', label: lang === 'en' ? 'Consecutive Late Days' : 'عدد أيام التأخر المتتالية', unit: t.rb_unit_days || (lang === 'en' ? 'days' : 'يوم') },
        { value: 'late_minutes', label: t.rb_field_late_minutes || (lang === 'en' ? 'Late Minutes' : 'دقائق التأخر في كل مرة'), unit: t.rb_unit_minutes || (lang === 'en' ? 'minutes' : 'دقيقة') },
    ],
    consecutive_absence: [
        { value: 'consecutive_days', label: t.rb_field_consecutive_days || (lang === 'en' ? 'Consecutive Days' : 'أيام الغياب المتتالية'), unit: t.rb_unit_days || (lang === 'en' ? 'days' : 'يوم') },
    ],
    work_hours: [
        { value: 'work_hours', label: lang === 'en' ? 'Actual Work Hours' : 'ساعات العمل الفعلية', unit: lang === 'en' ? 'hours' : 'ساعة' },
        { value: 'work_minutes', label: lang === 'en' ? 'Actual Work Minutes' : 'دقائق العمل الفعلية', unit: t.rb_unit_minutes || (lang === 'en' ? 'minutes' : 'دقيقة') },
    ],
});

const getTranslatedOperators = (t, lang) => [
    { value: 'gt', label: t.rb_operator_gt || (lang === 'en' ? 'Greater than' : 'أكبر من'), symbol: '>' },
    { value: 'gte', label: t.rb_operator_gte || (lang === 'en' ? 'Greater or equal' : 'أكبر من أو يساوي'), symbol: '≥' },
    { value: 'lt', label: t.rb_operator_lt || (lang === 'en' ? 'Less than' : 'أصغر من'), symbol: '<' },
    { value: 'lte', label: t.rb_operator_lte || (lang === 'en' ? 'Less or equal' : 'أصغر من أو يساوي'), symbol: '≤' },
    { value: 'eq', label: t.rb_operator_eq || (lang === 'en' ? 'Exactly equal' : 'يساوي'), symbol: '=' },
    { value: 'between', label: t.rb_operator_between || (lang === 'en' ? 'Between two values' : 'بين'), symbol: '↔' },
];

const getTranslatedActionTypes = (t, lang) => [
    { value: 'deduct_fixed', label: t.rb_deduct_fixed || (lang === 'en' ? 'Deduct Fixed Amount' : 'خصم مبلغ ثابت'), icon: '💸', color: 'var(--color-error)', category: 'deduction' },
    { value: 'deduct_percentage', label: t.rb_deduct_percentage || (lang === 'en' ? 'Deduct Percentage' : 'خصم نسبة من الراتب'), icon: '📉', color: 'var(--color-warning)', category: 'deduction' },
    { value: 'deduct_daily_rate', label: t.rb_deduct_daily_rate || (lang === 'en' ? 'Deduct Daily Rate' : 'خصم × أيام عمل'), icon: '📆', color: 'var(--color-danger)', category: 'deduction' },
    { value: 'deduct_per_minute', label: t.rb_deduct_per_minute || (lang === 'en' ? 'Deduct Per Minute Late' : 'خصم لكل دقيقة'), icon: '⏱', color: 'var(--color-error)', category: 'deduction' },
    { value: 'add_bonus', label: t.rb_add_bonus || (lang === 'en' ? 'Add Fixed Bonus' : 'إضافة مكافأة / بدل'), icon: '🎁', color: 'var(--color-success)', category: 'bonus' },
    { value: 'add_percentage', label: t.rb_add_percentage || (lang === 'en' ? 'Add Percentage Bonus' : 'إضافة نسبة من الراتب'), icon: '📈', color: 'var(--color-success)', category: 'bonus' },
    { value: 'send_warning', label: t.rb_send_warning || (lang === 'en' ? 'Send Official Warning' : 'إرسال تحذير'), icon: '⚠️', color: 'var(--color-warning)', category: 'warning' },
    { value: 'flag_review', label: t.rb_flag_review || (lang === 'en' ? 'Flag for HR Review' : 'تحديد للمراجعة'), icon: '🚩', color: 'var(--obs-secondary)', category: 'flag' },
    { value: 'double_deduction', label: t.rb_double_deduction || (lang === 'en' ? 'Double Deduction for Day' : 'مضاعفة الخصم (×2)'), icon: '✖️', color: 'var(--obs-tertiary)', category: 'deduction' },
];

const getTranslatedRuleCategories = (t, lang) => [
    { value: 'deduction', label: t.rb_category_deduction || (lang === 'en' ? 'Deductions' : 'خصم'), icon: <HiOutlineCash />, color: 'var(--color-error)' },
    { value: 'bonus', label: t.rb_category_bonus || (lang === 'en' ? 'Bonuses' : 'مكافأة'), icon: <HiOutlineGift />, color: 'var(--color-success)' },
    { value: 'warning', label: lang === 'en' ? 'Warnings' : 'تحذير', icon: <HiOutlineBell />, color: 'var(--color-warning)' },
    { value: 'flag', label: lang === 'en' ? 'HR Reviews' : 'مراجعة', icon: <HiOutlineFlag />, color: 'var(--obs-secondary)' },
];

const CATEGORY_MAP = Object.fromEntries(RULE_CATEGORIES.map(c => [c.value, c]));
const TRIGGER_MAP = Object.fromEntries(TRIGGER_EVENTS.map(t => [t.value, t]));
const ACTION_MAP = Object.fromEntries(ACTION_TYPES.map(a => [a.value, a]));

const uid = () => Math.random().toString(36).slice(2, 10);

const EMPTY_RULE = {
    name: '', description: '', icon: '📋', color: '#6c63ff',
    category: 'deduction', trigger_event: 'late_arrival',
    logic_mode: 'ALL', scope: 'all', scope_ids: [],
    priority: 0, is_active: true, apply_once: false,
    conditions: [], actions: [],
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// -------------------------------------------------------------------------
function RulePreview({ rule, currencySymbol }) {
    const { t, language } = useLocale();
    const TRIGGER_EVENTS_TRANS = getTranslatedTriggerEvents(t, language);
    const ACTION_TYPES_TRANS = getTranslatedActionTypes(t, language);
    const TRIGGER_MAP_TRANS = Object.fromEntries(TRIGGER_EVENTS_TRANS.map(t => [t.value, t]));
    const ACTION_MAP_TRANS = Object.fromEntries(ACTION_TYPES_TRANS.map(a => [a.value, a]));
    const CONDITION_FIELDS_TRANS = getTranslatedConditionFields(t, language);
    const OPERATORS_TRANS = getTranslatedOperators(t, language);

    const trigger = TRIGGER_MAP_TRANS[rule.trigger_event];
    const logic = rule.logic_mode === 'ALL' ? (t.rb_logic_and_all || 'وجميع') : (t.rb_logic_or || 'أو');

    const condText = (c, i) => {
        const field = CONDITION_FIELDS_TRANS[rule.trigger_event]?.find(f => f.value === c.field);
        const operator = OPERATORS_TRANS.find(o => o.value === c.operator);
        if (!field || !operator) return '';
        const prefix = i > 0 ? `${logic} ` : '';
        if (c.operator === 'between') return `${prefix}${field.label} ${t.rb_between || 'بين'} ${c.value} ${t.rb_and || 'و'} ${c.value2} ${field.unit}`;
        return `${prefix}${field.label} ${operator.symbol} ${c.value} ${field.unit}`;
    };

    const actText = (a) => {
        const act = ACTION_MAP_TRANS[a.type];
        if (!act) return '';
        switch (a.type) {
            case 'deduct_fixed': return `${t.rb_deduct_fixed || 'خصم مبلغ ثابت'} (${a.value} ${currencySymbol})`;
            case 'deduct_percentage': return `${t.rb_deduct_percentage || 'خصم نسبة مئوية'} (${a.value}%)`;
            case 'deduct_daily_rate': return `${t.rb_deduct_daily_rate || 'خصم معدل يومي'} (${a.value} ${language === 'en' ? 'day(s)' : 'يوم عمل'})`;
            case 'deduct_per_minute': return `${t.rb_deduct_per_minute || 'خصم لكل دقيقة تأخير'} (${a.value} ${currencySymbol})`;
            case 'add_bonus': return `${t.rb_add_bonus || 'إضافة مكافأة ثابتة'} (${a.value} ${currencySymbol})`;
            case 'add_percentage': return `${t.rb_add_percentage || 'إضافة نسبة مئوية مكافأة'} (${a.value}%)`;
            case 'send_warning': return t.rb_send_warning || 'إرسال تحذير';
            case 'flag_review': return t.rb_flag_review || 'تحديد للمراجعة';
            case 'double_deduction': return t.rb_double_deduction || 'مضاعفة الخصم';
            default: return act.label;
        }
    };

    if (!rule.trigger_event) return null;

    return (
        <div style={{
            padding: '14px 16px', borderRadius: 12,
            background: 'var(--obs-surface-variant)',
            border: '1px solid var(--obs-border)',
            fontSize: '0.85rem', lineHeight: 1.8, color: 'var(--obs-on-surface-variant)',
            fontFamily: 'Cairo',
        }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--obs-primary)', marginBottom: 6, letterSpacing: '0.08em' }}>
                {t.rb_rule_preview || 'معاينة القانون'}
            </div>
            <span style={{ color: trigger?.color || 'var(--obs-on-surface)', fontWeight: 700 }}>
                {trigger?.icon} {t.rb_preview_trigger?.replace('{event}', trigger?.label) || `${language === 'en' ? 'When' : 'عند'} ${trigger?.label}`}
            </span>
            {rule.conditions.length > 0 && (
                <>
                    <span style={{ color: 'var(--obs-on-surface-dim)' }}>{t.rb_preview_if || ' — إذا كان '}</span>
                    {rule.conditions.map((c, i) => (
                        <span key={c.id} style={{ color: 'var(--obs-secondary)' }}>{condText(c, i)} </span>
                    ))}
                </>
            )}
            {rule.actions.length > 0 && (
                <>
                    <span style={{ color: 'var(--obs-on-surface-dim)' }}>{t.rb_preview_then || ' ← '}</span>
                    {rule.actions.map((a, i) => (
                        <span key={a.id} style={{ color: 'var(--color-success)', fontWeight: 700 }}>
                            {i > 0 ? ' + ' : ''}{actText(a)}
                        </span>
                    ))}
                </>
            )}
        </div>
    );
}

// -------------------------------------------------------------------------
function ConditionRow({ cond, index, triggerEvent, onChange, onRemove, logicMode }) {
    const { t, language } = useLocale();
    const CONDITION_FIELDS_TRANS = getTranslatedConditionFields(t, language);
    const OPERATORS_TRANS = getTranslatedOperators(t, language);

    const fields = CONDITION_FIELDS_TRANS[triggerEvent] || [];
    const selField = fields.find(f => f.value === cond.field) || fields[0];
    const isDayField = cond.field === 'day_of_week';

    return (
        <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '12px 14px', borderRadius: 10,
            background: 'var(--bg-primary, #0f0f1a)',
            border: '1px solid var(--border-color)',
            position: 'relative',
        }}>
            {/* Logic badge */}
            {index > 0 && (
                <div style={{
                    position: 'absolute', top: -12, right: 20,
                    fontSize: '0.7rem', fontWeight: 800,
                    padding: '2px 10px', borderRadius: 20,
                    background: logicMode === 'ALL' ? 'var(--obs-primary-alpha)' : 'var(--color-warning-alpha)',
                    color: logicMode === 'ALL' ? 'var(--obs-primary)' : 'var(--color-warning)',
                    border: `1px solid ${logicMode === 'ALL' ? 'var(--obs-primary-dim)' : 'var(--color-warning-dim)'}`,
                }}>
                    {logicMode === 'ALL' ? (t.rb_logic_and || 'و') : (t.rb_logic_or || 'أو')}
                </div>
            )}

            {/* Field */}
            <select
                value={cond.field}
                onChange={e => onChange({ ...cond, field: e.target.value, value: '', value2: '' })}
                style={{ ...selectStyle, flex: 2 }}
            >
                {fields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>

            {/* Operator */}
            {!isDayField && (
                <select
                    value={cond.operator}
                    onChange={e => onChange({ ...cond, operator: e.target.value })}
                    style={{ ...selectStyle, flex: 1 }}
                >
                    {OPERATORS_TRANS.map(o => <option key={o.value} value={o.value}>{o.symbol} {o.label}</option>)}
                </select>
            )}

            {/* Value */}
            {isDayField ? (
                <select
                    value={cond.value}
                    onChange={e => onChange({ ...cond, value: e.target.value })}
                    style={{ ...selectStyle, flex: 2 }}
                >
                    {DAYS_OF_WEEK.map(d => {
                        const label = language === 'en' 
                            ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].indexOf(d)] || d 
                            : d;
                        return <option key={d} value={d}>{label}</option>;
                    })}
                </select>
            ) : cond.operator === 'between' ? (
                <>
                    <input type="number" min={0} placeholder={language === 'en' ? 'From' : 'من'}
                        value={cond.value}
                        onChange={e => onChange({ ...cond, value: e.target.value })}
                        style={{ ...numInputStyle, flex: 1 }} />
                    <span style={{ color: 'var(--text-muted)', alignSelf: 'center', flexShrink: 0 }}>—</span>
                    <input type="number" min={0} placeholder={language === 'en' ? 'To' : 'إلى'}
                        value={cond.value2 || ''}
                        onChange={e => onChange({ ...cond, value2: e.target.value })}
                        style={{ ...numInputStyle, flex: 1 }} />
                </>
            ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="number" min={0}
                        value={cond.value}
                        onChange={e => onChange({ ...cond, value: e.target.value })}
                        style={{ ...numInputStyle, flex: 1 }} />
                    {selField?.unit && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {selField.unit}
                        </span>
                    )}
                </div>
            )}

            <button onClick={onRemove} style={{
                width: 30, height: 30, borderRadius: 8, border: 'none',
                background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, alignSelf: 'center', transition: 'background 0.15s',
            }}>
                <HiOutlineX />
            </button>
        </div>
    );
}

// -------------------------------------------------------------------------
function ActionRow({ action, onChange, onRemove, currencySymbol }) {
    const { t, language } = useLocale();
    const ACTION_TYPES_TRANS = getTranslatedActionTypes(t, language);
    const ACTION_MAP_TRANS = Object.fromEntries(ACTION_TYPES_TRANS.map(a => [a.value, a]));

    const actDef = ACTION_MAP_TRANS[action.type];
    const needsVal = !['send_warning', 'flag_review', 'double_deduction'].includes(action.type);
    const unit = ['deduct_percentage', 'add_percentage'].includes(action.type)
        ? '%' : ['deduct_daily_rate'].includes(action.type) ? (language === 'en' ? 'days' : 'يوم') : currencySymbol;

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 14px', borderRadius: 10,
            background: 'var(--bg-primary, #0f0f1a)',
            border: `1px solid ${actDef?.color}33`,
        }}>
            {/* Type badge */}
            <span style={{
                fontSize: '1.2rem', flexShrink: 0,
                width: 36, height: 36, borderRadius: 8,
                background: `${actDef?.color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                {actDef?.icon}
            </span>

            {/* Type selector */}
            <select
                value={action.type}
                onChange={e => onChange({ ...action, type: e.target.value, value: '' })}
                style={{ ...selectStyle, flex: 2 }}
            >
                {ACTION_TYPES_TRANS.map(a => (
                    <option key={a.value} value={a.value}>{a.icon} {a.label}</option>
                ))}
            </select>

            {/* Value */}
            {needsVal && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <input type="number" min={0} step={0.1} placeholder={t.rb_value || (language === 'en' ? 'Value' : 'القيمة')}
                        value={action.value || ''}
                        onChange={e => onChange({ ...action, value: e.target.value })}
                        style={{ ...numInputStyle, flex: 1 }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>{unit}</span>
                </div>
            )}

            {/* Note */}
            <input type="text" placeholder={t.rb_note || (language === 'en' ? 'Note (Optional)' : 'ملاحظة (اختياري)')}
                value={action.note || ''}
                onChange={e => onChange({ ...action, note: e.target.value })}
                style={{ ...selectStyle, flex: 1, fontSize: '0.8rem' }} />

            <button onClick={onRemove} style={{
                width: 30, height: 30, borderRadius: 8, border: 'none',
                background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.15s',
            }}>
                <HiOutlineX />
            </button>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RULE MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function RuleModal({ rule, onClose, onSave }) {
    const { t, language, currencySymbol } = useLocale();
    const [tab, setTab] = useState('basic'); 
    const [saving, setSaving] = useState(false);

    const localRuleSchema = useMemo(() => {
        const localActionSchema = z.object({
            id: z.string().optional(),
            type: z.string().min(1, t.rb_action_type_required || (language === 'en' ? 'Action type is required' : 'نوع الإجراء مطلوب')),
            value: z.union([z.number(), z.string()]).refine(val => val !== '', t.rb_value_required || (language === 'en' ? 'Value is required' : 'القيمة مطلوبة')),
            note: z.string().optional(),
        });

        const localConditionSchema = z.object({
            id: z.string().optional(),
            field: z.string().min(1, t.rb_field_required || (language === 'en' ? 'Field is required' : 'الحقل مطلوب')),
            operator: z.string().min(1, t.rb_operator_required || (language === 'en' ? 'Operator is required' : 'المعامل مطلوب')),
            value: z.union([z.number(), z.string()]).refine(val => val !== '', t.rb_value_required || (language === 'en' ? 'Value is required' : 'القيمة مطلوبة')),
            value2: z.union([z.number(), z.string()]).optional(),
        });

        return z.object({
            name: z.string().min(3, t.rb_rule_name_min || (language === 'en' ? 'Rule name must be at least 3 characters' : 'اسم القانون يجب أن يكون 3 أحرف على الأقل')),
            description: z.string().optional(),
            icon: z.string().default('⚖️'),
            color: z.string().default('var(--obs-primary)'),
            category: z.string().default('deduction'),
            trigger_event: z.string().min(1, t.rb_trigger_required || (language === 'en' ? 'Trigger event is required' : 'الحدث المشغل مطلوب')),
            logic_mode: z.enum(['ALL', 'ANY']).default('ALL'),
            priority: z.number().min(0).max(100).default(0),
            is_active: z.boolean().default(true),
            apply_once: z.boolean().default(false),
            conditions: z.array(localConditionSchema).min(1, t.rb_rule_min_one_condition || (language === 'en' ? 'Please add at least one condition' : 'يجب إضافة شرط واحد على الأقل')),
            actions: z.array(localActionSchema).min(1, t.rb_rule_min_one_action || (language === 'en' ? 'Please add at least one action' : 'يجب إضافة إجراء واحد على الأقل')),
        });
    }, [t, language]);

    const { 
        register, handleSubmit, watch, setValue, formState: { errors } 
    } = useForm({
        resolver: zodResolver(localRuleSchema),
        defaultValues: rule ? { ...EMPTY_RULE, ...rule } : { ...EMPTY_RULE }
    });

    const form = watch(); // Watch all fields to reflect changes in UI

    const TRIGGER_EVENTS_TRANS = getTranslatedTriggerEvents(t, language);
    const TRIGGER_MAP_TRANS = Object.fromEntries(TRIGGER_EVENTS_TRANS.map(t => [t.value, t]));
    const CONDITION_FIELDS_TRANS = getTranslatedConditionFields(t, language);
    const RULE_CATEGORIES_TRANS = getTranslatedRuleCategories(t, language);

    const addCondition = () => {
        const fields = CONDITION_FIELDS_TRANS[form.trigger_event] || [];
        if (!fields.length) return;
        const newConditions = [...(form.conditions || []), {
            id: uid(), field: fields[0].value, operator: 'gt', value: '', value2: '',
        }];
        setValue('conditions', newConditions, { shouldValidate: true });
    };

    const updateCondition = (id, updated) => {
        const newConditions = form.conditions.map(c => c.id === id ? updated : c);
        setValue('conditions', newConditions, { shouldValidate: true });
    };

    const removeCondition = (id) => {
        const newConditions = form.conditions.filter(c => c.id !== id);
        setValue('conditions', newConditions, { shouldValidate: true });
    };

    const addAction = () => {
        const newActions = [...(form.actions || []), {
            id: uid(), type: 'deduct_fixed', value: '', note: '',
        }];
        setValue('actions', newActions, { shouldValidate: true });
    };

    const updateAction = (id, updated) => {
        const newActions = form.actions.map(a => a.id === id ? updated : a);
        setValue('actions', newActions, { shouldValidate: true });
    };

    const removeAction = (id) => {
        const newActions = form.actions.filter(a => a.id !== id);
        setValue('actions', newActions, { shouldValidate: true });
    };

    const onSubmit = async (data) => {
        setSaving(true);
        try {
            await onSave(data);
        } catch (e) {
            console.error('[RuleModal] Save Error:', e);
        } finally {
            setSaving(false);
        }
    };

    const trigger = TRIGGER_MAP_TRANS[form.trigger_event];
    const tabs = [
        { key: 'basic', label: t.rb_tab_basics || 'الأساسيات', badge: null },
        { key: 'conditions', label: t.rb_tab_conditions || 'الشروط', badge: form.conditions?.length || null },
        { key: 'actions', label: t.rb_tab_actions || 'الإجراءات', badge: form.actions?.length || null },
        { key: 'preview', label: t.rb_tab_preview || 'المعاينة', badge: null },
    ];

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
            <div style={{
                background: 'var(--bg-secondary, #1a1a2e)',
                border: `1px solid ${form.color}44`,
                borderRadius: 24, width: '100%', maxWidth: 680,
                maxHeight: '93vh', display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: `0 0 0 1px ${form.color}22, 0 32px 80px rgba(0,0,0,0.6)`,
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px 0',
                    background: `linear-gradient(135deg, ${form.color}18, transparent)`,
                    borderBottom: '1px solid var(--border-color)',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 12,
                                background: `${form.color}22`, border: `1px solid ${form.color}44`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.4rem',
                            }}>{form.icon}</div>
                            <div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
                                    {rule ? (t.rb_edit_rule || 'تعديل القانون') : (t.rb_new_rule || 'قانون جديد')}
                                </div>
                                {form.name && (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{form.name}</div>
                                )}
                            </div>
                        </div>
                        <button onClick={onClose} style={{
                            width: 32, height: 32, borderRadius: 8, border: 'none',
                            background: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}><HiOutlineX /></button>
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 4 }}>
                        {tabs.map(t => (
                            <button key={t.key} onClick={() => setTab(t.key)} style={{
                                padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none',
                                background: tab === t.key ? 'var(--bg-primary, #0f0f1a)' : 'transparent',
                                color: tab === t.key ? '#fff' : 'var(--text-muted)',
                                cursor: 'pointer', fontFamily: 'Cairo', fontSize: '0.85rem', fontWeight: 600,
                                display: 'flex', alignItems: 'center', gap: 6,
                                borderBottom: tab === t.key ? `2px solid ${form.color}` : '2px solid transparent',
                                transition: 'all 0.15s',
                            }}>
                                {t.label}
                                {t.badge != null && (
                                    <span style={{
                                        fontSize: '0.7rem', padding: '1px 6px', borderRadius: 20,
                                        background: `${form.color}33`, color: form.color, fontWeight: 800,
                                    }}>{t.badge}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', scrollbarWidth: 'thin' }}>


                    {tab === 'basic' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {/* اسم القانون */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>{(t.rb_rule_name || 'اسم القانون')} *</label>
                                    <input 
                                        {...register('name')}
                                        style={inputStyle} 
                                        placeholder={t.rb_rule_name_placeholder || 'مثال: خصم التأخر المتكرر'}
                                    />
                                    {errors.name && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 4 }}>{errors.name.message}</div>}
                                </div>
                                <div>
                                    <label style={labelStyle}>{t.rb_icon || 'الأيقونة'}</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                        {RULE_ICONS.map(ic => (
                                            <button key={ic} onClick={() => setValue('icon', ic)} style={{
                                                width: 34, height: 34, borderRadius: 8, fontSize: '1.1rem',
                                                border: form.icon === ic ? `2px solid ${form.color}` : '1px solid var(--border-color)',
                                                background: form.icon === ic ? `${form.color}22` : 'var(--bg-tertiary)',
                                                cursor: 'pointer', transition: 'all 0.12s',
                                            }}>{ic}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* لون */}
                            <div>
                                <label style={labelStyle}>{t.rb_color || 'اللون'}</label>
                                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                                    {RULE_COLORS.map(c => (
                                        <button key={c} onClick={() => setValue('color', c)} style={{
                                            width: 30, height: 30, borderRadius: '50%', background: c,
                                            border: form.color === c ? '2px solid #fff' : '2px solid transparent',
                                            cursor: 'pointer', transition: 'transform 0.15s',
                                            transform: form.color === c ? 'scale(1.25)' : 'scale(1)',
                                        }} />
                                    ))}
                                </div>
                            </div>

                            {/* وصف */}
                            <div>
                                <label style={labelStyle}>{t.rb_description || 'وصف (اختياري)'}</label>
                                <textarea 
                                    {...register('description')}
                                    style={{ ...inputStyle, height: 70, padding: '10px 14px', resize: 'vertical' }}
                                    placeholder={t.rb_description_placeholder || 'وصف مختصر لهذا القانون...'}
                                />
                            </div>

                            {/* الفئة */}
                            <div>
                                <label style={labelStyle}>{t.rb_category || 'فئة القانون'}</label>
                                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                                    {RULE_CATEGORIES_TRANS.map(cat => (
                                        <button key={cat.value} onClick={() => setValue('category', cat.value)} style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            padding: '8px 16px', borderRadius: 10,
                                            border: `1.5px solid ${form.category === cat.value ? cat.color : 'var(--border-color)'}`,
                                            background: form.category === cat.value ? `${cat.color}18` : 'var(--bg-tertiary)',
                                            color: form.category === cat.value ? cat.color : 'var(--text-muted)',
                                            cursor: 'pointer', fontFamily: 'Cairo', fontWeight: 600, fontSize: '0.85rem',
                                        }}>
                                            {cat.icon} {cat.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* الحدث المُشغِّل */}
                            <div>
                                <label style={labelStyle}>{(t.rb_trigger || 'الحدث المُشغِّل للقانون')} *</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginTop: 8 }}>
                                    {TRIGGER_EVENTS_TRANS.map(t_ev => (
                                        <button key={t_ev.value} onClick={() => {
                                            setValue('trigger_event', t_ev.value);
                                            setValue('conditions', []);
                                        }} style={{
                                            padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                                            border: `1.5px solid ${form.trigger_event === t_ev.value ? t_ev.color : 'var(--border-color)'}`,
                                            background: form.trigger_event === t_ev.value ? `${t_ev.color}15` : 'var(--bg-tertiary)',
                                            color: form.trigger_event === t_ev.value ? t_ev.color : 'var(--text-muted)',
                                            fontFamily: 'Cairo', fontWeight: 600, fontSize: '0.82rem',
                                            display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
                                            textAlign: 'right',
                                        }}>
                                            <span style={{ fontSize: '1.1rem' }}>{t_ev.icon}</span>
                                            {t_ev.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* الأولوية + الخيارات */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={labelStyle}>{t.rb_priority || 'الأولوية (الأعلى = الأسبق)'}</label>
                                    <input 
                                        type="number" 
                                        min={0} max={100} 
                                        style={inputStyle}
                                        {...register('priority', { valueAsNumber: true })} 
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'flex-end' }}>
                                    {[
                                        { key: 'is_active', label: t.rb_active || '⚡ القانون نشط' },
                                        { key: 'apply_once', label: t.rb_apply_once || '🔂 تطبيق مرة واحدة / شهر' },
                                    ].map(opt => (
                                        <div key={opt.key} onClick={() => setValue(opt.key, !form[opt.key])} style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                                            background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                                        }}>
                                            <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)' }}>{opt.label}</span>
                                            <div style={{
                                                width: 36, height: 20, borderRadius: 10,
                                                background: form[opt.key] ? form.color : 'var(--border-color)',
                                                cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                                            }}>
                                                <div style={{
                                                    position: 'absolute', top: 2,
                                                    left: form[opt.key] ? 18 : 2,
                                                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                                                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                                }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}


                    {tab === 'conditions' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* منطق الشروط */}
                            <div>
                                <label style={labelStyle}>{t.rb_logic_mode || 'منطق تطبيق الشروط'}</label>
                                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                    {[
                                        { value: 'ALL', label: t.rb_logic_all || 'كل الشروط (AND)', desc: t.rb_logic_all_desc || 'يجب تحقق جميع الشروط', color: '#6366f1' },
                                        { value: 'ANY', label: t.rb_logic_any || 'أي شرط (OR)', desc: t.rb_logic_any_desc || 'يكفي تحقق شرط واحد', color: '#f59e0b' },
                                    ].map(m => (
                                        <div key={m.value} onClick={() => setValue('logic_mode', m.value)} style={{
                                            flex: 1, padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                                            border: `1.5px solid ${form.logic_mode === m.value ? m.color : 'var(--border-color)'}`,
                                            background: form.logic_mode === m.value ? `${m.color}15` : 'var(--bg-tertiary)',
                                        }}>
                                            <div style={{ fontWeight: 700, color: form.logic_mode === m.value ? m.color : '#fff', fontSize: '0.88rem', marginBottom: 4 }}>
                                                {m.label}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                             {/* قائمة الشروط */}
                             {(!form.conditions || form.conditions.length === 0) && (
                                 <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                                     <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔍</div>
                                     <div style={{ fontSize: '0.85rem' }}>{t.rb_no_conditions || 'لا توجد شروط بعد'}</div>
                                     <div style={{ fontSize: '0.75rem', marginTop: 4 }}>{t.rb_no_conditions_desc || 'بدون شروط، يُطبَّق القانون على كل حالة'}</div>
                                 </div>
                             )}
                             {form.conditions?.map((c, i) => (
                                 <ConditionRow
                                     key={c.id}
                                     cond={c}
                                     index={i}
                                     triggerEvent={form.trigger_event}
                                     logicMode={form.logic_mode}
                                     onChange={updated => updateCondition(c.id, updated)}
                                     onRemove={() => removeCondition(c.id)}
                                 />
                             ))}
                             {errors.conditions && <div style={{ color: '#ef4444', fontSize: '0.75rem', textAlign: 'center' }}>{errors.conditions.message}</div>}

                            <button onClick={addCondition} style={{
                                padding: '10px', borderRadius: 10, border: `1.5px dashed ${form.color}66`,
                                background: `${form.color}08`, color: form.color,
                                cursor: 'pointer', fontFamily: 'Cairo', fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            }}>
                                <HiOutlinePlus /> {t.rb_add_condition || 'إضافة شرط'}
                            </button>
                        </div>
                    )}


                    {tab === 'actions' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{
                                padding: '10px 14px', borderRadius: 10,
                                background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
                                fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)',
                            }}>
                                {t.rb_tip_multiple_actions || '💡 يمكنك إضافة أكثر من إجراء — جميعها تُطبَّق عند تحقق الشروط'}
                            </div>

                             {/* قائمة الإجراءات */}
                             {(!form.actions || form.actions.length === 0) && (
                                 <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                                     <div style={{ fontSize: '2rem', marginBottom: 8 }}>⚡</div>
                                     <div style={{ fontSize: '0.85rem' }}>{t.rb_no_actions || 'لا توجد إجراءات بعد'}</div>
                                 </div>
                             )}
                             {form.actions?.map(a => (
                                 <ActionRow
                                     key={a.id}
                                     action={a}
                                     currencySymbol={currencySymbol}
                                     onChange={updated => updateAction(a.id, updated)}
                                     onRemove={() => removeAction(a.id)}
                                 />
                             ))}
                             {errors.actions && <div style={{ color: '#ef4444', fontSize: '0.75rem', textAlign: 'center' }}>{errors.actions.message}</div>}

                            <button onClick={addAction} style={{
                                padding: '10px', borderRadius: 10, border: `1.5px dashed ${form.color}66`,
                                background: `${form.color}08`, color: form.color,
                                cursor: 'pointer', fontFamily: 'Cairo', fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            }}>
                                <HiOutlinePlus /> {t.rb_add_action || 'إضافة إجراء'}
                            </button>
                        </div>
                    )}


                    {tab === 'preview' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <RulePreview rule={form} currencySymbol={currencySymbol} />

                            {/* ملخص */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                {[
                                    { label: t.rb_trigger || 'الحدث المُشغِّل', value: `${trigger?.icon} ${trigger?.label}` },
                                    { label: language === 'en' ? 'Conditions Count' : 'عدد الشروط', value: form.conditions.length },
                                    { label: language === 'en' ? 'Actions Count' : 'عدد الإجراءات', value: form.actions.length },
                                    { label: t.rb_logic_mode || 'منطق الشروط', value: form.logic_mode === 'ALL' ? (t.rb_logic_all || 'كل الشروط (AND)') : (t.rb_logic_any || 'أي شرط (OR)') },
                                    { label: t.rb_priority || 'الأولوية', value: form.priority },
                                    { label: language === 'en' ? 'Apply once/month' : 'تطبيق مرة/شهر', value: form.apply_once ? (t.rb_yes || 'نعم') : (t.rb_no || 'لا') },
                                ].map(s => (
                                    <div key={s.label} style={{
                                        padding: '10px 14px', borderRadius: 10,
                                        background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                                    }}>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>{s.value}</div>
                                    </div>
                                ))}
                            </div>

                            {(!form.conditions.length || !form.actions.length) && (
                                <div style={{
                                    padding: '12px 16px', borderRadius: 10,
                                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                                    fontSize: '0.82rem', color: '#fca5a5',
                                }}>
                                    {t.rb_rule_incomplete || '⚠️ القانون غير مكتمل:'}
                                    {!form.conditions.length && (t.rb_rule_need_condition || ' يحتاج شرطاً واحداً على الأقل.')}
                                    {!form.actions.length && (t.rb_rule_need_action || ' يحتاج إجراءً واحداً على الأقل.')}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px', borderTop: '1px solid var(--border-color)',
                    display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--bg-secondary)',
                }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {tabs.map((t, i) => (
                            <button key={t.key} onClick={() => setTab(t.key)} style={{
                                width: 8, height: 8, borderRadius: '50%', border: 'none',
                                background: tab === t.key ? form.color : 'var(--border-color)',
                                cursor: 'pointer', transition: 'background 0.2s',
                            }} />
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={onClose} style={{
                            padding: '10px 20px', background: 'transparent',
                            border: '1px solid var(--border-color)', borderRadius: 10,
                            color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'Cairo',
                        }}>{t.cancelBtn || 'إلغاء'}</button>
                        <button onClick={handleSubmit(onSubmit)} disabled={saving} style={{
                            padding: '10px 24px', borderRadius: 10, border: 'none',
                            background: `linear-gradient(135deg, ${form.color}, ${form.color}cc)`,
                            color: '#fff', cursor: 'pointer', fontFamily: 'Cairo', fontWeight: 700,
                            opacity: saving ? 0.7 : 1, boxShadow: `0 4px 16px ${form.color}44`,
                            display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                            {saving ? (t.saving || 'جاري الحفظ...') : <><HiOutlineCheck /> {rule ? (t.saveChangesBtn || 'حفظ التعديلات') : (t.rb_add_rule || 'إنشاء القانون')}</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RULE CARD
// ═══════════════════════════════════════════════════════════════════════════════
function RuleCard({ rule, onEdit, onDelete, onDuplicate, onToggle, currencySymbol }) {
    const { t, language } = useLocale();
    const [expanded, setExpanded] = useState(false);

    const TRIGGER_EVENTS_TRANS = getTranslatedTriggerEvents(t, language);
    const ACTION_TYPES_TRANS = getTranslatedActionTypes(t, language);
    const TRIGGER_MAP_TRANS = Object.fromEntries(TRIGGER_EVENTS_TRANS.map(t => [t.value, t]));
    const ACTION_MAP_TRANS = Object.fromEntries(ACTION_TYPES_TRANS.map(a => [a.value, a]));
    const CONDITION_FIELDS_TRANS = getTranslatedConditionFields(t, language);
    const OPERATORS_TRANS = getTranslatedOperators(t, language);
    const RULE_CATEGORIES_TRANS = getTranslatedRuleCategories(t, language);
    const CATEGORY_MAP_TRANS = Object.fromEntries(RULE_CATEGORIES_TRANS.map(c => [c.value, c]));

    const trigger = TRIGGER_MAP_TRANS[rule.trigger_event];
    const category = CATEGORY_MAP_TRANS[rule.category];

    const actSummary = rule.actions.map(a => {
        const act = ACTION_MAP_TRANS[a.type];
        switch (a.type) {
            case 'deduct_fixed': return `${t.rb_deduct_fixed || 'خصم مبلغ ثابت'} (${a.value} ${currencySymbol})`;
            case 'deduct_percentage': return `${t.rb_deduct_percentage || 'خصم نسبة مئوية'} (${a.value}%)`;
            case 'deduct_daily_rate': return `${t.rb_deduct_daily_rate || 'خصم معدل يومي'} (${a.value} ${language === 'en' ? 'day(s)' : 'يوم'})`;
            case 'deduct_per_minute': return `${a.value} ${currencySymbol}/${language === 'en' ? 'min' : 'دقيقة'}`;
            case 'add_bonus': return `${t.rb_add_bonus || 'مكافأة'} (${a.value} ${currencySymbol})`;
            case 'add_percentage': return `+${a.value}%`;
            default: return act?.label || a.type;
        }
    }).join(' + ');

    return (
        <div className={`rb-card ${!rule.is_active ? 'rb-card-inactive' : ''}`}>
            <div className="rb-card-glow" style={{ background: `linear-gradient(to bottom, ${rule.color}, transparent)` }} />
            
            <div className="rb-card-header">
                <div className="rb-card-header-left">
                    <div className="rb-card-icon" style={{ background: `${rule.color}15`, color: rule.color }}>
                        {rule.icon}
                    </div>
                    <div>
                        <h3 className="rb-card-title">{rule.name}</h3>
                        <div className="rb-card-subtitle" style={{ color: trigger?.color }}>
                            {trigger?.icon} {trigger?.label}
                        </div>
                    </div>
                </div>

                <label className="rb-switch-wrapper" title={rule.is_active ? (language === 'en' ? 'Stop' : 'إيقاف') : (language === 'en' ? 'Activate' : 'تفعيل')}>
                    <input 
                        type="checkbox" 
                        className="rb-switch-input" 
                        checked={rule.is_active} 
                        onChange={() => onToggle(rule)} 
                    />
                    <div className="rb-switch-track" style={{ '--switch-color': `linear-gradient(135deg, ${rule.color}, ${rule.color}cc)` }}>
                        <div className="rb-switch-thumb" style={{ transform: rule.is_active ? 'translateX(calc(-3rem + 1.125rem + 4px))' : 'translateX(0)' }}></div>
                    </div>
                </label>
            </div>

            <div className="rb-card-body">
                <div className="rb-card-conditions">
                    <div className="rb-condition-item" style={{ marginBottom: 4 }}>
                        <span className="rb-condition-label">{t.rb_category_label || 'الفئة:'}</span>
                        <span className="rb-condition-value" style={{ color: category?.color }}>{category?.label}</span>
                    </div>
                    <div className="rb-condition-item">
                        <span className="rb-condition-label">{t.rb_priority_label || 'الأولوية:'}</span>
                        <span className="rb-condition-value">{rule.priority}</span>
                    </div>
                    <div className="rb-condition-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                        {expanded ? (
                            <div style={{ width: '100%', marginTop: '0.5rem' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                                    {language === 'en' ? 'Conditions' : 'الشروط'} ({rule.logic_mode === 'ALL' ? (language === 'en' ? 'AND' : 'كل') : (language === 'en' ? 'OR' : 'أي')})
                                </div>
                                {rule.conditions.length > 0 ? rule.conditions.map((c, i) => {
                                    const fields = CONDITION_FIELDS_TRANS[rule.trigger_event] || [];
                                    const field = fields.find(f => f.value === c.field);
                                    const op = OPERATORS_TRANS.find(o => o.value === c.operator);
                                    return (
                                        <div key={c.id} style={{
                                            fontSize: '0.8rem', color: 'var(--text-primary)',
                                            padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                                        }}>
                                            {i > 0 && <span style={{ color: '#a5b4fc', marginLeft: 4 }}>{rule.logic_mode === 'ALL' ? (t.rb_logic_and || 'و') : (t.rb_logic_or || 'أو')}</span>}
                                            {field?.label} {op?.symbol} {c.value}
                                            {c.operator === 'between' ? ` — ${c.value2}` : ''}
                                            {' '}{field?.unit}
                                        </div>
                                    );
                                }) : <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{language === 'en' ? 'No restricting conditions' : 'لا توجد شروط مقيدة'}</div>}
                                <div style={{ width: '100%', textAlign: 'left', marginTop: 8 }}>
                                    <button onClick={() => setExpanded(false)} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>{language === 'en' ? 'Collapse Details' : 'طي التفاصيل'}</button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%'}}>
                                <span className="rb-condition-label">{language === 'en' ? 'Conditions:' : 'الشروط:'}</span>
                                <span className="rb-condition-value">
                                    {rule.conditions.length > 0 ? `${rule.conditions.length} ${language === 'en' ? 'condition(s)' : 'شرط'} (${rule.logic_mode === 'ALL' ? 'AND' : 'OR'})` : (language === 'en' ? 'None' : 'لا يوجد')}
                                    {rule.conditions.length > 0 && <button onClick={() => setExpanded(true)} style={{ border: 'none', background: 'transparent', color: '#818cf8', cursor: 'pointer', fontSize: '0.8rem', marginRight: '6px' }}>{language === 'en' ? 'Details' : 'تفاصيل'}</button>}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="rb-card-footer">
                <div className="rb-action-summary" style={{ '--summary-color': rule.color, '--summary-bg': `${rule.color}15` }}>
                    ⚡ {actSummary || 'لا توجد إجراءات'}
                </div>
                <div className="rb-card-actions">
                    <button onClick={() => onEdit(rule)} className="rb-card-btn" title="تعديل"><HiOutlinePencil /></button>
                    <button onClick={() => onDuplicate(rule)} className="rb-card-btn" title="نسخ"><HiOutlineDuplicate /></button>
                    <button onClick={() => onDelete(rule.id)} className="rb-card-btn rb-card-btn-danger" title="حذف"><HiOutlineTrash /></button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function RuleBuilder() {
    const { company, user } = useAuth();
    const { t, language, currencySymbol } = useLocale();
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [filterCat, setFilterCat] = useState('all');
    const [filterActive, setFilterActive] = useState('all');
    const [search, setSearch] = useState('');
    const [ruleToDelete, setRuleToDelete] = useState(null);

    const fetchRules = useCallback(async () => {
        if (!company) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('hr_rules')
                .select('id, name, description, icon, color, category, trigger_event, logic_mode, scope, scope_ids, priority, is_active, apply_once, conditions, actions, created_at')
                .eq('company_id', company.id)
                .order('priority', { ascending: false })
                .order('created_at', { ascending: true });
            if (error) throw error;
            setRules(data || []);
        } catch (err) {
            console.error('[RuleBuilder] fetchRules:', err.message);
            toast.error('تعذر تحميل القوانين');
        } finally {
            setLoading(false);
        }
    }, [company]);

    useEffect(() => { fetchRules(); }, [fetchRules]);

    const handleSave = async (form) => {
        try {
            const payload = { ...form, company_id: company.id };
            // Strip client-only condition/action IDs before persisting
            payload.conditions = (payload.conditions || []).map(({ id, ...rest }) => rest);
            payload.actions    = (payload.actions    || []).map(({ id, ...rest }) => rest);

            if (editingRule) {
                const { error } = await supabase
                    .from('hr_rules')
                    .update(payload)
                    .eq('id', editingRule.id)
                    .eq('company_id', company.id); // دفاع ثانٍ
                if (error) throw error;
                toast.success('✅ تم تعديل القانون بنجاح');
                await logAudit({
                    companyId: company.id,
                    userId: user?.id, // سيتم جلبه عبر auth callback
                    action: 'UPDATE_RULE',
                    tableName: 'hr_rules',
                    recordId: editingRule.id,
                    oldData: { name: editingRule.name, is_active: editingRule.is_active },
                    newData: { name: form.name, is_active: form.is_active },
                });
            } else {
                const { data: inserted, error } = await supabase
                    .from('hr_rules')
                    .insert(payload)
                    .select('id')
                    .single();
                if (error) throw error;
                toast.success('✅ تمت إضافة القانون بنجاح');
                await logAudit({
                    companyId: company.id,
                    userId: user?.id,
                    action: 'CREATE_RULE',
                    tableName: 'hr_rules',
                    recordId: inserted?.id,
                    oldData: null,
                    newData: { name: form.name, category: form.category },
                });
            }
            setShowModal(false); setEditingRule(null); fetchRules();
        } catch (error) {
            console.error('[RuleBuilder] handleSave:', error.message);
            toast.error('خطأ في الحفظ: ' + error.message);
        }
    };

    const handleDelete = (id) => {
        setRuleToDelete(id);
    };

    const confirmDeleteRule = async () => {
        if (!ruleToDelete) return;
        const ruleObj = rules.find(r => r.id === ruleToDelete);
        try {
            const { error } = await supabase
                .from('hr_rules')
                .delete()
                .eq('id', ruleToDelete)
                .eq('company_id', company.id); // دفاع ثانٍ
            if (error) throw error;
            toast.success('تم حذف القانون بنجاح');
            await logAudit({
                companyId: company.id,
                userId: user?.id,
                action: 'DELETE_RULE',
                tableName: 'hr_rules',
                recordId: ruleToDelete,
                oldData: ruleObj ? { name: ruleObj.name, category: ruleObj.category } : null,
                newData: null,
            });
            fetchRules();
        } catch (error) {
            console.error('[RuleBuilder] confirmDeleteRule:', error.message);
            toast.error('لم يتم الحذف: ' + error.message);
        } finally {
            setRuleToDelete(null);
        }
    };

    const handleToggle = async (rule) => {
        const newActive = !rule.is_active;
        try {
            const { error } = await supabase
                .from('hr_rules')
                .update({ is_active: newActive })
                .eq('id', rule.id)
                .eq('company_id', company.id); // دفاع ثانٍ
            if (error) throw error;
            toast.success(newActive ? (t.rb_toast_toggle_active?.replace('{name}', rule.name) || `✅ تم تفعيل «${rule.name}»`) : (t.rb_toast_toggle_inactive?.replace('{name}', rule.name) || `⏸ تم إيقاف «${rule.name}»`));
            await logAudit({
                companyId: company.id,
                userId: user?.id,
                action: 'TOGGLE_RULE',
                tableName: 'hr_rules',
                recordId: rule.id,
                oldData: { is_active: rule.is_active },
                newData: { is_active: newActive },
            });
            fetchRules();
        } catch (error) {
            console.error('[RuleBuilder] handleToggle:', error.message);
            toast.error((language === 'en' ? 'Could not change rule status: ' : 'تعذر تغيير حالة القانون: ') + error.message);
        }
    };

    const handleDuplicate = async (rule) => {
        try {
            const { id, created_at, updated_at, ...rest } = rule;
            const payload = {
                ...rest,
                name: `${rule.name} (${language === 'en' ? 'Copy' : 'نسخة'})`,
                company_id: company.id,
                is_active: false, // النسخة تبدأ موقوفة حتى يراجعها المفوّض
            };
            const { data: inserted, error } = await supabase
                .from('hr_rules')
                .insert(payload)
                .select('id')
                .single();
            if (error) throw error;
            toast.success(t.rb_toast_duplicate_success?.replace('{name}', rule.name) || `تم نسخ «${rule.name}» بنجاح`);
            await logAudit({
                companyId: company.id,
                userId: null,
                action: 'DUPLICATE_RULE',
                tableName: 'hr_rules',
                recordId: inserted?.id,
                oldData: { source_id: id, name: rule.name },
                newData: { name: payload.name },
            });
            fetchRules();
        } catch (error) {
            console.error('[RuleBuilder] handleDuplicate:', error.message);
            toast.error((language === 'en' ? 'Could not duplicate rule: ' : 'تعذر نسخ القانون: ') + error.message);
        }
    };

    // Filtered rules
    const filtered = rules.filter(r => {
        if (filterCat !== 'all' && r.category !== filterCat) return false;
        if (filterActive === 'active' && !r.is_active) return false;
        if (filterActive === 'inactive' && r.is_active) return false;
        if (search && !r.name.includes(search) && !r.description?.includes(search)) return false;
        return true;
    });

    const activeCount = rules.filter(r => r.is_active).length;
    const deductCount = rules.filter(r => r.category === 'deduction').length;
    const bonusCount = rules.filter(r => r.category === 'bonus').length;

    const TRIGGER_EVENTS_TRANS = getTranslatedTriggerEvents(t, language);
    const RULE_CATEGORIES_TRANS = getTranslatedRuleCategories(t, language);

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
            <p style={{ color: 'var(--text-muted)' }}>{t.loading || 'جاري تحميل القوانين...'}</p>
        </div>
    );

    return (
        <div className="rb-page fade-in">
            {/* Quick Add Floating Button */}
            <button className="rb-fab" onClick={() => { setEditingRule(null); setShowModal(true); }} title={t.rb_add_rule || 'إنشاء قانون جديد'}>
                <HiOutlinePlus />
            </button>

            {/* Header */}
            <div className="rb-header">
                <div>
                    <h2 className="rb-title">{t.rulesTitle || 'منشئ القوانين'}</h2>
                    <p className="rb-subtitle">{t.rulesSubtitle || 'قوانين ذكية تُطبَّق تلقائياً على الرواتب والحضور'}</p>
                </div>
                <div className="rb-header-actions">
                    <button className="rb-btn-secondary" onClick={fetchRules}>
                        <HiOutlineRefresh /> {t.retryBtn || (language === 'en' ? 'Refresh' : 'تحديث')}
                    </button>
                    <button className="rb-btn-primary" onClick={() => { setEditingRule(null); setShowModal(true); }}>
                        <HiOutlinePlus /> {t.addRuleBtn || 'قانون جديد'}
                    </button>
                </div>
            </div>

            {/* Smart Stats Row - Inspired by Stitch Impact Summary */}
            <div className="rb-stats-row">
                <div className="rb-stat-card">
                    <div className="rb-stat-glow" style={{ background: 'linear-gradient(to bottom, #818cf8, transparent)' }} />
                    <div className="rb-stat-header">
                        <div className="rb-stat-icon" style={{ background: 'rgba(129, 140, 248, 0.1)', color: '#818cf8' }}>
                            <HiOutlineCash />
                        </div>
                        <div>
                            <div className="rb-stat-title">{language === 'en' ? 'Total Rules' : 'إجمالي القوانين'}</div>
                            <div className="rb-stat-value">{rules.length}</div>
                        </div>
                    </div>
                </div>
                <div className="rb-stat-card">
                    <div className="rb-stat-glow" style={{ background: 'linear-gradient(to bottom, #10b981, transparent)' }} />
                    <div className="rb-stat-header">
                        <div className="rb-stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                            <HiOutlineCheck />
                        </div>
                        <div>
                            <div className="rb-stat-title">{language === 'en' ? 'Active Rules' : 'قوانين نشطة'}</div>
                            <div className="rb-stat-value" style={{ color: '#10b981' }}>{activeCount}</div>
                        </div>
                    </div>
                </div>
                <div className="rb-stat-card">
                    <div className="rb-stat-glow" style={{ background: 'linear-gradient(to bottom, #ef4444, transparent)' }} />
                    <div className="rb-stat-header">
                        <div className="rb-stat-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                            <HiOutlineBell />
                        </div>
                        <div>
                            <div className="rb-stat-title">{language === 'en' ? 'Deduction Rules' : 'إجراءات خصم'}</div>
                            <div className="rb-stat-value" style={{ color: '#ef4444' }}>{deductCount}</div>
                        </div>
                    </div>
                </div>
                <div className="rb-stat-card">
                    <div className="rb-stat-glow" style={{ background: 'linear-gradient(to bottom, #059669, transparent)' }} />
                    <div className="rb-stat-header">
                        <div className="rb-stat-icon" style={{ background: 'rgba(5, 150, 105, 0.1)', color: '#059669' }}>
                            <HiOutlineGift />
                        </div>
                        <div>
                            <div className="rb-stat-title">{language === 'en' ? 'Bonus Policies' : 'سياسات حوافز'}</div>
                            <div className="rb-stat-value" style={{ color: '#059669' }}>{bonusCount}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="rb-filter-bar">
                <div className="rb-search-wrap">
                    <input 
                        className="rb-search"
                        placeholder={language === 'en' ? 'Search rules...' : 'بحــث فـي القوانيــن...'}
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                    />
                    <HiOutlineRefresh className="rb-search-icon" style={{ display: 'none' }} />
                </div>

                <div className="rb-filter-group">
                    {[{ value: 'all', label: t.all || (language === 'en' ? 'All' : 'الكل'), color: 'var(--obs-primary)' }, ...RULE_CATEGORIES_TRANS].map(cat => (
                        <button 
                            key={cat.value} 
                            onClick={() => setFilterCat(cat.value)} 
                            className={`rb-filter-btn ${filterCat === cat.value ? 'active' : ''}`}
                            style={filterCat === cat.value ? { background: `${cat.color}15`, borderColor: `${cat.color}50`, color: cat.color } : {}}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                <div className="rb-filter-group">
                    {[
                        { value: 'all', label: t.all || (language === 'en' ? 'All' : 'الكل') },
                        { value: 'active', label: language === 'en' ? 'Active ✅' : 'نشط ✅' },
                        { value: 'inactive', label: language === 'en' ? 'Stopped ⏸' : 'موقوف ⏸' },
                    ].map(f => (
                        <button 
                            key={f.value} 
                            onClick={() => setFilterActive(f.value)} 
                            className={`rb-filter-btn ${filterActive === f.value ? 'active' : ''}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Empty state */}
            {filtered.length === 0 && (
                <div className="rb-empty">
                    <span className="material-symbols-outlined" style={{ fontSize: '4rem', color: 'var(--text-muted)' }}>rule</span>
                    <h3>{rules.length === 0 ? (language === 'en' ? 'You haven\'t created any rules yet' : 'لم تقم بإنشاء أي قوانين بعد') : (language === 'en' ? 'No rules match your search' : 'لا توجد قوانين تطابق بحثك')}</h3>
                    <p>{rules.length === 0 ? (language === 'en' ? 'Use the rule builder to add automatic deductions or bonuses' : 'استخدم منشئ القوانين لإضافة قواعد الخصم أو المكافآت التلقائية') : (language === 'en' ? 'Try changing filters or search query' : 'حاول تغيير فلاتر البحث أو الفئات المحددة')}</p>
                    {rules.length === 0 && (
                        <button className="rb-btn-primary" onClick={() => setShowModal(true)}>
                            <HiOutlinePlus /> {language === 'en' ? 'Setup first rule' : 'إعداد أول قانون'}
                        </button>
                    )}
                </div>
            )}

            {/* Rules grid */}
            {filtered.length > 0 && (
                <div className="rb-grid">
                    {filtered.map(rule => (
                        <RuleCard
                            key={rule.id}
                            rule={rule}
                            currencySymbol={currencySymbol}
                            onEdit={r => { setEditingRule(r); setShowModal(true); }}
                            onDelete={handleDelete}
                            onDuplicate={handleDuplicate}
                            onToggle={handleToggle}
                        />
                    ))}
                </div>
            )}

            {/* Legend */}
            {rules.length > 0 && (
                <div className="rb-card" style={{ marginTop: '1.5rem', padding: '1.5rem', flexDirection: 'row', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                        {language === 'en' ? 'Available events:' : 'الأحداث المتاحة:'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {TRIGGER_EVENTS_TRANS.map(t_ev => (
                            <span key={t_ev.value} style={{
                                padding: '4px 12px', borderRadius: 20, fontSize: '0.8rem',
                                background: `${t_ev.color}15`, color: t_ev.color,
                                border: `1px solid ${t_ev.color}30`, fontWeight: 500
                            }}>
                                {t_ev.icon} {t_ev.label}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <RuleModal
                    rule={editingRule}
                    onClose={() => { setShowModal(false); setEditingRule(null); }}
                    onSave={handleSave}
                />
            )}

            <ConfirmModal
                isOpen={!!ruleToDelete}
                onClose={() => setRuleToDelete(null)}
                onConfirm={confirmDeleteRule}
                title={t.rb_delete_confirm_title || 'تأكيد حذف القانون'}
                message={t.rb_delete_confirm_msg || 'هل أنت متأكد من رغبتك في حذف هذا القانون نهائياً؟ هذا الإجراء قد يؤثر على حساب الرواتب المستقبلية.'}
                confirmText={t.rb_delete_btn || 'حذف القانون'}
            />
        </div>
    );
}

// -------------------------------------------------------------------------
const labelStyle = {
    display: 'block', fontSize: '0.82rem', fontWeight: 600,
    color: 'rgba(255,255,255,0.6)', marginBottom: 6,
};
const inputStyle = {
    width: '100%', height: 42, padding: '0 14px',
    background: 'var(--bg-tertiary, rgba(255,255,255,0.05))',
    border: '1.5px solid var(--border-color)',
    borderRadius: 10, color: '#fff', fontSize: 14,
    fontFamily: 'Cairo', outline: 'none', boxSizing: 'border-box',
};
const selectStyle = {
    height: 38, padding: '0 10px',
    background: 'var(--bg-secondary)',
    border: '1.5px solid var(--border-color)',
    borderRadius: 8, color: '#fff', fontSize: '0.82rem',
    fontFamily: 'Cairo', outline: 'none', cursor: 'pointer',
    boxSizing: 'border-box',
};
const numInputStyle = {
    height: 38, padding: '0 10px',
    background: 'var(--bg-secondary)',
    border: '1.5px solid var(--border-color)',
    borderRadius: 8, color: '#fff', fontSize: '0.85rem',
    fontFamily: 'Cairo', outline: 'none', boxSizing: 'border-box',
    textAlign: 'center',
};
const cardIconBtn = {
    width: 34, height: 34, borderRadius: 8,
    border: '1px solid var(--border-color)',
    background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', fontSize: '0.95rem', transition: 'all 0.15s',
};

export default RuleBuilder;