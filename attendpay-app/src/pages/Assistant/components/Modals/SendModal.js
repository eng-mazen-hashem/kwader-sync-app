import React, { useState } from 'react';
import { toast } from 'sonner';
import { HiOutlineX, HiOutlinePaperAirplane } from 'react-icons/hi';
import { useLocale } from '../../../../context/LocaleContext';
import { overlay, modalBox, modalHeader, h3, closeBtn, cancelBtn, saveBtn } from '../../styles';

const SendModal = ({ report, settings, onClose }) => {
    const { t } = useLocale();
    const [sending, setSending] = useState(null);
    const hasWA = !!settings?.whatsapp_phone;
    const hasTG = !!(settings?.telegram_token && settings?.telegram_chat_id);

    const doSend = async (ch) => {
        setSending(ch);
        try {
            if (ch === 'whatsapp') {
                const phone = settings.whatsapp_phone.replace(/\D/g, '');
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(report.text)}`, '_blank');
                toast.success(t.sendWhatsAppSuccess);
            } else if (ch === 'telegram') {
                const url = `https://api.telegram.org/bot${settings.telegram_token}/sendMessage`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: settings.telegram_chat_id, text: report.text, parse_mode: 'Markdown' })
                });
                if (!res.ok) {
                    const body = await res.json();
                    throw new Error(body?.description || 'Telegram API error');
                }
                // constitution §9: success via toast, not alert()
                toast.success(t.sendTelegramSuccess);
                onClose();
            }
        } catch (err) {
            console.error('[SendModal] doSend:', err.message);
            // constitution §9: error via toast, not alert()
            toast.error(t.sendError.replace('{msg}', err.message));
        } finally {
            setSending(null);
        }
    };

    return (
        <div style={overlay}>
            <div style={{ ...modalBox, maxWidth: 450 }}>
                <div style={modalHeader}>
                    <h3 style={h3}><HiOutlinePaperAirplane style={{ verticalAlign: 'middle', marginInlineEnd: 8 }} /> {t.sendModalTitle}</h3>
                    <button onClick={onClose} style={closeBtn}><HiOutlineX /></button>
                </div>

                <div style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 20, maxHeight: 200, overflowY: 'auto' }}>
                    <pre style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', direction: 'rtl', fontFamily: 'inherit' }}>
                        {report.text}
                    </pre>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button
                        onClick={() => doSend('whatsapp')}
                        disabled={!hasWA || sending === 'whatsapp'}
                        style={{
                            ...saveBtn,
                            background: 'linear-gradient(135deg, #25d366, #128c7e)',
                            opacity: hasWA ? 1 : 0.5,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                        }}
                    >
                        {sending === 'whatsapp' ? t.sendingWhatsApp : `💬 ${t.sendViaWhatsApp}`}
                    </button>

                    <button
                        onClick={() => doSend('telegram')}
                        disabled={!hasTG || sending === 'telegram'}
                        style={{
                            ...saveBtn,
                            background: 'linear-gradient(135deg, #229ed9, #1a7fb3)',
                            opacity: hasTG ? 1 : 0.5,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                        }}
                    >
                        {sending === 'telegram' ? t.sendingTelegram : `🤖 ${t.sendViaTelegram}`}
                    </button>

                    <button onClick={onClose} style={{ ...cancelBtn, marginTop: 10 }}>{t.closeModalBtn}</button>
                </div>
            </div>
        </div>
    );
};

export default SendModal;
