import React, { useState } from 'react';
import { HiOutlineX, HiOutlineCog } from 'react-icons/hi';
import { overlay, modalBox, modalHeader, h3, closeBtn, lbl, inp, cancelBtn, saveBtn, section, sectionHead, pill } from '../../styles';

const SettingsModal = ({ settings, onSave, onClose }) => {
    const [form, setForm] = useState({ ...settings });

    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSave = () => {
        onSave(form);
        onClose();
    };

    return (
        <div style={overlay}>
            <div style={{ ...modalBox, maxWidth: 500 }}>
                <div style={modalHeader}>
                    <h3 style={h3}><HiOutlineCog style={{ verticalAlign: 'middle', marginLeft: 8 }} /> إعدادات الإرسال</h3>
                    <button onClick={onClose} style={closeBtn}><HiOutlineX /></button>
                </div>

                <div style={{ marginBottom: 20 }}>
                    <div style={{ ...section('#25d366'), marginBottom: 20 }}>
                        <div style={sectionHead}>
                            <span style={{ fontSize: '1.2rem' }}>💬</span>
                            <span style={{ fontWeight: 700, color: '#fff' }}>واتساب (الرقم الافتراضي)</span>
                        </div>
                        <label style={lbl}>رقم الهاتف (مع كود الدولة وبدون +)</label>
                        <input
                            style={inp}
                            placeholder="966501234567"
                            dir="ltr"
                            value={form.whatsapp_phone || ''}
                            onChange={e => set('whatsapp_phone', e.target.value)}
                        />
                    </div>

                    <div style={section('#229ed9')}>
                        <div style={sectionHead}>
                            <span style={{ fontSize: '1.2rem' }}>🤖</span>
                            <span style={{ fontWeight: 700, color: '#fff' }}>تيليجرام (Telegram Bot)</span>
                            <span style={pill('#229ed9')}>اختياري</span>
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <label style={lbl}>Bot Token</label>
                            <input
                                style={{ ...inp, marginBottom: 10 }}
                                placeholder="123456789:ABCdef..."
                                dir="ltr"
                                value={form.telegram_token || ''}
                                onChange={e => set('telegram_token', e.target.value)}
                            />
                        </div>
                        <div>
                            <label style={lbl}>Chat ID</label>
                            <input
                                style={inp}
                                placeholder="123456789"
                                dir="ltr"
                                value={form.telegram_chat_id || ''}
                                onChange={e => set('telegram_chat_id', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={onClose} style={cancelBtn}>إلغاء</button>
                    <button onClick={handleSave} style={saveBtn}>حفظ الإعدادات</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
