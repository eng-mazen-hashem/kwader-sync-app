import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    CreditCard, Copy, Check, CheckCircle, Clock,
    RefreshCw, Phone, Wallet, Calendar, MessageCircle,
    AlertCircle, ChevronRight
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';
import './PaymentPage.css';

// WhatsApp SVG Icon
const WhatsAppIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
);

export default function PaymentPage() {
    const { id } = useParams(); // Get invoice/payment link ID if public
    const { company } = useAuth();
    const { language } = useLocale();
    const isRtl = language === 'ar';

    const [config, setConfig] = useState({
        vodafone_cash_number: '',
        vodafone_cash_name: '',
        instapay_number: '',
        instapay_name: '',
        admin_whatsapp: ''
    });
    const [configLoading, setConfigLoading] = useState(true);

    const [selectedMethod, setSelectedMethod] = useState('vodafone_cash');
    const [transactionRef, setTransactionRef] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [existingPending, setExistingPending] = useState(null);
    const [copiedKey, setCopiedKey] = useState('');

    // State for public quick payment
    const [quickPayment, setQuickPayment] = useState(null);
    const [quickPaymentLoading, setQuickPaymentLoading] = useState(false);

    const fetchConfig = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('payment_config')
                .select('key, value');
            if (error) throw error;
            const mapped = {};
            (data || []).forEach(row => { mapped[row.key] = row.value || ''; });
            setConfig(prev => ({ ...prev, ...mapped }));
        } catch (err) {
            console.error('PaymentPage fetchConfig:', err.message);
        } finally {
            setConfigLoading(false);
        }
    }, []);

    const fetchQuickPayment = useCallback(async () => {
        if (!id) return;
        setQuickPaymentLoading(true);
        try {
            const { data, error } = await supabase
                .from('quick_payments')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;
            setQuickPayment(data);
            if (data.status === 'pending' && data.transaction_ref) {
                setExistingPending({
                    amount: data.amount,
                    payment_method: data.payment_method || 'vodafone_cash',
                    transaction_ref: data.transaction_ref,
                    status: 'pending'
                });
            } else if (data.status === 'approved') {
                setSubmitted(true);
            }
        } catch (err) {
            console.error('fetchQuickPayment error:', err.message);
            toast.error(isRtl ? 'رابط الدفع غير صالح أو منتهي' : 'Invalid or expired payment link');
        } finally {
            setQuickPaymentLoading(false);
        }
    }, [id, isRtl]);

    const fetchPendingRequest = useCallback(async () => {
        if (id) return; // If quick payment, handle separately
        if (!company) return;
        try {
            const { data } = await supabase
                .from('payment_requests')
                .select('id, amount, payment_method, status, requested_at, transaction_ref')
                .eq('company_id', company.id)
                .eq('status', 'pending')
                .order('requested_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (data) setExistingPending(data);
        } catch (err) {
            console.error('PaymentPage fetchPending:', err.message);
        }
    }, [company, id]);

    useEffect(() => {
        fetchConfig();
        if (id) {
            fetchQuickPayment();
        } else {
            fetchPendingRequest();
        }
    }, [id, fetchConfig, fetchQuickPayment, fetchPendingRequest]);

    const copyToClipboard = async (text, key) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(''), 2000);
            toast.success(isRtl ? 'تم النسخ!' : 'Copied!');
        } catch {
            toast.error(isRtl ? 'فشل النسخ' : 'Copy failed');
        }
    };

    const handleSubmit = async () => {
        if (!transactionRef.trim()) {
            toast.error(isRtl ? 'يرجى إدخال رقم مرجع العملية' : 'Please enter transaction reference');
            return;
        }
        setSubmitting(true);
        try {
            if (id && quickPayment) {
                // Public quick payment flow
                const { error } = await supabase
                    .from('quick_payments')
                    .update({
                        transaction_ref: transactionRef.trim(),
                        payment_method: selectedMethod,
                        status: 'pending'
                    })
                    .eq('id', id);
                if (error) throw error;
                setSubmitted(true);
                toast.success(isRtl ? 'تم إرسال تأكيد الدفع بنجاح!' : 'Payment confirmation submitted!');
            } else {
                // Default Kwader company subscription flow
                if (!company) return;
                const amount = company.subscription_amount || 0;
                const { error } = await supabase
                    .from('payment_requests')
                    .insert({
                        company_id: company.id,
                        amount,
                        payment_method: selectedMethod,
                        transaction_ref: transactionRef.trim(),
                        status: 'pending',
                        subscription_duration_months: 1
                    });
                if (error) throw error;
                setSubmitted(true);
                toast.success(isRtl ? 'تم إرسال طلب الدفع بنجاح!' : 'Payment request submitted!');
            }

            // ─── Automated WhatsApp Notification to Admin ───
            const adminWA = (config.admin_whatsapp || '').replace(/\D/g, '');
            if (adminWA) {
                const method = selectedMethod === 'vodafone_cash' ? 'فودافون كاش' : 'InstaPay';
                const cName = id && quickPayment ? quickPayment.client_name : (company?.name || '');
                const pName = id && quickPayment ? quickPayment.project_name : 'تجديد اشتراك كوادر';
                const pAmount = id && quickPayment ? quickPayment.amount : (company?.subscription_amount || 0);

                const message = `🔔 *طلب دفع إلكتروني جديد*\n\n` +
                                `👤 *العميل:* ${cName}\n` +
                                `📦 *المشروع/الخدمة:* ${pName}\n` +
                                `💰 *المبلغ:* ${pAmount} جنيه\n` +
                                `💳 *طريقة الدفع:* ${method}\n` +
                                `🔖 *رقم العملية:* ${transactionRef.trim()}\n` +
                                `📅 *التاريخ:* ${new Date().toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}`;

                try {
                    await supabase.functions.invoke('auto-reports', {
                        body: {
                            action: 'send_whatsapp',
                            phone: adminWA,
                            message: message
                        }
                    });
                } catch (err) {
                    console.error('Failed to auto-send WhatsApp:', err.message);
                }
            }
        } catch (err) {
            console.error('PaymentPage submit:', err.message);
            toast.error(isRtl ? 'حدث خطأ، يرجى المحاولة مجدداً' : 'Error submitting, please try again');
        } finally {
            setSubmitting(false);
        }
    };

    const buildWhatsAppMsg = (ref) => {
        const method = selectedMethod === 'vodafone_cash'
            ? (isRtl ? 'فودافون كاش' : 'Vodafone Cash')
            : 'InstaPay';
        
        let clientName = '';
        let projectName = '';
        let payAmount = 0;

        if (id && quickPayment) {
            clientName = quickPayment.client_name;
            projectName = quickPayment.project_name;
            payAmount = quickPayment.amount;
        } else {
            clientName = company?.name || '';
            projectName = isRtl ? 'اشتراك منصة كوادر' : 'Kwader Subscription';
            payAmount = company?.subscription_amount || 0;
        }

        const lines = [
            `✅ *${isRtl ? 'تأكيد عملية دفع إلكتروني' : 'Electronic Payment Confirmation'}*`,
            ``,
            `👤 ${isRtl ? 'العميل' : 'Client'}: ${clientName}`,
            `📦 ${isRtl ? 'المشروع/الخدمة' : 'Project/Service'}: ${projectName}`,
            `💰 ${isRtl ? 'المبلغ' : 'Amount'}: ${payAmount} ${isRtl ? 'جنيه' : 'EGP'}`,
            `💳 ${isRtl ? 'طريقة الدفع' : 'Method'}: ${method}`,
            `🔖 ${isRtl ? 'رقم العملية' : 'Ref'}: ${ref || transactionRef}`,
            `📅 ${isRtl ? 'التاريخ' : 'Date'}: ${new Date().toLocaleDateString('ar-EG')}`,
            ``,
            `${isRtl ? 'يرجى مراجعة وتأكيد الدفعة، شكراً.' : 'Please review and confirm the payment, thank you.'}`
        ].join('\n');
        
        const adminWA = (config.admin_whatsapp || '').replace(/\D/g, '');
        return `https://wa.me/${adminWA}?text=${encodeURIComponent(lines)}`;
    };

    const payAmount = id && quickPayment ? quickPayment.amount : (company?.subscription_amount || 0);
    const projectName = id && quickPayment ? quickPayment.project_name : (isRtl ? 'تجديد اشتراك كوادر' : 'Kwader Subscription');
    const clientName = id && quickPayment ? quickPayment.client_name : (company?.name || '');

    // ─── Loading ───────────────────────────────────────────────────────────────
    if (configLoading || quickPaymentLoading) {
        return (
            <div className="pay-page" dir={isRtl ? 'rtl' : 'ltr'} style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="pay-spinner" style={{ width: 40, height: 40, border: '3px solid var(--border-color)', borderTopColor: '#6366f1', margin: '0 auto 16px' }} />
                    <p style={{ color: 'var(--text-muted)' }}>{isRtl ? 'جاري التحميل...' : 'Loading...'}</p>
                </div>
            </div>
        );
    }

    // ─── If quick payment link was already approved/paid ──────────────────────
    if (id && quickPayment && quickPayment.status === 'approved') {
        return (
            <div className="pay-page" dir={isRtl ? 'rtl' : 'ltr'}>
                <motion.div
                    className="pay-success"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.08),rgba(6,182,212,0.05))', borderColor: 'rgba(16,185,129,0.2)' }}
                >
                    <div className="pay-success-icon" style={{ background: 'linear-gradient(135deg,#10b981,#06b6d4)' }}>
                        <CheckCircle size={36} color="white" />
                    </div>
                    <h2 className="pay-success-title">{isRtl ? 'تم الدفع بنجاح! 🎉' : 'Payment Completed! 🎉'}</h2>
                    <p className="pay-success-msg">
                        {isRtl
                            ? `شكراً لك. تم تأكيد استلام مبلغ ${quickPayment.amount} جنيه بنجاح لـ "${quickPayment.project_name}".`
                            : `Thank you. The payment of ${quickPayment.amount} EGP has been successfully confirmed for "${quickPayment.project_name}".`}
                    </p>
                </motion.div>
            </div>
        );
    }

    // ─── Already has pending request ──────────────────────────────────────────
    if (existingPending && !submitted) {
        return (
            <div className="pay-page" dir={isRtl ? 'rtl' : 'ltr'}>
                <motion.div
                    className="pay-success"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.08),rgba(239,68,68,0.05))', borderColor: 'rgba(245,158,11,0.2)' }}
                >
                    <div className="pay-success-icon" style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>
                        <Clock size={36} color="white" />
                    </div>
                    <h2 className="pay-success-title">{isRtl ? 'طلبك قيد المراجعة ⏳' : 'Your Request is Pending ⏳'}</h2>
                    <p className="pay-success-msg">
                        {isRtl
                            ? `لديك طلب دفع بمبلغ ${existingPending.amount} جنيه في انتظار موافقة الإدارة. سيتم التأكيد والتفعيل قريباً.`
                            : `You have a pending payment of ${existingPending.amount} EGP awaiting admin review. It will be confirmed soon.`}
                    </p>
                    <span className="pay-badge-pending">
                        <Clock size={13} />
                        {isRtl ? 'قيد المراجعة' : 'Pending Review'}
                    </span>
                    <div className="pay-note" style={{ marginTop: '1.5rem' }}>
                        {isRtl
                            ? `📌 رقم مرجع العملية: ${existingPending.transaction_ref || '—'}`
                            : `📌 Transaction ref: ${existingPending.transaction_ref || '—'}`}
                    </div>
                    {config.admin_whatsapp && (
                        <a
                            href={buildWhatsAppMsg(existingPending.transaction_ref)}
                            target="_blank"
                            rel="noreferrer"
                            className="pay-btn-whatsapp"
                            style={{ marginTop: '1.5rem', width: 'auto', display: 'inline-flex' }}
                        >
                            <WhatsAppIcon />
                            {isRtl ? 'تذكير الإدارة عبر واتساب' : 'Remind Admin via WhatsApp'}
                        </a>
                    )}
                </motion.div>
            </div>
        );
    }

    // ─── Success Screen ────────────────────────────────────────────────────────
    if (submitted) {
        return (
            <div className="pay-page" dir={isRtl ? 'rtl' : 'ltr'}>
                <AnimatePresence>
                    <motion.div
                        className="pay-success"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                    >
                        <div className="pay-success-icon">
                            <CheckCircle size={36} color="white" />
                        </div>
                        <h2 className="pay-success-title">
                            {isRtl ? 'تم إرسال طلب التأكيد! ✅' : 'Confirmation Request Sent! ✅'}
                        </h2>
                        <p className="pay-success-msg">
                            {isRtl
                                ? 'تم تسجيل بيانات عملية الدفع. يرجى الضغط على زر واتساب لإرسال رسالة التأكيد الفورية للإدارة لتسريع العملية.'
                                : 'Your payment details are registered. Please press the WhatsApp button to send a confirmation to the admin to speed up validation.'}
                        </p>

                        {config.admin_whatsapp && (
                            <a
                                href={buildWhatsAppMsg(transactionRef)}
                                target="_blank"
                                rel="noreferrer"
                                className="pay-btn-whatsapp"
                                style={{ display: 'inline-flex' }}
                            >
                                <WhatsAppIcon />
                                {isRtl ? 'أرسل تأكيداً عبر واتساب الآن' : 'Send WhatsApp Confirmation Now'}
                                <ChevronRight size={18} />
                            </a>
                        )}

                        <div className="pay-note" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                            <AlertCircle size={14} style={{ display: 'inline', marginLeft: 4, verticalAlign: 'middle' }} />
                            {isRtl
                                ? 'سيتم تأكيد معاملتك وتفعيل حسابك خلال دقائق بعد موافقة الإدارة.'
                                : 'Your transaction will be validated and your account activated shortly after admin approval.'}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        );
    }

    // ─── Main Payment Page ─────────────────────────────────────────────────────
    return (
        <div className="pay-page" dir={isRtl ? 'rtl' : 'ltr'}>
            {/* Header */}
            <motion.div
                className="pay-header"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="pay-header-icon">
                    <CreditCard size={28} color="white" />
                </div>
                <h1 className="pay-header-title">
                    {isRtl ? 'بوابة الدفع الإلكتروني السريع' : 'Quick Payment Portal'}
                </h1>
                <p className="pay-header-subtitle">
                    {isRtl ? 'ادفع بسهولة وأمان عبر فودافون كاش أو انستاباي' : 'Pay easily and securely via Vodafone Cash or InstaPay'}
                </p>
            </motion.div>

            {/* Plan/Invoice Card */}
            <motion.div
                className="pay-plan-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
            >
                <div className="pay-plan-info">
                    <h3>{isRtl ? 'تفاصيل الفاتورة / الخدمة' : 'Invoice / Service Details'}</h3>
                    <p className="pay-plan-name">{projectName}</p>
                    {clientName && (
                        <div className="pay-plan-duration" style={{ background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', borderColor: 'rgba(99,102,241,0.2)' }}>
                            {isRtl ? `العميل: ${clientName}` : `Client: ${clientName}`}
                        </div>
                    )}
                </div>
                <div className="pay-plan-amount">
                    <div>
                        <span className="pay-amount-value">{Number(payAmount).toLocaleString('ar-EG')}</span>
                        <br />
                        <span className="pay-amount-currency">{isRtl ? 'جنيه مصري' : 'EGP'}</span>
                    </div>
                </div>
            </motion.div>

            {/* Steps */}
            <motion.div
                className="pay-steps"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
            >
                {[
                    isRtl ? 'اختر الطريقة' : 'Choose Method',
                    isRtl ? 'حوّل المبلغ' : 'Transfer Amount',
                    isRtl ? 'أدخل المرجع' : 'Enter Ref',
                    isRtl ? 'تأكيد واتساب' : 'WhatsApp Confirm'
                ].map((label, i) => (
                    <div className="pay-step" key={i}>
                        <div className="pay-step-num">{i + 1}</div>
                        <span className="pay-step-label">{label}</span>
                    </div>
                ))}
            </motion.div>

            {/* Payment Methods */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
            >
                <p className="pay-methods-title">
                    {isRtl ? '1. اختر طريقة الدفع وحوّل المبلغ' : '1. Choose payment method and transfer the amount'}
                </p>
                <div className="pay-methods-grid" style={{ marginTop: '1rem' }}>
                    {/* Vodafone Cash */}
                    <div
                        className={`pay-method-card vodafone ${selectedMethod === 'vodafone_cash' ? 'selected' : ''}`}
                        onClick={() => setSelectedMethod('vodafone_cash')}
                        style={selectedMethod === 'vodafone_cash' ? { border: '2px solid rgba(239,68,68,0.5)', boxShadow: '0 0 0 4px rgba(239,68,68,0.08)' } : {}}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                            <div className="pay-method-logo">📱</div>
                            {selectedMethod === 'vodafone_cash' && (
                                <div style={{ background: 'rgba(239,68,68,0.15)', borderRadius: '50%', padding: 4 }}>
                                    <Check size={16} color="#ef4444" />
                                </div>
                            )}
                        </div>
                        <p className="pay-method-name">Vodafone Cash</p>
                        <p className="pay-method-desc">{isRtl ? 'تحويل فوري من أي محفظة فودافون' : 'Instant transfer from any Vodafone wallet'}</p>

                        {config.vodafone_cash_number ? (
                            <div className="pay-method-account">
                                <p className="pay-account-label">{isRtl ? 'رقم التحويل' : 'Transfer Number'}</p>
                                <div className="pay-account-row">
                                    <span className="pay-account-number">{config.vodafone_cash_number}</span>
                                    <button
                                        className={`pay-copy-btn ${copiedKey === 'vf' ? 'copied' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); copyToClipboard(config.vodafone_cash_number, 'vf'); }}
                                    >
                                        {copiedKey === 'vf' ? <Check size={16} /> : <Copy size={16} />}
                                    </button>
                                </div>
                                {config.vodafone_cash_name && (
                                    <p className="pay-account-name">
                                        <Wallet size={12} style={{ display: 'inline', marginLeft: 4 }} />
                                        {config.vodafone_cash_name}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="pay-method-account" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                {isRtl ? 'لم يتم إعداد الحساب بعد' : 'Account not configured yet'}
                            </div>
                        )}
                    </div>

                    {/* InstaPay */}
                    <div
                        className={`pay-method-card instapay ${selectedMethod === 'instapay' ? 'selected' : ''}`}
                        onClick={() => setSelectedMethod('instapay')}
                        style={selectedMethod === 'instapay' ? { border: '2px solid rgba(99,102,241,0.5)', boxShadow: '0 0 0 4px rgba(99,102,241,0.08)' } : {}}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
                            <div className="pay-method-logo">⚡</div>
                            {selectedMethod === 'instapay' && (
                                <div style={{ background: 'rgba(99,102,241,0.15)', borderRadius: '50%', padding: 4 }}>
                                    <Check size={16} color="#6366f1" />
                                </div>
                            )}
                        </div>
                        <p className="pay-method-name">InstaPay</p>
                        <p className="pay-method-desc">{isRtl ? 'تحويل فوري بين البنوك المصرية' : 'Instant transfer between Egyptian banks'}</p>

                        {config.instapay_number ? (
                            <div className="pay-method-account">
                                <p className="pay-account-label">{isRtl ? 'رقم/حساب التحويل' : 'Transfer Account'}</p>
                                <div className="pay-account-row">
                                    <span className="pay-account-number">{config.instapay_number}</span>
                                    <button
                                        className={`pay-copy-btn ${copiedKey === 'ip' ? 'copied' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); copyToClipboard(config.instapay_number, 'ip'); }}
                                    >
                                        {copiedKey === 'ip' ? <Check size={16} /> : <Copy size={16} />}
                                    </button>
                                </div>
                                {config.instapay_name && (
                                    <p className="pay-account-name">
                                        <Phone size={12} style={{ display: 'inline', marginLeft: 4 }} />
                                        {config.instapay_name}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="pay-method-account" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                {isRtl ? 'لم يتم إعداد الحساب بعد' : 'Account not configured yet'}
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Reference Input */}
            <motion.div
                className="pay-ref-section"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <p className="pay-ref-title">
                    {isRtl ? '2. أدخل رقم مرجع العملية' : '2. Enter Transaction Reference Number'}
                </p>
                <p className="pay-ref-desc">
                    {isRtl
                        ? 'بعد إتمام التحويل، أدخل رقم مرجع العملية (Transaction ID) الظاهر في رسالة التأكيد.'
                        : 'After completing the transfer, enter the Transaction ID shown in your confirmation message.'}
                </p>
                <div className="pay-ref-row">
                    <select
                        className="pay-ref-method-select"
                        value={selectedMethod}
                        onChange={(e) => setSelectedMethod(e.target.value)}
                    >
                        <option value="vodafone_cash">Vodafone Cash</option>
                        <option value="instapay">InstaPay</option>
                    </select>
                    <div className="pay-ref-input-wrap">
                        <input
                            className="pay-ref-input"
                            type="text"
                            placeholder={isRtl ? 'مثال: 1234567890' : 'e.g. 1234567890'}
                            value={transactionRef}
                            onChange={(e) => setTransactionRef(e.target.value)}
                            dir="ltr"
                        />
                    </div>
                </div>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
                className="pay-actions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
            >
                <button
                    className="pay-btn-confirm"
                    onClick={handleSubmit}
                    disabled={submitting || !transactionRef.trim()}
                >
                    {submitting ? (
                        <>
                            <div className="pay-spinner" />
                            {isRtl ? 'جاري الإرسال...' : 'Submitting...'}
                        </>
                    ) : (
                        <>
                            <CheckCircle size={20} />
                            {isRtl ? 'تأكيد الدفع وإرسال الطلب' : 'Confirm Payment & Submit'}
                        </>
                    )}
                </button>

                {config.admin_whatsapp && (
                    <>
                        <div className="pay-separator">{isRtl ? 'أو' : 'OR'}</div>
                        <a
                            href={buildWhatsAppMsg(transactionRef)}
                            target="_blank"
                            rel="noreferrer"
                            className="pay-btn-whatsapp"
                            onClick={() => {
                                if (transactionRef.trim()) handleSubmit();
                            }}
                        >
                            <WhatsAppIcon />
                            {isRtl ? 'أرسل تأكيد الدفع عبر واتساب' : 'Send Payment Confirmation via WhatsApp'}
                            <MessageCircle size={18} />
                        </a>
                    </>
                )}

                <div className="pay-note">
                    <AlertCircle size={14} style={{ display: 'inline', marginLeft: 4, verticalAlign: 'middle' }} />
                    {isRtl
                        ? 'بعد إرسال طلبك، ستتلقى تأكيداً من الإدارة خلال دقائق وسيتم تفعيل الفاتورة تلقائياً.'
                        : 'After submitting, you\'ll receive confirmation from the admin within minutes and your invoice will be activated automatically.'}
                </div>
            </motion.div>
        </div>
    );
}
