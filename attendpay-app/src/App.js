import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { EmployeeAuthProvider, useEmployeeAuth } from './context/EmployeeAuthContext';
import { LocaleProvider, useLocale } from './context/LocaleContext';
import { ThemeProvider } from './context/ThemeContext';
import { PrivacyProvider } from './context/PrivacyContext';
import { ShieldAlert, LogOut, Home } from 'lucide-react';
import { motion } from 'motion/react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import MobileBottomNav from './components/MobileBottomNav';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Attendance from './pages/Attendance';
import Payroll from './pages/Payroll';
import Devices from './pages/Devices';
import Settings from './pages/Settings';
import Shifts from './pages/Shifts';
import RuleBuilder from './pages/RuleBuilder';
import Assistant from './pages/Assistant';
import Leaves from './pages/Leaves';
import Departments from './pages/Departments';
import Loans from './pages/Loans';
import SalarySlip from './pages/SalarySlip';
import TeamManagement from './pages/TeamManagement';
import EmployeeLayout from './components/EmployeeLayout';
import MobileLogin from './pages/MobileLogin';
import MobileDashboard from './pages/MobileDashboard';
import MobilePunch from './pages/MobilePunch';
import MobileRequests from './pages/MobileRequests';
import MobileProfile from './pages/MobileProfile';
import AcceptInvite from './pages/AcceptInvite';
import Onboarding from './pages/Onboarding';
import LandingPage from './landing/LandingPage';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import ResellerDashboard from './pages/ResellerDashboard';
import EmployeeProfile from './pages/EmployeeProfile';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import AboutUs from './pages/AboutUs';
import Careers from './pages/Careers';
import ContactUs from './pages/ContactUs';
import ResetPassword from './pages/ResetPassword';
import PaymentPage from './pages/PaymentPage';
import SupportChatWidget from './components/SupportChatWidget';
import PwaInstaller from './components/PwaInstaller';
import TrialBanner from './components/TrialBanner';
import { ProductTour } from './components/ProductTour';
import GenericPage from './pages/GenericPage';
import { Toaster, toast } from 'sonner';
import './index.css';

// -------------------------------------------------------------------------

