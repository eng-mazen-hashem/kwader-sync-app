import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Home, MapPin, FileText, User, LogOut,
    Shield, RefreshCw, Smartphone, Bell, Trash2, X
} from 'lucide-react';
import { useEmployeeAuth } from '../context/EmployeeAuthContext';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';
import { supabase } from '../supabaseClient';
import './EmployeeLayout.css';
import '../pages/Employees.css'; // Reuse premium blocker styles

const EmployeeLayout = () => {
    const { employee, logout } = useEmployeeAuth();
    const { language, t, formatTime } = useLocale();
    const navigate = useNavigate();

    // -------------------------------------------------------------------------
    // Professional PWA Force Mobile Download Interceptor for Employees Layout
    // -------------------------------------------------------------------------
    const [isMobile, setIsMobile] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [isIos, setIsIos] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    useEffect(() => {
        const checkStandalone = () => {
            return window.matchMedia('(display-mode: standalone)').matches || 
                   window.navigator.standalone === true;
        };

        const checkMobile = () => {
            const ua = window.navigator.userAgent || window.navigator.vendor || window.opera;
            const matchesUA = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua.toLowerCase());
            return matchesUA || window.innerWidth < 1024;
        };

        setIsStandalone(checkStandalone());
        setIsMobile(checkMobile());

        const userAgent = window.navigator.userAgent || '';
        const iosDevice = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
        setIsIos(iosDevice);

        const handleResize = () => {
            setIsMobile(checkMobile());
        };

        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleMobileInstall = async () => {
        if (!deferredPrompt) {
            toast.info(t.empPwaInstallManualTip);
            return;
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/me/login');
    };

    const [notifications, setNotifications] = useState([]);
    const [isNotifOpen, setIsNotifOpen] = useState(false);

    const fetchNotifications = useCallback(async () => {
        if (!employee) return;
        try {
            const { data, error } = await supabase
                .from('employee_notifications')
                .select('*')
                .eq('employee_id', employee.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setNotifications(data || []);
        } catch (err) {
            console.error('[EmployeeLayout] fetchNotifications:', err);
        }
    }, [employee]);

    useEffect(() => {
        fetchNotifications();
        
        if (!employee) return;
        const channel = supabase
            .channel(`employee_notif_${employee.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'employee_notifications', filter: `employee_id=eq.${employee.id}` },
                (payload) => {
                    setNotifications(prev => [payload.new, ...prev]);
                    toast.success(t.empNewNotification || 'You have a new notification 🔔');
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [employee, fetchNotifications, language]);

    const markAsRead = async (id) => {
        try {
            const { error } = await supabase
                .from('employee_notifications')
                .update({ read_at: new Date().toISOString() })
                .eq('id', id);
            if (error) throw error;
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
        } catch (err) {
            console.error(err);
        }
    };

    const deleteNotification = async (id) => {
        try {
            const { error } = await supabase
                .from('employee_notifications')
                .delete()
                .eq('id', id);
            if (error) throw error;
            setNotifications(prev => prev.filter(n => n.id !== id));
            toast.success(t.empNotificationDeleted || 'Notification deleted');
        } catch (err) {
            console.error(err);
        }
    };

    const unreadCount = notifications.filter(n => !n.read_at).length;

    if (!employee) return null;

    if (false && isMobile && !isStandalone) {
        const isRtl = language === 'ar';
        return (
            <div className="emp-mb-page animate-fadeIn" dir={isRtl ? 'rtl' : 'ltr'}>
                <div className="emp-mb-glow1" />
                <div className="emp-mb-glow2" />

                <div className="emp-mb-card animate-scaleUp">
                    {/* Glowing Logo */}
                    <div className="emp-mb-logo-container">
                        <div className="emp-mb-logo-ring animate-pulse" />
                        <img src="/logo.png" alt="KWADER" className="emp-mb-logo-img" />
                    </div>

                    {/* Heading */}
                    <h2 className="emp-mb-title">
                        {isRtl ? 'تطبيق بوابة الموظفين مطلوب' : 'Employee Portal App Required'}
                    </h2>
                    <p className="emp-mb-subtitle">
                        {isRtl 
                            ? 'لتسجيل حضورك بدقة تامة وتتبع الطلبات والرواتب، يرجى تشغيل بوابة الموظفين كـ تطبيق مثبت على الشاشة الرئيسية.'
                            : 'To check in accurately and track requests & payroll, please run the Employee Portal as an installed app from your home screen.'}
                    </p>

                    {/* Benefits Grid */}
                    <div className="emp-mb-benefits">
                        {[
                            {
                                icon: <Shield size={18} className="text-indigo-400" />,
                                title: isRtl ? 'حماية بياناتك الشخصية' : 'Personal Data Protection',
                                desc: isRtl ? 'تشفير كامل لكافة بياناتك الخاصة وتأمينها لمنع أي تسريب.' : 'Complete encryption of your personal data to prevent any leaks.'
                            },
                            {
                                icon: <MapPin size={18} className="text-purple-400" />,
                                title: isRtl ? 'بصمة الموقع الجغرافي GPS' : 'GPS Location Clocking',
                                desc: isRtl ? 'تسجيل الحضور والإنصراف الذكي والموثوق في نطاق العمل المحدد للشركة.' : 'Smart and reliable check-ins within the company\'s defined work boundaries.'
                            },
                            {
                                icon: <RefreshCw size={18} className="text-teal-400" />,
                                title: isRtl ? 'مزامنة وتنبيهات فورية' : 'Real-time Sync & Alerts',
                                desc: isRtl ? 'استقبل إشعارات الرواتب المعتمدة وموافقات الإجازات لحظة بلحظة.' : 'Receive approved salary slips and leave requests instantly.'
                            }
                        ].map((b, i) => (
                            <div key={i} className="emp-mb-benefit-card">
                                <div className="emp-mb-benefit-icon-wrapper">
                                    {b.icon}
                                </div>
                                <div className="emp-mb-benefit-text">
                                    <h4>{b.title}</h4>
                                    <p>{b.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Installation Guide */}
                    {isIos ? (
                        <div className="emp-mb-ios-guide">
                            <div className="emp-mb-guide-title">
                                <Smartphone size={16} />
                                <span>{isRtl ? 'خطوات التثبيت على أجهزة آبل (iOS)' : 'Installation Steps for Apple Devices (iOS)'}</span>
                            </div>
                            <div className="emp-mb-ios-steps">
                                <div className="emp-mb-ios-step">
                                    <span className="emp-mb-step-num">1</span>
                                    <p>
                                        {isRtl 
                                            ? 'اضغط على زر المشاركة 📥 في شريط أدوات متصفح Safari بالأسفل.'
                                            : 'Tap the Share button 📥 in the Safari toolbar below.'}
                                    </p>
                                </div>
                                <div className="emp-mb-ios-step">
                                    <span className="emp-mb-step-num">2</span>
                                    <p>
                                        {isRtl 
                                            ? 'اسحب القائمة للأعلى ثم اختر «إضافة إلى الشاشة الرئيسية» ➕.'
                                            : 'Scroll up and select "Add to Home Screen" ➕.'}
                                    </p>
                                </div>
                                <div className="emp-mb-ios-step">
                                    <span className="emp-mb-step-num">3</span>
                                    <p>
                                        {isRtl 
                                            ? 'اضغط على «إضافة» في الزاوية العلوية لتثبيت التطبيق.'
                                            : 'Tap "Add" in the top-right corner to complete the install.'}
                                    </p>
                                </div>
                            </div>
                            <div className="emp-mb-ios-indicator animate-bounce">
                                <span className="emp-mb-indicator-arrow">↓</span>
                                <span className="emp-mb-indicator-text">
                                    {isRtl ? 'اضغط بالأسفل للمشاركة والتثبيت' : 'Tap below to share and install'}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="emp-mb-android-guide">
                            {deferredPrompt ? (
                                <>
                                    <button 
                                        onClick={handleMobileInstall}
                                        className="emp-mb-install-btn animate-shimmer"
                                    >
                                        <span>{isRtl ? 'تثبيت تطبيق بوابة الموظفين الآن 📱' : 'Install Employee App Now 📱'}</span>
                                    </button>
                                    <p className="emp-mb-install-tip">
                                        {isRtl 
                                            ? 'سيعمل التطبيق بكامل كفاءته وملء الشاشة فور تثبيته مباشرة من شاشتك الرئيسية.'
                                            : 'The app installs instantly and runs in gorgeous fullscreen directly from your home screen.'}
                                    </p>
                                </>
                            ) : (
                                <div className="emp-mb-android-manual-guide animate-fadeIn" style={{
                                    width: '100%',
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    border: '1px dashed rgba(255, 255, 255, 0.08)',
                                    borderRadius: '20px',
                                    padding: '16px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px'
                                }}>
                                    <div className="emp-mb-guide-title">
                                        <Smartphone size={16} />
                                        <span>{isRtl ? 'خطوات التثبيت السهلة على أندرويد' : 'Easy Install Steps for Android'}</span>
                                    </div>
                                    <div className="emp-mb-ios-steps">
                                        <div className="emp-mb-ios-step">
                                            <span className="emp-mb-step-num">1</span>
                                            <p>
                                                {isRtl 
                                                    ? 'اضغط على زر الخيارات ⋮ (النقاط الثلاث) في أعلى متصفح كروم أو بريف.'
                                                    : 'Tap the options menu ⋮ (three dots) in Chrome or Brave.'}
                                            </p>
                                        </div>
                                        <div className="emp-mb-ios-step">
                                            <span className="emp-mb-step-num">2</span>
                                            <p>
                                                {isRtl 
                                                    ? 'اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية» ➕.'
                                                    : 'Select "Install app" or "Add to Home screen" ➕.'}
                                            </p>
                                        </div>
                                        <div className="emp-mb-ios-step">
                                            <span className="emp-mb-step-num">3</span>
                                            <p>
                                                {isRtl 
                                                    ? 'اضغط على «تثبيت» لتأكيد تثبيت التطبيق فوراً على شاشتك.'
                                                    : 'Tap "Install" or "Add" to complete and run in fullscreen.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const navItems = [
        { path: '/me', icon: <Home size={22} className="nav-icon" />, label: t.empNavHome || 'Home' },
        { path: '/me/punch', icon: <MapPin size={22} className="nav-icon" />, label: t.empNavPunch || 'Punch' },
        { path: '/me/requests', icon: <FileText size={22} className="nav-icon" />, label: t.empNavRequests || 'Requests' },
        { path: '/me/profile', icon: <User size={22} className="nav-icon" />, label: t.empNavProfile || 'Profile' }
    ];

    return (
        <div className="emp-portal-container" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            
            {/* Header */}
            <header className="emp-portal-header">
                <div className="emp-portal-logo">
                    <img src="/logo.png" alt="Logo" onError={(e) => e.target.style.display='none'} />
                    <span>{t.empPortalTitle || 'Employee Portal'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button 
                        className="emp-portal-bell" 
                        onClick={() => setIsNotifOpen(true)}
                        style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', position: 'relative' }}
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span style={{ position: 'absolute', top: '-2px', right: '-2px', background: '#ef4444', color: 'white', fontSize: '0.65rem', fontWeight: 'bold', width: '15px', height: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                                {unreadCount}
                            </span>
                        )}
                    </button>
                    <button className="emp-portal-logout" onClick={handleLogout} title={t.signOut}>
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            {/* Main Content (Routes injected here) */}
            <main className="emp-portal-main">
                <Outlet />
            </main>

            {/* Bottom Navigation */}
            <nav className="emp-bottom-nav">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === '/me'} // exact match for root
                        className={({ isActive }) => `emp-nav-item ${isActive ? 'active' : ''}`}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* Notifications Drawer */}
            <AnimatePresence>
                {isNotifOpen && (
                    <>
                        <div 
                            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100 }}
                            onClick={() => setIsNotifOpen(false)}
                        />
                        <motion.div 
                            initial={{ x: language === 'ar' ? '-100%' : '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: language === 'ar' ? '-100%' : '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            style={{ 
                                position: 'fixed', 
                                top: 0, 
                                [language === 'ar' ? 'left' : 'right']: 0, 
                                bottom: 0, 
                                width: '320px', 
                                background: '#1e293b', 
                                borderLeft: language === 'ar' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                                borderRight: language === 'ar' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                                zIndex: 101,
                                display: 'flex',
                                flexDirection: 'column',
                                padding: '16px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                                color: 'white'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                    <Bell size={18} className="text-indigo-400" />
                                    {t.empNotificationsTitle || 'Notifications'}
                                </h3>
                                <button onClick={() => setIsNotifOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                                    <X size={18} />
                                </button>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }} className="custom-scrollbar">
                                {notifications.length === 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#64748b', gap: '8px' }}>
                                        <Bell size={32} style={{ opacity: 0.3 }} />
                                        <p style={{ fontSize: '0.85rem', margin: 0 }}>{t.empNoNotifications || 'No notifications yet'}</p>
                                    </div>
                                ) : (
                                    notifications.map(n => {
                                        const isUnread = !n.read_at;
                                        return (
                                            <div 
                                                key={n.id}
                                                onClick={() => isUnread && markAsRead(n.id)}
                                                style={{ 
                                                    background: isUnread ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                                                    border: isUnread ? '1px solid rgba(99,102,241,0.2)' : '1px solid rgba(255,255,255,0.05)',
                                                    borderRadius: '12px',
                                                    padding: '12px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '6px',
                                                    cursor: isUnread ? 'pointer' : 'default',
                                                    position: 'relative',
                                                    transition: 'all 0.2s',
                                                    textAlign: language === 'ar' ? 'right' : 'left'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: isUnread ? 'white' : '#cbd5e1' }}>
                                                        {n.title}
                                                    </span>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', opacity: 0.6 }}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                                <p style={{ fontSize: '0.78rem', color: isUnread ? '#cbd5e1' : '#94a3b8', lineHeight: '1.4', margin: 0 }}>
                                                    {n.message}
                                                </p>
                                                <span style={{ fontSize: '0.68rem', color: '#64748b', alignSelf: language === 'ar' ? 'flex-start' : 'flex-end' }}>
                                                    {formatTime(n.created_at)}
                                                </span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default EmployeeLayout;
