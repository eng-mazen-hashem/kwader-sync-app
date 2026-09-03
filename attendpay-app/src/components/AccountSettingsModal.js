import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useLocale } from '../context/LocaleContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { HiOutlineX, HiOutlineLockClosed, HiOutlineOfficeBuilding } from 'react-icons/hi';
import './AccountSettingsModal.css';

export default function AccountSettingsModal({ onClose }) {
    const { t, language } = useLocale();
    const { user, refreshAuth } = useAuth();
    const [activeTab, setActiveTab] = useState('security');
    const [securityForm, setSecurityForm] = useState({ newPassword: '', confirmPassword: '' });
    const [savingSecurity, setSavingSecurity] = useState(false);

    // Company Form State
    const [companyForm, setCompanyForm] = useState({ name: '', phone: '' });
    const [savingCompany, setSavingCompany] = useState(false);

    const isRtl = language === 'ar';

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (!securityForm.newPassword || securityForm.newPassword.length < 6) {
            toast.error(isRtl ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters');
            return;
        }
        if (securityForm.newPassword !== securityForm.confirmPassword) {
            toast.error(isRtl ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
            return;
        }

        setSavingSecurity(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: securityForm.newPassword
            });
            if (error) throw error;
            toast.success(isRtl ? 'تم تحديث كلمة المرور بنجاح' : 'Password updated successfully');
            setSecurityForm({ newPassword: '', confirmPassword: '' });
            onClose();
        } catch (e) {
            console.error('[AccountSettings] updatePassword:', e.message);
            toast.error((t.errorGeneric || 'Error occurred') + ': ' + e.message);
        } finally {
            setSavingSecurity(false);
        }
    };

    const handleCreateCompany = async (e) => {
        e.preventDefault();
        if (!companyForm.name.trim()) {
            toast.error(isRtl ? 'اسم الشركة مطلوب' : 'Company name is required');
            return;
        }

        setSavingCompany(true);
        try {
            const trialExpiry = new Date();
            trialExpiry.setDate(trialExpiry.getDate() + 35);

            const { data, error } = await supabase.from('companies').insert({
                name: companyForm.name.trim(),
                phone: companyForm.phone.trim() || null,
                owner_id: user?.id,
                status: 'active',
                plan: 'Pro', // Default Pro tier for trial
                restriction_level: 'none',
                subscription_amount: 0,
                subscription_expires_at: trialExpiry.toISOString(),
                subscription_end_date: trialExpiry.toISOString().split('T')[0],
                settings: {
                    subscription_amount: 0,
                    subscription_expires_at: trialExpiry.toISOString(),
                    subscription_end_date: trialExpiry.toISOString(),
                    trial_end_date: trialExpiry.toISOString(),
                    work_end: "17:00",
                    work_start: "08:00",
                    overtime_rate: 1.5,
                    housing_allowance: 500,
                    transport_allowance: 300,
                    absence_deduction_formula: "daily_rate",
                    late_deduction_per_minute: 2
                }
            }).select();

            if (error) throw error;

            toast.success(isRtl ? 'تم إنشاء الشركة بنجاح!' : 'Company created successfully!');
            
            // Reload auth context to get new companies list
            await refreshAuth();
            
            setCompanyForm({ name: '', phone: '' });
            onClose();
        } catch (err) {
            console.error('[AccountSettings] createCompany:', err.message);
            toast.error((t.errorGeneric || 'Error occurred') + ': ' + err.message);
        } finally {
            setSavingCompany(false);
        }
    };

    return (
        <div className="asm-overlay" onClick={onClose} dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="asm-modal" onClick={e => e.stopPropagation()}>
                <div className="asm-header">
                    <div className="asm-title-group">
                        <div className="asm-icon-wrapper">
                            {activeTab === 'security' ? <HiOutlineLockClosed size={24} /> : <HiOutlineOfficeBuilding size={24} />}
                        </div>
                        <div>
                            <h2>{isRtl ? 'إعدادات الحساب' : 'Account Settings'}</h2>
                            <p>{activeTab === 'security' 
                                ? (isRtl ? 'إدارة الأمان وكلمة المرور الخاصة بحسابك' : 'Manage your account security and password')
                                : (isRtl ? 'إضافة شركة أو فرع جديد تحت إدارتك' : 'Add a new company or branch under your management')}
                            </p>
                        </div>
                    </div>
                    <button className="asm-close-btn" onClick={onClose}>
                        <HiOutlineX size={20} />
                    </button>
                </div>

                <div className="asm-tabs">
                    <button 
                        className={`asm-tab ${activeTab === 'security' ? 'active' : ''}`} 
                        onClick={() => setActiveTab('security')}
                    >
                        <HiOutlineLockClosed size={16} />
                        <span>{isRtl ? 'الأمان' : 'Security'}</span>
                    </button>
                    <button 
                        className={`asm-tab ${activeTab === 'add_company' ? 'active' : ''}`} 
                        onClick={() => setActiveTab('add_company')}
                    >
                        <HiOutlineOfficeBuilding size={16} />
                        <span>{isRtl ? 'إضافة شركة' : 'Add Company'}</span>
                    </button>
                </div>

                {activeTab === 'security' ? (
                    <form onSubmit={handleUpdatePassword} className="asm-body">
                        <div className="asm-form-group">
                            <label>{isRtl ? 'كلمة المرور الجديدة' : 'New Password'}</label>
                            <input 
                                type="password" 
                                placeholder="••••••••"
                                value={securityForm.newPassword}
                                onChange={e => setSecurityForm(p => ({ ...p, newPassword: e.target.value }))}
                            />
                        </div>
                        <div className="asm-form-group">
                            <label>{isRtl ? 'تأكيد كلمة المرور' : 'Confirm Password'}</label>
                            <input 
                                type="password" 
                                placeholder="••••••••"
                                value={securityForm.confirmPassword}
                                onChange={e => setSecurityForm(p => ({ ...p, confirmPassword: e.target.value }))}
                            />
                        </div>

                        <div className="asm-actions">
                            <button type="button" className="asm-btn-cancel" onClick={onClose}>
                                {isRtl ? 'إلغاء' : 'Cancel'}
                            </button>
                            <button type="submit" className="asm-btn-save" disabled={savingSecurity}>
                                {savingSecurity ? (isRtl ? 'جاري التحديث...' : 'Updating...') : (isRtl ? 'تحديث كلمة المرور' : 'Update Password')}
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleCreateCompany} className="asm-body">
                        <div className="asm-form-group">
                            <label>{isRtl ? 'اسم الشركة / الفرع الجديد' : 'New Company / Branch Name'}</label>
                            <input 
                                type="text" 
                                placeholder={isRtl ? "مثال: شركة الحلول المتقدمة" : "e.g. Advanced Solutions Co."}
                                value={companyForm.name}
                                onChange={e => setCompanyForm(p => ({ ...p, name: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="asm-form-group">
                            <label>{isRtl ? 'رقم الهاتف (اختياري)' : 'Phone Number (Optional)'}</label>
                            <input 
                                type="text" 
                                placeholder="05xxxxxxxx"
                                value={companyForm.phone}
                                onChange={e => setCompanyForm(p => ({ ...p, phone: e.target.value }))}
                            />
                        </div>

                        <div className="asm-actions">
                            <button type="button" className="asm-btn-cancel" onClick={onClose}>
                                {isRtl ? 'إلغاء' : 'Cancel'}
                            </button>
                            <button type="submit" className="asm-btn-save" disabled={savingCompany}>
                                {savingCompany ? (isRtl ? 'جاري الإنشاء...' : 'Creating...') : (isRtl ? 'إنشاء الشركة' : 'Create Company')}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
