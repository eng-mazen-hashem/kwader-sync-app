import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { Clock, AlertTriangle, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';

const TrialBanner = () => {
    const { company, activeRole, user } = useAuth();
    const { language } = useLocale();
    const [isVisible, setIsVisible] = useState(true);
    const [requestStatus, setRequestStatus] = useState(null); // 'pending', 'approved', 'rejected', or null
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!company?.id || activeRole !== 'org_admin') return;
        const checkRenewalRequestStatus = async () => {
            try {
                const { data, error } = await supabase
                    .from('renewal_requests')
                    .select('status')
                    .eq('company_id', company.id)
                    .order('requested_at', { ascending: false })
                    .limit(1);
                if (!error && data && data.length > 0) {
                    setRequestStatus(data[0].status);
                } else {
                    setRequestStatus(null);
                }
            } catch (err) {
                console.error("Error checking renewal request status:", err);
            }
        };
        checkRenewalRequestStatus();
    }, [company?.id, activeRole]);

    // Only org admins should care about billing/trial
    if (!company || activeRole !== 'org_admin') return null;

    // Find the expiration date
    const rawEndDate = company.settings?.subscription_end_date || company.settings?.trial_end_date || company.subscription_end_date || company.subscription_expires_at;
    
    if (!rawEndDate) return null;

    const endDate = new Date(rawEndDate);
    const now = new Date();
    const diffTime = endDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Only show if expiring in 15 days or less, or already expired
    if (diffDays > 15) return null;

    const isRtl = language === 'ar';
    const isExpired = diffDays <= 0;

    const handleRequestRenewal = async () => {
        if (isSubmitting || requestStatus === 'pending') return;
        setIsSubmitting(true);
        try {
            // 1. Insert into DB (renewal_requests)
            const { error } = await supabase
                .from('renewal_requests')
                .insert({
                    company_id: company.id,
                    status: 'pending',
                    details: {
                        requested_by: user?.email || 'unknown',
                        company_name: company.name,
                        current_plan: company.plan || 'Free'
                    }
                });

            if (error) throw error;

            setRequestStatus('pending');
            toast.success(isRtl ? 'تم إرسال طلب التجديد بنجاح! سيتم إخطار الإدارة وتفعيل اشتراكك.' : 'Renewal request sent successfully! Admin will be notified.');

            // 2. Fetch WhatsApp settings to send notification to admin
            let targetPhone = "";

            const { data: configData } = await supabase
                .from('payment_config')
                .select('key, value')
                .eq('key', 'admin_whatsapp')
                .maybeSingle();

            if (configData && configData.value) {
                targetPhone = configData.value;
            } else {
                const { data: settingsData } = await supabase
                    .from('system_settings')
                    .select('key, value');

                if (settingsData) {
                    const phoneSetting = settingsData.find(s => s.key === 'whatsapp_recipient_phone')?.value;
                    if (phoneSetting) targetPhone = phoneSetting;
                }
            }

            if (targetPhone) {
                const cleanPhone = targetPhone.replace(/[^0-9]/g, '');
                const message = `🔔 *طلب تجديد اشتراك جديد*\n\n` +
                                `🏢 *الشركة:* ${company.name}\n` +
                                `📧 *البريد الإلكتروني:* ${user?.email || 'غير معروف'}\n` +
                                `📦 *الباقة الحالية:* ${company.plan || 'Free'}\n` +
                                `📅 *تاريخ الطلب:* ${new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}`;

                try {
                    await supabase.functions.invoke('auto-reports', {
                        body: {
                            action: 'send_whatsapp',
                            phone: cleanPhone,
                            message: message
                        }
                    });
                } catch (fetchErr) {
                    console.error('Failed to dispatch WhatsApp message via Edge Function:', fetchErr);
                }
            }
        } catch (err) {
            console.error('Error submitting renewal request:', err);
            toast.error(isRtl ? 'فشل في إرسال طلب التجديد. يرجى المحاولة مرة أخرى.' : 'Failed to send renewal request. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    style={{
                        background: isExpired 
                            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.98), rgba(185, 28, 28, 0.98))' 
                            : 'linear-gradient(135deg, rgba(245, 158, 11, 0.98), rgba(217, 119, 6, 0.98))',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        color: '#fff',
                        zIndex: 1000,
                        position: 'relative',
                        boxShadow: isExpired ? '0 8px 30px rgba(239, 68, 68, 0.35)' : '0 8px 30px rgba(245, 158, 11, 0.3)',
                        borderBottom: '1px solid rgba(255,255,255,0.15)'
                    }} 
                    className="px-3 py-2 md:py-3 flex items-center justify-between gap-2"
                    dir={isRtl ? 'rtl' : 'ltr'}
                >
                    <div className="flex flex-row items-center gap-2 md:gap-4 flex-1 min-width-0 justify-between md:justify-center w-full">
                        <div className="flex items-center gap-1.5 min-width-0">
                            {isExpired ? <AlertTriangle size={16} className="animate-pulse text-white shrink-0" /> : <Clock size={16} className="animate-pulse text-white shrink-0" />}
                            <span className="text-[11px] md:text-sm font-semibold text-white truncate md:whitespace-normal leading-tight">
                                {isExpired 
                                    ? (isRtl ? 'انتهى اشتراكك. يرجى طلب التجديد لمتابعة العمل.' : 'Subscription expired. Please request renewal.')
                                    : (isRtl ? `ينتهي اشتراكك خلال ${diffDays} يوم.` : `Expires in ${diffDays} day(s).`)
                                }
                            </span>
                        </div>
                        
                        <button 
                            onClick={handleRequestRenewal}
                            disabled={requestStatus === 'pending' || isSubmitting}
                            className={`px-2.5 py-1 md:px-4 md:py-1.5 rounded-lg md:rounded-xl border border-white/30 text-[11px] md:text-xs font-black transition-all flex items-center gap-1 justify-center shrink-0
                                ${(requestStatus === 'pending' || isSubmitting) 
                                    ? 'bg-white/10 text-white/60 cursor-not-allowed' 
                                    : 'bg-white/20 text-white hover:bg-white hover:text-slate-900 active:scale-95'}`}
                            style={{ fontFamily: 'Cairo' }}
                        >
                            <RefreshCw size={11} className={isSubmitting ? "animate-spin" : ""} />
                            {isSubmitting 
                                ? (isRtl ? 'جاري الإرسال...' : 'Sending...') 
                                : requestStatus === 'pending' 
                                    ? (isRtl ? 'معلق (مراجعة)' : 'Pending') 
                                    : (isRtl ? 'تجديد ⚡' : 'Renew ⚡')
                            }
                        </button>
                    </div>

                    {!isExpired && (
                        <button 
                            onClick={() => setIsVisible(false)}
                            className="p-0.5 text-white/70 hover:text-white transition-colors shrink-0 ms-1"
                            aria-label="Close"
                        >
                            <X size={16} />
                        </button>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default TrialBanner;