function LoadingSpinner() {
  const { t } = useLocale();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--bg-primary)'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 48, height: 48, border: '3px solid var(--border-color)',
          borderTopColor: 'var(--accent-primary)', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 16px'
        }} />
        <p style={{ color: 'var(--text-muted)' }}>{t.loading}</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, company, isReseller, resellerData, isSuperAdmin, activeRole, loading, signOut, refreshAuth } = useAuth();
  const { t, language } = useLocale();
  const location = useLocation();
  const [retryLoading, setRetryLoading] = useState(false);

  const handleRetry = async () => {
    setRetryLoading(true);
    await refreshAuth();
    setRetryLoading(false);
  };

  if (loading || retryLoading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  // Super admins and resellers use their own dashboards based on activeRole
  if (activeRole === 'super_admin') return <Navigate to="/super-admin" replace />;
  if (activeRole === 'reseller' && resellerData) return <Navigate to="/reseller" replace />;

  // Org Admin path — must have a company
  if (!company) {
    return (
      <div className={`auth-error-page ${language}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <div style={{ fontSize: '4rem' }}>🏢</div>
        <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>{t.welcomeToKwader}</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '400px', lineHeight: '1.6' }}>
          {t.noCompanyLinked}
        </p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={handleRetry} className="auth-error-btn primary">
            {retryLoading ? t.verifying : t.retryBtn}
          </button>
          <button onClick={() => signOut()} className="auth-error-btn secondary">{t.signOut}</button>
        </div>
      </div>
    );
  }

  // Suspension check
  const companyStatus = (company.status || '').toString().trim().toLowerCase();
  if (companyStatus === 'suspended') {
    return (
      <div className="auth-error-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="auth-error-card shadow-2xl"
        >
          <div className="auth-error-icon-wrapper">
            <ShieldAlert size={40} />
          </div>
          <h2 className="auth-error-title">{t.accountSuspended}</h2>
          <p className="auth-error-msg">
            {t.suspendedMsg}
          </p>
          <div className="auth-error-actions">
            <button 
              onClick={() => signOut()} 
              className="auth-error-btn primary"
            >
              <LogOut size={18} />
              {t.signOut}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Onboarding check
  if (activeRole === 'org_admin' && !isSuperAdmin) {
      const isCompleted = company.settings?.onboarding_completed === true;
      if (!isCompleted && location.pathname !== '/onboarding') {
          return <Navigate to="/onboarding" replace />;
      }
      if (isCompleted && location.pathname === '/onboarding') {
          return <Navigate to="/dashboard" replace />;
      }
  } else if (location.pathname === '/onboarding') {
      // HR users shouldn't access onboarding
      return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="logged-in-container">
      {children}
    </div>
  );
}

// -------------------------------------------------------------------------
function UnauthorizedPage() {
  const { signOut } = useAuth();
  const { t, language } = useLocale();
  return (
    <div className="auth-error-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="auth-error-card"
      >
        <div className="auth-error-icon-wrapper" style={{ color: 'var(--obs-primary)', background: 'rgba(159, 167, 255, 0.1)' }}>
          <ShieldAlert size={40} />
        </div>
        <h2 className="auth-error-title">
          {t.unauthorizedTitle}
        </h2>
        <p className="auth-error-msg">
          {t.unauthorizedMsg}
        </p>
        <div className="auth-error-actions">
          <button 
            onClick={() => window.location.href = '/'} 
            className="auth-error-btn primary"
          >
            <Home size={18} />
            {t.backHome}
          </button>
          <button 
            onClick={() => signOut().then(() => window.location.href = '/login')} 
            className="auth-error-btn secondary"
          >
            <LogOut size={18} />
            {t.signOut}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// -------------------------------------------------------------------------
function RoleProtectedRoute({ children, requiredRole }) {
  // ⚠️ All hooks MUST be called before any conditional return (Rules of Hooks)
  const { user, isSuperAdmin, isReseller, resellerData, activeRole, loading, signOut } = useAuth();
  const { t, language } = useLocale();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  if (requiredRole === 'super_admin') {
    if (activeRole !== 'super_admin') return <UnauthorizedPage />;
  }

  if (requiredRole === 'reseller') {
    if (activeRole !== 'reseller') return <UnauthorizedPage />;
    // Check reseller account is active
    if (resellerData?.status === 'suspended') {
      return (
        <div className="auth-error-page" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="auth-error-card"
          >
            <div className="auth-error-icon-wrapper">
              <ShieldAlert size={40} />
            </div>
            <h2 className="auth-error-title">{t.resellerSuspended}</h2>
            <p className="auth-error-msg">
              {t.resellerSuspendedMsg}
            </p>
            <div className="auth-error-actions">
              <button 
                onClick={() => signOut().then(() => window.location.href = '/login')} 
                className="auth-error-btn primary"
              >
                <LogOut size={18} />
                {t.signOut}
              </button>
            </div>
          </motion.div>
        </div>
      );
    }
  }

  return children;
}

function RequirePermission({ children, permission }) {
  const { hasPermission, activeRole } = useAuth();
  
  if (permission === 'admin_only' && activeRole !== 'org_admin' && activeRole !== 'super_admin') {
    return <UnauthorizedPage />;
  }
  
  if (permission !== 'admin_only' && !hasPermission(permission)) {
    return <UnauthorizedPage />;
  }
  
  return children;
}

function EmployeeProtectedRoute({ children }) {
  const { employee, loading } = useEmployeeAuth();
  
  if (loading) return <LoadingSpinner />;
  if (!employee) return <Navigate to="/me/login" replace />;
  
  return children;
}

function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const { t, language } = useLocale();

  const pageTitles = {
    '/dashboard': { title: t.titleDashboard, subtitle: t.subtitleDashboard },
    '/employees': { title: t.titleEmployees, subtitle: t.subtitleEmployees },
    '/attendance': { title: t.titleAttendance, subtitle: t.subtitleAttendance },
    '/payroll': { title: t.titlePayroll, subtitle: t.subtitlePayroll },
    '/shifts': { title: t.titleShifts, subtitle: t.subtitleShifts },
    '/assistant': { title: t.titleAssistant, subtitle: t.subtitleAssistant },
    '/rules': { title: t.titleRules, subtitle: t.subtitleRules },
    '/devices': { title: t.titleDevices, subtitle: t.subtitleDevices },
    '/settings': { title: t.titleSettings, subtitle: t.subtitleSettings },
    '/leaves': { title: t.titleLeaves, subtitle: t.subtitleLeaves },
    '/structure': { title: t.titleStructure, subtitle: t.subtitleStructure },
    '/loans': { title: t.titleLoans, subtitle: t.subtitleLoans },
  };

  const currentPage = pageTitles[location.pathname] || pageTitles['/dashboard'] || { title: '', subtitle: '' };

  const { requiresPasswordUpdate, updatePassword, clearPasswordUpdate, signOut, isSuperAdmin, activeRole, company, switchRole } = useAuth();
  const [newPass, setNewPass] = useState('');
  const [passUpdating, setPassUpdating] = useState(false);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPass.length < 6) {
        toast.error(t.appPasswordTooShort);
        return;
    }
    setPassUpdating(true);
    try {
        await updatePassword(newPass);
        toast.success(t.appPasswordUpdatedSuccess);
        clearPasswordUpdate();
    } catch (err) {
        toast.error(err.message);
    } finally {
        setPassUpdating(false);
    }
  };

  return (
    <div className={`app-layout ${language}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <ProductTour />
      {requiresPasswordUpdate && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '2rem', borderRadius: '16px', maxWidth: '400px', width: '100%', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                  <h2 style={{ marginTop: 0, color: 'var(--text-primary)' }}>
                      {t.appUpdatePasswordTitle}
                  </h2>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '14px' }}>
                      {t.appUpdatePasswordDesc}
                  </p>
                  <form onSubmit={handleUpdatePassword}>
                      <input 
                          type="password" 
                          placeholder={t.appNewPasswordPlaceholder}
                          value={newPass}
                          onChange={(e) => setNewPass(e.target.value)}
                          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', marginBottom: '1rem', fontFamily: 'inherit' }}
                          required
                      />
                      <div style={{ display: 'flex', gap: '10px' }}>
                          <button type="submit" disabled={passUpdating} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'var(--accent-primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'inherit' }}>
                              {passUpdating ? t.appUpdatingPasswordBtn : t.appSavePasswordBtn}
                          </button>
                          <button type="button" onClick={() => { clearPasswordUpdate(); signOut(); }} disabled={passUpdating} style={{ padding: '12px', borderRadius: '8px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)', cursor: 'pointer', fontFamily: 'inherit' }}>
                              {t.cancelBtn}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={isMobileOpen}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onClose={() => setIsMobileOpen(false)}
      />

      <div className={`main-area ${sidebarCollapsed ? 'collapsed' : ''}`}>
        {isSuperAdmin && activeRole === 'org_admin' && company && (
          <div className="impersonation-banner animate-slide-up">
            <div className="impersonation-content">
              <span className="impersonation-badge">{t.saImpersonatingTitle}</span>
              <span className="impersonation-company">{company.name}</span>
            </div>
            <button 
              onClick={() => {
                switchRole('super_admin');
                toast.success(t.saReturnToSuperAdmin || 'تمت العودة للوحة الإشراف');
              }}
              className="impersonation-btn"
            >
              {t.saReturnToSuperAdmin}
            </button>
          </div>
        )}
        <TrialBanner />
        <TopBar
          title={currentPage.title}
          subtitle={currentPage.subtitle}
          onMenuClick={() => setIsMobileOpen(true)}
        />
        <main className="page-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/employees" element={<RequirePermission permission="manage_employees"><Employees /></RequirePermission>} />
            <Route path="/employees/:id" element={<RequirePermission permission="manage_employees"><EmployeeProfile /></RequirePermission>} />
            <Route path="/attendance" element={<RequirePermission permission="manage_attendance"><Attendance /></RequirePermission>} />
            <Route path="/payroll" element={<RequirePermission permission="manage_payroll"><Payroll /></RequirePermission>} />
            <Route path="/loans" element={<RequirePermission permission="manage_loans"><Loans /></RequirePermission>} />
            <Route path="/shifts" element={<RequirePermission permission="manage_attendance"><Shifts /></RequirePermission>} />
            <Route path="/rules" element={<RequirePermission permission="manage_settings"><RuleBuilder /></RequirePermission>} />
            <Route path="/assistant" element={<Assistant />} />
            <Route path="/devices" element={<RequirePermission permission="manage_settings"><Devices /></RequirePermission>} />
            <Route path="/settings" element={<RequirePermission permission="manage_settings"><Settings /></RequirePermission>} />
            <Route path="/leaves" element={<RequirePermission permission="manage_attendance"><Leaves /></RequirePermission>} />
            <Route path="/structure" element={<RequirePermission permission="manage_settings"><Departments /></RequirePermission>} />
            <Route path="/team" element={<RequirePermission permission="admin_only"><TeamManagement /></RequirePermission>} />
            <Route path="/salary-slip/:id" element={<RequirePermission permission="manage_payroll"><SalarySlip /></RequirePermission>} />
            <Route path="/subscribe" element={<PaymentPage />} />
          </Routes>
        </main>
      </div>
      
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav onOpenMenu={() => setIsMobileOpen(true)} />

      {/* Global Support Widget for Users */}
      <SupportChatWidget />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <PrivacyProvider>
        <Toaster richColors position="top-center" />
        <AuthProvider>
          <EmployeeAuthProvider>
            <LocaleProvider>
            <PwaInstaller />
            <Router>
              <Routes>
                {/* Employee Portal Routes */}
                <Route path="/me/login" element={<MobileLogin />} />
                <Route path="/me" element={<EmployeeProtectedRoute><EmployeeLayout /></EmployeeProtectedRoute>}>
                  <Route index element={<MobileDashboard />} />
                  <Route path="punch" element={<MobilePunch />} />
                  <Route path="requests" element={<MobileRequests />} />
                  <Route path="profile" element={<MobileProfile />} />
                </Route>

                {/* Main Admin Routes */}
                <Route path="/" element={<RootRoute />} />
                <Route path="/index.html" element={<Navigate to="/" replace />} />
                <Route path="/login" element={<LoginRoute />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/invite" element={<AcceptInvite />} />
              <Route path="/accept-invite" element={<AcceptInvite />} />
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/pay/:id" element={<PaymentPage />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/about" element={<AboutUs />} />
              <Route path="/careers" element={<Careers />} />
              <Route path="/contact" element={<ContactUs />} />
              {['/cookie-policy', '/gdpr', '/security', '/integrations', '/changelog', '/roadmap', '/startups', '/smbs', '/enterprise', '/agencies', '/remote-teams', '/multi-country', '/documentation', '/blog', '/hr-templates', '/webinars', '/case-studies', '/api-reference', '/press-kit', '/partners', '/legal'].map(path => (
                <Route key={path} path={path} element={<GenericPage />} />
              ))}
              <Route
                path="/super-admin"
                element={
                  <RoleProtectedRoute requiredRole="super_admin">
                    <SuperAdminDashboard />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/reseller"
                element={
                  <RoleProtectedRoute requiredRole="reseller">
                    <ResellerDashboard />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              />
            </Routes>
            </Router>
          </LocaleProvider>
        </EmployeeAuthProvider>
      </AuthProvider>
      </PrivacyProvider>
    </ThemeProvider>
  );
}

function RootRoute() {
  const { user, isSuperAdmin, isReseller, activeRole, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (user) {
    if (activeRole === 'super_admin') return <Navigate to="/super-admin" replace />;
    if (activeRole === 'reseller') return <Navigate to="/reseller" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  
  // If an employee session exists in local storage, redirect to employee portal
  const hasEmployeeSession = localStorage.getItem('attendpay_employee_session');
  if (hasEmployeeSession) {
    return <Navigate to="/me" replace />;
  }
  
  return <LandingPage />;
}

function LoginRoute() {
  const { user, isSuperAdmin, isReseller, activeRole, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (user) {
    if (activeRole === 'super_admin') return <Navigate to="/super-admin" replace />;
    if (activeRole === 'reseller') return <Navigate to="/reseller" replace />;
    return <Navigate to="/" replace />;
  }
  return <Login />;
}

export default App;
