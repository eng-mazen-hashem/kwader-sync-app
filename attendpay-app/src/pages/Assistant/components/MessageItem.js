import React from 'react';
import { HiOutlineUser, HiOutlineLightningBolt } from 'react-icons/hi';

const MessageItem = ({ msg, onAction }) => {
    const isUser = msg.role === 'user';
    const isAssistant = msg.role === 'assistant';

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: isUser ? 'flex-end' : 'flex-start',
            marginBottom: 20,
            gap: 6
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexDirection: isUser ? 'row-reverse' : 'row'
            }}>
                <div style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: isUser ? 'rgba(108,99,255,0.15)' : 'linear-gradient(135deg, #6c63ff, #a78bfa)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isUser ? '#6c63ff' : '#fff',
                    fontSize: '0.9rem'
                }}>
                    {isUser ? <HiOutlineUser /> : <HiOutlineLightningBolt />}
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {isUser ? 'أنت' : 'وتين (المساعد)'} • {msg.time}
                </span>
            </div>

            <div style={{
                maxWidth: '85%',
                padding: '14px 18px',
                borderRadius: isUser ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                background: isUser ? 'var(--bg-tertiary)' : 'rgba(108,99,255,0.08)',
                border: `1px solid ${isUser ? 'var(--border-color)' : 'rgba(108,99,255,0.2)'}`,
                color: '#fff',
                fontSize: '0.9rem',
                lineHeight: 1.6,
                position: 'relative',
                boxShadow: isAssistant ? '0 4px 20px rgba(108,99,255,0.08)' : 'none'
            }}>
                {msg.loading ? (
                    <div style={{ display: 'flex', gap: 4, padding: '4px 0' }}>
                        {[0, 1, 2].map(i => (
                            <div key={i} style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: '#a78bfa',
                                animation: `pulse 1.2s infinite ease-in-out ${i * 0.2}s`
                            }} />
                        ))}
                    </div>
                ) : (
                    <>
                        <div style={{ direction: 'rtl', whiteSpace: 'pre-wrap' }}>
                            {msg.content}
                        </div>

                        {msg.action && msg.action.type === 'whatsapp' && (
                            <button
                                onClick={() => onAction(msg.action)}
                                style={{
                                    marginTop: 14,
                                    padding: '8px 16px',
                                    borderRadius: 12,
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #25d366, #128c7e)',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontFamily: 'Cairo',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    boxShadow: '0 4px 12px rgba(37,211,102,0.25)'
                                }}
                            >
                                <span style={{ fontSize: '1.1rem' }}>💬</span>
                                إرسال إلى {msg.action.name || 'الموظف'} عبر واتساب
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default MessageItem;
