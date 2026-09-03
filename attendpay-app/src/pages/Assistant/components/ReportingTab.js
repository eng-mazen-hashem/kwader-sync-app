import React from 'react';
import { HiOutlineClock, HiOutlinePencil, HiOutlineTrash, HiOutlinePlus } from 'react-icons/hi';
import { useLocale } from '../../../context/LocaleContext';
import { iconBtn } from '../styles';

const ReportingTab = ({ schedules, onToggle, onEdit, onDelete, onNew }) => {
    const { t, locale } = useLocale();
    
    const fmtNext = (ts) => {
        if (!ts) return t.schedNotScheduled;
        const d = new Date(ts);
        const now = new Date();
        const diff = d - now;
        if (diff < 0) return t.schedPendingProcessing;
        if (diff < 3600000) {
            const mins = Math.round(diff / 60000);
            return (t.schedWithinMinutes || 'خلال {mins} دقيقة').replace('{mins}', String(mins));
        }
        const langCode = locale === 'ar' ? 'ar-SA' : 'en-US';
        const timePart = d.toLocaleTimeString(langCode, { hour: '2-digit', minute: '2-digit' });
        const datePart = d.toLocaleDateString(langCode, { day: 'numeric', month: 'short' });
        return locale === 'ar' 
            ? `${datePart} الساعة ${timePart}`
            : `${datePart} at ${timePart}`;
    };

    const REPORT_TYPES = {
        attendance: { label: t.reportDailyAttendance, color: '#6c63ff', icon: '📝' },
        payroll: { label: t.reportMonthlyPayroll, color: '#10b981', icon: '💰' },
        absent: { label: t.reportAbsentTardiness, color: '#f59e0b', icon: '⚠️' },
        summary: { label: t.reportPeriodicSummary, color: '#8b5cf6', icon: '📊' }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>{t.schedTabTitle}</h3>
                <button
                    onClick={onNew}
                    style={{
                        padding: '6px 14px',
                        borderRadius: 10,
                        border: 'none',
                        background: 'rgba(108,99,255,0.15)',
                        color: '#6c63ff',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                    }}
                >
                    <HiOutlinePlus /> {t.schedAddNewBtn}
                </button>
            </div>

            {schedules.length === 0 ? (
                <div style={{
                    padding: 40,
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: 20,
                    border: '1px dashed var(--border-color)',
                    color: 'var(--text-muted)'
                }}>
                    <HiOutlineClock style={{ fontSize: '2.5rem', marginBottom: 12, opacity: 0.3 }} />
                    <p>{t.schedNoSchedules}</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                    {schedules.map(sched => {
                        const rT = REPORT_TYPES[sched.report_type];
                        return (
                            <div key={sched.id} style={{
                                background: 'var(--bg-tertiary)',
                                border: `1px solid ${sched.is_active ? (rT?.color || '#6c63ff') + '44' : 'var(--border-color)'}`,
                                borderRadius: 14,
                                padding: '16px 18px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 14,
                                opacity: sched.is_active ? 1 : 0.65,
                                transition: 'all 0.2s'
                            }}>
                                <div style={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 12,
                                    background: `${rT?.color || '#6c63ff'}18`,
                                    border: `1px solid ${rT?.color || '#6c63ff'}33`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.2rem',
                                    flexShrink: 0
                                }}>
                                    {rT?.icon || '📄'}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>{rT?.label || sched.report_type}</span>
                                        <span style={{
                                            fontSize: '0.72rem',
                                            padding: '2px 8px',
                                            borderRadius: 20,
                                            background: sched.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)',
                                            color: sched.is_active ? '#10b981' : 'var(--text-muted)',
                                            border: `1px solid ${sched.is_active ? 'rgba(16,185,129,0.25)' : 'var(--border-color)'}`
                                        }}>
                                            {sched.is_active ? t.schedStatusActive : t.schedStatusInactive}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: '0.76rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                                        <span style={{ color: sched.is_active ? '#a78bfa' : 'var(--text-muted)' }}>⏱ {fmtNext(sched.next_send_at)}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                    <button onClick={() => onToggle(sched)} style={iconBtn} title={sched.is_active ? t.schedTogglePause : t.schedToggleActive}>
                                        {sched.is_active ? '⏸' : '▶️'}
                                    </button>
                                    <button onClick={() => onEdit(sched)} style={iconBtn}><HiOutlinePencil /></button>
                                    <button onClick={() => onDelete(sched.id)} style={{ ...iconBtn, color: 'var(--color-danger)' }}><HiOutlineTrash /></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ReportingTab;
