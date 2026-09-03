import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { toast } from 'sonner';

const InviteSubUserModal = ({ onClose, onInviteSent }) => {
    const { company } = useAuth();
    const { t, language } = useLocale();
    
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [permissions, setPermissions] = useState({
        manage_employees: false,
        manage_attendance: false,
        manage_payroll: false,
        manage_loans: false,
        manage_settings: false
    });
    const [inviteLink, setInviteLink] = useState('');

    const handleCheckboxChange = (e) => {
        const { name, checked } = e.target;
        setPermissions(prev => ({
            ...prev,
            [name]: checked
        }));
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const normalizedEmail = email.trim().toLowerCase();

            // 1 & 2. Delete any existing pending invites for this email in this company
            // We use a bulk delete directly to avoid 'maybeSingle' throwing errors if there are duplicates
            const { error: deleteError } = await supabase
                .from('company_invites')
                .delete()
                .eq('company_id', company.id)
                .ilike('email', normalizedEmail);
            
            if (deleteError) {
                console.error('[InviteSubUserModal] delete existing invite error:', deleteError);
            }

            // 3. Create invite record
            const { data, error } = await supabase
                .from('company_invites')
                .insert([
                    {
                        company_id: company.id,
                        email: normalizedEmail,
                        permissions: permissions
                    }
                ])
                .select()
                .single();

            if (error) throw error;

            const link = `${window.location.origin}/invite?token=${data.token}`;
            setInviteLink(link);
            
        } catch (err) {
            console.error('[InviteSubUserModal] handleInvite:', err);
            const errMsg = err.message || err.error_description || (typeof err === 'object' ? JSON.stringify(err) : String(err));
            toast.error(`${t.errSendInvite || 'حدث خطأ أثناء إرسال الدعوة. تأكد من أن البريد الإلكتروني غير مدعو مسبقاً.'} (${errMsg})`);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(inviteLink);
        toast.success(t.lblCopiedSuccess || 'تم نسخ رابط الدعوة بنجاح!');
        onInviteSent();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir={language === 'en' ? 'ltr' : 'rtl'}>
            <div className="bg-[#1A1A24] border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slideUp">
                
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-700/50">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                        {t.lblInviteModalTitle || 'دعوة موظف HR'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {inviteLink ? (
                        <div className="space-y-6 text-center">
                            <div className="mx-auto w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h4 className="text-lg font-bold text-white">
                                {t.lblInviteCreateSuccess || 'تم إنشاء الدعوة بنجاح!'}
                            </h4>
                            <p className="text-slate-400 text-sm">
                                {t.lblInviteModalDesc || 'قم بنسخ الرابط التالي وإرساله للموظف ليتمكن من التسجيل والانضمام لفريقك.'}
                            </p>
                            
                            <div className="bg-slate-900 p-3 rounded-xl border border-slate-700 text-left overflow-x-auto">
                                <span className="text-emerald-300 text-sm whitespace-nowrap">{inviteLink}</span>
                            </div>

                            <button 
                                onClick={handleCopy}
                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 rounded-xl transition-colors cursor-pointer"
                            >
                                {t.btnCopyAndClose || 'نسخ الرابط وإنهاء'}
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleInvite} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    {t.lblEmployeeEmail || 'البريد الإلكتروني للموظف'}
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => email !== e.target.value && setEmail(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                                    placeholder="hr@example.com"
                                    dir="ltr"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-3">
                                    {t.lblGrantedPermissions || 'الصلاحيات الممنوحة'}
                                </label>
                                <div className="space-y-3 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                                    
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative flex items-center">
                                            <input type="checkbox" name="manage_employees" checked={permissions.manage_employees} onChange={handleCheckboxChange} className="peer sr-only" />
                                            <div className="w-10 h-5 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                                        </div>
                                        <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                                            {t.lblPermEmployees || 'إدارة الموظفين والملفات'}
                                        </span>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative flex items-center">
                                            <input type="checkbox" name="manage_attendance" checked={permissions.manage_attendance} onChange={handleCheckboxChange} className="peer sr-only" />
                                            <div className="w-10 h-5 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                                        </div>
                                        <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                                            {t.lblPermAttendance || 'إدارة الحضور والانصراف (الورديات)'}
                                        </span>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative flex items-center">
                                            <input type="checkbox" name="manage_payroll" checked={permissions.manage_payroll} onChange={handleCheckboxChange} className="peer sr-only" />
                                            <div className="w-10 h-5 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                                        </div>
                                        <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                                            {t.lblPermPayroll || 'إدارة مسيرات الرواتب'}
                                        </span>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative flex items-center">
                                            <input type="checkbox" name="manage_loans" checked={permissions.manage_loans} onChange={handleCheckboxChange} className="peer sr-only" />
                                            <div className="w-10 h-5 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                                        </div>
                                        <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                                            {t.lblPermLoans || 'إدارة السلف'}
                                        </span>
                                    </label>

                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative flex items-center">
                                            <input type="checkbox" name="manage_settings" checked={permissions.manage_settings} onChange={handleCheckboxChange} className="peer sr-only" />
                                            <div className="w-10 h-5 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                                        </div>
                                        <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                                            {t.lblPermSettings || 'إدارة إعدادات الشركة والإشعارات'}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors cursor-pointer"
                                >
                                    {t.cancelBtn || 'إلغاء'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-colors disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        t.btnCreateInviteLink || 'إنشاء رابط الدعوة'
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InviteSubUserModal;
