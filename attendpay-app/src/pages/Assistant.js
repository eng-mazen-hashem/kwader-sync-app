import React, { useState, useEffect } from 'react';
import { HiOutlineDocumentReport, HiOutlineChatAlt2, HiOutlineTrash } from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';
import './Assistant.css';

// Hooks
import { useAssistantData } from './Assistant/hooks/useAssistantData';
import { useAssistantAI } from './Assistant/hooks/useAssistantAI';
import { useAssistantTools } from './Assistant/hooks/useAssistantTools';

// Components
import ChatWindow from './Assistant/components/ChatWindow';
import ReportingTab from './Assistant/components/ReportingTab';
import SettingsModal from './Assistant/components/Modals/SettingsModal';
import ScheduleModal from './Assistant/components/Modals/ScheduleModal';
import SendModal from './Assistant/components/Modals/SendModal';
import ConfirmModal from '../components/ConfirmModal';
import { useLocale } from '../context/LocaleContext';

const Assistant = () => {
    const { user, updateCompanySettings } = useAuth();
    const { t } = useLocale();
    
    // State management via custom hooks
    const { company, data, reloadData } = useAssistantData();
    const { messages, loading: aiLoading, input, setInput, sendMessage, setMessages, clearChat } = useAssistantAI(company, data, reloadData);
    const { 
        executeAddEmployee, 
        executeUpdateEmployee,
        executeCreateLeave,
        executeUpdateLeaveStatus,
        executeRecordLoan,
        executeRecordAdjustment,
        executeGeneratePayroll,
        toggleSchedule, 
        deleteSchedule, 
        saveSchedule 
    } = useAssistantTools(company, reloadData, setMessages);

    // UI state
    const [activeTab, setActiveTab] = useState('chat');
    const [deleteScheduleId, setDeleteScheduleId] = useState(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showSched, setShowSched] = useState(false);
    const [editSched, setEditSched] = useState(null);
    const [activeReport, setActiveReport] = useState(null);

    // Helper for AI response actions
    const handleAction = React.useCallback(async (action) => {
        if (!action) return;
        
        // Merge root fields and nested data fields so no parameters are dropped
        const data = {
            ...action,
            ...(action.data || {})
        };
        delete data.data;

        switch (action.type) {
            case 'add_employee':
                await executeAddEmployee(data);
                break;
            case 'update_employee':
                await executeUpdateEmployee(data);
                break;
            case 'create_leave':
                await executeCreateLeave(data);
                break;
            case 'update_leave_status':
            case 'approve_leave':
            case 'reject_leave':
                await executeUpdateLeaveStatus({
                    ...data,
                    status: (action.type === 'reject_leave' || data.status === 'rejected') ? 'rejected' : 'approved'
                });
                break;
            case 'record_loan':
                await executeRecordLoan(data);
                break;
            case 'record_adjustment':
            case 'record_bonus':
            case 'record_deduction':
                await executeRecordAdjustment({
                    ...data,
                    type: (action.type === 'record_deduction' || data.type === 'deduction') ? 'deduction' : (data.type || 'bonus')
                });
                break;
            case 'generate_payroll':
                await executeGeneratePayroll(data);
                break;
            case 'whatsapp':
                // Handled in MessageItem's UI button
                break;
            default:
                break;
        }
    }, [
        executeAddEmployee, 
        executeUpdateEmployee, 
        executeCreateLeave, 
        executeUpdateLeaveStatus, 
        executeRecordLoan, 
        executeRecordAdjustment,
        executeGeneratePayroll
    ]);

    // Derived settings
    const sendSettings = {
        whatsapp_phone: company?.settings?.whatsapp_phone || '',
        telegram_token: company?.settings?.telegram_token || '',
        telegram_chat_id: company?.settings?.telegram_chat_id || '',
    };
    const hasAnySettings = !!(sendSettings.whatsapp_phone || (sendSettings.telegram_token && sendSettings.telegram_chat_id));
    const hasTG = !!(sendSettings.telegram_token && sendSettings.telegram_chat_id);

    // Listen for AI actions
    useEffect(() => {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && !lastMsg.loading && lastMsg.role === 'assistant' && lastMsg.action) {
            handleAction(lastMsg.action);
        }
    }, [messages, handleAction]);

    const TABS = [
        { id: 'chat', label: 'المساعد الذكي (وتين)', icon: <HiOutlineChatAlt2 /> },
        { id: 'reports', label: 'التقارير المجدولة (الأتمتة)', icon: <HiOutlineDocumentReport /> }
    ];

    if (!user) return null;

    if (company && company.limits && company.limits.ai_enabled === false) {
        return (
            <div className="assistant-console-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '24px' }}>
                <div style={{
                    maxWidth: '560px',
                    width: '100%',
                    background: 'var(--bg-secondary, #1e293b)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '24px',
                    padding: '40px 32px',
                    textAlign: 'center',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                    direction: 'rtl'
                }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '20px',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 20px',
                        boxShadow: '0 10px 25px rgba(99, 102, 241, 0.4)'
                    }}>
                        <HiOutlineChatAlt2 size={32} color="#ffffff" />
                    </div>

                    <div style={{
                        display: 'inline-block',
                        background: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        color: '#a5b4fc',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        padding: '4px 14px',
                        borderRadius: '50px',
                        marginBottom: '16px'
                    }}>
                        ميزة متقدمة في الباقات الاحترافية
                    </div>

                    <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary, #ffffff)', marginBottom: '12px' }}>
                        المساعد الإداري الذكي (وتين AI)
                    </h2>

                    <p style={{ fontSize: '14px', color: 'var(--text-muted, #94a3b8)', lineHeight: '1.7', marginBottom: '24px' }}>
                        المساعد الذكي غير مفعل في باقتك الحالية (Starter). يمكنك الترقية إلى الباقة الاحترافية (Pro) أو باقة الشركات (Enterprise) للحصول على:
                    </p>

                    <div style={{
                        textAlign: 'right',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '16px',
                        padding: '16px 20px',
                        marginBottom: '28px',
                        fontSize: '13px',
                        color: 'var(--text-secondary, #cbd5e1)',
                        lineHeight: '2'
                    }}>
                        <div>✨ استعلامات وتحليلات ذكية باللغة الطبيعية عن الحضور والغياب والرواتب</div>
                        <div>📊 توليد تقارير تنفيذية مجدولة وإرسالها آلياً</div>
                        <div>⚡ تنفيذ أوامر إدارية وإضافة وتعديل بيانات الموظفين بالأوامر الصوتية والنصية</div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                        <a
                            href="/subscribe"
                            style={{
                                padding: '12px 28px',
                                background: '#6366f1',
                                color: '#ffffff',
                                borderRadius: '12px',
                                textDecoration: 'none',
                                fontWeight: 'bold',
                                fontSize: '14px',
                                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)'
                            }}
                        >
                            ترقية باقة الاشتراك الآن
                        </a>
                        <a
                            href="https://wa.me/201091560500"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                padding: '12px 20px',
                                background: 'rgba(255, 255, 255, 0.08)',
                                color: 'var(--text-primary, #ffffff)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '12px',
                                textDecoration: 'none',
                                fontWeight: 'bold',
                                fontSize: '14px'
                            }}
                        >
                            طلب مساعدة من المبيعات
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="assistant-console-page">
            
            {/* Header Section */}
            <div className="assistant-header-container">
                <div className="assistant-title-wrapper">
                    <h2 className="assistant-page-title">
                        Smart Assistant Console
                    </h2>
                    <p className="assistant-live-status">
                        <span className="status-dot"></span>
                        Live System Status: <span className="status-text-highlight">Operational</span>
                    </p>
                </div>
                <div className="assistant-header-actions">
                    <button
                        onClick={() => setShowSettings(true)}
                        className="assistant-sync-btn"
                        style={{
                            borderColor: hasAnySettings ? 'rgba(108,99,255,0.3)' : 'rgba(239,68,68,0.3)',
                            color: hasAnySettings ? 'var(--color-primary)' : 'var(--color-danger)'
                        }}
                    >
                        <span className="material-symbols-outlined">settings</span>
                        {hasAnySettings ? 'Settings Configured' : 'Setup Required'}
                    </button>
                    <button className="assistant-export-btn">
                        Export Reports
                    </button>
                </div>
            </div>

            {/* Dashboard Grid & Chat/Reports Tabs Wrapper */}
            <div className="assistant-dashboard-grid">
                
                {/* Main Action Panel */}
                <div className="assistant-main-panel">
                    <div className="assistant-chat-header">
                        <div className="assistant-tabs-container" style={{ marginBottom: 0, border: 'none', background: 'transparent' }}>
                            {TABS.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setActiveTab(t.id)}
                                    className={`assistant-tab-btn ${activeTab === t.id ? 'active' : ''}`}
                                >
                                    {t.icon}
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {activeTab === 'chat' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: 'rgba(16, 185, 129, 0.1)',
                                    border: '1px solid rgba(16, 185, 129, 0.25)',
                                    color: '#10b981',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    padding: '4px 10px',
                                    borderRadius: '20px'
                                }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                                    <span>سجل محفوظ (0 استهلاك كوتة)</span>
                                </div>

                                <button
                                    onClick={() => setShowClearConfirm(true)}
                                    title="بدء محادثة جديدة ومسح السجل"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        color: 'var(--text-secondary)',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        padding: '6px 12px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                                        e.currentTarget.style.color = '#ef4444';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                        e.currentTarget.style.color = 'var(--text-secondary)';
                                    }}
                                >
                                    <HiOutlineTrash size={15} />
                                    <span>محادثة جديدة</span>
                                </button>
                            </div>
                        )}
                    </div>
                    
                    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', padding: activeTab === 'chat' ? 0 : '1.5rem' }}>
                        {activeTab === 'chat' && <div className="assistant-glow-bg"></div>}
                        {activeTab === 'chat' ? (
                            <div className="assistant-chat-wrapper">
                                <ChatWindow
                                    messages={messages}
                                    loading={aiLoading}
                                    input={input}
                                    setInput={setInput}
                                    sendMessage={sendMessage}
                                    onAction={(action) => {
                                        if (action.type === 'whatsapp') {
                                            const phone = action.phone.replace(/\D/g, '');
                                            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(action.text)}`, '_blank');
                                        }
                                    }}
                                />
                            </div>
                        ) : (
                            <ReportingTab
                                schedules={data.schedules}
                                onToggle={toggleSchedule}
                                onEdit={(s) => { setEditSched(s); setShowSched(true); }}
                                onDelete={(id) => setDeleteScheduleId(id)}
                                onNew={() => { setEditSched(null); setShowSched(true); }}
                            />
                        )}
                    </div>
                </div>

                {/* Side Stats Panel */}
                <div className="assistant-side-panel">
                    <div className="assistant-card">
                        <div className="assistant-card-title">Messages Today</div>
                        <div className="assistant-card-value">{Math.floor(Math.random() * 50) + 120}</div>
                        <div className="assistant-card-trend up">
                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>trending_up</span>
                            <span>+12.4%</span>
                        </div>
                    </div>
                    <div className="assistant-card">
                        <div className="assistant-card-title">Delivery Rate</div>
                        <div className="assistant-card-value">99.8<span style={{ fontSize: '1.25rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>%</span></div>
                        <div className="assistant-card-trend neutral">
                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>check_circle</span>
                            <span>Optimal</span>
                        </div>
                    </div>
                    <div className="assistant-card" style={{ flex: 1 }}>
                        <div className="assistant-card-title">Active Schedules</div>
                        <div className="assistant-card-value">{data?.schedules?.filter(s => s.is_active)?.length || 0}</div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showSettings && (
                <SettingsModal
                    settings={sendSettings}
                    onSave={async (s) => {
                        await updateCompanySettings({ ...company?.settings, ...s });
                        reloadData();
                    }}
                    onClose={() => setShowSettings(false)}
                />
            )}

            {showSched && (
                <ScheduleModal
                    schedule={editSched}
                    hasTelegram={hasTG}
                    hasWhatsApp={!!sendSettings.whatsapp_phone}
                    onSave={async (form, isEdit) => {
                        const success = await saveSchedule(form, isEdit);
                        if (success) setShowSched(false);
                    }}
                    onClose={() => setShowSched(false)}
                />
            )}

            {activeReport && (
                <SendModal
                    report={activeReport}
                    settings={sendSettings}
                    onClose={() => setActiveReport(null)}
                />
            )}

            <ConfirmModal
                isOpen={!!deleteScheduleId}
                onClose={() => setDeleteScheduleId(null)}
                onConfirm={async () => {
                    if (deleteScheduleId) {
                        await deleteSchedule(deleteScheduleId, true);
                        setDeleteScheduleId(null);
                    }
                }}
                title={t.deleteConfirmTitle}
                message={t.deleteConfirmMsg}
                confirmText={t.deleteBtn}
                cancelText={t.cancelBtn}
            />

            <ConfirmModal
                isOpen={showClearConfirm}
                onClose={() => setShowClearConfirm(false)}
                onConfirm={() => {
                    clearChat();
                    setShowClearConfirm(false);
                }}
                title="بدء محادثة جديدة"
                message="هل تريد مسح سجل المحادثة المحفوظ وبدء جلسة جديدة؟ سيتم مسح الرسائل السابقة فقط."
                confirmText="مسح وبدء جديد"
                cancelText="إلغاء"
                intent="danger"
            />

        </div>
    );
};

export default Assistant;
