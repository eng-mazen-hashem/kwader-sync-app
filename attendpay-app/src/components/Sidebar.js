import React, { useEffect, useState, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    ClipboardCheck,
    CalendarDays,
    Building2,
    Clock,
    DollarSign,
    HandCoins,
    Scale,
    BotMessageSquare,
    Monitor,
    Settings,
    ShieldCheck,
    LogOut,
    X,
    ChevronsLeft,
    ChevronsRight,
    ChevronUp,
    Briefcase,
    Store
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import AccountSettingsModal from './AccountSettingsModal';
import './Sidebar.css';

function Sidebar({ collapsed, mobileOpen, onToggle, onClose }) {
    const { company, isSuperAdmin, isReseller, activeRole, switchRole, signOut, hasPermission } = useAuth();
    const { t, language } = useLocale();
    const navigate = useNavigate();
    const location = useLocation();
    const [showRoleMenu, setShowRoleMenu] = useState(false);
    const [showAccountModal, setShowAccountModal] = useState(false);
    const roleMenuRef = useRef(null);

// -------------------------------------------------------------------------
    const navGroups = [
        {
            groupLabel: t.hrGroup,
            groupIcon: '👥',
            items: [
                { path: '/dashboard', label: t.dashboard, icon: LayoutDashboard },
                { path: '/employees', label: t.employees, icon: Users, permission: 'manage_employees' },
                { path: '/attendance', label: t.attendance, icon: ClipboardCheck, permission: 'manage_attendance' },
                { path: '/leaves', label: t.leaves, icon: CalendarDays, permission: 'manage_attendance' },
                { path: '/structure', label: t.structure, icon: Building2, permission: 'manage_settings' },
                { path: '/shifts', label: t.shifts, icon: Clock, permission: 'manage_attendance' },
                { path: '/payroll', label: t.payroll, icon: DollarSign, permission: 'manage_payroll' },
                { path: '/loans', label: t.loans, icon: HandCoins, permission: 'manage_loans' },
            ].filter(item => !item.permission || hasPermission(item.permission)),
        },
        {
            groupLabel: t.advancedTools,
            groupIcon: '⚡',
            items: [
                { path: '/rules', label: t.rulesBuilder, icon: Scale, permission: 'manage_settings' },
                { path: '/assistant', label: t.smartAssistant, icon: BotMessageSquare },
            ].filter(item => !item.permission || hasPermission(item.permission)),
        },
        {
            groupLabel: t.systemGroup,
            groupIcon: '⚙️',
            items: [
                { path: '/devices', label: t.devices, icon: Monitor, permission: 'manage_settings' },
                { path: '/team', label: t.teamWork, icon: Users, permission: 'admin_only' },
                { path: '/settings', label: t.settings, icon: Settings, permission: 'manage_settings' },
            ].filter(item => {
                if (item.permission === 'admin_only') return activeRole === 'org_admin' || activeRole === 'super_admin';
                return !item.permission || hasPermission(item.permission);
            }),
        },
    ];

    const SUPER_ADMIN_ITEM = { path: '/super-admin', label: t.superAdmin, icon: ShieldCheck };

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    // Close on mobile route change
    useEffect(() => {
        if (mobileOpen) onClose();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]);

    // Close role menu on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (roleMenuRef.current && !roleMenuRef.current.contains(event.target)) {
                setShowRoleMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const avatarChar = isSuperAdmin ? '⭐' : activeRole === 'reseller' ? 'M' : (company?.name?.charAt(0)?.toUpperCase() || 'K');
    const userName = isSuperAdmin ? 'KWADER Admin' : activeRole === 'reseller' ? t.resellerDashboard : (company?.name || t.myCompany);
    const userRole = isSuperAdmin ? t.userRoleSuper : activeRole === 'reseller' ? t.certifiedReseller : t.userRoleAdmin;

    const canSwitchRoles = (isReseller && company && !isSuperAdmin) || (isSuperAdmin && company);

    return (
        <>
            {/* Mobile Overlay */}
            {mobileOpen && (
                <div className="sidebar-overlay" onClick={onClose} aria-hidden="true" />
            )}

            <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
                {/* Ambient glow */}
                <div className="sidebar-glow" aria-hidden="true" />


                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <div className="logo-icon-wrap">
                            <img src="/logo.png" alt="KWADER" className="logo-icon" />
                        </div>
                        <div className="logo-text-wrap">
                            <span className="logo-text">KWADER</span>
                            <span className="logo-sub">HR Platform</span>
                        </div>
                    </div>

                    {/* Desktop Toggle */}
                    <button
                        className="sidebar-toggle desktop-only"
                        onClick={onToggle}
                        aria-label={collapsed ? t.expandMenu : t.collapseMenu}
                    >
                        {collapsed
                            ? <ChevronsRight size={16} />
                            : <ChevronsLeft size={16} />}
                    </button>

                    {/* Mobile Close */}
                    <button
                        className="sidebar-close mobile-only"
                        onClick={onClose}
                        aria-label={t.closeMenu}
                    >
                        <X size={20} />
                    </button>
                </div>


                <nav className="sidebar-nav" aria-label="Primary navigation">
                    {navGroups.map((group) => (
                        <div key={group.groupLabel} className="nav-group">
                            <div className="nav-group-header">
                                <span className="nav-group-label">{group.groupLabel}</span>
                                <div className="nav-group-divider" />
                            </div>

                            {group.items.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    end={item.path === '/'}
                                    className={({ isActive }) =>
                                        `nav-item ${isActive ? 'active' : ''}`
                                    }
                                    data-tour={item.path.substring(1)}
                                    data-tooltip={item.label}
                                >
                                    <div className="nav-icon-wrapper">
                                        <item.icon size={20} strokeWidth={1.8} className="nav-icon" />
                                    </div>
                                    <span className="nav-label">{item.label}</span>
                                    <div className="nav-active-indicator" aria-hidden="true" />
                                </NavLink>
                            ))}

                            {/* Super Admin Link — shown in System group */}
                            {group.groupLabel === t.systemGroup && isSuperAdmin && (
                                <NavLink
                                    to={SUPER_ADMIN_ITEM.path}
                                    className={({ isActive }) =>
                                        `nav-item super-admin-link ${isActive ? 'active' : ''}`
                                    }
                                    data-tooltip={SUPER_ADMIN_ITEM.label}
                                >
                                    <div className="nav-icon-wrapper super-admin-icon">
                                        <ShieldCheck size={20} strokeWidth={1.8} className="nav-icon" />
                                    </div>
                                    <span className="nav-label">{t.superAdmin}</span>
                                    <div className="nav-active-indicator" aria-hidden="true" />
                                </NavLink>
                            )}
                        </div>
                    ))}
                </nav>


                <div className="sidebar-footer">
                    <div className="sidebar-footer-divider" />

                    <div className="sidebar-user-container" ref={roleMenuRef}>
                        <div 
                            className="sidebar-user interactive" 
                            title={collapsed ? userName : undefined}
                            onClick={() => {
                                console.log('[Sidebar] User card clicked. showRoleMenu:', !showRoleMenu);
                                setShowRoleMenu(!showRoleMenu);
                            }}
                        >
                            <div className={`user-avatar ${isSuperAdmin ? 'super' : activeRole === 'reseller' ? 'reseller' : ''}`}>
                                {avatarChar}
                                <span className="user-status-dot" aria-label="Online" />
                            </div>
                            <div className="user-info">
                                <span className="user-name">{userName}</span>
                                <span className="user-role">{userRole}</span>
                            </div>
                            {!collapsed && (
                                <ChevronUp className={`role-chevron ${showRoleMenu ? 'open' : ''}`} size={16} />
                            )}
                        </div>

                        {/* User Menu */}
                        {showRoleMenu && !collapsed && (
                            <div className="sidebar-role-switcher-menu">
                                {canSwitchRoles && (
                                    <>
                                        <div className="role-switcher-header">
                                            <span className="role-switcher-title">{t.switchAccount}</span>
                                            <span className="role-switcher-subtitle">{t.chooseWorkspace}</span>
                                        </div>
                                        
                                        <div className="role-switcher-accounts">
                                            {company && (
                                                <button 
                                                    className={`role-switcher-account ${activeRole === 'org_admin' ? 'active' : ''}`}
                                                    onClick={() => { switchRole('org_admin'); setShowRoleMenu(false); navigate('/dashboard'); }}
                                                >
                                                    <div className="role-avatar org">
                                                        <Briefcase size={16} />
                                                    </div>
                                                    <div className="role-info">
                                                        <span className="role-name">{company.name}</span>
                                                        <span className="role-desc">{t.manageEmployees}</span>
                                                    </div>
                                                    {activeRole === 'org_admin' && <div className="role-check"><div className="check-dot"></div></div>}
                                                </button>
                                            )}
                                            
                                            {isReseller && (
                                                <button 
                                                    className={`role-switcher-account ${activeRole === 'reseller' ? 'active' : ''}`}
                                                    onClick={() => { switchRole('reseller'); setShowRoleMenu(false); navigate('/dashboard'); }}
                                                >
                                                    <div className="role-avatar reseller">
                                                        <Store size={16} />
                                                    </div>
                                                    <div className="role-info">
                                                        <span className="role-name">{t.resellerAccount}</span>
                                                        <span className="role-desc">{t.manageClientsAndSubscriptions}</span>
                                                    </div>
                                                    {activeRole === 'reseller' && <div className="role-check"><div className="check-dot"></div></div>}
                                                </button>
                                            )}

                                            {isSuperAdmin && (
                                                <button 
                                                    className={`role-switcher-account ${activeRole === 'super_admin' ? 'active' : ''}`}
                                                    onClick={() => { switchRole('super_admin'); setShowRoleMenu(false); navigate('/super-admin'); }}
                                                >
                                                    <div className="role-avatar super">
                                                        <ShieldCheck size={16} />
                                                    </div>
                                                    <div className="role-info">
                                                        <span className="role-name">{t.superAdmin}</span>
                                                        <span className="role-desc">{t.userRoleSuper}</span>
                                                    </div>
                                                    {activeRole === 'super_admin' && <div className="role-check"><div className="check-dot"></div></div>}
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                                
                                <div className="role-switcher-footer">
                                    <button 
                                        className="role-action-btn"
                                        onClick={() => { setShowRoleMenu(false); setShowAccountModal(true); }}
                                    >
                                        <Settings size={14} />
                                        <span>{language === 'ar' ? 'إعدادات الحساب' : 'Account Settings'}</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleSignOut}
                        className="signout-btn"
                        data-tooltip={t.signOut}
                        aria-label={t.signOut}
                    >
                        <div className="nav-icon-wrapper">
                            <LogOut size={18} strokeWidth={1.8} className="nav-icon" />
                        </div>
                        <span className="nav-label">{t.signOut}</span>
                    </button>
                </div>
            </aside>

            {showAccountModal && (
                <AccountSettingsModal onClose={() => setShowAccountModal(false)} />
            )}
        </>
    );
}

export default Sidebar;