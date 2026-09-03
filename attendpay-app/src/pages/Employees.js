import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    Search, UserPlus, Phone, Pencil, Trash2,
    Users, UserCheck, Clock, ChevronLeft, ChevronRight,
    Download, SlidersHorizontal, Shield, MapPin, RefreshCw,
    Smartphone
} from 'lucide-react';
import EmployeeFormModal from '../components/EmployeeFormModal';
import ConfirmModal from '../components/ConfirmModal';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';
import { logAudit } from '../utils/auditLogger';
import './Employees.css';

// -------------------------------------------------------------------------
const AVATAR_COLORS = [
    'linear-gradient(135deg,#6366f1,#8b5cf6)',
    'linear-gradient(135deg,#8b5cf6,#c084fc)',
    'linear-gradient(135deg,#06b6d4,#6366f1)',
    'linear-gradient(135deg,#f59e0b,#ef4444)',
    'linear-gradient(135deg,#10b981,#06b6d4)',
];
const avatarColor = (name = '') =>
    AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

// -------------------------------------------------------------------------
const statusConfig = {
    active:     { label: 'active',    cls: 'emp-badge-active' },
    inactive:   { label: 'inactive',  cls: 'emp-badge-inactive' },
    terminated: { label: 'terminated',cls: 'emp-badge-error' },
    on_leave:   { label: 'on leave',  cls: 'emp-badge-warning' },
};

function getBadgeConfig(status, t) {
    const cfg = statusConfig[status] || statusConfig.inactive;
    return {
        cls  : cfg.cls,
        label: status === 'active' ? t.statusActive : t.statusInactive,
    };
}

function Employees() {
    const { company }                   = useAuth();
    const { t, formatCurrency, language } = useLocale();
    const navigate                      = useNavigate();

    // -------------------------------------------------------------------------
    // Professional PWA Force Mobile Download Interceptor
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
            toast.info(language === 'ar' ? 'التثبيت التلقائي غير مدعوم على متصفحك الحالي. يرجى التثبيت يدوياً عبر قائمة المتصفح.' : 'Automatic installation is not supported on your current browser. Please install manually from browser options.');
            return;
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

// -------------------------------------------------------------------------
    const [employeeList, setEmployeeList]   = useState([]);
    const [totalCount,   setTotalCount]     = useState(0);
    const [departments,  setDepartments]    = useState([]);
    const [searchTerm,   setSearchTerm]     = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page,         setPage]           = useState(0);
    const [pageSize]                        = useState(50);
    const [showModal,    setShowModal]      = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [employeeToDelete, setEmployeeToDelete] = useState(null);
    const [loading,      setLoading]        = useState(true);

// -------------------------------------------------------------------------
    const [deptFilter, setDeptFilter]       = useState('all');

// -------------------------------------------------------------------------
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(0);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchTerm]);

// -------------------------------------------------------------------------
    const fetchEmployees = useCallback(async () => {
        if (!company) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            let query = supabase
                .from('employees')
                .select(`id, name, phone, device_pin, base_salary, joining_date, department_id, status, departments(name)`, { count: 'exact' })
                .eq('company_id', company.id);

            if (debouncedSearch) {
                query = query.or(`name.ilike.%${debouncedSearch}%,device_pin.ilike.%${debouncedSearch}%`);
            }

            const from = page * pageSize;
            const to   = from + pageSize - 1;

            const { data, count, error } = await query
                .order('created_at', { ascending: true })
                .range(from, to);

            if (error) throw error;
            setEmployeeList(data || []);
            setTotalCount(count || 0);
        } catch (err) {
            console.error('[Employees] fetchEmployees:', err.message);
            toast.error(t.errFetchFailed);
        } finally {
            setLoading(false);
        }
    }, [company, t, page, pageSize, debouncedSearch]);

