import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plane, Banknote, Clock, FileText, CalendarDays, Wallet, ArrowRightLeft, Info, HelpCircle } from 'lucide-react';
import { useEmployeeAuth } from '../context/EmployeeAuthContext';
import { supabase } from '../supabaseClient';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';

const MobileRequests = () => {
    const { employee } = useEmployeeAuth();
    const { t, language, formatCurrency } = useLocale();
    const [activeTab, setActiveTab] = useState('leaves'); // 'leaves' or 'loans'
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Leave Form State
    const [leaveType, setLeaveType] = useState('annual');
    const [leaveStart, setLeaveStart] = useState('');
    const [leaveEnd, setLeaveEnd] = useState('');

    // Loan Form State
    const [loanAmount, setLoanAmount] = useState('');
    const [loanMonths, setLoanMonths] = useState('1');

    // Request History State
    const [requestsList, setRequestsList] = useState({ leaves: [], loans: [] });
    const [loadingRequests, setLoadingRequests] = useState(true);

    const fetchRequests = useCallback(async () => {
        if (!employee) return;
        try {
            setLoadingRequests(true);
            const { data, error } = await supabase.rpc('get_employee_requests', {
                p_employee_id: employee.id,
                p_pin: employee.pin
            });
            if (error) throw error;
            if (data && data.success) {
                setRequestsList({
                    leaves: data.leaves || [],
                    loans: data.loans || []
                });
            }
        } catch (err) {
            console.error('[MobileRequests] fetchRequests:', err);
        } finally {
            setLoadingRequests(false);
        }
    }, [employee]);

    useEffect(() => {
        if (employee) {
            fetchRequests();
        }
    }, [employee, fetchRequests]);

    const handleLeaveSubmit = async (e) => {
        e.preventDefault();
        if (!leaveStart || !leaveEnd) return;
        
        setIsSubmitting(true);
        try {
            const { error } = await supabase.rpc('submit_leave_request', {
                p_employee_id: employee.id,
                p_pin: employee.pin,
                p_leave_type: leaveType,
                p_start_date: leaveStart,
                p_end_date: leaveEnd
            });

            if (error) throw error;
            toast.success(t.empLeaveSubmittedSuccess || 'Leave request submitted for review');
            setLeaveStart(''); setLeaveEnd('');
            fetchRequests(); // Refresh requests history
        } catch (err) {
            toast.error(err.message || t.errorGeneric || 'An error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLoanSubmit = async (e) => {
        e.preventDefault();
        const amount = Number(loanAmount);
        const isWeekly = employee?.company_settings?.payroll_mode === 'weekly_advance';
        const months = isWeekly ? 1 : Number(loanMonths);
        if (!amount || amount <= 0) return;
        
        setIsSubmitting(true);
        try {
            const { error } = await supabase.rpc('submit_loan_request', {
                p_employee_id: employee.id,
                p_pin: employee.pin,
                p_amount: amount,
                p_months: months
            });

            if (error) throw error;
            toast.success(t.empLoanSubmittedSuccess || 'Loan request submitted for review');
            setLoanAmount(''); setLoanMonths('1');
            fetchRequests(); // Refresh requests history
        } catch (err) {
            toast.error(err.message || t.errorGeneric || 'An error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusBadge = (status) => {
        const statusMap = {
            pending: { ar: 'قيد الانتظار', en: 'Pending', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
            approved: { ar: 'مقبول', en: 'Approved', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
            active: { ar: 'نشط', en: 'Active', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
            rejected: { ar: 'مرفوض', en: 'Rejected', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
            paid: { ar: 'مسدد', en: 'Paid', bg: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
            cancelled: { ar: 'ملغي', en: 'Cancelled', bg: 'bg-slate-500/10 text-slate-400 border-slate-500/20' }
        };
        
        const cfg = statusMap[status] || statusMap.pending;
        const text = language === 'ar' ? cfg.ar : cfg.en;
        return (
            <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${cfg.bg} uppercase tracking-wider`}>
                {text}
            </span>
        );
    };

    const isRtl = language === 'ar';

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="space-y-5 pb-8"
            style={{ textAlign: isRtl ? 'right' : 'left' }}
            dir={isRtl ? 'rtl' : 'ltr'}
        >
            <h2 className="text-2xl font-black text-white tracking-tight">{t.empMyRequestsTitle}</h2>

            {/* Sliding Pill Tabs (M3 Styled Navigation) */}
            <div className="flex bg-slate-900/60 p-1.5 rounded-2xl relative w-full mb-6">
                <div className="flex w-full relative z-10">
                    <button 
                        onClick={() => setActiveTab('leaves')}
                        className={`flex-1 py-2.5 text-center text-xs font-bold transition-all rounded-xl ${activeTab === 'leaves' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        {t.empTabLeave}
                    </button>
                    <button 
                        onClick={() => setActiveTab('loans')}
                        className={`flex-1 py-2.5 text-center text-xs font-bold transition-all rounded-xl ${activeTab === 'loans' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        {t.empTabLoan}
                    </button>
                </div>
                {/* Sliding Accent Background */}
                <motion.div 
                    layoutId="activeRequestTab"
                    className="absolute bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl h-[calc(100%-12px)] top-1.5"
                    animate={{
                        left: activeTab === 'leaves' ? '6px' : '50%',
                        right: activeTab === 'leaves' ? '50%' : '6px',
                        width: 'calc(50% - 6px)'
                    }}
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                />
            </div>

            {/* Main Interactive Form Card */}
            <div className="bg-slate-900/40 p-5 rounded-3xl border border-slate-800/40 shadow-xl">
                <AnimatePresence mode="wait">
                    {activeTab === 'leaves' ? (
                        <motion.form 
                            key="leave-form"
                            initial={{ opacity: 0, x: isRtl ? 10 : -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: isRtl ? -10 : 10 }}
                            transition={{ duration: 0.15 }}
                            onSubmit={handleLeaveSubmit} 
                            className="space-y-4"
                        >
                            <div className="flex items-center gap-2.5 text-indigo-400 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                                    <Plane size={16} />
                                </div>
                                <h3 className="font-bold text-sm text-white">{t.empNewLeaveRequest}</h3>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-400">{t.leaveTypeLabel}</label>
                                <select 
                                    value={leaveType} 
                                    onChange={(e) => setLeaveType(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                                >
                                    <option value="annual">{t.leaveTypeAnnual}</option>
                                    <option value="sick">{t.leaveTypeSick}</option>
                                    <option value="unpaid">{t.leaveTypeUnpaid}</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3.5">
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-slate-400">{t.fromDateLabel}</label>
                                    <input 
                                        type="date" 
                                        value={leaveStart}
                                        onChange={(e) => setLeaveStart(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-slate-400">{t.toDateLabel}</label>
                                    <input 
                                        type="date" 
                                        value={leaveEnd}
                                        onChange={(e) => setLeaveEnd(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 active:scale-98"
                            >
                                <FileText size={16} />
                                <span className="text-xs">{isSubmitting ? t.sending : t.empSubmitRequestBtn}</span>
                            </button>
                        </motion.form>
                    ) : (
                        <motion.form 
                            key="loan-form"
                            initial={{ opacity: 0, x: isRtl ? -10 : 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: isRtl ? 10 : -10 }}
                            transition={{ duration: 0.15 }}
                            onSubmit={handleLoanSubmit} 
                            className="space-y-4"
                        >
                            <div className="flex items-center gap-2.5 text-emerald-400 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                    <Banknote size={16} />
                                </div>
                                <h3 className="font-bold text-sm text-white">{t.empNewLoanRequest}</h3>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-400">{t.empLoanAmountLabel}</label>
                                <input 
                                    type="number" 
                                    value={loanAmount}
                                    onChange={(e) => setLoanAmount(e.target.value)}
                                    placeholder={t.empLoanAmountPlaceholder}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all"
                                    required
                                />
                            </div>

                            {employee?.company_settings?.payroll_mode === 'weekly_advance' ? (
                                <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 text-xs text-amber-400 leading-relaxed flex gap-2">
                                    <Info size={16} className="shrink-0 mt-0.5" />
                                    <p className="font-semibold">
                                        {language === 'ar' 
                                            ? "سيتم خصم مبلغ السلفة بالكامل من تسوية راتبك الأسبوعية القادمة مباشرة."
                                            : "The loan amount will be deducted in full from your next weekly salary settlement."}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-slate-400">{t.empRepaymentPeriodLabel}</label>
                                    <select 
                                        value={loanMonths} 
                                        onChange={(e) => setLoanMonths(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 outline-none transition-all"
                                    >
                                        <option value="1">{t.empOneMonth}</option>
                                        <option value="2">{t.empTwoMonths}</option>
                                        <option value="3">{t.empThreeMonths}</option>
                                        <option value="6">{t.empSixMonths}</option>
                                    </select>
                                </div>
                            )}

                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 active:scale-98"
                            >
                                <FileText size={16} />
                                <span className="text-xs">{isSubmitting ? t.sending : t.empSubmitRequestBtn}</span>
                            </button>
                        </motion.form>
                    )}
                </AnimatePresence>
            </div>

            {/* Requests History List (M3 Dense List Component) */}
            <div className="bg-slate-900/40 p-5 rounded-3xl border border-slate-800/40 shadow-xl">
                <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
                    <Clock size={16} className="text-indigo-400" />
                    {language === 'ar' ? 'سجل الطلبات' : 'Requests History'}
                </h3>
                
                <AnimatePresence mode="wait">
                    {loadingRequests ? (
                        <motion.div 
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center py-6 text-slate-400 gap-2"
                        >
                            <div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                            <span className="text-[10px] font-bold tracking-wider">{language === 'ar' ? 'جاري تحميل الطلبات...' : 'Loading requests...'}</span>
                        </motion.div>
                    ) : activeTab === 'leaves' ? (
                        <motion.div 
                            key="leaves-list"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="space-y-3"
                        >
                            {requestsList.leaves.length > 0 ? (
                                requestsList.leaves.map((item) => (
                                    <div 
                                        key={item.id} 
                                        className="p-3.5 bg-slate-950/40 border border-slate-900/60 rounded-2xl flex justify-between items-center transition-all hover:bg-slate-950/60"
                                    >
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-black text-white">
                                                {item.leave_type === 'annual' ? t.leaveTypeAnnual 
                                                    : item.leave_type === 'sick' ? t.leaveTypeSick 
                                                    : item.leave_type === 'unpaid' ? t.leaveTypeUnpaid 
                                                    : t.leaveTypeEmergency || item.leave_type}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1.5">
                                                <CalendarDays size={12} className="text-slate-600" />
                                                <span className="font-mono text-slate-400">{item.start_date}</span>
                                                <ArrowRightLeft size={10} className="text-slate-600" />
                                                <span className="font-mono text-slate-400">{item.end_date}</span>
                                            </span>
                                        </div>
                                        <div>
                                            {getStatusBadge(item.status)}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-6 text-slate-500 text-xs font-semibold">
                                    {language === 'ar' ? 'لا توجد طلبات إجازة سابقة' : 'No previous leave requests'}
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="loans-list"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="space-y-3"
                        >
                            {requestsList.loans.length > 0 ? (
                                requestsList.loans.map((item) => (
                                    <div 
                                        key={item.id} 
                                        className="p-3.5 bg-slate-950/40 border border-slate-900/60 rounded-2xl flex justify-between items-center transition-all hover:bg-slate-950/60"
                                    >
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-black text-white privacy-blur">
                                                {formatCurrency(item.total_amount)}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1.5">
                                                <Wallet size={12} className="text-slate-600" />
                                                <span className="text-slate-400">
                                                    {item.repayment_months} {language === 'ar' ? 'أشهر' : 'months'}
                                                </span>
                                                <span className="text-slate-600">·</span>
                                                <span className="text-slate-500 font-medium">
                                                    {language === 'ar' ? 'قسط:' : 'Inst:'} <span className="privacy-blur font-mono text-slate-400">{formatCurrency(item.monthly_installment)}</span>
                                                </span>
                                            </span>
                                        </div>
                                        <div>
                                            {getStatusBadge(item.status)}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-6 text-slate-500 text-xs font-semibold">
                                    {language === 'ar' ? 'لا توجد طلبات سلف سابقة' : 'No previous loan requests'}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            
            <div className="text-center text-[10px] text-slate-500 mt-6 flex items-center justify-center gap-1">
                <HelpCircle size={13} className="text-slate-600" />
                <span>{t.empRequestReviewNotice}</span>
            </div>
        </motion.div>
    );
};

export default MobileRequests;
