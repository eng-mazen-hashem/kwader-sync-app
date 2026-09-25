import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    HiOutlineSave, HiOutlineKey, HiOutlineGlobe,
    HiOutlineCash, HiOutlineChevronLeft,
    HiOutlineChevronRight, HiOutlineCheck, HiOutlineSearch,
    HiOutlineBadgeCheck, HiOutlineShieldCheck
} from 'react-icons/hi';
import {
    Sparkles, Crown, Zap, Shield, Clock, Calendar, CheckCircle2,
    ArrowUpRight, RefreshCw, MessageSquare, Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { COUNTRIES, getCountryByCode } from '../utils/countries';
import './Settings.css';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import { logAudit } from '../utils/auditLogger';

function CountryDropdown({ value, onChange, t, language }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef(null);
    const inputRef = useRef(null);
    const selected = getCountryByCode(value);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q
            ? COUNTRIES.filter(c =>
                c.nameAr.includes(q) ||
                c.nameEn.toLowerCase().includes(q) ||
                c.currency.toLowerCase().includes(q) ||
                c.code.toLowerCase().includes(q))
            : COUNTRIES;
    }, [query]);

    useEffect(() => {
        if (!open) return;
        const fn = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQuery(''); } };
        document.addEventListener('mousedown', fn);
        return () => document.removeEventListener('mousedown', fn);
    }, [open]);

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 50);
    }, [open]);

    const pick = code => { onChange(code); setOpen(false); setQuery(''); };
    const ChevronIcon = language === 'ar' ? HiOutlineChevronLeft : HiOutlineChevronRight;

    return (
        <div ref={ref} className="country-dropdown-container" style={{ position: 'relative' }}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`country-trigger ${open ? 'is-open' : ''}`}
            >
                <span className="flag-icon">{selected ? selected.flag : '🌍'}</span>
                <span className="name-display">
                    {selected ? (language === 'ar' ? selected.nameAr : selected.nameEn) : t.changeCountryLabel}
                </span>
                {selected && (
                    <div className="currency-badge">
                        <span>{selected.currency}</span>
                        <span className="sep">|</span>
                        <span>{selected.currencySymbol}</span>
                    </div>
                )}
                <ChevronIcon className="chevron-icon" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)' }} />
            </button>

            {open && (
                <div className="country-dropdown-panel">
                    <div className="country-search-box">
                        <HiOutlineSearch className="search-icon" />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder={t.settingsSearchPlaceholder}
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                        />
                    </div>

                    <div className="country-options-list custom-scrollbar">
                        {filtered.length === 0 ? (
                            <div className="empty-state">
                                <p>{t.noResults}</p>
                            </div>
                        ) : (
                            filtered.map(c => {
                                const active = c.code === value;
                                return (
                                    <button 
                                        key={c.code} 
                                        type="button" 
                                        onClick={() => pick(c.code)}
                                        className={`country-option ${active ? 'active' : ''}`}
                                    >
                                        <span className="flag-icon">{c.flag}</span>
                                        <div className="name-stack">
                                            <span className="main-name">
                                                {language === 'ar' ? c.nameAr : c.nameEn}
                                            </span>
                                            <span className="sub-name">
                                                {language === 'ar' ? c.nameEn : c.nameAr} · {c.currency}
                                            </span>
                                        </div>
                                        <div className="currency-tag">
                                            {c.currencySymbol}
                                        </div>
                                        {active && <HiOutlineCheck className="check-icon" />}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function Settings() {
    const { user, company, updateCompanySettings } = useAuth();
    const { t, formatCurrency, currencySymbol, language } = useLocale();
    const navigate = useNavigate();

    const defaults = {
        late_deduction_per_minute: 2,
        absence_deduction_formula: 'daily_rate',
        housing_allowance: 500,
        transport_allowance: 300,
        country: '',
        ai_payroll_frequency: 'off',
        payroll_mode: 'regular',
        weekly_advance_rate: 50,
        device_1_ip: '',
        device_1_port: 4370,
        device_1_type: 'zkteco',
        device_1_sn: '',
        device_2_ip: '',
        device_2_port: 4370,
        device_2_type: 'zkteco',
        device_2_sn: '',
    };

    const [form, setForm] = useState({ ...defaults, ...(company?.settings || {}) });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // WhatsApp OTP verification state
    const [whatsappPhone, setWhatsappPhone] = useState(company?.settings?.whatsapp_phone || '');
    const [whatsappVerified, setWhatsappVerified] = useState(company?.settings?.whatsapp_verified || false);
    const [otpStep, setOtpStep] = useState(0); // 0 = input, 1 = otp input
    const [otpInput, setOtpInput] = useState('');
    const [sendingOtp, setSendingOtp] = useState(false);
    const [verifyingOtp, setVerifyingOtp] = useState(false);
    const [otpTimer, setOtpTimer] = useState(0);

    // Subscription & Plan States
    const [employeeCount, setEmployeeCount] = useState(0);
    const [renewalStatus, setRenewalStatus] = useState(null);
    const [requestingRenewal, setRequestingRenewal] = useState(false);
    const [supportPhone, setSupportPhone] = useState('');

    useEffect(() => {
        if (!company?.id) return;

        const fetchEmployeeCount = async () => {
            try {
                const { count, error } = await supabase
                    .from('employees')
                    .select('id', { count: 'exact', head: true })
                    .eq('company_id', company.id)
                    .eq('status', 'active');
                if (!error && typeof count === 'number') {
                    setEmployeeCount(count);
                }
            } catch (err) {
                console.error('Error fetching employee count:', err);
            }
        };

        const fetchRenewalStatus = async () => {
            try {
                const { data, error } = await supabase
                    .from('renewal_requests')
                    .select('status')
                    .eq('company_id', company.id)
                    .order('requested_at', { ascending: false })
                    .limit(1);
                if (!error && data && data.length > 0) {
                    setRenewalStatus(data[0].status);
                }
            } catch (err) {
                console.error('Error fetching renewal status:', err);
            }
        };

        const fetchSupportConfig = async () => {
            try {
                const { data } = await supabase
                    .from('payment_config')
                    .select('value')
                    .eq('key', 'admin_whatsapp')
                    .maybeSingle();
                if (data?.value) setSupportPhone(data.value);
            } catch {}
        };

        fetchEmployeeCount();
        fetchRenewalStatus();
        fetchSupportConfig();
    }, [company?.id]);

    // Calculate dates & days remaining
    const rawEndDate = company?.subscription_end_date ||
                       company?.subscription_expires_at ||
                       company?.trial_ends_at ||
                       company?.settings?.subscription_end_date ||
                       company?.settings?.trial_end_date;

    const endDate = useMemo(() => {
        if (rawEndDate) {
            const d = new Date(rawEndDate);
            if (!isNaN(d.getTime())) return d;
        }
        const base = company?.created_at ? new Date(company.created_at) : new Date();
        return new Date(base.getTime() + 14 * 86400000);
    }, [rawEndDate, company?.created_at]);

    const startDate = useMemo(() => {
        if (company?.settings?.subscription_start_date) {
            const d = new Date(company.settings.subscription_start_date);
            if (!isNaN(d.getTime())) return d;
        }
        if (company?.created_at) {
            const d = new Date(company.created_at);
            if (!isNaN(d.getTime())) return d;
        }
        return new Date(endDate.getTime() - 30 * 86400000);
    }, [company?.settings?.subscription_start_date, company?.created_at, endDate]);

    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isExpired = diffDays <= 0;
    const isExpiringSoon = diffDays > 0 && diffDays <= 7;

    const totalDuration = Math.max(86400000, endDate.getTime() - startDate.getTime());
    const elapsedDuration = Math.min(totalDuration, Math.max(0, now.getTime() - startDate.getTime()));
    const elapsedPercent = Math.min(100, Math.max(0, Math.round((elapsedDuration / totalDuration) * 100)));

    // Plan & tier details
    const rawPlanLower = (company?.plan || 'Starter').toLowerCase();
    const isEnterprise = rawPlanLower.includes('enterprise');
    const isPro = rawPlanLower.includes('pro') || rawPlanLower.includes('growth');
    const planTierKey = isEnterprise ? 'enterprise' : isPro ? 'pro' : 'starter';

    const planTitle = isEnterprise 
        ? t.planEnterpriseTitle 
        : isPro 
        ? t.planProTitle 
        : t.planStarterTitle;

    const planTierLabel = isEnterprise ? 'ENTERPRISE' : isPro ? 'PRO GROWTH' : 'STARTER';
    const maxEmployees = company?.max_employees || (isEnterprise ? 500 : isPro ? 100 : 25);
    const maxEmployeesDisplay = isEnterprise ? t.planUnlimited : maxEmployees;

    const isTrial = company?.status === 'trialing';
    const billingCycle = company?.settings?.billing_cycle || (isEnterprise ? 'yearly' : 'monthly');
    const billingCycleLabel = isTrial 
        ? t.planCycleTrial 
        : (billingCycle === 'yearly' || billingCycle === 'annual' ? t.planCycleAnnual : t.planCycleMonthly);

    const planDescription = isEnterprise
        ? (language === 'ar' ? 'حلول مؤسسية متقدمة مع دعم مخصص، سعة غير محدودة، ومزامنة حية لكافة الفروع' : 'Comprehensive enterprise HR solution with unlimited capacity and dedicated support')
        : isPro
        ? (language === 'ar' ? 'الباقة الاحترافية المتكاملة لإدارة الحضور والانصراف، مسيرات الرواتب الذكية، وتقارير AI' : 'Most popular plan for smart payroll, attendance tracking, and AI reports')
        : (language === 'ar' ? 'الباقة الأساسية لإدارة الحضور والانصراف، أجهزة البصمة، وتطبيق الموظفين بكفاءة' : 'Essential HR & attendance tier with device sync and employee mobile app');

    let statusThemeClass = 'status-active';
    let statusLabel = t.planStatusActive;
    if (isExpired) {
        statusThemeClass = 'status-expired';
        statusLabel = t.planStatusExpired;
    } else if (isExpiringSoon) {
        statusThemeClass = 'status-expiring';
        statusLabel = t.planStatusExpiring;
    } else if (isTrial) {
        statusThemeClass = 'status-trial';
        statusLabel = t.planStatusTrial;
    }

    let daysThemeClass = 'days-emerald';
    if (isExpired) {
        daysThemeClass = 'days-ruby';
    } else if (isExpiringSoon) {
        daysThemeClass = 'days-amber';
    }

    const planPerks = useMemo(() => {
        const list = [
            t.perkFingerprintSync,
            t.perkSmartPayroll,
            t.perkWhatsAppAlerts,
            t.perkShiftManagement
        ];
        if (isPro || isEnterprise) {
            list.push(t.perkAiReports);
            list.push(t.perkPrioritySupport);
        }
        return list;
    }, [t, isPro, isEnterprise]);

    const formatDate = (dateObj) => {
        if (!dateObj || isNaN(dateObj.getTime())) return '-';
        return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(dateObj);
    };

    const handleQuickRenewal = async () => {
        if (requestingRenewal || renewalStatus === 'pending') return;
        setRequestingRenewal(true);
        try {
            const { error } = await supabase
                .from('renewal_requests')
                .insert({
                    company_id: company.id,
                    status: 'pending',
                    details: {
                        requested_by: user?.email || 'admin',
                        company_name: company.name,
                        current_plan: (company.plan === 'Free' ? 'Starter' : (company.plan || 'Starter')),
                        source: 'settings_page'
                    }
                });
            if (error) throw error;
            setRenewalStatus('pending');
            toast.success(t.renewalRequestSuccess);
        } catch (err) {
            console.error('Renewal request failed:', err.message);
            toast.error(err.message || 'Failed to submit renewal request');
        } finally {
            setRequestingRenewal(false);
        }
    };

    const openWhatsAppSupport = () => {
        const target = supportPhone || '201000000000';
        const cleanTarget = target.replace(/\D/g, '');
        const currentPlanDisplay = company?.plan === 'Free' ? 'Starter' : (company?.plan || 'Starter');
        const msg = language === 'ar'
            ? `مرحباً، أود الاستفسار حول ترقية وتجديد باقة الاشتراك لمنشأة (${company?.name || 'كوادر'}) - الباقة الحالية: ${currentPlanDisplay}.`
            : `Hello, I would like to inquire about upgrading/renewing our subscription for (${company?.name || 'Kwader'}) - Current plan: ${currentPlanDisplay}.`;
        window.open(`https://wa.me/${cleanTarget}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    useEffect(() => {
        if (company?.settings) {
            setWhatsappPhone(company.settings.whatsapp_phone || '');
            setWhatsappVerified(company.settings.whatsapp_verified || false);
        }
    }, [company]);

    useEffect(() => {
        if (otpTimer <= 0) return;
        const interval = setInterval(() => setOtpTimer(t => t - 1), 1000);
        return () => clearInterval(interval);
    }, [otpTimer]);

    const handleSendOtp = async () => {
        const cleanPhone = whatsappPhone.replace(/\D/g, '');
        if (cleanPhone.length < 10) {
            toast.error(language === 'ar' ? 'يرجى إدخال رقم هاتف صحيح' : 'Please enter a valid phone number');
            return;
        }
        setSendingOtp(true);
        try {
            const { data: code, error } = await supabase.rpc('generate_otp_code', {
                target_phone: cleanPhone,
                target_company_id: company.id
            });
            if (error) throw error;

            const message = `🔐 *رمز تحقق كوادر (Kwader OTP)*\n\n` +
                            (language === 'ar'
                                ? `رمز التحقق الخاص بك لربط الرقم وتفعيل إشعارات الجدولة والتقارير هو:\n\n👈 *${code}* 👉\n\nصالح لمدة 5 دقائق. لا تشارك هذا الرمز مع أحد.`
                                : `Your verification code to link your number and activate scheduling/reports is:\n\n👈 *${code}* 👉\n\nValid for 5 minutes. Do not share this code.`);

            const { error: funcError } = await supabase.functions.invoke('auto-reports', {
                body: {
                    action: 'send_whatsapp',
                    phone: cleanPhone,
                    message
                }
            });
            if (funcError) throw funcError;

            toast.success(t.whatsappOtpSentSuccess);
            setOtpStep(1);
            setOtpTimer(300);
        } catch (err) {
            console.error('handleSendOtp:', err.message);
            toast.error(language === 'ar' ? 'فشل إرسال رمز التحقق. يرجى المحاولة لاحقاً.' : 'Failed to send OTP. Please try again later.');
        } finally {
            setSendingOtp(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (otpInput.trim().length !== 6) {
            toast.error(language === 'ar' ? 'يرجى إدخال كود من 6 أرقام' : 'Please enter a 6-digit code');
            return;
        }
        setVerifyingOtp(true);
        try {
            const { data: success, error } = await supabase.rpc('verify_otp_code', {
                submitted_otp: otpInput.trim(),
                target_company_id: company.id
            });
            if (error) throw error;

            if (success) {
                setWhatsappVerified(true);
                setOtpStep(0);
                setForm(prev => ({ ...prev, whatsapp_phone: whatsappPhone.replace(/\D/g, ''), whatsapp_verified: true }));
                toast.success(language === 'ar' ? 'تم توثيق الرقم بنجاح! 🎉' : 'Number verified successfully! 🎉');

                const congrats = language === 'ar'
                    ? `🎉 *تهانينا! تم توثيق رقمك بنجاح*\n\nتم ربط هذا الرقم وتوثيقه تلقائياً لتلقي إشعارات وجدولة النظام من منصة كوادر.`
                    : `🎉 *Congratulations! Number Verified*\n\nYour number has been successfully linked and verified to receive automatic report schedules and notifications.`;

                try {
                    await supabase.functions.invoke('auto-reports', {
                        body: {
                            action: 'send_whatsapp',
                            phone: whatsappPhone.replace(/\D/g, ''),
                            message: congrats
                        }
                    });
                } catch {}
            } else {
                toast.error(t.whatsappVerificationFailed);
            }
        } catch (err) {
            console.error('handleVerifyOtp:', err.message);
            toast.error(t.whatsappVerificationFailed);
        } finally {
            setVerifyingOtp(false);
        }
    };

    // Account Security State
    const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setSaved(false); };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateCompanySettings(form);
            // constitution §15: audit sensitive settings changes
            const { data: { user: authUser } } = await supabase.auth.getUser();
            await logAudit({
                company_id: company?.id,
                user_id: authUser?.id,
                action: 'UPDATE_COMPANY_SETTINGS',
                table_name: 'companies',
                record_id: company?.id,
                new_data: form,
            });
            setSaved(true);
            toast.success(t.saved || 'Settings applied successfully.');
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            console.error('[Settings] handleSave:', e.message);
            toast.error((t.errorGeneric || 'Error occurred') + ': ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const pending = getCountryByCode(form.country);
    const hasChange = form.country !== (company?.settings?.country || '');
    const totalAllow = (form.housing_allowance || 0) + (form.transport_allowance || 0);

    const ChevronIcon = language === 'ar' ? HiOutlineChevronLeft : HiOutlineChevronRight;

    return (
        <div className={`settings-luxe-container ${language === 'ar' ? 'rtl' : 'ltr'}`}>
            
            <header className="settings-header">
                <div className="title-group">
                    <h1 className="settings-title">{t.settingsTitle}</h1>
                    <p className="settings-subtitle">{t.settingsSubtitle}</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`settings-save-btn ${saved ? 'saved-state' : ''}`}
                >
                    {saved ? <HiOutlineCheck /> : <HiOutlineSave />}
                    {saving ? t.saving : saved ? t.saved : t.saveSettings}
                </button>
            </header>

            <div className="settings-bento-grid">
                
                {/* World-Class Plan & Subscription Hero Card */}
                <section className="settings-card span-12 settings-subscription-card">
                    <div className="subscription-header-row">
                        <div className="subscription-brand-header">
                            <div className="subscription-icon-glow">
                                <Sparkles className="sub-header-icon" size={20} />
                            </div>
                            <div>
                                <h2 className="subscription-title">{t.subscriptionCardTitle}</h2>
                                <p className="subscription-subtitle">{t.subscriptionCardSubtitle}</p>
                            </div>
                        </div>
                        <div className={`subscription-status-pill ${statusThemeClass}`}>
                            <span className="status-pulse-dot" />
                            <span>{statusLabel}</span>
                        </div>
                    </div>

                    <div className="subscription-content-row">
                        <div className="subscription-details-col">
                            <div className="plan-name-block">
                                <span className={`plan-tier-chip ${planTierKey}`}>
                                    {planTierKey === 'enterprise' ? <Crown size={14} /> : <Zap size={14} />}
                                    {planTierLabel}
                                </span>
                                <h3 className="plan-display-name">{planTitle}</h3>
                                <p className="plan-tier-desc">{planDescription}</p>
                            </div>

                            <div className="plan-metrics-block">
                                <div className="metric-item">
                                    <span className="metric-label"><Users size={14} /> {t.planEmployeeCapacity}</span>
                                    <span className="metric-value"><strong>{employeeCount}</strong> / {maxEmployeesDisplay}</span>
                                </div>
                                <div className="metric-item">
                                    <span className="metric-label"><Calendar size={14} /> {t.planRenewalDate}</span>
                                    <span className="metric-value"><strong>{formatDate(endDate)}</strong> {billingCycleLabel ? `· ${billingCycleLabel}` : ''}</span>
                                </div>
                            </div>
                        </div>

                        <div className="subscription-actions-col">
                            <div className="days-remaining-block">
                                <div className="days-number-wrapper">
                                    <span className={`countdown-number ${daysThemeClass}`}>{diffDays > 0 ? diffDays : 0}</span>
                                    <span className="countdown-text">
                                        {diffDays === 0 ? t.planDaysZero : diffDays === 1 ? t.planDaysSingular : diffDays < 0 ? t.planExpiredDaysAgo.replace('{days}', Math.abs(diffDays)) : t.planDaysRemaining}
                                    </span>
                                </div>
                                <div className="progress-bar-wrapper">
                                    <div className="progress-bar-track">
                                        <div className={`progress-bar-fill ${daysThemeClass}`} style={{ width: `${Math.max(4, elapsedPercent)}%` }} />
                                    </div>
                                    <span className="progress-text">{elapsedPercent}% {t.planCycleProgress}</span>
                                </div>
                            </div>

                            <div className="action-buttons-group">
                                <button type="button" onClick={() => navigate('/subscribe')} className="sub-btn-primary">
                                    <Zap className="btn-icon" size={16} /> <span>{t.planUpgradeBtn}</span>
                                </button>
                                <button type="button" onClick={handleQuickRenewal} disabled={requestingRenewal || renewalStatus === 'pending'} className="sub-btn-secondary">
                                    <RefreshCw className={`btn-icon ${requestingRenewal ? 'animate-spin' : ''}`} size={16} />
                                    <span>{renewalStatus === 'pending' ? t.planRenewalRequested : t.planRequestRenewalBtn}</span>
                                </button>
                            </div>
                            
                            <button type="button" onClick={openWhatsAppSupport} className="sub-advisor-link">
                                <MessageSquare size={14} /> <span>{t.planContactAdvisor}</span> <ArrowUpRight size={14} />
                            </button>
                        </div>
                    </div>
                </section>

                {/* Corporate Identity Card */}
                <section className="settings-card span-8">
                    <HiOutlineBadgeCheck className="card-bg-icon" />
                    
                    <div className="settings-card-header">
                        <HiOutlineKey className="icon" />
                        <span>Corporate Identity</span>
                    </div>

                    <div className="form-split">
                        <div className="form-column">
                            <div className="settings-form-group">
                                <label className="settings-label">Enterprise Name</label>
                                <input 
                                    className="settings-input" 
                                    type="text" 
                                    value={company?.name || company?.full_name || 'Kwader Enterprise'} 
                                    disabled 
                                />
                            </div>

                            <div className="settings-form-group">
                                <label className="settings-label">Admin Email</label>
                                <input 
                                    className="settings-input" 
                                    type="text" 
                                    value={user?.email || ''} 
                                    disabled 
                                />
                            </div>
                        </div>

                        <div className="form-column">
                            <div className="settings-form-group">
                                <label className="settings-label">{t.licenseKeyTitle}</label>
                                {company?.license_key ? (
                                    <div className="license-box">
                                        {company.license_key}
                                    </div>
                                ) : (
                                    <div className="license-empty">
                                        <p>{t.licenseKeyMissing}</p>
                                        <button
                                            onClick={async () => {
                                                const k = crypto.randomUUID();
                                                try { await updateCompanySettings({ license_key: k }); }
                                                catch { await supabase.from('companies').update({ license_key: k }).eq('id', company.id); }
                                                toast.success(t.saved || 'License Generated');
                                                setTimeout(() => window.location.reload(), 1000);
                                            }}
                                            className="btn-action-small"
                                        >
                                            {t.generateNewKey}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="nav-link-card" onClick={() => navigate('/shifts')}>
                        <div className="nav-link-icon"><span>🕐</span></div>
                        <div className="nav-link-content">
                            <div className="main">{t.shiftsSettingsTitle}</div>
                            <div className="sub">{t.shiftsSettingsSubtitle}</div>
                        </div>
                        <ChevronIcon className="nav-chevron" />
                    </div>

                </section>

                {/* System Preferences Card */}
                <section className="settings-card span-4">
                    <HiOutlineGlobe className="card-bg-icon" />
                    
                    <div className="settings-card-header">
                        <HiOutlineGlobe className="icon" />
                        <span>{t.countryAndCurrencyTitle}</span>
                    </div>

                    <div className="settings-form-group">
                        <label className="settings-label">{t.changeCountryLabel}</label>
                        <CountryDropdown value={form.country} onChange={code => set('country', code)} t={t} language={language} />

                        {hasChange && pending && (
                            <div className="info-alert warning">
                                {t.countryApplyingWarning
                                    .replace('{name}', language === 'ar' ? pending.nameAr : pending.nameEn)
                                    .replace('{currency}', pending.currency)}
                            </div>
                        )}
                        {!hasChange && pending && (
                            <p className="hint-text">
                                ✅ {t.countryActiveTip.replace('{timezone}', pending.timezone)}
                            </p>
                        )}
                    </div>

                    <div className="settings-form-group mt-auto">
                        <label className="settings-label success-label">{t.aiPayrollEnableLabel}</label>
                        <select
                            className={`settings-select ${form.ai_payroll_frequency !== 'off' ? 'active-ai' : ''}`}
                            value={form.ai_payroll_frequency}
                            onChange={e => set('ai_payroll_frequency', e.target.value)}
                        >
                            <option value="off">{t.aiPayrollOptionOff}</option>
                            <option value="monthly">{t.aiPayrollOptionMonthly}</option>
                            <option value="weekly">{t.aiPayrollOptionWeekly}</option>
                        </select>
                        <p className="hint-text">{t.aiPayrollTip}</p>
                    </div>

                </section>

                {/* Financial Allowances Card */}
                <section className="settings-card span-12">
                    <HiOutlineCash className="card-bg-icon purple-icon" />
                    
                    <div className="settings-card-header purple">
                        <HiOutlineCash className="icon" />
                        <span>{t.allowancesTitle}</span>
                    </div>

                    <div className="form-split">
                        <div className="form-column">
                            <div className="settings-form-group">
                                <label className="settings-label">{t.housingAllowanceLabel}</label>
                                <div className="input-with-symbol">
                                    <span className="symbol">{currencySymbol}</span>
                                    <input
                                        className="settings-input"
                                        type="number" min={0}
                                        value={form.housing_allowance}
                                        onChange={e => set('housing_allowance', Number(e.target.value))}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="form-column">
                            <div className="settings-form-group">
                                <label className="settings-label">{t.transportAllowanceLabel}</label>
                                <div className="input-with-symbol">
                                    <span className="symbol">{currencySymbol}</span>
                                    <input
                                        className="settings-input"
                                        type="number" min={0}
                                        value={form.transport_allowance}
                                        onChange={e => set('transport_allowance', Number(e.target.value))}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="info-alert purple-alert">
                        {t.totalAllowancesLabel}
                        <strong className="total-val">
                            {formatCurrency(totalAllow)}
                        </strong>
                        {t.totalAllowancesSubtitle && <span className="sub-val">{t.totalAllowancesSubtitle}</span>}
                    </div>

                </section>

                {/* Weekly Advance Payroll Card */}
                <section className="settings-card span-12">
                    <HiOutlineCash className="card-bg-icon" style={{ color: '#f59e0b' }} />

                    <div className="settings-card-header" style={{ color: '#f59e0b' }}>
                        <HiOutlineCash className="icon" />
                        <span>{language === 'ar' ? 'نظام المسيرات الأسبوعية والسلف' : 'Weekly Advance Payroll Mode'}</span>
                    </div>

                    <div className="form-split">
                        <div className="form-column">
                            <div className="settings-form-group">
                                <label className="settings-label">
                                    {language === 'ar' ? 'وضع المسيرة' : 'Payroll Mode'}
                                </label>
                                <select
                                    className="settings-select"
                                    value={form.payroll_mode || 'regular'}
                                    onChange={e => set('payroll_mode', e.target.value)}
                                >
                                    <option value="regular">
                                        {language === 'ar' ? '📅 مسيرة عادية (شهرية فقط)' : '📅 Regular (Monthly only)'}
                                    </option>
                                    <option value="weekly_advance">
                                        {language === 'ar' ? '💸 مسيرة أسبوعية مع سلفة' : '💸 Weekly Advance Mode'}
                                    </option>
                                </select>
                                <p className="hint-text" style={{ marginTop: '0.5rem' }}>
                                    {form.payroll_mode === 'weekly_advance'
                                        ? (language === 'ar'
                                            ? '✅ النظام سيدفع سلفة أسبوعية ويخصمها تلقائياً من المسيرة الشهرية النهائية'
                                            : '✅ System pays weekly advances and auto-deducts them from the final monthly run')
                                        : (language === 'ar'
                                            ? 'كل مسيرة تُحسب باستقلالية دون خصم تراكمي'
                                            : 'Each payroll run is calculated independently')}
                                </p>
                            </div>
                        </div>

                        {form.payroll_mode === 'weekly_advance' && (
                            <div className="form-column">
                                <div className="settings-form-group">
                                    <label className="settings-label">
                                        {language === 'ar'
                                            ? `نسبة السلفة الأسبوعية: ${form.weekly_advance_rate || 50}%`
                                            : `Weekly Advance Rate: ${form.weekly_advance_rate || 50}%`}
                                    </label>
                                    <input
                                        type="range"
                                        min={10}
                                        max={100}
                                        step={5}
                                        value={form.weekly_advance_rate || 50}
                                        onChange={e => set('weekly_advance_rate', Number(e.target.value))}
                                        style={{
                                            width: '100%',
                                            accentColor: '#f59e0b',
                                            height: '6px',
                                            cursor: 'pointer',
                                            margin: '0.75rem 0'
                                        }}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        <span>10%</span>
                                        <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '1rem' }}>
                                            {form.weekly_advance_rate || 50}%
                                        </span>
                                        <span>100%</span>
                                    </div>
                                    <div className="info-alert" style={{
                                        background: 'rgba(245,158,11,0.08)',
                                        borderColor: 'rgba(245,158,11,0.25)',
                                        marginTop: '0.75rem',
                                        fontSize: '0.8rem'
                                    }}>
                                        {language === 'ar'
                                            ? `مثال: موظف راتبه 4,000 — راتبه الأسبوعي المستحق 1,000 → سيأخذ سلفة ${formatCurrency(1000 * (form.weekly_advance_rate || 50) / 100)} فقط`
                                            : `Example: Employee earning 4,000/mo → weekly earned 1,000 → receives ${formatCurrency(1000 * (form.weekly_advance_rate || 50) / 100)} advance`}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                </section>



                {/* WhatsApp OTP Verification Card */}
                <section className="settings-card span-12">
                    <HiOutlineShieldCheck className="card-bg-icon" style={{ color: '#10b981' }} />
                    
                    <div className="settings-card-header" style={{ color: '#10b981' }}>
                        <span style={{ fontSize: '1.5rem' }}>💬</span>
                        <span>{t.whatsappCardTitle}</span>
                    </div>

                    <div className="form-split">
                        <div className="form-column">
                            <p className="hint-text" style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                {t.whatsappCardDesc}
                            </p>

                            {whatsappVerified ? (
                                <div className="info-alert" style={{
                                    background: 'rgba(16,185,129,0.08)',
                                    borderColor: 'rgba(16,185,129,0.25)',
                                    color: '#10b981',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    gap: '8px',
                                    marginTop: 0
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 705 }}>
                                        <HiOutlineBadgeCheck size={20} />
                                        <span>{t.whatsappVerifiedMsg}</span>
                                    </div>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                        {language === 'ar' ? `الرقم الموثق: +${whatsappPhone}` : `Verified Number: +${whatsappPhone}`}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setWhatsappVerified(false);
                                            set('whatsapp_verified', false);
                                        }}
                                        className="settings-save-btn"
                                        style={{ marginTop: '8px', padding: '6px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.78rem', boxShadow: 'none' }}
                                    >
                                        {language === 'ar' ? 'تغيير الرقم أو إلغاء الربط' : 'Change Number or Unlink'}
                                    </button>
                                </div>
                            ) : (
                                <div className="settings-form-group">
                                    {otpStep === 0 ? (
                                        <>
                                            <label className="settings-label">{t.whatsappPhoneLabel}</label>
                                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                <input
                                                    className="settings-input"
                                                    type="text"
                                                    placeholder="2010xxxxxxxx"
                                                    value={whatsappPhone}
                                                    onChange={e => setWhatsappPhone(e.target.value)}
                                                    dir="ltr"
                                                    style={{ maxWidth: '300px' }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleSendOtp}
                                                    disabled={sendingOtp || !whatsappPhone}
                                                    className="settings-save-btn"
                                                    style={{ padding: '0 24px', borderRadius: '14px', fontSize: '0.85rem', height: '50px' }}
                                                >
                                                    {sendingOtp ? t.whatsappSendingOtp : t.whatsappSendOtpBtn}
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '400px' }}>
                                            <label className="settings-label">{t.whatsappEnterOtpLabel}</label>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <input
                                                    className="settings-input"
                                                    type="text"
                                                    maxLength={6}
                                                    placeholder={t.whatsappOtpPlaceholder}
                                                    value={otpInput}
                                                    onChange={e => setOtpInput(e.target.value)}
                                                    dir="ltr"
                                                    style={{ fontSize: '1.2rem', letterSpacing: '4px', textAlign: 'center', fontWeight: 'bold' }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleVerifyOtp}
                                                    disabled={verifyingOtp || otpInput.trim().length !== 6}
                                                    className="settings-save-btn"
                                                    style={{ padding: '0 24px', borderRadius: '14px', fontSize: '0.85rem', background: '#10b981', boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)' }}
                                                >
                                                    {verifyingOtp ? t.whatsappVerifying : t.whatsappVerifyBtn}
                                                </button>
                                            </div>
                                            {otpTimer > 0 ? (
                                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                    {t.whatsappTimerLabel.replace('{time}', otpTimer)}
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setOtpStep(0)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', textDecoration: 'underline', width: 'fit-content' }}
                                                >
                                                    {language === 'ar' ? 'إعادة إرسال الرمز' : 'Resend Code'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </div>

        </div>
    );
}

export default Settings;