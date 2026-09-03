import React, { useCallback, useEffect, useRef, useState } from 'react';
import { 
    HiOutlineSearch, HiOutlineBell, HiOutlineMenuAlt3, HiOutlineSun, HiOutlineMoon, 
    HiOutlineTrash, HiOutlineCheck, HiOutlineEye, HiOutlineEyeOff, HiOutlineQuestionMarkCircle,
    HiOutlineExclamationCircle, HiOutlineCheckCircle, HiOutlineInformationCircle, HiOutlineExclamation,
    HiOutlineOfficeBuilding, HiChevronDown
} from 'react-icons/hi';
import { useTheme } from '../context/ThemeContext';
import { usePrivacy } from '../context/PrivacyContext';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import './TopBar.css';

const getNotificationIcon = (type) => {
    switch (type) {
        case 'success':
            return <HiOutlineCheckCircle size={20} />;
        case 'warning':
            return <HiOutlineExclamationCircle size={20} />;
        case 'error':
        case 'critical':
            return <HiOutlineExclamation size={20} />;
        case 'info':
        default:
            return <HiOutlineInformationCircle size={20} />;
    }
};

function TopBar({ title, subtitle, onMenuClick }) {
    const { isDark, toggleTheme } = useTheme();
    const { isPrivacyActive, togglePrivacy } = usePrivacy();
    const { company, companies, isReseller, isSuperAdmin, switchRole, switchCompany } = useAuth();
    const { t, language, toggleLanguage, country } = useLocale();
    const [notifications, setNotifications] = useState([]);
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifLoading, setNotifLoading] = useState(false);
    const notifRef = useRef(null);

    const [switcherOpen, setSwitcherOpen] = useState(false);
    const switcherRef = useRef(null);

    const fetchNotifications = useCallback(async () => {
        if (!company?.id) return;
        setNotifLoading(true);
        try {
            const { data, error } = await supabase
                .from('company_notifications')
                .select('id, title, message, type, created_at, read_at')
                .eq('company_id', company.id)
                .order('created_at', { ascending: false })
                .limit(8);
            if (!error) {
                setNotifications(data || []);
            }
        } finally {
            setNotifLoading(false);
        }
    }, [company?.id]);

    const markAllRead = useCallback(async () => {
        if (!company?.id) return;
        await supabase
            .from('company_notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('company_id', company.id)
            .is('read_at', null);
        setNotifications((prev) =>
            prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
        );
    }, [company?.id]);

    const markRead = useCallback(async (id) => {
        await supabase
            .from('company_notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('id', id);
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at || new Date().toISOString() } : n))
        );
    }, []);

    const deleteNotification = useCallback(async (id, e) => {
        if (e) e.stopPropagation();
        
        // Optimistic UI update
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        
        // Backend delete (now supported by RLS)
        await supabase
            .from('company_notifications')
            .delete()
            .eq('id', id);
    }, []);

    const deleteAllNotifications = useCallback(async () => {
        if (!company?.id) return;
        
        // Optimistic UI update
        setNotifications([]);
        
        // Backend delete (now supported by RLS)
        await supabase
            .from('company_notifications')
            .delete()
            .eq('company_id', company.id);
    }, [company?.id]);

    useEffect(() => {
        if (!company?.id) return;
        fetchNotifications();
        const channel = supabase
            .channel(`company-notifications-${company.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'company_notifications', filter: `company_id=eq.${company.id}` },
                (payload) => {
                    if (payload.new.type === 'force_refresh') {
                        supabase.from('company_notifications').delete().eq('id', payload.new.id).then();
                        toast.info(t.msgHardRefreshing || 'جاري إعادة تحميل الصفحة لرؤية التحديثات الجديدة...', {
                            duration: 2000,
                            position: 'top-center'
                        });
                        setTimeout(() => {
                            const currentUrl = new URL(window.location.href);
                            currentUrl.searchParams.set('refresh', Date.now().toString());
                            window.location.replace(currentUrl.toString());
                        }, 1500);
                        return;
                    }
                    setNotifications((prev) => [payload.new, ...prev].slice(0, 8));
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'company_notifications', filter: `company_id=eq.${company.id}` },
                (payload) => {
                    setNotifications((prev) => prev.map((n) => (n.id === payload.new.id ? payload.new : n)));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [company?.id, fetchNotifications, t]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setNotifOpen(false);
            }
            if (switcherRef.current && !switcherRef.current.contains(event.target)) {
                setSwitcherOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const unreadCount = notifications.filter((n) => !n.read_at).length;
    return (
        <header className="topbar">
            {/* Right side (for RTL) - Title and Menu button */}
            <div className="topbar-right">
                <button className="topbar-menu-btn" onClick={onMenuClick} aria-label={t.openSidebar}>
                    <HiOutlineMenuAlt3 />
                </button>
                <div className="topbar-title-group">
                    <h1 className="topbar-title">{title}</h1>
                    {subtitle && <p className="topbar-subtitle">{subtitle}</p>}
                </div>
            </div>

            {/* Left side (for RTL) - Search and Profile */}
            <div className="topbar-left">
                <div className="topbar-search-wrapper">
                    <HiOutlineSearch className="search-icon" />
                    <input type="text" placeholder={t.searchPlaceholder} aria-label={t.searchPlaceholder} />
                </div>

                <div className="topbar-actions">

                    {companies && companies.length > 1 && (
                        <div className="company-switcher-wrapper" ref={switcherRef}>
                            <button 
                                className="company-switcher-btn"
                                onClick={() => setSwitcherOpen(!switcherOpen)}
                                title={language === 'ar' ? "تغيير الشركة" : "Switch Company"}
                            >
                                <HiOutlineOfficeBuilding className="company-switcher-btn-icon" size={16} />
                                <span className="company-switcher-btn-text">{company?.name || ''}</span>
                                <HiChevronDown className={`company-switcher-icon ${switcherOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {switcherOpen && (
                                <div className="company-switcher-dropdown fade-in">
                                    <div className="company-switcher-dropdown-pointer"></div>
                                    <div className="company-switcher-list">
                                        {companies.map(c => (
                                            <button
                                                key={c.company.id}
                                                className={`company-switcher-item ${c.company.id === company?.id ? 'active' : ''}`}
                                                onClick={() => {
                                                    switchCompany(c.company.id);
                                                    setSwitcherOpen(false);
                                                }}
                                            >
                                                <HiOutlineOfficeBuilding size={16} />
                                                <span>{c.company.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}


                    <button
                        className="topbar-action-btn lang-toggle"
                        onClick={toggleLanguage}
                        title={language === 'ar' ? "Switch to English" : "تغيير للعربية"}
                    >
                        {language === 'ar' ? 'EN' : 'AR'}
                    </button>
                    <button 
                        className="topbar-action-btn theme-toggle-btn" 
                        onClick={toggleTheme} 
                        aria-label={t.toggleTheme}
                        title={isDark ? t.lightMode : t.darkMode}
                        style={{ color: isDark ? '#f59e0b' : '#6c63ff' }}
                    >
                        {isDark ? <HiOutlineSun /> : <HiOutlineMoon />}
                    </button>

                    <button 
                        className={`topbar-action-btn privacy-toggle-btn ${isPrivacyActive ? 'active' : ''}`}
                        onClick={togglePrivacy} 
                        aria-label={t.privacyMode}
                        title={t.privacyMode}
                    >
                        {isPrivacyActive ? <HiOutlineEyeOff /> : <HiOutlineEye />}
                    </button>

                    <button 
                        className="topbar-action-btn tour-trigger-btn" 
                        onClick={() => window.dispatchEvent(new CustomEvent('start-product-tour'))}
                        title={language === 'ar' ? 'جولة تعريفية بالنظام' : 'Quick Guided Tour'}
                        style={{ color: '#818cf8' }}
                    >
                        <HiOutlineQuestionMarkCircle />
                    </button>

                    <div className="notification-wrapper" ref={notifRef}>
                        <button
                            className={`topbar-action-btn ${notifOpen ? 'active' : ''}`}
                            aria-label={t.notifications}
                            onClick={() => {
                                const next = !notifOpen;
                                setNotifOpen(next);
                                if (next) fetchNotifications();
                            }}
                        >
                            <HiOutlineBell />
                            {unreadCount > 0 && (
                                <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                            )}
                        </button>
                        {notifOpen && (
                            <div className="notification-panel fade-in">
                                <div className="notification-panel-pointer"></div>
                                <div className="notification-header">
                                    <span className="notification-header-title">{t.notifications}</span>
                                    <div className="notification-header-actions">
                                        {unreadCount > 0 && (
                                            <button className="notification-quick-btn tooltip-trigger" onClick={markAllRead} title={language === 'ar' ? "تحديد الكل كمقروء" : "Mark all read"}>
                                                <HiOutlineCheck size={16} />
                                            </button>
                                        )}
                                        {notifications.length > 0 && (
                                            <button className="notification-quick-btn danger tooltip-trigger" onClick={deleteAllNotifications} title={language === 'ar' ? "مسح الكل" : "Clear all"}>
                                                <HiOutlineTrash size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="notification-list">
                                    {notifLoading && (
                                        <div className="notification-empty">
                                            <div className="spinner-mini"></div>
                                            {t.loading}
                                        </div>
                                    )}
                                    {!notifLoading && notifications.length === 0 && (
                                        <div className="notification-empty">
                                            <div className="notification-empty-icon">🔔</div>
                                            {language === 'ar' ? 'لا يوجد إشعارات جديدة' : 'No new notifications'}
                                        </div>
                                    )}
                                    {!notifLoading && notifications.map((item) => (
                                        <div
                                            key={item.id}
                                            className={`notification-item ${item.read_at ? 'read' : 'unread'}`}
                                            onClick={() => markRead(item.id)}
                                        >
                                            <div className={`notification-icon-wrapper ${item.type || 'info'}`}>
                                                {getNotificationIcon(item.type)}
                                            </div>
                                            <div className="notification-content">
                                                <div className="notification-title">{item.title}</div>
                                                <div className="notification-message">{item.message}</div>
                                                <div className="notification-time">
                                                    {item.created_at ? new Date(item.created_at).toLocaleString(country.locale) : ''}
                                                </div>
                                            </div>
                                            <button 
                                                className="notification-delete-btn" 
                                                onClick={(e) => deleteNotification(item.id, e)}
                                                title={language === 'ar' ? "حذف" : "Delete"}
                                            >
                                                <HiOutlineTrash />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="topbar-divider"></div>
                    
                    <div className="topbar-date-display">
                        {new Date().toLocaleDateString(country.locale, {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                        })}
                    </div>
                </div>
            </div>
        </header>
    );
}

export default TopBar;
