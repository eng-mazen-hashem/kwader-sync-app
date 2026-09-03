import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Clock, CalendarDays, Wallet, AlertCircle, 
    Bell, Trash2, 
    TrendingUp, X, Fingerprint, Navigation, 
    MapPin, CheckCircle2, ChevronRight, Info
} from 'lucide-react';
import { useEmployeeAuth } from '../context/EmployeeAuthContext';
import { supabase } from '../supabaseClient';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';

const MobileDashboard = () => {
    const { employee } = useEmployeeAuth();
    const { formatCurrency, t, language, formatTime, formatDateTime } = useLocale();
    const [loading, setLoading] = useState(true);
    
    // Bottom Sheet states
    const [isSalarySheetOpen, setIsSalarySheetOpen] = useState(false);
    const [isPunchSheetOpen, setIsPunchSheetOpen] = useState(false);
    
    // Geolocation / Punch states
    const [location, setLocation] = useState(null);
    const [loadingLocation, setLoadingLocation] = useState(false);
    const [isSubmittingPunch, setIsSubmittingPunch] = useState(false);
    const [punchErrorMsg, setPunchErrorMsg] = useState('');
    const [punchSuccess, setPunchSuccess] = useState(null);

    // Scroll state for collapsible header
    const [scrolled, setScrolled] = useState(false);

    const [stats, setStats] = useState({
        todayPunch: null,
        totalHours: 0,
        upcomingShift: null,
        expectedSalary: {
            net: 0,
            base: 0,
            housing: 0,
            transport: 0,
            absenceDeduction: 0,
            absentDays: 0,
            unpaidLeaveDeduction: 0,
            unpaidLeaveDays: 0,
            loanInstallments: 0,
            totalAllowances: 0,
            totalDeductions: 0,
        },
        recentNotifications: []
    });

    const fetchDashboardData = useCallback(async () => {
        if (!employee) return;
        try {
            // Call secure RPC to load stats bypassing RLS restrictions
            const { data: statsData, error: statsError } = await supabase.rpc('get_employee_dashboard_stats', {
                p_employee_id: employee.id,
                p_pin: employee.pin
            });

            if (statsError) throw statsError;

            // Extract values
            const todayPunch = statsData.today_punch ? {
                timestamp: statsData.today_punch.timestamp,
                punch_type: statsData.today_punch.status === '0' ? 'check_in' : 'check_out'
            } : null;

            const baseSalary = Number(employee.base_salary || 0);
            const companySettings = employee.company_settings || {};
            const defaultHousing = Number(companySettings.housing_allowance || 0);
            const defaultTransport = Number(companySettings.transport_allowance || 0);

            const housing = employee.housing_allowance != null && Number(employee.housing_allowance) !== 0
                ? Number(employee.housing_allowance) 
                : defaultHousing;
            const transport = employee.transport_allowance != null && Number(employee.transport_allowance) !== 0
                ? Number(employee.transport_allowance) 
                : defaultTransport;

            const shift = statsData.shift;
            const workDaysNames = shift?.work_days || ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
            const shiftStartTime = shift?.start_time || '09:00';
            const shiftEndTime = shift?.end_time || '17:00';

            // Setup date variables
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();

            const firstDay = new Date(year, month, 1);
            const today = new Date(year, month, now.getDate());
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            const parseLocalDate = (dateStr) => {
                if (!dateStr) return null;
                const parts = dateStr.split('T')[0].split('-');
                if (parts.length !== 3) return new Date(dateStr);
                const [y, m, d] = parts.map(Number);
                return new Date(y, m - 1, d);
            };

            // Mapping Arabic weekday name to JS day number
            const AR_DAY_TO_JS = {
                'الأحد': 0, 'الاثنين': 1, 'الإثنين': 1,
                'الثلاثاء': 2, 'الأربعاء': 3, 'الخميس': 4,
                'الجمعة': 5, 'السبت': 6
            };
            const workDayNums = new Set(workDaysNames.map(d => AR_DAY_TO_JS[d] ?? -1).filter(d => d >= 0));

            // Calculate Scheduled Days So Far (1st to yesterday)
            let scheduledDaysSoFar = 0;
            const tempDate = new Date(firstDay);
            while (tempDate <= yesterday) {
                if (workDayNums.has(tempDate.getDay())) {
                    scheduledDaysSoFar++;
                }
                tempDate.setDate(tempDate.getDate() + 1);
            }

            const processedAtt = statsData.processed_attendance || [];
            // Only count past days for absence calculation
            const presentDays = processedAtt.filter(a => {
                const attDate = parseLocalDate(a.date);
                return attDate && attDate <= yesterday && ['present', 'late', 'early_leave', 'missing_checkout', 'missing_checkin'].includes(a.status);
            }).length;

            const actualWorkedHours = processedAtt.reduce((sum, a) => sum + Number(a.work_hours || 0), 0);

            const leavesData = statsData.leave_requests || [];
            let unpaidLeaveDays = 0;
            let paidLeaveDays = 0;

            leavesData.forEach(lv => {
                const start = new Date(Math.max(firstDay, parseLocalDate(lv.start_date)));
                const end = new Date(Math.min(yesterday, parseLocalDate(lv.end_date)));
                const curDate = new Date(start);
                while (curDate <= end) {
                    if (workDayNums.has(curDate.getDay())) {
                        if (lv.leave_type === 'unpaid') {
                            unpaidLeaveDays++;
                        } else if (['annual', 'sick', 'emergency'].includes(lv.leave_type)) {
                            paidLeaveDays++;
                        }
                    }
                    curDate.setDate(curDate.getDate() + 1);
                }
            });

            // Calculate absent days
            const totalPaidDays = presentDays + paidLeaveDays;
            const absentDays = Math.max(0, scheduledDaysSoFar - totalPaidDays - unpaidLeaveDays);

            // Expected salary calculations
            const absenceFormula = companySettings.absence_deduction_formula || 'daily_rate';
            let absenceMultiplier = 1;
            if (absenceFormula === 'double_daily') {
                absenceMultiplier = 2;
            }
            const dailyWage = baseSalary / 30;
            const absenceDeduction = dailyWage * absentDays * absenceMultiplier;
            const unpaidLeaveDeduction = dailyWage * unpaidLeaveDays;

            const loansData = statsData.employee_loans || [];
            const loanInstallments = loansData.reduce((sum, l) => {
                const isShortTerm = Number(l.repayment_months || 0) <= 1 || companySettings.payroll_mode === 'weekly_advance';
                const deductAmt = isShortTerm 
                    ? Number(l.remaining_amount || 0)
                    : Math.min(Number(l.monthly_installment || 0), Number(l.remaining_amount || 0));
                return sum + deductAmt;
            }, 0);

            // Expected net salary
            const totalAllowances = housing + transport;
            const totalDeductions = absenceDeduction + unpaidLeaveDeduction + loanInstallments;
            let expectedNet = baseSalary + totalAllowances - totalDeductions;
            if (expectedNet < 0) expectedNet = 0;

            // Fetch last 3 notifications
            const { data: notifs } = await supabase
                .from('employee_notifications')
                .select('*')
                .eq('employee_id', employee.id)
                .order('created_at', { ascending: false })
                .limit(3);

            setStats({
                todayPunch: todayPunch,
                totalHours: Math.round(actualWorkedHours * 10) / 10,
                upcomingShift: shift 
                    ? `${shiftStartTime} - ${shiftEndTime} (${workDaysNames.slice(0, 3).join('، ')}${workDaysNames.length > 3 ? '...' : ''})`
                    : '09:00 - 17:00',
                expectedSalary: {
                    net: Math.round(expectedNet * 100) / 100,
                    base: baseSalary,
                    housing,
                    transport,
                    absenceDeduction: Math.round(absenceDeduction * 100) / 100,
                    absentDays,
                    unpaidLeaveDeduction: Math.round(unpaidLeaveDeduction * 100) / 100,
                    unpaidLeaveDays,
                    loanInstallments: Math.round(loanInstallments * 100) / 100,
                    totalAllowances,
                    totalDeductions: Math.round(totalDeductions * 100) / 100,
                },
                recentNotifications: notifs || []
            });

        } catch (err) {
            console.error('[MobileDashboard] fetchDashboardData:', err);
        } finally {
            setLoading(false);
        }
    }, [employee]);

    useEffect(() => {
        if (!employee) return;
        
        fetchDashboardData();

        const channel = supabase
            .channel(`dashboard_notifs_${employee.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'employee_notifications', filter: `employee_id=eq.${employee.id}` },
                () => {
                    fetchDashboardData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [employee, fetchDashboardData]);

    // Handle scroll listener on layout container to collapse greetings header
    useEffect(() => {
        const mainEl = document.querySelector('.emp-portal-main');
        if (!mainEl) return;
        const handleScroll = () => {
            setScrolled(mainEl.scrollTop > 15);
        };
        mainEl.addEventListener('scroll', handleScroll);
        handleScroll(); // Trigger initially to catch any pre-scrolled state
        return () => mainEl.removeEventListener('scroll', handleScroll);
    }, [loading]);

    // Geolocation handlers for FAB
    const getLocation = () => {
        setLoadingLocation(true);
        setPunchErrorMsg('');
        
        if (!navigator.geolocation) {
            setPunchErrorMsg(t.errGeolocationNotSupported || 'متصفحك لا يدعم تحديد الموقع.');
            setLoadingLocation(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
                setLoadingLocation(false);
            },
            (error) => {
                console.error("Error getting location:", error);
                if (error.code === 1) setPunchErrorMsg(t.errGeolocationDenied || 'يرجى السماح بالوصول لموقعك الجغرافي.');
                else setPunchErrorMsg(t.errGeolocationFailed || 'تعذر تحديد موقعك الحالي.');
                setLoadingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const handlePunch = async () => {
        if (!location) {
            toast.error(t.errCannotDetermineLocation || 'لا يمكن تحديد الموقع');
            return;
        }

        setIsSubmittingPunch(true);
        try {
            const { data, error } = await supabase.rpc('submit_gps_punch', {
                p_employee_id: employee.id,
                p_pin: employee.pin,
                p_lat: location.lat,
                p_lng: location.lng
            });

            if (error) throw error;

            if (data && data.success) {
                const punchTypeLabel = data.punch_type === 'check_in' 
                    ? (t.empCheckIn || 'حضور') 
                    : (t.empCheckOut || 'انصراف');
                setPunchSuccess({
                    type: punchTypeLabel,
                    time: formatTime(data.timestamp)
                });
                toast.success(language === 'ar' 
                    ? `تم تسجيل ال${punchTypeLabel} بنجاح!` 
                    : `Punch ${data.punch_type === 'check_in' ? 'in' : 'out'} registered successfully!`);
                
                // Refresh dashboard variables
                await fetchDashboardData();
            }
        } catch (err) {
            console.error('Punch error:', err);
            toast.error(err.message || (t.errGeneric || 'حدث خطأ أثناء تسجيل البصمة.'));
        } finally {
            setIsSubmittingPunch(false);
        }
    };

    const handleClosePunchSheet = () => {
        setIsPunchSheetOpen(false);
        setPunchSuccess(null);
        setLocation(null);
        setPunchErrorMsg('');
    };

    const handleMarkAsRead = async (id) => {
        try {
            const { error } = await supabase
                .from('employee_notifications')
                .update({ read_at: new Date().toISOString() })
                .eq('id', id);
            if (error) throw error;
            setStats(prev => ({
                ...prev,
                recentNotifications: prev.recentNotifications.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
            }));
        } catch (err) {
            console.error('[MobileDashboard] handleMarkAsRead:', err);
        }
    };

    const handleDeleteNotification = async (id) => {
        try {
            const { error } = await supabase
                .from('employee_notifications')
                .delete()
                .eq('id', id);
            if (error) throw error;
            setStats(prev => ({
                ...prev,
                recentNotifications: prev.recentNotifications.filter(n => n.id !== id)
            }));
            toast.success(t.empNotificationDeleted || 'Notification deleted');
        } catch (err) {
            console.error('[MobileDashboard] handleDeleteNotification:', err);
        }
    };

    const isRtl = language === 'ar';

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 gap-3">
                <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                <span className="text-sm">{t.empLoadingDashboard || 'Loading dashboard...'}</span>
            </div>
        );
    }

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 pb-12 relative"
            style={{ textAlign: isRtl ? 'right' : 'left' }}
            dir={isRtl ? 'rtl' : 'ltr'}
        >
            {/* Sliver-Style App Bar Header */}
            <AnimatePresence>
                {!scrolled && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="mb-6 overflow-hidden"
                    >
                        <h2 className="text-2xl font-black mb-0.5 tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                            {t.empWelcomeMsg?.replace('{name}', employee?.name?.split(' ')[0]) || `Welcome, ${employee?.name?.split(' ')[0]} 👋`}
                        </h2>
                        <p className="text-slate-400 text-xs font-medium tracking-wide uppercase opacity-75">{employee?.company_name}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Quick Stats Grid - High Density M3 Cards (No Borders, Elevated/Filled Style) */}
            <div className="grid grid-cols-2 gap-4 mb-5">
                {/* Working Hours Card */}
                <div className="bg-slate-900/40 p-4 rounded-2xl flex flex-col gap-3 transition-colors duration-200">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                        <Clock size={18} />
                    </div>
                    <div className="space-y-0.5">
                        <span className="text-xs text-slate-400 font-medium">{t.empMonthlyWorkHours || 'Working Hours (Month)'}</span>
                        <h3 className="text-xl font-bold text-white leading-none">
                            {stats.totalHours} <span className="text-xs font-normal text-slate-500">{t.hoursWord || 'hour'}</span>
                        </h3>
                    </div>
                </div>

                {/* Expected Salary Card - Interactive to trigger Bottom Sheet */}
                <button 
                    onClick={() => setIsSalarySheetOpen(true)}
                    className="bg-slate-900/40 p-4 rounded-2xl flex flex-col gap-3 text-start hover:bg-slate-900/60 transition-all duration-200 active:scale-98 relative group"
                >
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                        <Wallet size={18} />
                    </div>
                    <div className="space-y-0.5 pr-4 pl-4">
                        <span className="text-xs text-slate-400 font-medium block">{t.empExpectedNetSalary || 'Expected Net Salary'}</span>
                        <h3 className="text-xl font-bold text-emerald-400 leading-none privacy-blur">
                            {formatCurrency(stats.expectedSalary?.net)}
                        </h3>
                    </div>
                    <ChevronRight size={16} className={`absolute bottom-4 ${isRtl ? 'left-4 rotate-180' : 'right-4'} text-slate-500 group-hover:text-white transition-colors`} />
                </button>
            </div>

            {/* Today's Status M3 Card - Direct entry to check in */}
            <div 
                onClick={() => employee?.allow_gps_punch && setIsPunchSheetOpen(true)}
                className={`bg-slate-900/40 p-4 rounded-2xl transition-all duration-200 ${employee?.allow_gps_punch ? 'hover:bg-slate-900/60 cursor-pointer active:scale-99' : ''}`}
                style={{ borderLeft: isRtl ? 'none' : '4px solid #6366f1', borderRight: isRtl ? '4px solid #6366f1' : 'none' }}
            >
                <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-sm text-slate-300 flex items-center gap-2">
                        <CalendarDays size={16} className="text-indigo-400" />
                        {t.empTodayStatus || "Today's Status"}
                    </h4>
                    {employee?.allow_gps_punch && (
                        <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Fingerprint size={10} />
                            {isRtl ? 'بصمة سريعة' : 'Quick Punch'}
                        </span>
                    )}
                </div>
                
                {stats.todayPunch ? (
                    <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-xl">
                        <span className="text-xs text-slate-400 font-medium">{t.empLastPunch || 'Last Punch:'}</span>
                        <span className={`text-xs font-black px-2.5 py-1 rounded-full ${stats.todayPunch.punch_type === 'check_in' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                            {stats.todayPunch.punch_type === 'check_in' 
                                ? (t.empCheckIn || 'Check In') 
                                : (t.empCheckOut || 'Check Out')} 
                            {' '}@{' '} 
                            {formatTime(stats.todayPunch.timestamp)}
                        </span>
                    </div>
                ) : (
                    <div className="flex gap-2.5 text-amber-400 bg-amber-400/5 p-3 rounded-xl text-xs leading-relaxed border border-amber-400/10">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <p className="font-medium">
                            {employee?.allow_gps_punch 
                                ? (language === 'ar' ? 'لم تقم بتسجيل البصمة اليوم. اضغط هنا للتسجيل الفوري.' : 'No punch recorded today. Tap here to punch in now.')
                                : (t.empNoPunchTodayWarning || 'You have not checked in today.')
                            }
                        </p>
                    </div>
                )}
            </div>

            {/* Shift Info - High Density M3 Card */}
            <div className="bg-slate-900/40 p-4 rounded-2xl flex items-center justify-between">
                <div className="space-y-0.5">
                    <span className="text-xs text-slate-400 font-medium block">{t.empUpcomingShift || 'Upcoming Shift'}</span>
                    <p className="text-sm font-bold text-slate-200">{stats.upcomingShift}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                    <Clock size={16} />
                </div>
            </div>

            {/* Recent Notifications Card - Swipe to Dismiss */}
            <div className="bg-slate-900/40 p-4 rounded-2xl">
                <h4 className="font-bold text-sm text-slate-300 mb-4 flex items-center gap-2">
                    <Bell size={16} className="text-indigo-400" />
                    {t.empRecentNotifications || 'Recent Notifications'}
                </h4>

                <AnimatePresence>
                    {stats.recentNotifications?.length > 0 ? (
                        <div className="space-y-3">
                            {stats.recentNotifications.map(n => {
                                const isUnread = !n.read_at;
                                return (
                                    <motion.div
                                        key={n.id}
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, x: isRtl ? 150 : -150 }}
                                        transition={{ duration: 0.2 }}
                                        className="relative overflow-hidden rounded-xl"
                                    >
                                        {/* Swipe reveal background for deletion */}
                                        <div className={`absolute inset-0 bg-red-600/90 flex items-center justify-end px-5 rounded-xl`}>
                                            <div className="flex items-center gap-1.5 text-white font-bold text-xs">
                                                <span>{language === 'ar' ? 'حذف' : 'Delete'}</span>
                                                <Trash2 size={16} />
                                            </div>
                                        </div>

                                        {/* Draggable Notification Card */}
                                        <motion.div
                                            drag="x"
                                            dragDirectionLock
                                            dragConstraints={{ left: -100, right: 0 }}
                                            dragElastic={{ left: 0.1, right: 0 }}
                                            onDragEnd={async (event, info) => {
                                                if (info.offset.x < -70) {
                                                    await handleDeleteNotification(n.id);
                                                }
                                            }}
                                            onClick={() => isUnread && handleMarkAsRead(n.id)}
                                            className={`relative p-3.5 rounded-xl border transition-colors cursor-pointer select-none bg-slate-900/60 hover:bg-slate-900/80 border-slate-800/40`}
                                            style={{ textAlign: isRtl ? 'right' : 'left' }}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="flex items-center gap-1.5">
                                                    {isUnread && <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />}
                                                    <span className={`text-xs font-bold ${isUnread ? 'text-white' : 'text-slate-300'}`}>
                                                        {n.title}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className={`text-xs leading-relaxed mb-2 ${isUnread ? 'text-slate-200' : 'text-slate-400'}`}>
                                                {n.message}
                                            </p>
                                            <div className="text-[9px] text-slate-500">
                                                {formatDateTime(n.created_at)}
                                            </div>
                                        </motion.div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-6 text-slate-500 text-xs gap-2">
                            <Bell size={24} className="opacity-30" />
                            <p>{t.empNoRecentNotifications || 'No new notifications'}</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>

            {/* ---------------------------------------------------- */}
            {/* FLOATING ACTION BUTTON (FAB) FOR QUICK GPS CLOCK-IN  */}
            {/* ---------------------------------------------------- */}
            {employee?.allow_gps_punch && (
                <button
                    onClick={() => {
                        setIsPunchSheetOpen(true);
                        getLocation();
                    }}
                    className={`fixed bottom-24 ${isRtl ? 'left-6' : 'right-6'} z-40 w-14 h-14 rounded-[18px] bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-[0_4px_20px_rgba(99,102,241,0.45)] hover:shadow-[0_6px_24px_rgba(99,102,241,0.6)] hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center`}
                >
                    <Fingerprint size={28} className="animate-pulse" />
                </button>
            )}

            {/* ---------------------------------------------------- */}
            {/* SALARY DETAIL BOTTOM SHEET (M3 Progressive Disclosure)*/}
            {/* ---------------------------------------------------- */}
            <AnimatePresence>
                {isSalarySheetOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSalarySheetOpen(false)}
                            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
                        />
                        {/* Bottom Sheet */}
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                            className="fixed bottom-0 left-0 right-0 bg-[#12121a] border-t border-slate-800/80 rounded-t-[28px] p-6 pb-10 z-50 max-h-[85vh] overflow-y-auto"
                            dir={isRtl ? 'rtl' : 'ltr'}
                        >
                            {/* Drag Handle indicator */}
                            <div className="w-12 h-1 bg-slate-700/60 rounded-full mx-auto mb-6" />

                            {/* Header */}
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                        <TrendingUp size={18} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-base leading-tight">
                                            {t.empExpectedSalaryDetails || 'Expected Salary Details'}
                                        </h3>
                                        <p className="text-[10px] text-slate-500 font-medium">
                                            {t.empExpectedSalaryDesc || 'Based on attendance logs, allowances, and active loans'}
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsSalarySheetOpen(false)}
                                    className="w-8 h-8 rounded-full bg-slate-900/60 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Breakdown List */}
                            <div className="space-y-3.5 text-sm text-slate-300">
                                <div className="flex justify-between items-center py-2 border-b border-slate-900/80">
                                    <span className="text-slate-400">{t.baseSalaryLabel || 'Base Salary'}</span>
                                    <span className="font-bold text-white privacy-blur">{formatCurrency(stats.expectedSalary?.base)}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-slate-900/80">
                                    <span className="text-slate-400">{t.housingAllowLabel || 'Housing Allowance'}</span>
                                    <span className="font-bold text-emerald-400 privacy-blur">+{formatCurrency(stats.expectedSalary?.housing)}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-slate-900/80">
                                    <span className="text-slate-400">{t.transportAllowLabel || 'Transport Allowance'}</span>
                                    <span className="font-bold text-emerald-400 privacy-blur">+{formatCurrency(stats.expectedSalary?.transport)}</span>
                                </div>

                                {stats.expectedSalary?.absentDays > 0 && (
                                    <div className="flex justify-between items-center py-2 border-b border-slate-900/80 text-rose-400 bg-rose-500/5 px-2.5 rounded-xl">
                                        <span className="font-medium">
                                            {t.empAbsenceDeductionLabel?.replace('{days}', stats.expectedSalary.absentDays) || 
                                                `Absence Deduction (${stats.expectedSalary.absentDays} days)`}
                                        </span>
                                        <span className="font-bold privacy-blur">-{formatCurrency(stats.expectedSalary.absenceDeduction)}</span>
                                    </div>
                                )}

                                {stats.expectedSalary?.unpaidLeaveDays > 0 && (
                                    <div className="flex justify-between items-center py-2 border-b border-slate-900/80 text-rose-400 bg-rose-500/5 px-2.5 rounded-xl">
                                        <span className="font-medium">
                                            {t.empUnpaidLeaveDeductionLabel?.replace('{days}', stats.expectedSalary.unpaidLeaveDays) || 
                                                `Unpaid Leave (${stats.expectedSalary.unpaidLeaveDays} days)`}
                                        </span>
                                        <span className="font-bold privacy-blur">-{formatCurrency(stats.expectedSalary.unpaidLeaveDeduction)}</span>
                                    </div>
                                )}

                                {stats.expectedSalary?.loanInstallments > 0 && (
                                    <div className="flex justify-between items-center py-2 border-b border-slate-900/80 text-amber-500 bg-amber-500/5 px-2.5 rounded-xl">
                                        <span className="font-medium">{t.empLoanInstallmentLabel || 'Loan Installment'}</span>
                                        <span className="font-bold privacy-blur">-{formatCurrency(stats.expectedSalary.loanInstallments)}</span>
                                    </div>
                                )}

                                {/* Net Salary Summary Block */}
                                <div className="mt-8 bg-slate-900 p-4 rounded-2xl flex justify-between items-center">
                                    <div>
                                        <span className="text-xs text-slate-400 font-bold uppercase block tracking-wider">
                                            {t.empExpectedNetLabel || 'Expected Net Salary'}
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-medium">
                                            {language === 'ar' ? 'تخضع للتسوية النهائية عند الإغلاق' : 'Subject to final calculations at close'}
                                        </span>
                                    </div>
                                    <span className="text-2xl font-black text-emerald-400 privacy-blur leading-none">
                                        {formatCurrency(stats.expectedSalary?.net)}
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ---------------------------------------------------- */}
            {/* QUICK GPS PUNCH BOTTOM SHEET (M3 Ergonomics & Flow)  */}
            {/* ---------------------------------------------------- */}
            <AnimatePresence>
                {isPunchSheetOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={handleClosePunchSheet}
                            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
                        />
                        {/* Bottom Sheet */}
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                            className="fixed bottom-0 left-0 right-0 bg-[#12121a] border-t border-slate-800/80 rounded-t-[28px] p-6 pb-12 z-50 max-h-[90vh] overflow-y-auto"
                            dir={isRtl ? 'rtl' : 'ltr'}
                        >
                            {/* Drag Handle */}
                            <div className="w-12 h-1 bg-slate-700/60 rounded-full mx-auto mb-6" />

                            {/* Header */}
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                        <Fingerprint size={18} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-base leading-tight">
                                            {t.empPunchTitle || 'GPS Clock-In / Out'}
                                        </h3>
                                        <p className="text-[10px] text-slate-500 font-medium">
                                            {t.empPunchSubtitle || 'Check in or out directly from your current location.'}
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleClosePunchSheet}
                                    className="w-8 h-8 rounded-full bg-slate-900/60 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Location Status Bar */}
                            <div className="bg-slate-900 p-3.5 rounded-2xl flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <MapPin size={18} className={location ? "text-emerald-400" : "text-slate-500"} />
                                    <span className="text-xs font-bold text-slate-300">
                                        {loadingLocation ? (t.empLocating || 'Locating...') : punchErrorMsg ? punchErrorMsg : (t.empLocationDetected || 'Location detected')}
                                    </span>
                                </div>
                                {!loadingLocation && !location && (
                                    <button 
                                        onClick={getLocation} 
                                        className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-2.5 py-1 rounded-lg hover:bg-indigo-500/20"
                                    >
                                        {t.retryBtn || 'Retry'}
                                    </button>
                                )}
                            </div>

                            {/* Success Screen inside Sheet */}
                            {punchSuccess ? (
                                <motion.div 
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="flex flex-col items-center justify-center text-center p-4"
                                >
                                    <CheckCircle2 size={72} className="text-emerald-500 mb-4" />
                                    <h4 className="text-xl font-bold text-white mb-1">
                                        {t.empPunchSuccessTitle || 'Punch Success'}
                                    </h4>
                                    <p className="text-sm text-slate-300 mb-1">
                                        {t.empPunchTypeLabel || 'Action:'} <span className="font-extrabold text-emerald-400">{punchSuccess.type}</span>
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {t.timeLabel || 'Time:'} {punchSuccess.time}
                                    </p>
                                    
                                    <button 
                                        onClick={handleClosePunchSheet}
                                        className="mt-6 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-all"
                                    >
                                        {language === 'ar' ? 'إغلاق البوابة' : 'Close'}
                                    </button>
                                </motion.div>
                            ) : (
                                /* Big interactive Check-In/Out Button */
                                <div className="relative flex flex-col justify-center items-center h-52 w-full mt-2">
                                    {/* Pulse Rings */}
                                    <AnimatePresence>
                                        {location && !isSubmittingPunch && (
                                            <>
                                                <motion.div 
                                                    initial={{ scale: 0.8, opacity: 0.5 }}
                                                    animate={{ scale: 1.4, opacity: 0 }}
                                                    exit={{ opacity: 0 }}
                                                    transition={{ repeat: Infinity, duration: 2.2 }}
                                                    className="absolute w-36 h-36 rounded-full border border-indigo-500/30 pointer-events-none"
                                                />
                                                <motion.div 
                                                    initial={{ scale: 0.8, opacity: 0.3 }}
                                                    animate={{ scale: 1.6, opacity: 0 }}
                                                    exit={{ opacity: 0 }}
                                                    transition={{ repeat: Infinity, duration: 2.2, delay: 0.8 }}
                                                    className="absolute w-36 h-36 rounded-full border border-purple-500/20 pointer-events-none"
                                                />
                                            </>
                                        )}
                                    </AnimatePresence>

                                    <button
                                        onClick={handlePunch}
                                        disabled={!location || isSubmittingPunch}
                                        className={`relative w-36 h-36 rounded-full flex flex-col items-center justify-center gap-1.5 shadow-2xl transition-all duration-300
                                            ${!location 
                                                ? 'bg-slate-900 text-slate-500 cursor-not-allowed border border-slate-800' 
                                                : 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white hover:scale-105 active:scale-95 shadow-[0_0_36px_rgba(99,102,241,0.4)]'}`}
                                    >
                                        <Navigation size={32} className={`${isSubmittingPunch ? 'animate-pulse' : ''}`} />
                                        <span className="font-extrabold text-sm">{isSubmittingPunch ? (t.sending || 'Punching...') : (t.empPunchNowBtn || 'Punch Now')}</span>
                                    </button>
                                    
                                    {!location && !loadingLocation && (
                                        <span className="text-[10px] text-amber-500 mt-4 font-medium flex items-center gap-1 bg-amber-500/5 px-3 py-1 rounded-full border border-amber-500/10">
                                            <Info size={12} />
                                            {language === 'ar' ? 'يرجى تفعيل الموقع للمتابعة' : 'Enable GPS location to proceed'}
                                        </span>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

        </motion.div>
    );
};

export default MobileDashboard;
