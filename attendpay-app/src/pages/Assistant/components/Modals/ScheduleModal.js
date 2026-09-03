import React, { useState } from 'react';
import { HiOutlineX, HiOutlineClock } from 'react-icons/hi';
import { useLocale } from '../../../../context/LocaleContext';
import { overlay, modalBox, modalHeader, h3, closeBtn, lbl, inp, cancelBtn, saveBtn } from '../../styles';

const ScheduleModal = ({ schedule, onClose, onSave, hasTelegram, hasWhatsApp }) => {
    const { t } = useLocale();
    const [form, setForm] = useState(schedule ? { ...schedule } : {
        report_type: 'attendance',
        frequency: 'daily',
        send_time: '18:00',
        send_day: null,
        channels: ['whatsapp'],
        is_active: true
    });

    const handleChange = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleFrequencyChange = (freq) => {
        let day = null;
        if (freq === 'weekly') day = 0;
        else if (freq === 'monthly') day = 1;
        setForm(p => ({ ...p, frequency: freq, send_day: day }));
    };

    const handleChannel = (ch) => {
        const cur = form.channels || [];
        const next = cur.includes(ch) ? cur.filter(c => c !== ch) : [...cur, ch];
        if (next.length === 0) return; // Must have at least one
        handleChange('channels', next);
    };

    const handleSave = () => {
        const cleanedForm = { ...form };
        if (cleanedForm.frequency === 'daily') {
            cleanedForm.send_day = null;
        } else {
            cleanedForm.send_day = cleanedForm.send_day !== null && cleanedForm.send_day !== undefined ? Number(cleanedForm.send_day) : (cleanedForm.frequency === 'weekly' ? 0 : 1);
        }
        onSave(cleanedForm, !!schedule);
    };

    return (
        <div style={overlay}>
            <div style={modalBox}>
                <div style={modalHeader}>
                    <h3 style={h3}>
                        <HiOutlineClock style={{ verticalAlign: 'middle', marginLeft: 8, marginRight: 8 }} />
                        {schedule ? t.schedModalTitleEdit : t.schedModalTitleAdd}
                    </h3>
                    <button onClick={onClose} style={closeBtn}><HiOutlineX /></button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                    <div>
                        <label style={lbl}>{t.schedReportType}</label>
                        <select style={inp} value={form.report_type} onChange={e => handleChange('report_type', e.target.value)}>
                            <option value="attendance">{t.reportDailyAttendance}</option>
                            <option value="absent">{t.reportAbsentTardiness}</option>
                            <option value="payroll">{t.reportMonthlyPayroll}</option>
                            <option value="summary">{t.reportPeriodicSummary}</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                            <label style={lbl}>{t.schedFrequency}</label>
                            <select style={inp} value={form.frequency} onChange={e => handleFrequencyChange(e.target.value)}>
                                <option value="daily">{t.freqDaily}</option>
                                <option value="weekly">{t.freqWeekly}</option>
                                <option value="monthly">{t.freqMonthly}</option>
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={lbl}>{t.schedSendTime}</label>
                            <input type="time" style={inp} value={form.send_time} onChange={e => handleChange('send_time', e.target.value)} />
                        </div>
                    </div>

                    {form.frequency === 'weekly' && (
                        <div>
                            <label style={lbl}>{t.schedSendDay}</label>
                            <select style={inp} value={form.send_day ?? 0} onChange={e => handleChange('send_day', Number(e.target.value))}>
                                <option value={0}>{t.daySunday}</option>
                                <option value={1}>{t.dayMonday}</option>
                                <option value={2}>{t.dayTuesday}</option>
                                <option value={3}>{t.dayWednesday}</option>
                                <option value={4}>{t.dayThursday}</option>
                                <option value={5}>{t.dayFriday}</option>
                                <option value={6}>{t.daySaturday}</option>
                            </select>
                        </div>
                    )}

                    {form.frequency === 'monthly' && (
                        <div>
                            <label style={lbl}>{t.schedSendDay}</label>
                            <select style={inp} value={form.send_day ?? 1} onChange={e => handleChange('send_day', Number(e.target.value))}>
                                {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                                    <option key={day} value={day}>
                                        {day} {t.dayOfMonthSuffix}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label style={lbl}>{t.schedChannels}</label>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                onClick={() => handleChannel('whatsapp')}
                                style={{
                                    flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${form.channels?.includes('whatsapp') ? '#25d366' : 'var(--border-color)'}`,
                                    background: form.channels?.includes('whatsapp') ? 'rgba(37,211,102,0.1)' : 'transparent',
                                    color: form.channels?.includes('whatsapp') ? '#25d366' : 'var(--text-muted)',
                                    cursor: 'pointer', fontFamily: 'Cairo', fontSize: '0.85rem'
                                }}
                            >
                                ✅ {t.brandingName === 'KWADER' ? 'WhatsApp' : 'واتساب'}
                            </button>
                            <button
                                onClick={() => handleChannel('telegram')}
                                disabled={!hasTelegram}
                                style={{
                                    flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${form.channels?.includes('telegram') ? '#229ed9' : 'var(--border-color)'}`,
                                    background: form.channels?.includes('telegram') ? 'rgba(34,158,217,0.1)' : 'transparent',
                                    color: form.channels?.includes('telegram') ? '#229ed9' : 'var(--text-muted)',
                                    cursor: hasTelegram ? 'pointer' : 'not-allowed', opacity: hasTelegram ? 1 : 0.4, fontFamily: 'Cairo', fontSize: '0.85rem'
                                }}
                            >
                                ✅ {t.brandingName === 'KWADER' ? 'Telegram' : 'تيليجرام'}
                            </button>
                        </div>
                        {form.channels?.includes('whatsapp') && !hasWhatsApp && (
                            <p style={{ fontSize: '0.72rem', color: 'var(--color-danger)', marginTop: 4 }}>{t.schedWhatsappWarning}</p>
                        )}
                        {form.channels?.includes('telegram') && !hasTelegram && (
                            <p style={{ fontSize: '0.72rem', color: 'var(--color-danger)', marginTop: 4 }}>{t.schedTelegramWarning}</p>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                        <input
                            type="checkbox"
                            id="sched_active"
                            checked={form.is_active}
                            onChange={e => handleChange('is_active', e.target.checked)}
                            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#6c63ff' }}
                        />
                        <label htmlFor="sched_active" style={{ ...lbl, marginBottom: 0, cursor: 'pointer', color: '#fff', fontSize: '0.85rem' }}>
                            {t.schedActive}
                        </label>
                    </div>

                    <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: 8, textAlign: 'center', lineHeight: '1.4' }}>
                        {t.schedTimezoneNotice}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={onClose} style={cancelBtn}>{t.cancelBtn}</button>
                    <button onClick={handleSave} style={saveBtn}>{schedule ? t.saveChangesBtn : t.saveBtn}</button>
                </div>
            </div>
        </div>
    );
};

export default ScheduleModal;
