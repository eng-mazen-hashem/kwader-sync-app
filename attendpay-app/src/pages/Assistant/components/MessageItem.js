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

                        {msg.action && msg.action.type === 'view_salary_slip' && (
                            <button
                                onClick={() => window.open(`/salary-slip/${msg.action.payroll_id}`, '_blank')}
                                style={{
                                    marginTop: 14,
                                    padding: '10px 18px',
                                    borderRadius: 12,
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontFamily: 'Cairo',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    boxShadow: '0 4px 15px rgba(99,102,241,0.35)'
                                }}
                            >
                                <span style={{ fontSize: '1.1rem' }}>📄</span>
                                فتح وطباعة قسيمة الراتب الرسمية (PDF)
                            </button>
                        )}

                        {msg.action && msg.action.type !== 'whatsapp' && msg.action.type !== 'view_salary_slip' && (
                            <div style={{
                                marginTop: 12,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 12px',
                                borderRadius: 10,
                                background: 'rgba(99, 102, 241, 0.15)',
                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                color: '#a5b4fc',
                                fontSize: '0.78rem',
                                fontWeight: 700
                            }}>
                                <span>⚡</span>
                                <span>
                                    {msg.action.type === 'add_employee' && 'تم إدراج الموظف في قاعدة البيانات'}
                                    {msg.action.type === 'update_employee' && 'تم تحديث بيانات الموظف في قاعدة البيانات'}
                                    {msg.action.type === 'create_leave' && 'تم تسجيل طلب الإجازة في النظام'}
                                    {(msg.action.type === 'update_leave_status' || msg.action.type === 'approve_leave' || msg.action.type === 'reject_leave') && 'تم تحديث حالة طلب الإجازة'}
                                    {msg.action.type === 'record_loan' && 'تم قيد السلفة المالية في النظام'}
                                    {(msg.action.type === 'record_adjustment' || msg.action.type === 'record_bonus' || msg.action.type === 'record_deduction') && 'تم قيد البند المالي في السلف والاستقطاعات ومسير الرواتب'}
                                    {msg.action.type === 'generate_payroll' && 'تم إرسال أمر تشغيل مسير الرواتب للمؤسسة'}
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default MessageItem;