// -------------------------------------------------------------------------
    const fetchDepartments = useCallback(async () => {
        if (!company) return;
        try {
            const { data, error } = await supabase
                .from('departments')
                .select('id, name')
                .eq('company_id', company.id);

            if (error) throw error;
            setDepartments(data || []);
        } catch (err) {
            console.error('[Employees] fetchDepartments:', err.message);
        }
    }, [company]);

    useEffect(() => { fetchEmployees();   }, [fetchEmployees]);
    useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

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
                        {isRtl ? 'تطبيق الموظفين مطلوب لإدارة فريقك' : 'Employees App Required to Manage Your Team'}
                    </h2>
                    <p className="emp-mb-subtitle">
                        {isRtl 
                            ? 'لضمان أمان البيانات، دقة المعالجة، والربط المباشر مع أجهزة البصمة الذكية، يرجى تشغيل كوادر كـ تطبيق من الشاشة الرئيسية.'
                            : 'To ensure data security, calculation accuracy, and direct link with smart biometric devices, please run Kwader as an app from your home screen.'}
                    </p>

                    {/* Benefits Grid */}
                    <div className="emp-mb-benefits">
                        {[
                            {
                                icon: <Shield size={18} className="text-indigo-400" />,
                                title: isRtl ? 'حماية معززة وتشفير كامل' : 'Enhanced Data Protection',
                                desc: isRtl ? 'تشفير محلي متكامل لحماية ملفات وسجلات موظفيك من أي وصول غير مصرح.' : 'Integrated local data encryption to protect your employee records from unauthorized access.'
                            },
                            {
                                icon: <MapPin size={18} className="text-purple-400" />,
                                title: isRtl ? 'بصمة الموقع الجغرافي GPS' : 'GPS Location Clocking',
                                desc: isRtl ? 'التحقق الآمن والذكي من النطاق الجغرافي المسموح به للموظفين لتسجيل الحضور.' : 'Secure and smart location boundary verification for employee clock-ins.'
                            },
                            {
                                icon: <RefreshCw size={18} className="text-teal-400" />,
                                title: isRtl ? 'مزامنة أجهزة البصمة اللحظية' : 'Real-time Biometric Sync',
                                desc: isRtl ? 'ربط لاسلكي مباشر مع أجهزة البصمة المعتمدة وتحديث كشوف الرواتب تلقائياً.' : 'Direct wireless connection with certified biometric devices, updating payrolls instantly.'
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
                                        <span>{isRtl ? 'تثبيت تطبيق كوادر الآن 📱' : 'Install Kwader App Now 📱'}</span>
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

// -------------------------------------------------------------------------
    const handleOpenAdd  = () => { setEditingEmployee(null); setShowModal(true); };
    const handleOpenEdit = (emp) => { setEditingEmployee(emp); setShowModal(true); };
    const handleDelete   = (id)  => { setEmployeeToDelete(id); };

    const confirmDelete = async () => {
        if (!employeeToDelete) return;
        try {
            const empToDel = employeeList.find(e => e.id === employeeToDelete);

            const { error } = await supabase
                .from('employees')
                .delete()
                .eq('id', employeeToDelete)
                .eq('company_id', company.id);

            if (error) throw error;

            toast.success(t.msgEmployeeDeleted);

            await logAudit({
                companyId : company.id,
                userId    : (await supabase.auth.getUser()).data.user?.id,
                action    : 'DELETE_EMPLOYEE',
                tableName : 'employees',
                recordId  : employeeToDelete,
                oldData   : empToDel,
                newData   : null,
            });

            fetchEmployees();
        } catch (err) {
            console.error('[Employees] confirmDelete:', err.message);
            toast.error(t.errorDeleteEmployee);
        } finally {
            setEmployeeToDelete(null);
        }
    };

// -------------------------------------------------------------------------
    const visibleList = deptFilter === 'all'
        ? employeeList
        : employeeList.filter(e => String(e.department_id) === deptFilter);

// -------------------------------------------------------------------------
    const activeCount  = employeeList.filter(e => e.status === 'active').length;
    const deptCount    = departments.length;

// -------------------------------------------------------------------------
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startIdx   = page * pageSize + 1;
    const endIdx     = Math.min((page + 1) * pageSize, totalCount);

// -------------------------------------------------------------------------
    return (
        <div className="emp-page fade-in">


            <div className="emp-header">
                <div className="emp-header-text">
                    <h2 className="emp-title">{t.employeesTitle}</h2>
                    <p className="emp-subtitle">
                        {t.employeesSubtitle?.replace('{count}', totalCount) ??
                            `Manage ${totalCount} team members`}
                    </p>
                </div>
                <div className="emp-header-actions">
                    <button className="emp-btn-secondary" onClick={() => toast.info('Export coming soon')}>
                        <Download size={16} />
                        {t.exportBtn ?? 'Export'}
                    </button>
                    <button className="emp-btn-primary" onClick={handleOpenAdd}>
                        <UserPlus size={16} />
                        {t.addEmployeeBtn}
                    </button>
                </div>
            </div>


            <div className="emp-stats-row">
                {[
                    {
                        icon : <Users size={22} />,
                        iconCls: 'emp-stat-icon-indigo',
                        label: t.totalEmployees ?? 'Total Employees',
                        value: loading ? '—' : totalCount.toLocaleString(),
                        badge: null,
                    },
                    {
                        icon : <UserCheck size={22} />,
                        iconCls: 'emp-stat-icon-purple',
                        label: t.activeEmployees ?? 'Active',
                        value: loading ? '—' : activeCount.toLocaleString(),
                        badge: totalCount > 0
                            ? `${Math.round((activeCount / totalCount) * 100)}%`
                            : null,
                    },
                    {
                        icon : <Clock size={22} />,
                        iconCls: 'emp-stat-icon-teal',
                        label: t.departments ?? 'Departments',
                        value: loading ? '—' : deptCount,
                        badge: null,
                    },
                ].map((s, i) => (
                    <motion.div
                        key={i}
                        className="emp-stat-card"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                    >
                        <div className="emp-stat-glow" />
                        <div className="emp-stat-top">
                            <div className={`emp-stat-icon ${s.iconCls}`}>{s.icon}</div>
                            {s.badge && <span className="emp-stat-badge">{s.badge}</span>}
                        </div>
                        <p className="emp-stat-label">{s.label}</p>
                        <h3 className="emp-stat-value">{s.value}</h3>
                    </motion.div>
                ))}
            </div>


            <div className="emp-filter-bar">
                {/* Search */}
                <div className="emp-search-wrap">
                    <Search className="emp-search-icon" size={16} />
                    <input
                        className="emp-search-input"
                        type="text"
                        placeholder={t.searchEmployeesPlaceholder}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Department filter */}
                <div className="emp-filter-group">
                    <select
                        className="emp-select"
                        value={deptFilter}
                        onChange={(e) => setDeptFilter(e.target.value)}
                    >
                        <option value="all">{t.allDepartments ?? 'All Departments'}</option>
                        {departments.map(d => (
                            <option key={d.id} value={String(d.id)}>{d.name}</option>
                        ))}
                    </select>

                    <button className="emp-filter-btn" title="Advanced filters">
                        <SlidersHorizontal size={18} />
                    </button>
                </div>
            </div>


            <motion.div
                className="emp-table-card"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
            >
                <div className="emp-table-wrap">
                    <table className="emp-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>{t.thEmployeeName}</th>
                                <th>{t.thPhoneNumber}</th>
                                <th>{t.thFingerprintPin}</th>
                                <th>{t.thBaseSalary}</th>
                                <th>{t.thDepartment}</th>
                                <th>{t.thJoiningDate}</th>
                                <th>{t.thStatus}</th>
                                <th style={{ textAlign: 'end' }}>{t.thActions}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence mode="wait">
                                {loading ? (
                                    // Skeleton rows
                                    [...Array(5)].map((_, i) => (
                                        <tr key={`sk-${i}`} className="emp-skeleton-row">
                                            {[...Array(9)].map((__, j) => (
                                                <td key={j}>
                                                    <div className="emp-skeleton" style={{ width: j === 1 ? 160 : 80 }} />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : visibleList.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="emp-empty">
                                            <Users size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                                            <p>{searchTerm ? t.noMatchingEmployees : t.noEmployeesFound}</p>
                                        </td>
                                    </tr>
                                ) : (
                                    visibleList.map((emp, index) => {
                                        const { cls: badgeCls, label: badgeLabel } = getBadgeConfig(emp.status, t);
                                        return (
                                            <motion.tr
                                                key={emp.id}
                                                className="emp-row"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: index * 0.03 }}
                                                onClick={() => navigate(`/employees/${emp.id}`)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                {/* # */}
                                                <td className="emp-td-muted" data-label="#">
                                                    {page * pageSize + index + 1}
                                                </td>

                                                {/* Name + Avatar */}
                                                <td data-label={t.thEmployeeName}>
                                                    <div className="emp-name-cell">
                                                        <div
                                                            className="emp-avatar"
                                                            style={{ background: avatarColor(emp.name) }}
                                                        >
                                                            {emp.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="emp-name">{emp.name}</span>
                                                    </div>
                                                </td>

                                                {/* Phone */}
                                                <td data-label={t.thPhoneNumber}>
                                                    <span className="emp-phone">
                                                        <Phone size={13} />
                                                        {emp.phone || '—'}
                                                    </span>
                                                </td>

                                                {/* PIN */}
                                                <td data-label={t.thFingerprintPin}>
                                                    <span className="emp-pin-badge">{emp.device_pin}</span>
                                                </td>

                                                {/* Salary */}
                                                <td className="emp-salary privacy-blur" data-label={t.thBaseSalary}>
                                                    {formatCurrency(emp.base_salary)}
                                                </td>

                                                {/* Department */}
                                                <td data-label={t.thDepartment}>
                                                    {emp.departments?.name
                                                        ? <span className="emp-dept-pill">{emp.departments.name}</span>
                                                        : <span className="emp-td-muted">—</span>}
                                                </td>

                                                {/* Join date */}
                                                <td className="emp-td-muted" data-label={t.thJoiningDate}>
                                                    {emp.joining_date || '—'}
                                                </td>

                                                {/* Status */}
                                                <td data-label={t.thStatus}>
                                                    <span className={`emp-status-badge ${badgeCls}`}>
                                                        {badgeLabel}
                                                    </span>
                                                </td>

                                                {/* Actions */}
                                                <td data-label={t.thActions}>
                                                    <div className="emp-actions" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            className="emp-action-btn"
                                                            onClick={(e) => { e.stopPropagation(); handleOpenEdit(emp); }}
                                                            title={t.editTitle}
                                                        >
                                                            <Pencil size={15} />
                                                        </button>
                                                        <button
                                                            className="emp-action-btn emp-action-danger"
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(emp.id); }}
                                                            title={t.deleteTitle}
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        );
                                    })
                                )}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>


                {totalCount > pageSize && (
                    <div className="emp-pagination">
                        <span className="emp-pagination-info">
                            {t.showing ?? 'Showing'} {startIdx}–{endIdx} {t.of ?? 'of'} {totalCount}
                        </span>
                        <div className="emp-pagination-controls">
                            <button
                                className="emp-page-btn"
                                disabled={page === 0}
                                onClick={() => setPage(p => p - 1)}
                            >
                                <ChevronLeft size={18} />
                            </button>

                            {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                                const p = i;
                                return (
                                    <button
                                        key={p}
                                        className={`emp-page-btn ${p === page ? 'active' : ''}`}
                                        onClick={() => setPage(p)}
                                    >
                                        {p + 1}
                                    </button>
                                );
                            })}

                            <button
                                className="emp-page-btn"
                                disabled={page >= totalPages - 1}
                                onClick={() => setPage(p => p + 1)}
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>


            <EmployeeFormModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSaved={() => { setShowModal(false); fetchEmployees(); }}
                editingEmployee={editingEmployee}
                departments={departments}
            />

            <ConfirmModal
                isOpen={!!employeeToDelete}
                onClose={() => setEmployeeToDelete(null)}
                onConfirm={confirmDelete}
                title={t.deleteConfirmTitle}
                message={t.deleteConfirmMsg}
                confirmText={t.deleteBtn}
            />
        </div>
    );
}

export default Employees;
