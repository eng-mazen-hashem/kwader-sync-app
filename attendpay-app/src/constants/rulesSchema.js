import React from 'react';
import { z } from 'zod';
import { HiOutlineCash, HiOutlineGift, HiOutlineBell, HiOutlineFlag } from 'react-icons/hi';

// -------------------------------------------------------------------------

export const ActionSchema = z.object({
    id: z.string().optional(),
    type: z.string().min(1, 'نوع الإجراء مطلوب'),
    value: z.union([z.number(), z.string()]).refine(val => val !== '', 'القيمة مطلوبة'),
    note: z.string().optional(),
});

export const ConditionSchema = z.object({
    id: z.string().optional(),
    field: z.string().min(1, 'الحقل مطلوب'),
    operator: z.string().min(1, 'المعامل مطلوب'),
    value: z.union([z.number(), z.string()]).refine(val => val !== '', 'القيمة مطلوبة'),
    value2: z.union([z.number(), z.string()]).optional(),
});

export const RuleSchema = z.object({
    name: z.string().min(3, 'اسم القانون يجب أن يكون 3 أحرف على الأقل'),
    description: z.string().optional(),
    icon: z.string().default('⚖️'),
    color: z.string().default('var(--obs-primary)'),
    category: z.string().default('deduction'),
    trigger_event: z.string().min(1, 'الحدث المشغل مطلوب'),
    logic_mode: z.enum(['ALL', 'ANY']).default('ALL'),
    priority: z.number().min(0).max(100).default(0),
    is_active: z.boolean().default(true),
    apply_once: z.boolean().default(false),
    conditions: z.array(ConditionSchema).min(1, 'يجب إضافة شرط واحد على الأقل'),
    actions: z.array(ActionSchema).min(1, 'يجب إضافة إجراء واحد على الأقل'),
});

// -------------------------------------------------------------------------

export const TRIGGER_EVENTS = [
    { value: 'late_arrival', label: 'تأخر في الدخول', icon: '⏰', color: 'var(--color-warning)' },
    { value: 'early_leave', label: 'انصراف مبكر', icon: '🚪', color: 'var(--color-error)' },
    { value: 'absence', label: 'غياب', icon: '❌', color: 'var(--color-danger)' },
    { value: 'overtime', label: 'عمل إضافي', icon: '⚡', color: 'var(--color-success)' },
    { value: 'incomplete_punch', label: 'بصمة ناقصة', icon: '👆', color: 'var(--obs-secondary)' },
    { value: 'consecutive_late', label: 'تأخر متكرر', icon: '🔁', color: 'var(--color-warning)' },
    { value: 'consecutive_absence', label: 'غياب متكرر', icon: '📅', color: 'var(--color-danger)' },
    { value: 'work_hours', label: 'ساعات العمل الفعلية', icon: '🕐', color: 'var(--obs-primary)' },
];

export const CONDITION_FIELDS = {
    late_arrival: [
        { value: 'late_minutes', label: 'دقائق التأخر', unit: 'دقيقة' },
        { value: 'occurrence_in_month', label: 'عدد مرات التأخر في الشهر', unit: 'مرة' },
        { value: 'day_of_week', label: 'يوم الأسبوع', unit: '' },
    ],
    early_leave: [
        { value: 'early_leave_minutes', label: 'دقائق الانصراف المبكر', unit: 'دقيقة' },
        { value: 'occurrence_in_month', label: 'عدد مرات الانصراف المبكر', unit: 'مرة' },
    ],
    absence: [
        { value: 'absence_days', label: 'أيام الغياب في الشهر', unit: 'يوم' },
        { value: 'consecutive_days', label: 'أيام غياب متتالية', unit: 'يوم' },
        { value: 'day_of_week', label: 'يوم الأسبوع', unit: '' },
    ],
    overtime: [
        { value: 'overtime_hours', label: 'ساعات العمل الإضافي', unit: 'ساعة' },
        { value: 'overtime_minutes', label: 'دقائق العمل الإضافي', unit: 'دقيقة' },
    ],
    incomplete_punch: [
        { value: 'occurrence_in_month', label: 'عدد المرات في الشهر', unit: 'مرة' },
    ],
    consecutive_late: [
        { value: 'consecutive_count', label: 'عدد أيام التأخر المتتالية', unit: 'يوم' },
        { value: 'late_minutes', label: 'دقائق التأخر في كل مرة', unit: 'دقيقة' },
    ],
    consecutive_absence: [
        { value: 'consecutive_days', label: 'أيام الغياب المتتالية', unit: 'يوم' },
    ],
    work_hours: [
        { value: 'work_hours', label: 'ساعات العمل الفعلية', unit: 'ساعة' },
        { value: 'work_minutes', label: 'دقائق العمل الفعلية', unit: 'دقيقة' },
    ],
};

export const OPERATORS = [
    { value: 'gt', label: 'أكبر من', symbol: '>' },
    { value: 'gte', label: 'أكبر من أو يساوي', symbol: '≥' },
    { value: 'lt', label: 'أصغر من', symbol: '<' },
    { value: 'lte', label: 'أصغر من أو يساوي', symbol: '≤' },
    { value: 'eq', label: 'يساوي', symbol: '=' },
    { value: 'between', label: 'بين', symbol: '↔' },
];

export const DAYS_OF_WEEK = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];


export const ACTION_TYPES = [
    { value: 'deduct_fixed', label: 'خصم مبلغ ثابت', icon: '💸', color: 'var(--color-error)', category: 'deduction' },
    { value: 'deduct_percentage', label: 'خصم نسبة من الراتب', icon: '📉', color: 'var(--color-warning)', category: 'deduction' },
    { value: 'deduct_daily_rate', label: 'خصم × أيام عمل', icon: '📆', color: 'var(--color-danger)', category: 'deduction' },
    { value: 'deduct_per_minute', label: 'خصم لكل دقيقة', icon: '⏱', color: 'var(--color-error)', category: 'deduction' },
    { value: 'add_bonus', label: 'إضافة مكافأة / بدل', icon: '🎁', color: 'var(--color-success)', category: 'bonus' },
    { value: 'add_percentage', label: 'إضافة نسبة من الراتب', icon: '📈', color: 'var(--color-success)', category: 'bonus' },
    { value: 'send_warning', label: 'إرسال تحذير', icon: '⚠️', color: 'var(--color-warning)', category: 'warning' },
    { value: 'flag_review', label: 'تحديد للمراجعة', icon: '🚩', color: 'var(--obs-secondary)', category: 'flag' },
    { value: 'double_deduction', label: 'مضاعفة الخصم (×2)', icon: '✖️', color: 'var(--obs-tertiary)', category: 'deduction' },
];

export const RULE_CATEGORIES = [
    { value: 'deduction', label: 'خصم', icon: <HiOutlineCash />, color: 'var(--color-error)' },
    { value: 'bonus', label: 'مكافأة', icon: <HiOutlineGift />, color: 'var(--color-success)' },
    { value: 'warning', label: 'تحذير', icon: <HiOutlineBell />, color: 'var(--color-warning)' },
    { value: 'flag', label: 'مراجعة', icon: <HiOutlineFlag />, color: 'var(--obs-secondary)' },
];

export const RULE_COLORS = [
    'var(--obs-primary)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-error)',
    'var(--color-info)', 'var(--obs-secondary)', 'var(--obs-tertiary)', 'var(--color-accent)'
];
export const RULE_ICONS = ['📋', '⚖️', '🎯', '🔒', '💡', '🛡️', '⚡', '🔔', '📊', '🏷️'];
