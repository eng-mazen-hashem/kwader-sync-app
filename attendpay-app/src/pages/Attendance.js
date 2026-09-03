import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Calendar, Users, UserX, Clock, Plus, ChevronLeft,
    ChevronRight, Fingerprint, X, Search,
    Wifi, ShieldCheck, PenLine, AlertCircle,
    FileDown, BarChart3, LogIn, LogOut
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { calculateRecordMetrics } from '../utils/attendanceCalculator';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';
import { logAudit } from '../utils/auditLogger';
import './Attendance.css';

/* ------------------------------------------------------------------------- */
const fmtTime = (t) => (t ? String(t).substring(0, 5) : null);

/* ------------------------------------------------------------------------- */
const STATUS_CFG = {
    present:          { label: 'statusPresent',        cls: 'att-chip-present',         var: '--att-present' },
    late:             { label: 'statusLate',            cls: 'att-chip-late',            var: '--att-late' },
    absent:           { label: 'statusAbsent',          cls: 'att-chip-absent',          var: '--att-absent' },
    early_leave:      { label: 'statusEarlyLeave',      cls: 'att-chip-early',           var: '--att-early' },
    leave:            { label: 'statusLeave',           cls: 'att-chip-leave',           var: '--att-leave' },
    manual:           { label: 'statusManual',          cls: 'att-chip-manual',          var: '--att-manual' },
    missing_checkout: { label: 'statusMissingCheckout', cls: 'att-chip-missing-checkout', var: '--att-missing' },
    missing_checkin:  { label: 'statusMissingCheckin',  cls: 'att-chip-missing-checkout', var: '--att-missing' },
};
const getCfg = (status) => STATUS_CFG[status] || STATUS_CFG.leave;

/* ------------------------------------------------------------------------- */
const AVATARS = [
    'var(--accent-primary)',
    'var(--accent-secondary)',
    'var(--color-info)',
    'var(--color-warning)',
    'var(--color-success)',
];
const avColor = (name = '') => AVATARS[name.charCodeAt(0) % AVATARS.length];

