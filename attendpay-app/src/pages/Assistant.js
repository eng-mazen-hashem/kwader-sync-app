import React, { useState, useEffect } from 'react';
import { HiOutlineDocumentReport, HiOutlineChatAlt2 } from 'react-icons/hi';
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
    const { messages, loading: aiLoading, input, setInput, sendMessage, setMessages } = useAssistantAI(company, data, reloadData);
    const { executeAddEmployee, toggleSchedule, deleteSchedule, saveSchedule } = useAssistantTools(company, reloadData, setMessages);

    // UI state
    const [activeTab, setActiveTab] = useState('chat');
    const [deleteScheduleId, setDeleteScheduleId] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showSched, setShowSched] = useState(false);
    const [editSched, setEditSched] = useState(null);
    const [activeReport, setActiveReport] = useState(null);

    // Helper for AI response actions
    const handleAction = React.useCallback(async (action) => {
        if (!action) return;
        
        switch (action.type) {
            case 'add_employee':
                await executeAddEmployee(action.data);
                break;
            case 'whatsapp':
                // Handled in MessageItem's UI button
                break;
            default:
                // Unknown action types are silently ignored — no console.log in production (constitution §11)
                break;
        }
    }, [executeAddEmployee]);

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

        </div>
    );
};

export default Assistant;
