import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
    LayoutDashboard, Users, Clock, Wallet, Menu, Sparkles
} from 'lucide-react';
import { useLocale } from '../context/LocaleContext';
import './MobileBottomNav.css';

const MobileBottomNav = ({ onOpenMenu }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useLocale();

    const navItems = [
        {
            path: '/dashboard',
            label: t.titleDashboard || 'الرئيسية',
            icon: LayoutDashboard,
        },
        {
            path: '/attendance',
            label: t.titleAttendance || 'الحضور',
            icon: Clock,
        },
        {
            path: '/employees',
            label: t.titleEmployees || 'الموظفون',
            icon: Users,
        },
        {
            path: '/payroll',
            label: t.titlePayroll || 'المسيرات',
            icon: Wallet,
        },
        {
            path: '/assistant',
            label: t.titleAssistant || 'الذكاء',
            icon: Sparkles,
            isAi: true
        }
    ];

    return (
        <nav className="mobile-bottom-nav">
            <div className="mobile-bottom-nav-container">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`mobile-nav-item ${isActive ? 'active' : ''} ${item.isAi ? 'ai-item' : ''}`}
                            type="button"
                        >
                            <div className="mobile-nav-icon-wrap">
                                <Icon size={20} className="mobile-nav-icon" />
                                {isActive && <span className="mobile-nav-indicator" />}
                            </div>
                            <span className="mobile-nav-label">{item.label}</span>
                        </button>
                    );
                })}

                <button
                    onClick={onOpenMenu}
                    className="mobile-nav-item menu-trigger"
                    type="button"
                >
                    <div className="mobile-nav-icon-wrap">
                        <Menu size={20} className="mobile-nav-icon" />
                    </div>
                    <span className="mobile-nav-label">{t.menu || 'القائمة'}</span>
                </button>
            </div>
        </nav>
    );
};

export default MobileBottomNav;