/* ═══════════════════════════════════════════════════════════════════════════
   OBSIDIAN TOOLTIP (micro-interaction on hover)
══════════════════════════════════════════════════════════════════════════════ */
function ObsidianTooltip({ record, t }) {
    const isManual = record.status === 'manual';
    const isAbsent = record.status === 'absent';

    const bento = isAbsent ? [
        {
            icon: <AlertCircle size={16} />,
            label: t.thStatus ?? 'Status',
            value: 'No punch-in recorded',
            type: 'danger',
        },
    ] : [
        {
            icon: <Clock size={16} />,
            label: t.thWorkHours ?? 'Work Hours',
            value: record.work_hours > 0 ? `${record.work_hours}h` : '—',
            type: 'info',
        },
        {
            icon: record.late_minutes > 0 ? <Clock size={16} /> : <ShieldCheck size={16} />,
            label: t.thLateMinutes ?? 'Late',
            value: record.late_minutes > 0
                ? `${record.late_minutes} min late`
                : (record.check_in ? 'On time' : '—'),
            type: record.late_minutes > 0 ? 'warning' : 'success',
        },
        {
            icon: isManual ? <PenLine size={16} /> : <Fingerprint size={16} />,
            label: 'Method',
            value: isManual ? 'Manual Entry' : 'Biometric',
            type: isManual ? 'warning' : 'info',
        },
        {
            icon: <Wifi size={16} />,
            label: 'Device',
            value: record.employee?.device_pin ? `PIN: ${record.employee.device_pin}` : `PIN: ${record.employees?.device_pin ?? '—'}`,
            type: 'muted',
        },
    ];

    return (
        <div className="att-tooltip">
            {bento.map((item, i) => (
                <div key={i} className={`att-tooltip-cell att-tooltip-${item.type}`}>
                    <span className="att-tooltip-label">{item.label}</span>
                    <div className="att-tooltip-val">
                        <span className="att-tooltip-icon">{item.icon}</span>
                        {item.value}
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TIMELINE ROW (each attendance record)
══════════════════════════════════════════════════════════════════════════════ */
function TimelineRow({ record, index, t, labels, onRefresh }) {
    const [hovered, setHovered] = useState(false);
    const [resolving, setResolving] = useState(false);
    const cfg = getCfg(record.status);
    const name = record.employee_name || '—';
    const checkInTime = fmtTime(record.check_in);
    const isAbsent = record.status === 'absent';
    const isManual = record.status === 'manual';

    // split HH:MM into HH and MM for the time column
    const timeParts = checkInTime ? checkInTime.split(':') : null;
    const timeHH = timeParts ? timeParts[0] : '--';
    const timeMM = timeParts ? timeParts[1] : '--';
    const ampm = timeParts ? (parseInt(timeHH) >= 12 ? 'PM' : 'AM') : 'NA';

    const handleResolve = async (status) => {
        setResolving(true);
        try {
            // 1. Update override_status
            const { error: updateError } = await supabase
                .from('processed_attendance')
                .update({ override_status: status })
                .eq('id', record.id);

            if (updateError) throw updateError;

            // 2. Touch raw logs to trigger recalculation (reprocess the logical day for the employee)
            // We find any raw log for this logical day and touch its is_processed to trigger process_raw_attendance_trigger()
            const { data: rawLogs, error: fetchError } = await supabase
                .from('raw_attendance_logs')
                .select('id')
                .eq('company_id', record.company_id || record.employees?.company_id)
                .eq('user_pin', record.employees?.device_pin)
                .order('timestamp', { ascending: true })
                .limit(1);

            if (!fetchError && rawLogs && rawLogs.length > 0) {
                await supabase
                    .from('raw_attendance_logs')
                    .update({ is_processed: false })
                    .eq('id', rawLogs[0].id);
            }

            toast.success('تم حل التعارض بنجاح');
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error('[TimelineRow] handleResolve error:', err);
            toast.error('حدث خطأ أثناء حل التعارض');
        } finally {
            setResolving(false);
        }
    };

    return (
        <motion.div
            className={`att-row ${isAbsent ? 'att-row-absent' : ''}`}
            style={{ borderInlineStartColor: `var(${cfg.var})` }}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.04, duration: 0.25 }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >

            <div className={`att-time-col ${isAbsent ? 'att-time-col-absent' : ''}`}>
                <span className="att-time-hh">{timeHH}:{timeMM}</span>
                <span className="att-time-ampm">{ampm}</span>
                <div
                    className="att-timeline-dot"
                    style={{
                        background: `var(${cfg.var})`,
                        boxShadow: record.status !== 'leave' ? `0 0 12px var(${cfg.var})` : 'none',
                    }}
                />
            </div>


            <div className="att-info-block">
                {/* Top: name + status chip */}
                <div className="att-info-top">
                    <div className="att-info-left">
                        <div
                            className="att-avatar"
                            style={{
                                background: isAbsent ? 'var(--color-danger-bg)' : avColor(name),
                                opacity: isAbsent ? 0.7 : 1,
                            }}
                        >
                            {name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="att-name">{name}</h3>
                            <div className="att-meta">
                                {checkInTime && (
                                    <span className="att-meta-time">
                                        <Clock size={11} />
                                        {fmtTime(record.check_in)} → {fmtTime(record.check_out) ?? '…'}
                                    </span>
                                )}
                                {record.work_hours > 0 && (
                                    <span className="att-meta-hours">
                                        {record.work_hours}h
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Status chip + manual badge + mark absent button */}
                    <div className="att-chips">
                        <div className={`att-status-chip ${cfg.cls}`}>
                            <span
                                className={`att-dot ${['present','late'].includes(record.status) ? 'att-dot-pulse' : ''}`}
                                style={{ background: `var(${cfg.var})` }}
                            />
                            {labels[record.status] || record.status}
                        </div>
                        {isManual && (
                            <div className="att-manual-badge">
                                <PenLine size={11} />
                                {t.statusManual ?? 'Manual'}
                            </div>
                        )}
                        {!isAbsent && (
                            <button
                                className="att-btn-mark-absent-sm"
                                title="تحويل السجل إلى غائب وتصفير الساعات الخاطئة"
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!window.confirm(`هل أنت تأكد من تسجيل الموظف (${name}) كـ غائب بتاريخ ${record.date || 'اليوم'} وتصفير الساعات؟`)) return;
                                    setResolving(true);
                                    try {
                                        if (record.id) {
                                            await supabase
                                                .from('processed_attendance')
                                                .update({
                                                    check_in: null,
                                                    check_out: null,
                                                    work_hours: 0,
                                                    late_minutes: 0,
                                                    early_leave_minutes: 0,
                                                    status: 'absent',
                                                    status_reason: 'تم التعديل إلى غائب بواسطة المدير'
                                                })
                                                .eq('id', record.id);
                                        }

                                        const pin = record.employees?.device_pin || record.user_pin;
                                        const cid = record.company_id || record.employees?.company_id;
                                        const targetDate = record.date;
                                        if (pin && cid && targetDate) {
                                            const nextD = new Date(targetDate);
                                            nextD.setDate(nextD.getDate() + 1);
                                            const nextStr = nextD.toISOString().split('T')[0];
                                            const dayStart = `${targetDate}T00:00:00`;
                                            const dayEnd   = `${nextStr}T14:00:00`;
                                            await supabase
                                                .from('raw_attendance_logs')
                                                .delete()
                                                .eq('company_id', cid)
                                                .eq('user_pin', pin)
                                                .gte('timestamp', dayStart)
                                                .lte('timestamp', dayEnd);
                                        }

                                        toast.success(`تم تسجيل ${name} كـ غائب بنجاح`);
                                        if (onRefresh) onRefresh();
                                    } catch (err) {
                                        console.error('[TimelineRow] handleMarkAbsent error:', err);
                                        toast.error('حدث خطأ أثناء تحويل السجل إلى غائب');
                                    } finally {
                                        setResolving(false);
                                    }
                                }}
                                disabled={resolving}
                            >
                                <UserX size={12} />
                                تحويل لغائب
                            </button>
                        )}
                    </div>
                </div>

                {/* Absent no-punch banner */}
                {isAbsent && (
                    <div className="att-absent-banner">
                        <AlertCircle size={14} style={{ color: '#f87171' }} />
                        <span>{t.noAttendanceData ?? 'No punch-in recorded'}</span>
                    </div>
                )}

                {/* Missing checkout banner / Status Reason */}
                {record.status_reason ? (
                    <div className={`att-reason-banner ${record.status === 'missing_checkout' ? 'att-reason-warning' : 'att-reason-info'}`} style={{
                        marginTop: '0.5rem',
                        padding: '0.6rem 0.8rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: record.status === 'missing_checkout' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(99, 102, 241, 0.08)',
                        border: record.status === 'missing_checkout' ? '1px solid rgba(239, 68, 68, 0.15)' : '1px solid rgba(99, 102, 241, 0.15)',
                        color: record.status === 'missing_checkout' ? '#f87171' : '#818cf8'
                    }}>
                        <AlertCircle size={14} style={{ flexShrink: 0 }} />
                        <span>{record.status_reason}</span>
                    </div>
                ) : (
                    record.status === 'missing_checkout' && (
                        <div className="att-missing-checkout-banner">
                            <AlertCircle size={14} />
                            <span>{t.missingCheckoutBanner}</span>
                        </div>
                    )
                )}

                {/* Biometric-manual conflict warning banner */}
                {record.is_conflicted && (
                    <div className="att-conflict-banner" style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px dashed rgba(239, 68, 68, 0.35)',
                        padding: '0.75rem 1rem',
                        borderRadius: '0.75rem',
                        marginTop: '0.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171', fontSize: '0.82rem', fontWeight: 600 }}>
                            <AlertCircle size={14} />
                            <span>تعارض بين البصمة الآلية واليدوية</span>
                            {record.override_status !== 'none' && (
                                <span style={{
                                    fontSize: '0.75rem',
                                    background: 'rgba(52, 211, 153, 0.15)',
                                    color: '#34d399',
                                    padding: '2px 8px',
                                    borderRadius: '4px'
                                }}>
                                    تم التجاوز بنجاح ({record.override_status === 'approved_manual' ? 'يدوي' : 'جهاز البصمة'})
                                </span>
                            )}
                        </div>
                        
                        {/* Override options */}
                        {record.override_status === 'none' && (
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                                <button
                                    onClick={() => handleResolve('approved_manual')}
                                    disabled={resolving}
                                    style={{
                                        background: 'rgba(245, 158, 11, 0.15)',
                                        border: '1px solid rgba(245, 158, 11, 0.3)',
                                        color: '#f59e0b',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <PenLine size={12} />
                                    اعتماد السجل اليدوي
                                </button>
                                <button
                                    onClick={() => handleResolve('approved_device')}
                                    disabled={resolving}
                                    style={{
                                        background: 'rgba(99, 102, 241, 0.15)',
                                        border: '1px solid rgba(99, 102, 241, 0.3)',
                                        color: '#818cf8',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <Fingerprint size={12} />
                                    اعتماد بصمة الجهاز
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Punch list details */}
                {record.punch_details && Array.isArray(record.punch_details) && record.punch_details.length > 0 && (
                    <div className="att-punch-details-row" style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        marginTop: '0.75rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', width: '100%', marginBottom: '0.15rem' }}>
                            <Fingerprint size={12} /> البصمات المسجلة اليوم ({record.punch_details.length}):
                        </span>
                        {record.punch_details.map((p, pIdx) => {
                            const isEven = pIdx % 2 === 0;
                            const timeParts = p.time.split(':');
                            const hh = parseInt(timeParts[0]);
                            const mm = timeParts[1];
                            const formattedTime = `${hh > 12 ? hh - 12 : (hh === 0 ? 12 : hh)}:${mm} ${hh >= 12 ? 'PM' : 'AM'}`;
                            const isManual = p.method === 'manual';

                            return (
                                <div key={pIdx} style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    fontSize: '0.75rem',
                                    background: isManual ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                                    border: isManual ? '1px dashed rgba(245, 158, 11, 0.25)' : '1px solid rgba(255, 255, 255, 0.06)',
                                    color: isManual ? '#f59e0b' : 'var(--color-text-primary)',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                }}>
                                    <span style={{
                                        width: '6px',
                                        height: '6px',
                                        borderRadius: '50%',
                                        background: isManual ? '#f59e0b' : (isEven ? '#10b981' : '#3b82f6')
                                    }} />
                                    <span style={{ fontWeight: 600 }}>{formattedTime}</span>
                                    <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>
                                        ({isManual ? 'يدوي' : 'جهاز'})
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Obsidian Tooltip on hover */}
                <AnimatePresence>
                    {hovered && !isAbsent && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15 }}
                        >
                            <ObsidianTooltip record={record} t={t} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MANUAL FINGERPRINT MODAL (original logic fully preserved, glass-panel reskin)
══════════════════════════════════════════════════════════════════════════════ */
function ManualFingerprintModal({ isOpen, onClose, onSaved, employees, company, user, selectedDate, shifts, shiftMappings }) {
    const { t } = useLocale();
    const [form, setForm] = useState({ employee_id: '', type: 'check_in', time: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            setForm({ employee_id: '', type: 'check_in', time: `${hh}:${mm}` });
            setError('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!form.employee_id) { setError(t.errorChooseEmployee); return; }
        if (!form.time)        { setError(t.errorChooseTime); return; }

        setSaving(true);
        setError('');
        try {
            const timestamp = `${selectedDate}T${form.time}:00`;
            await supabase.from('raw_attendance_logs').insert({
                company_id: company.id,
                user_pin  : employees.find(e => e.id === form.employee_id)?.device_pin || 'MANUAL',
                timestamp,
                status    : form.type === 'check_in' ? '0' : '1',
                punch_method: 'manual',
                is_processed: false, // Let DB trigger handle processing
            });

            await logAudit(
                company.id, user?.email, 'ADD_MANUAL_LOG',
                t.auditManualLogAdded
                    ?.replace('{employeeId}', form.employee_id)
                    ?.replace('{date}', selectedDate)
                    ?.replace('{time}', form.time)
            );

            const empName = employees.find(e => e.id === form.employee_id)?.name || '';
            const punchLabel = form.type === 'check_in' ? '🟢 تسجيل دخول' : '🔵 تسجيل خروج';
            toast.success(`${punchLabel} — ${empName} — ${form.time}`, { duration: 4000 });
            onSaved();
            onClose();
        } catch (err) {
            console.error('[Attendance] handleSave:', err.message);
            setError(t.errorSavingFingerprint);
            toast.error(t.errorSavingFingerprint);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="att-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="att-modal-header">
                    <div className="att-modal-icon">
                        <Fingerprint size={20} />
                    </div>
                    <div>
                        <h3 className="att-modal-title">{t.addManualFingerprintTitle}</h3>
                        <p className="att-modal-sub">{t.addManualFingerprintSubtitle}</p>
                    </div>
                    <button className="att-modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="att-modal-body">
                    {/* Employee select */}
                    <div className="att-field">
                        <label className="att-field-label">{t.employeeSelectLabel}</label>
                        <select className="att-field-select" value={form.employee_id}
                            onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))}>
                            <option value="">{t.chooseEmployeePlaceholder}</option>
                            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                        </select>
                    </div>

                    {/* Type toggle */}
                    <div className="att-field">
                        <label className="att-field-label">{t.fingerprintTypeLabel}</label>
                        <div className="att-type-toggle">
                            {[{ val: 'check_in', label: t.checkInLabelText },
                              { val: 'check_out', label: t.checkOutLabelText }].map(opt => (
                                <button key={opt.val}
                                    className={`att-type-btn ${form.type === opt.val ? 'active' : ''}`}
                                    onClick={() => setForm(p => ({ ...p, type: opt.val }))}>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Time */}
                    <div className="att-field">
                        <label className="att-field-label">{t.timeLabel}</label>
                        <input className="att-field-input" type="time" value={form.time}
                            onChange={e => setForm(p => ({ ...p, time: e.target.value }))} />
                    </div>

                    {/* Date info */}
                    <div className="att-info-bar">
                        <Calendar size={14} />
                        {t.dateSelectedNotice?.replace('{date}', selectedDate)}
                    </div>

                    {error && <div className="att-error-bar"><AlertCircle size={14} /> {error}</div>}
                </div>

                <div className="att-modal-footer">
                    <button className="att-modal-btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? t.saving : t.saveFingerprintBtn}
                    </button>
                    <button className="att-modal-btn-secondary" onClick={onClose}>{t.cancelBtn}</button>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ATTENDANCE REPORT MODAL — per-employee detailed report + Excel export
══════════════════════════════════════════════════════════════════════════════ */
function AttendanceReportModal({ isOpen, onClose, employees, company }) {
    const { t } = useLocale();
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
    });
    const [dateTo,  setDateTo]  = useState(new Date().toISOString().split('T')[0]);
    const [empId,   setEmpId]   = useState('');
    const [loading, setLoading] = useState(false);
    const [rows,    setRows]    = useState([]);
    const [fetched, setFetched] = useState(false);

    useEffect(() => { if (isOpen) { setRows([]); setFetched(false); } }, [isOpen]);

    if (!isOpen) return null;

    const statusLabel = (s) => ({
        present: 'حاضر', late: 'متأخر', absent: 'غائب',
        early_leave: 'انصراف مبكر', leave: 'إجازة', manual: 'يدوي',
        missing_checkout: 'انصراف مفقود (خصم نصف شفت) ⚠️',
        missing_checkin: 'دخول مفقود (خصم نصف شفت) ⚠️',
    }[s] || s);

    const fetchReport = async () => {
        if (!empId) { toast.error(t.errSelectEmployee); return; }
        setLoading(true);
        try {
            const { data: shiftData } = await supabase
                .from('shift_employees')
                .select('shifts(start_time, end_time, shift_type, target_hours, deduct_half_on_missing, has_break, break_duration)')
                .eq('employee_id', empId)
                .limit(1);

            const empShift = Array.isArray(shiftData) && shiftData.length > 0 ? shiftData[0]?.shifts : null;

            const { data, error } = await supabase
                .from('processed_attendance')
                .select('id, date, check_in, check_out, status, work_hours, late_minutes, early_leave_minutes')
                .eq('company_id', company.id)
                .eq('employee_id', empId)
                .gte('date', dateFrom)
                .lte('date', dateTo)
                .order('date', { ascending: true });
            if (error) throw error;

            let shiftHours = 8;
            if (empShift) {
                if (empShift.shift_type === 'flexible') {
                    shiftHours = Number(empShift.target_hours || 8);
                } else if (empShift.start_time && empShift.end_time) {
                    const [sh, sm] = empShift.start_time.split(':').map(Number);
                    const [eh, em] = empShift.end_time.split(':').map(Number);
                    let sMins = sh * 60 + sm;
                    let eMins = eh * 60 + em;
                    if (eMins <= sMins) eMins += 24 * 60;
                    let durationMins = eMins - sMins;
                    if (empShift.has_break && empShift.break_duration) {
                        durationMins -= Number(empShift.break_duration);
                    }
                    shiftHours = Math.max(0, durationMins / 60);
                }
            }
            const halfShiftHours = Math.round((shiftHours / 2) * 100) / 100;

            const processedRows = (data || []).map(r => {
                const isMissing = r.status === 'missing_checkout' || r.status === 'missing_checkin' || (!r.check_in && r.check_out) || (r.check_in && !r.check_out);
                if (isMissing && empShift?.deduct_half_on_missing) {
                    return {
                        ...r,
                        work_hours: halfShiftHours
                    };
                }
                return r;
            });

            setRows(processedRows);
            setFetched(true);
        } catch {
            toast.error(t.errFetchReport);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAbsent = async (r) => {
        if (!window.confirm(`هل أنت تأكد من تسجيل الموظف كـ غائب بتاريخ ${r.date} وتصفير الساعات الخاطئة؟`)) {
            return;
        }
        setLoading(true);
        try {
            if (r.id) {
                await supabase
                    .from('processed_attendance')
                    .update({
                        check_in: null,
                        check_out: null,
                        work_hours: 0,
                        late_minutes: 0,
                        early_leave_minutes: 0,
                        status: 'absent',
                        status_reason: 'تم التعديل إلى غائب بواسطة المدير'
                    })
                    .eq('id', r.id);
            }

            const emp = employees.find(e => e.id === empId);
            if (emp?.device_pin && company?.id) {
                const nextD = new Date(r.date);
                nextD.setDate(nextD.getDate() + 1);
                const nextStr = nextD.toISOString().split('T')[0];
                const dayStart = `${r.date}T00:00:00`;
                const dayEnd   = `${nextStr}T14:00:00`;
                await supabase
                    .from('raw_attendance_logs')
                    .delete()
                    .eq('company_id', company.id)
                    .eq('user_pin', emp.device_pin)
                    .gte('timestamp', dayStart)
                    .lte('timestamp', dayEnd);
            }

            toast.success(`تم تحويل يوم ${r.date} إلى غائب بنجاح`);
            await fetchReport();
        } catch (err) {
            console.error('[AttendanceReportModal] handleMarkAbsent error:', err);
            toast.error('حدث خطأ أثناء تعديل السجل');
            setLoading(false);
        }
    };

    const summary = {
        present: rows.filter(r => ['present', 'manual'].includes(r.status)).length,
        missingPunch: rows.filter(r => ['missing_checkout', 'missing_checkin'].includes(r.status)).length,
        late:    rows.filter(r => r.status === 'late').length,
        absent:  rows.filter(r => r.status === 'absent').length,
        leave:   rows.filter(r => r.status === 'leave').length,
        totalHours: rows.reduce((s, r) => s + (Number(r.work_hours) || 0), 0).toFixed(1),
        totalLate:  rows.reduce((s, r) => s + (Number(r.late_minutes) || 0), 0),
    };

    const exportExcel = () => {
        if (!rows.length) return;
        const empName = employees.find(e => e.id === empId)?.name || empId;
        const headers = [
            t.reportColDate, t.reportColCheckIn, t.reportColCheckOut, 
            t.reportColWorkHours, t.reportColLate, t.reportColEarly, t.reportColStatus
        ];
        const dataRows = rows.map(r => [
            r.date,
            r.check_in  ? r.check_in.substring(0, 5)  : '—',
            r.check_out ? r.check_out.substring(0, 5) : '—',
            r.work_hours         ?? 0,
            r.late_minutes       ?? 0,
            r.early_leave_minutes ?? 0,
            statusLabel(r.status),
        ]);
        const totalsRow = [
            t.reportTotalsRow, '', '',
            Number(summary.totalHours),
            summary.totalLate, '', '',
        ];
        const sheetData = [
            [t.reportTitleExcel],
            [t.reportEmpNameExcel?.replace('{name}', empName)],
            [t.reportPeriodExcel?.replace('{from}', dateFrom).replace('{to}', dateTo)],
            [t.reportSummaryExcel?.replace('{present}', summary.present).replace('{late}', summary.late).replace('{absent}', summary.absent).replace('{leave}', summary.leave)],
            [],
            headers,
            ...dataRows,
            [],
            totalsRow,
        ];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!cols'] = [14, 12, 12, 14, 16, 18, 14].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, t.reportTitleExcel);
        XLSX.writeFile(wb, `attendance_report_${empName}_${dateFrom}_${dateTo}.xlsx`);
        toast.success(t.exportSuccess);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="att-report-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="att-modal-header">
                    <div className="att-modal-icon" style={{ background: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.3)', color: '#34d399' }}>
                        <BarChart3 size={20} />
                    </div>
                    <div>
                        <h3 className="att-modal-title">{t.reportModalTitle}</h3>
                        <p className="att-modal-sub">{t.reportModalSub}</p>
                    </div>
                    <button className="att-modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="att-modal-body att-report-body">
                    {/* Filters */}
                    <div className="att-report-filters">
                        <div className="att-field att-field-wide">
                            <label className="att-field-label">{t.empSelectLabel}</label>
                            <select className="att-field-select" value={empId} onChange={e => setEmpId(e.target.value)}>
                                <option value="">{t.chooseEmployeePlaceholder}</option>
                                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                            </select>
                        </div>
                        <div className="att-field">
                            <label className="att-field-label">{t.fromDateLabel}</label>
                            <input className="att-field-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                        </div>
                        <div className="att-field">
                            <label className="att-field-label">{t.toDateLabel}</label>
                            <input className="att-field-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                        </div>
                        <button className="att-btn-primary att-report-fetch-btn" onClick={fetchReport} disabled={loading}>
                            {loading ? '...' : t.fetchReportBtn}
                        </button>
                    </div>

                    {/* Summary chips */}
                    {fetched && rows.length > 0 && (
                        <div className="att-report-summary">
                            {[
                                { label: t.repDaysPresent,  val: summary.present,          cls: 'rep-green'  },
                                { label: 'بصمة مفقودة (نصف شفت)', val: summary.missingPunch, cls: 'rep-amber' },
                                { label: t.repLate,         val: summary.late,             cls: 'rep-amber'  },
                                { label: t.repAbsent,       val: summary.absent,           cls: 'rep-red'    },
                                { label: t.repLeave,        val: summary.leave,            cls: 'rep-blue'   },
                                { label: t.repWorkHours,    val: `${summary.totalHours}h`, cls: 'rep-indigo' },
                                { label: t.repTotalLate,    val: `${summary.totalLate}m`,  cls: 'rep-amber' },
                            ].map((s, i) => (
                                <div key={i} className={`att-rep-chip ${s.cls}`}>
                                    <span className="att-rep-chip-val">{s.val}</span>
                                    <span className="att-rep-chip-label">{s.label}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Table */}
                    {fetched && (
                        rows.length === 0
                            ? <div className="att-report-empty">{t.repNoData}</div>
                            : (
                                <div className="att-report-table-wrap">
                                    <table className="att-report-table">
                                        <thead>
                                            <tr>
                                                <th>التاريخ</th>
                                                <th><LogIn size={12} /> دخول</th>
                                                <th><LogOut size={12} /> خروج</th>
                                                <th>ساعات</th>
                                                <th>تأخر (د)</th>
                                                <th>مبكر (د)</th>
                                                <th>الحالة</th>
                                                <th>الإجراءات</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((r, i) => (
                                                <tr key={i} className={`att-rep-row-${r.status}`}>
                                                    <td className="att-rep-date">{r.date}</td>
                                                    <td className="att-rep-in">{r.check_in  ? r.check_in.substring(0,5)  : <span className="att-rep-dash">—</span>}</td>
                                                    <td className="att-rep-out">{r.check_out ? r.check_out.substring(0,5) : <span className="att-rep-dash">—</span>}</td>
                                                    <td className="att-rep-hours">{r.work_hours ? `${r.work_hours}h` : '—'}</td>
                                                    <td className={r.late_minutes > 0 ? 'att-rep-late-val' : ''}>{r.late_minutes || '—'}</td>
                                                    <td>{r.early_leave_minutes || '—'}</td>
                                                    <td>
                                                        <span className={`att-rep-status att-rep-s-${r.status}`}>
                                                            {statusLabel(r.status)}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {r.status !== 'absent' && (
                                                            <button
                                                                className="att-btn-mark-absent"
                                                                title="تحويل السجل إلى غائب وتصفير الساعات الخاطئة"
                                                                onClick={() => handleMarkAbsent(r)}
                                                            >
                                                                <UserX size={13} />
                                                                تحويل لغائب
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )
                    )}
                </div>

                {/* Footer */}
                <div className="att-modal-footer">
                    {fetched && rows.length > 0 && (
                        <button className="att-btn-excel" onClick={exportExcel}>
                            <FileDown size={16} />
                            {t.exportExcelBtn}
                        </button>
                    )}
                    <button className="att-modal-btn-secondary" style={{ marginInlineStart: 'auto' }} onClick={onClose}>{t.closeBtn}</button>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN ATTENDANCE PAGE
══════════════════════════════════════════════════════════════════════════════ */
function Attendance() {
    const { company, user }         = useAuth();
    const { t }                     = useLocale();

// -------------------------------------------------------------------------
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendance,   setAttendance]   = useState([]);
    const [employees,    setEmployees]    = useState([]);
    const [loading,      setLoading]      = useState(true);
    const [dataSource,   setDataSource]   = useState('processed');
    const [showManualModal, setShowManualModal]   = useState(false);
    const [showReportModal, setShowReportModal]   = useState(false);
    const [dbShifts,     setDbShifts]     = useState([]);
    const [dbShiftMappings, setDbShiftMappings] = useState([]);
    const [page,         setPage]         = useState(0);
    const [pageSize]                      = useState(50);
    const [totalCount,   setTotalCount]   = useState(0);

// -------------------------------------------------------------------------
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const labels = useMemo(() => ({
        present         : t.statusPresent,
        late            : t.statusLate,
        absent          : t.statusAbsent,
        early_leave     : t.statusEarlyLeave,
        leave           : t.statusLeave,
        manual          : t.statusManual,
        missing_checkout: 'بصمة انصراف مفقودة',
    }), [t]);

// -------------------------------------------------------------------------
    useEffect(() => { setPage(0); }, [selectedDate]);

// -------------------------------------------------------------------------
    useEffect(() => {
        if (!company) return;
        supabase.from('employees').select('id, name, device_pin')
            .eq('company_id', company.id).eq('status', 'active').order('name')
            .then(({ data }) => setEmployees(data || []));
    }, [company]);

// -------------------------------------------------------------------------
    const fetchAttendance = useCallback(async () => {
        if (!company) { setLoading(false); return; }
        setLoading(true);

        try {
            const { data: dbshifts } = await supabase.from('shifts').select('id, name, start_time, end_time, shift_type, target_hours, has_break, break_duration, break_policy, grace_minutes, deduct_half_on_missing').eq('company_id', company.id);
            const shiftIds = (dbshifts || []).map(s => s.id);
            const { data: dbsm }     = shiftIds.length > 0
                ? await supabase.from('shift_employees').select('employee_id, shift_id').in('shift_id', shiftIds)
                : { data: [] };
            setDbShifts(dbshifts || []);
            setDbShiftMappings(dbsm || []);

            const getShiftForEmp = (empId) => {
                const m = dbsm?.find(x => x.employee_id === empId);
                return m ? dbshifts?.find(s => s.id === m.shift_id) : null;
            };

            const from = page * pageSize;
            const to   = from + pageSize - 1;

            const { data: processed, count, error: pErr } = await supabase
                .from('processed_attendance')
                .select('id, employee_id, date, check_in, check_out, status, work_hours, late_minutes, early_leave_minutes, is_conflicted, conflict_details, override_status, punch_details, status_reason, employees(id, name, device_pin)', { count: 'exact' })
                .eq('company_id', company.id)
                .eq('date', selectedDate)
                .order('check_in', { ascending: true })
                .range(from, to);

            if (!pErr && processed && processed.length > 0) {
                setDataSource('processed');
                const healedAttendance = [];
                for (const a of processed) {
                    const shift   = getShiftForEmp(a.employee_id);
                    const metrics = calculateRecordMetrics(a.check_in, a.check_out, shift, company.settings || {});
                    const rec     = { ...a, employee_name: a.employees?.name || `بصمة #${a.employee_id}`, ...metrics };

                    if (a.late_minutes !== rec.late_minutes || a.status !== rec.status ||
                        a.work_hours !== rec.work_hours || a.early_leave_minutes !== rec.early_leave_minutes) {
                        supabase.from('processed_attendance').update(metrics).eq('id', a.id).then();
                    }
                    healedAttendance.push(rec);
                }
                setAttendance(healedAttendance);
                setTotalCount(count || 0);
                setLoading(false);
                return;
            }

            // Fallback: raw_attendance_logs
            const dayStart = `${selectedDate}T00:00:00`;
            const dayEnd   = `${selectedDate}T23:59:59`;
            const { data: rawLogs } = await supabase
                .from('raw_attendance_logs')
                .select('id, user_pin, timestamp, status')
                .eq('company_id', company.id)
                .gte('timestamp', dayStart).lte('timestamp', dayEnd)
                .order('timestamp', { ascending: true })
                .limit(2000);

            if (rawLogs && rawLogs.length > 0) {
                const { data: emps } = await supabase.from('employees').select('id, name, device_pin').eq('company_id', company.id);
                const pinMap = {};
                if (emps) emps.forEach(e => { pinMap[e.device_pin] = e; });

                const byPin = {};
                rawLogs.forEach(log => {
                    if (!byPin[log.user_pin]) byPin[log.user_pin] = [];
                    byPin[log.user_pin].push(log);
                });

                const records = Object.entries(byPin).map(([pin, logs]) => {
                    const emp      = pinMap[pin];
                    const checkIn  = new Date(logs[0].timestamp).toTimeString().substring(0, 5);
                    const checkOut = logs.length > 1 ? new Date(logs[logs.length - 1].timestamp).toTimeString().substring(0, 5) : null;
                    const shift    = getShiftForEmp(emp?.id);
                    const metrics  = calculateRecordMetrics(checkIn, checkOut, shift, company.settings || {});
                    return {
                        id: logs[0].id,
                        employee_id  : emp?.id,
                        employee_name: emp?.name || `رقم بصمة: ${pin}`,
                        check_in: checkIn, check_out: checkOut,
                        ...metrics,
                    };
                });

                setDataSource('raw');
                setTotalCount(records.length);
                setAttendance(records.slice(page * pageSize, (page + 1) * pageSize));
            } else {
                setDataSource('processed');
                setAttendance([]);
                setTotalCount(0);
            }
        } catch (error) {
            console.error('[fetchAttendance]', error);
            toast.error(t.errorFetchingAttendance || 'حدث خطأ أثناء جلب بينات الحضور');
        } finally {
            setLoading(false);
        }
    }, [company, selectedDate, page, pageSize, t]);

    useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

// -------------------------------------------------------------------------
    const stats = useMemo(() => {
        const pres = attendance.filter(a => ['present', 'late', 'early_leave', 'manual'].includes(a.status)).length;
        const abs  = attendance.filter(a => a.status === 'absent').length;
        const late = attendance.filter(a => a.status === 'late').length;
        const lateR = attendance.filter(a => a.late_minutes > 0);
        const avgL = lateR.length > 0
            ? Math.round(lateR.reduce((s, a) => s + a.late_minutes, 0) / lateR.length)
            : 0;
        const totalW = attendance
            .reduce((s, a) => s + (Number(a.work_hours) || 0), 0)
            .toFixed(1);
        return { pres, abs, late, avgL, totalW };
    }, [attendance]);

// -------------------------------------------------------------------------
    const changeDate = useCallback((delta) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + delta);
        setSelectedDate(d.toISOString().split('T')[0]);
    }, [selectedDate]);

// -------------------------------------------------------------------------
    const filteredAttendance = useMemo(() => {
        return attendance
            .filter(a => statusFilter === 'all' || a.status === statusFilter)
            .filter(a => !searchTerm || (a.employee_name ?? '').toLowerCase().includes(searchTerm.toLowerCase()));
    }, [attendance, statusFilter, searchTerm]);

// -------------------------------------------------------------------------
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

// -------------------------------------------------------------------------
    return (
        <div className="att-page fade-in">


            <div className="att-header">
                <div>
                    <h2 className="att-title">{t.attendancePageTitle}</h2>
                    <p className="att-subtitle">{t.attendancePageSubtitle}</p>
                </div>
                <div className="att-header-actions">
                    <button className="att-btn-report" onClick={() => setShowReportModal(true)}>
                        <BarChart3 size={16} />
                        {t.detailedReportBtn}
                    </button>
                    <button className="att-btn-primary" onClick={() => setShowManualModal(true)}>
                        <Plus size={16} />
                        {t.manualFingerprintBtn}
                    </button>
                </div>
            </div>


            <div className="att-stats-row">
                {[
                    { icon: <Clock size={20} />,   iconCls: 'att-si-indigo', label: t.statAvgLateLabel ?? 'Total Work Hours',  value: `${stats.totalW}h`, sub: 'today' },
                    { icon: <Users size={20} />,   iconCls: 'att-si-green',  label: t.statPresentLabel ?? 'Present',           value: stats.pres, sub: `${stats.late} late` },
                    { icon: <UserX size={20} />,   iconCls: 'att-si-red',    label: t.statAbsentLabel ?? 'Absent',             value: stats.abs, sub: 'unexcused' },
                    { icon: <Clock size={20} />,   iconCls: 'att-si-amber',  label: t.statAvgLateLabel ?? 'Avg Late',          value: `${stats.avgL}m`, sub: t.minuteLabel ?? 'minutes' },
                ].map((s, i) => (
                    <motion.div key={i} className="att-stat-card"
                        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.07 }}>
                        <div className="att-stat-glow" />
                        <div className={`att-stat-icon ${s.iconCls}`}>{s.icon}</div>
                        <div className="att-stat-right">
                            <p className="att-stat-label">{s.label}</p>
                            <div className="att-stat-value">{loading ? '—' : s.value}</div>
                            <span className="att-stat-sub">{s.sub}</span>
                        </div>
                    </motion.div>
                ))}
            </div>


            {dataSource === 'raw' && attendance.length > 0 && (
                <div className="att-raw-notice">
                    <AlertCircle size={14} />
                    {t.rawLogsNotice}
                </div>
            )}


            <div className="att-filter-bar">
                {/* Date navigation with pill date picker */}
                <div className="att-date-nav">
                    <button className="att-nav-btn" onClick={() => changeDate(-1)}>
                        <ChevronLeft size={17} />
                    </button>
                    <div className="att-date-pill">
                        <Calendar size={15} className="att-date-icon" />
                        <input
                            type="date"
                            className="att-date-input"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>
                    <button className="att-nav-btn" onClick={() => changeDate(1)}>
                        <ChevronRight size={17} />
                    </button>
                </div>

                {/* Search */}
                <div className="att-search-wrap">
                    <Search className="att-search-icon" size={15} />
                    <input
                        className="att-search-input"
                        placeholder={t.searchEmployeesPlaceholder}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Status filter pills */}
                <div className="att-status-pills">
                    {['all', 'present', 'late', 'absent', 'early_leave'].map(s => (
                        <button
                            key={s}
                            className={`att-pill-btn ${statusFilter === s ? `active att-pill-${s}` : ''}`}
                            onClick={() => setStatusFilter(s)}
                        >
                            {s === 'all' ? t.all : (labels[s] ?? s)}
                        </button>
                    ))}
                </div>
            </div>


            <div className="att-timeline-wrap">
                {/* Vertical guide line */}
                <div className="att-timeline-line" />

                {loading ? (
                    [...Array(4)].map((_, i) => (
                        <div key={i} className="att-skeleton-row">
                            <div className="att-skeleton att-sk-time" />
                            <div className="att-skeleton att-sk-body" />
                        </div>
                    ))
                ) : filteredAttendance.length === 0 ? (
                    <motion.div
                        className="att-empty"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    >
                        <Calendar size={48} className="att-empty-icon" />
                        <p>{t.noAttendanceData}</p>
                        <button className="att-btn-primary att-empty-btn"
                            onClick={() => setShowManualModal(true)}>
                            <Plus size={16} /> {t.manualFingerprintBtn}
                        </button>
                    </motion.div>
                ) : (
                    filteredAttendance.map((record, index) => (
                        <TimelineRow
                            key={record.id}
                            record={record}
                            index={index}
                            t={t}
                            labels={labels}
                            onRefresh={fetchAttendance}
                        />
                    ))
                )}
            </div>


            {totalCount > 0 && (
                <div className="att-footer">
                    <div className="att-footer-stats">
                        <div className="att-footer-stat">
                            <span className="att-footer-stat-label">
                                {t.statPresentLabel ?? 'Present'}
                            </span>
                            <span className="att-footer-stat-val att-green">{stats.pres}</span>
                        </div>
                        <div className="att-footer-stat att-footer-stat-mid">
                            <span className="att-footer-stat-label">
                                {t.statLateLabel ?? 'Late'}
                            </span>
                            <span className="att-footer-stat-val att-amber">{stats.late}</span>
                        </div>
                        <div className="att-footer-stat">
                            <span className="att-footer-stat-label">
                                {t.statAbsentLabel ?? 'Absent'}
                            </span>
                            <span className="att-footer-stat-val att-red">{stats.abs}</span>
                        </div>
                    </div>

                    {totalCount > pageSize && (
                        <div className="att-pagination">
                            <button className="att-page-btn" disabled={page === 0}
                                onClick={() => setPage(p => p - 1)}>
                                <ChevronLeft size={17} />
                            </button>
                            {[...Array(Math.min(totalPages, 5))].map((_, i) => (
                                <button key={i}
                                    className={`att-page-btn ${i === page ? 'active' : ''}`}
                                    onClick={() => setPage(i)}>
                                    {i + 1}
                                </button>
                            ))}
                            <button className="att-page-btn" disabled={page >= totalPages - 1}
                                onClick={() => setPage(p => p + 1)}>
                                <ChevronRight size={17} />
                            </button>
                        </div>
                    )}
                </div>
            )}


            <ManualFingerprintModal
                isOpen={showManualModal}
                onClose={() => setShowManualModal(false)}
                onSaved={fetchAttendance}
                employees={employees}
                company={company}
                user={user}
                selectedDate={selectedDate}
                shifts={dbShifts}
                shiftMappings={dbShiftMappings}
            />


            <AttendanceReportModal
                isOpen={showReportModal}
                onClose={() => setShowReportModal(false)}
                employees={employees}
                company={company}
            />
        </div>
    );
}

export default Attendance;
