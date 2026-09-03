import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';
import { 
    Mail, 
    User, 
    Lock, 
    ArrowLeft, 
    Check, 
    LogOut, 
    AlertTriangle, 
    ShieldCheck,
    Compass
} from 'lucide-react';

const AcceptInvite = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t, language } = useLocale();
    
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [inviteData, setInviteData] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');

    useEffect(() => {
        const checkInvite = async () => {
            const searchParams = new URLSearchParams(location.search);
            const token = searchParams.get('token');
            
            if (!token) {
                setError(t.lblInviteTokenNotFound || 'لم يتم العثور على رمز الدعوة.');
                setLoading(false);
                return;
            }

            // Save token to session storage for auto-acceptance after login if needed
            sessionStorage.setItem('pending_invite_token', token);

            try {
                // Check if user is already logged in
                const { data: { user } } = await supabase.auth.getUser();
                setCurrentUser(user);

                // Fetch invite details
                const { data, error: fetchErr } = await supabase
                    .from('company_invites')
                    .select('*, companies(name)')
                    .eq('token', token)
                    .maybeSingle();

                if (fetchErr || !data) {
                    setError(t.lblInviteLinkInvalid || 'رابط الدعوة غير صالح أو منتهي الصلاحية.');
                } else if (new Date(data.expires_at) < new Date()) {
                    setError(t.lblInviteLinkExpired || 'عذراً، لقد انتهت صلاحية هذه الدعوة.');
                } else {
                    setInviteData(data);
                }
            } catch (err) {
                console.error('[AcceptInvite] checkInvite:', err);
                setError(t.lblInviteFetchError || 'حدث خطأ أثناء التحقق من الدعوة.');
            } finally {
                setLoading(false);
            }
        };

        checkInvite();
    }, [location.search, t]);

    const handleAcceptExisting = async () => {
        setSubmitting(true);
        try {
            const { error: rpcError } = await supabase.rpc('accept_invite', {
                invite_token: inviteData.token
            });

            if (rpcError) throw rpcError;

            sessionStorage.removeItem('pending_invite_token');
            toast.success(t.lblJoinSuccess || 'تم الانضمام بنجاح! جاري التوجيه إلى لوحة التحكم...');
            navigate('/dashboard');
        } catch (err) {
            console.error('[AcceptInvite] handleAcceptExisting:', err);
            toast.error(err.message || t.lblSignupError || 'حدث خطأ أثناء إعداد الحساب.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await supabase.auth.signOut();
            setCurrentUser(null);
            toast.success(language === 'en' ? 'Signed out successfully' : 'تم تسجيل الخروج بنجاح');
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (password !== confirmPassword) {
            toast.error(t.lblPasswordsNotMatch || 'كلمات المرور غير متطابقة.');
            return;
        }

        if (password.length < 6) {
            toast.error(t.lblPasswordTooShort || 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            // 1. Sign up the user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: inviteData.email,
                password: password,
                options: {
                    data: { full_name: fullName }
                }
            });

            if (authError) throw authError;

            sessionStorage.removeItem('pending_invite_token');

            // Check if a session was created immediately
            const session = authData.session;
            if (!session) {
                // If they don't have a session immediately, it means email confirmation is required.
                toast.success(t.lblSignupSuccessConfirm || 'تم إنشاء الحساب بنجاح. يرجى تفعيل البريد الإلكتروني ثم تسجيل الدخول للوصول إلى شركتك.');
                navigate('/login');
                return;
            }

            // 2. Call the idempotent RPC to accept the invite (just to be safe)
            const { error: rpcError } = await supabase.rpc('accept_invite', {
                invite_token: inviteData.token
            });

            if (rpcError) throw rpcError;

            // Success!
            toast.success(t.lblJoinSuccess || 'تم الانضمام بنجاح! جاري التوجيه إلى لوحة التحكم...');
            navigate('/dashboard');

        } catch (err) {
            console.error('[AcceptInvite] handleSubmit:', err);
            toast.error(err.message || t.lblSignupError || 'حدث خطأ أثناء إعداد الحساب.');
        } finally {
            setSubmitting(false);
        }
    };

    const isRtl = language !== 'en';

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050811] flex flex-col items-center justify-center relative overflow-hidden p-6">
                {/* Visual Glow Orbs */}
                <div className="absolute top-[20%] left-[-10%] w-[30rem] h-[30rem] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
                <div className="absolute bottom-[20%] right-[-10%] w-[30rem] h-[30rem] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
                
                <div className="relative flex flex-col items-center p-8 bg-[#0F0F16]/50 backdrop-blur-2xl rounded-3xl border border-white/5 shadow-2xl max-w-sm w-full text-center">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-6 animate-pulse">
                        <Compass size={32} className="animate-spin" style={{ animationDuration: '3s' }} />
                    </div>
                    <h3 className="text-white font-bold text-lg mb-2">{isRtl ? 'جاري التحقق من الدعوة' : 'Verifying Invitation'}</h3>
                    <p className="text-slate-400 text-sm">{isRtl ? 'نعمل على تأمين اتصالك بالمنصة...' : 'Securing your connection...'}</p>
                </div>
            </div>
        );
    }

    // Determine the view state
    const isSameUserLoggedIn = currentUser && currentUser.email?.toLowerCase() === inviteData?.email?.toLowerCase();
    const isDifferentUserLoggedIn = currentUser && currentUser.email?.toLowerCase() !== inviteData?.email?.toLowerCase();

    return (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8 bg-[#050811] relative overflow-y-auto" dir={isRtl ? 'rtl' : 'ltr'}>
            
            {/* Ambient Background Glows */}
            <div className="absolute top-[10%] left-[-10%] w-[35rem] h-[35rem] rounded-full bg-gradient-to-tr from-[#6c63ff]/10 to-[#8b5cf6]/5 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[10%] right-[-10%] w-[35rem] h-[35rem] rounded-full bg-gradient-to-tr from-[#06b6d4]/10 to-[#6c63ff]/5 blur-[120px] pointer-events-none" />
            
            <div className="relative w-full max-w-md bg-[#0F0F16]/60 backdrop-blur-3xl rounded-[2rem] p-6 sm:p-8 md:p-10 shadow-[0_0_50px_rgba(108,99,255,0.08)] border border-white/5 animate-fadeIn my-6">
                
                {/* Logo and Header */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 mx-auto mb-4 relative flex items-center justify-center">
                        <div className="absolute inset-0 bg-[#6c63ff]/20 blur-xl rounded-full scale-90" />
                        <img src="/logo.png" alt="Logo" className="w-16 h-16 relative z-10 object-contain" />
                    </div>
                    
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
                        {t.lblSetupAccountTitle || 'إكمال إعداد الحساب'}
                    </h1>
                    
                    <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
                        {inviteData?.role === 'owner'
                            ? (t.lblInvitedToOwnerCompany ? t.lblInvitedToOwnerCompany.replace('{name}', inviteData.companies?.name) : `لقد تمت دعوتك لتفعيل حساب شركتك (${inviteData.companies?.name}) وتعيين كلمة المرور الخاصة بك.`)
                            : (inviteData?.companies?.name 
                                ? (t.lblInvitedToJoinCompany ? t.lblInvitedToJoinCompany.replace('{name}', inviteData.companies.name) : `لقد تمت دعوتك للانضمام إلى فريق HR في ${inviteData.companies.name}`)
                                : (t.lblInvitedToJoinGeneric || 'لقد تمت دعوتك للانضمام إلى فريق HR'))}
                    </p>
                </div>

                {error ? (
                    /* ERROR STATE */
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-5 rounded-2xl text-center space-y-4">
                        <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto text-red-400">
                            <AlertTriangle size={24} />
                        </div>
                        <p className="text-sm font-semibold leading-relaxed">{error}</p>
                        <button 
                            onClick={() => navigate('/login')}
                            className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border border-red-500/30"
                        >
                            <ArrowLeft size={16} className={isRtl ? 'rotate-180' : ''} />
                            <span>{t.lblBackToLogin || 'العودة إلى تسجيل الدخول'}</span>
                        </button>
                    </div>
                ) : isSameUserLoggedIn ? (
                    /* CASE 1: User is already logged in with the matching email */
                    <div className="space-y-6 text-center">
                        <div className="bg-slate-800/40 p-5 rounded-2xl border border-white/5 text-slate-300 text-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                            <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                                {isRtl ? 'حسابك النشط:' : 'Your active account:'}
                            </span>
                            <span className="text-white font-bold text-lg block truncate">{currentUser.email}</span>
                        </div>
                        
                        <p className="text-slate-400 text-sm leading-relaxed">
                            {isRtl 
                                ? 'أنت مسجل الدخول بالفعل بهذا البريد الإلكتروني. يمكنك الانضمام فوراً دون الحاجة لكلمة مرور جديدة.' 
                                : 'You are already logged in with this email address. You can join immediately without creating a new password.'}
                        </p>
                        
                        <button
                            onClick={handleAcceptExisting}
                            disabled={submitting}
                            className="w-full bg-gradient-to-r from-[#6c63ff] to-[#a78bfa] hover:from-[#5a52d5] hover:to-[#8b5cf6] text-white font-bold py-4 rounded-2xl transition-all shadow-[0_4px_20px_rgba(108,99,255,0.25)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transform active:scale-98"
                        >
                            {submitting ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <ShieldCheck size={20} />
                                    <span>{isRtl ? 'القبول والانضمام للمنشأة' : 'Accept & Join Organization'}</span>
                                </>
                            )}
                        </button>
                    </div>
                ) : isDifferentUserLoggedIn ? (
                    /* CASE 2: User is logged in, but with a DIFFERENT email address */
                    <div className="space-y-6 text-center">
                        <div className="bg-amber-500/10 border border-amber-500/25 text-amber-400 p-5 rounded-2xl text-sm leading-relaxed text-right" dir={isRtl ? 'rtl' : 'ltr'}>
                            <div className="flex items-start gap-3">
                                <AlertTriangle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold mb-1.5 text-sm">
                                        {isRtl ? 'تنبيه: حساب بريد إلكتروني مختلف' : 'Warning: Different Email Account'}
                                    </p>
                                    <p className="text-xs text-slate-300 leading-normal">
                                        {isRtl 
                                            ? `أنت مسجل الدخول حالياً بـ (${currentUser.email})، بينما هذه الدعوة مخصصة للبريد الإلكتروني (${inviteData.email}).`
                                            : `You are currently logged in as (${currentUser.email}), but this invitation is for (${inviteData.email}).`}
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        <p className="text-slate-400 text-xs leading-relaxed">
                            {isRtl 
                                ? 'يرجى تسجيل الخروج أولاً، ثم قبول الدعوة لإنشاء حسابك الجديد أو تسجيل الدخول بالحساب الصحيح.' 
                                : 'Please sign out first, then accept the invitation to create your new account or log in with the correct credentials.'}
                        </p>
                        
                        <div className="flex gap-4">
                            <button
                                onClick={handleSignOut}
                                className="flex-1 py-3.5 bg-slate-800/80 text-slate-300 rounded-2xl hover:bg-slate-700/80 transition-colors font-bold text-sm cursor-pointer border border-white/5"
                            >
                                <LogOut size={16} className="inline-block me-2 align-middle" />
                                <span className="align-middle">{isRtl ? 'خروج' : 'Sign Out'}</span>
                            </button>
                            
                            <button
                                onClick={() => navigate('/login')}
                                className="flex-1 py-3.5 bg-[#6c63ff] text-white rounded-2xl hover:bg-[#5a52d5] transition-colors font-bold text-sm cursor-pointer shadow-lg shadow-[#6c63ff]/20"
                            >
                                <span className="align-middle">{t.lblBackToLogin || 'تسجيل دخول'}</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    /* CASE 3: User is not logged in - show signup form and log in link */
                    <form onSubmit={handleSubmit} className="space-y-5">
                        
                        {/* Email Field (Disabled) */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                                {t.lblEmailAddress || 'البريد الإلكتروني'}
                            </label>
                            <div className="relative flex items-center bg-[#050811]/40 border border-white/5 rounded-2xl overflow-hidden">
                                <Mail size={18} className={`absolute text-slate-500 ${isRtl ? 'right-4' : 'left-4'}`} />
                                <input
                                    type="email"
                                    disabled
                                    value={inviteData.email}
                                    className={`w-full bg-transparent border-none py-3.5 text-slate-400 cursor-not-allowed select-none font-medium text-sm ${isRtl ? 'pr-12 pl-4 text-right' : 'pl-12 pr-4 text-left'}`}
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        {/* Full Name Field */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                                {t.lblFullName || 'الاسم الكامل'}
                            </label>
                            <div className="relative flex items-center bg-[#050811]/60 border border-white/5 hover:border-white/10 focus-within:border-[#6c63ff] focus-within:bg-[#050811]/80 rounded-2xl transition-all duration-300">
                                <User size={18} className={`absolute text-slate-500 transition-colors duration-300 ${isRtl ? 'right-4' : 'left-4'}`} />
                                <input
                                    type="text"
                                    required
                                    value={fullName}
                                    onChange={(e) => fullName !== e.target.value && setFullName(e.target.value)}
                                    className={`w-full bg-transparent border-none py-3.5 outline-none text-white placeholder-slate-600 font-medium text-sm transition-all ${isRtl ? 'pr-12 pl-4 text-right' : 'pl-12 pr-4 text-left'}`}
                                    placeholder={isRtl ? 'محمد أحمد' : 'John Doe'}
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                                {t.lblPassword || 'كلمة المرور'}
                            </label>
                            <div className="relative flex items-center bg-[#050811]/60 border border-white/5 hover:border-white/10 focus-within:border-[#6c63ff] focus-within:bg-[#050811]/80 rounded-2xl transition-all duration-300">
                                <Lock size={18} className={`absolute text-slate-500 transition-colors duration-300 ${isRtl ? 'right-4' : 'left-4'}`} />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => password !== e.target.value && setPassword(e.target.value)}
                                    className={`w-full bg-transparent border-none py-3.5 outline-none text-white placeholder-slate-600 font-medium text-sm transition-all ${isRtl ? 'pr-12 pl-4 text-right' : 'pl-12 pr-4 text-left'}`}
                                    placeholder="••••••••"
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        {/* Confirm Password Field */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                                {t.lblConfirmPassword || 'تأكيد كلمة المرور'}
                            </label>
                            <div className="relative flex items-center bg-[#050811]/60 border border-white/5 hover:border-white/10 focus-within:border-[#6c63ff] focus-within:bg-[#050811]/80 rounded-2xl transition-all duration-300">
                                <Lock size={18} className={`absolute text-slate-500 transition-colors duration-300 ${isRtl ? 'right-4' : 'left-4'}`} />
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => confirmPassword !== e.target.value && setConfirmPassword(e.target.value)}
                                    className={`w-full bg-transparent border-none py-3.5 outline-none text-white placeholder-slate-600 font-medium text-sm transition-all ${isRtl ? 'pr-12 pl-4 text-right' : 'pl-12 pr-4 text-left'}`}
                                    placeholder="••••••••"
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-gradient-to-r from-[#6c63ff] to-[#a78bfa] hover:from-[#5a52d5] hover:to-[#8b5cf6] text-white font-bold py-4 rounded-2xl transition-all shadow-[0_8px_30px_rgba(108,99,255,0.22)] hover:shadow-[0_12px_36px_rgba(108,99,255,0.32)] mt-6 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transform active:scale-98"
                        >
                            {submitting ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>{t.lblJoining || 'جاري إنشاء الحساب...'}</span>
                                </>
                            ) : (
                                <>
                                    <Check size={18} />
                                    <span>{t.btnJoinNow || 'الإنضمام الآن'}</span>
                                </>
                            )}
                        </button>

                        {/* Return to Login */}
                        <div className="text-center mt-6 pt-5 border-t border-white/5 flex items-center justify-center gap-2">
                            <span className="text-xs text-slate-400">
                                {isRtl ? 'لديك حساب بالفعل؟' : 'Already have an account?'}
                            </span>
                            <button
                                type="button"
                                onClick={() => navigate('/login')}
                                className="text-xs text-indigo-400 hover:text-indigo-300 font-bold hover:underline bg-transparent border-none cursor-pointer p-0 transition-colors"
                            >
                                {isRtl ? 'تسجيل دخول وقبول الدعوة' : 'Log In & Accept'}
                            </button>
                        </div>
                    </form>
                )}

            </div>
        </div>
    );
};

export default AcceptInvite;
