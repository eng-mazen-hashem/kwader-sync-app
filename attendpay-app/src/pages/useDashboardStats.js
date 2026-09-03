// -------------------------------------------------------------------------
// Custom Hook: مسؤول حصرياً عن جلب بيانات Dashboard من Supabase.
// يُرجع: { stats, chartData, recentActivity, isLoading, error }
//
// التحسينات المطبّقة:
//   1. Promise.all — كل الاستعلامات المستقلة تعمل بالتوازي.
//   2. RPC بدل 7 استعلامات داخل حلقة for للرسم البياني.
//   3. أعمدة محددة في كل استعلام (لا select('*')).
//   4. company_id في كل استعلام (عزل البيانات).
//   5. try/catch + sonner toast + console.error بـ prefix.
// -------------------------------------------------------------------------

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';

/**
 * @returns {{
 *   stats: {
 *     present: number,
 *     absent: number,
 *     totalEmployees: number,
 *     totalPayroll: number,
 *     overtimeHours: number,
 *     pendingLeaves: number,
 *     totalDept: number,
 *   },
 *   chartData: Array<{ day: string, present: number, late: number, absent: number }>,
 *   recentActivity: Array<{ id, type, employee_name, time, message }>,
 *   aiTriggerConfig: { startDate: string, endDate: string } | null,
 *   isLoading: boolean,
 *   error: string | null,
 *   refresh: () => void,
 * }}
 */
export function useDashboardStats() {
    const { company } = useAuth();
    const { t } = useLocale();

// -------------------------------------------------------------------------
    const [stats, setStats] = useState({
        present: 0,
        absent: 0,
        totalEmployees: 0,
        totalPayroll: 0,
        overtimeHours: 0,
        pendingLeaves: 0,
        totalDept: 0,
    });
    const [chartData, setChartData]         = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [aiTriggerConfig, setAiTriggerConfig] = useState(null);
    const [isLoading, setIsLoading]         = useState(true);
    const [error, setError]                 = useState(null);


// -------------------------------------------------------------------------
    // يُحسب مرة واحدة عند تغيير إعدادات الشركة — منفصل عن جلب البيانات.
    useEffect(() => {
        if (!company?.settings) return;
        const freq = company.settings.ai_payroll_frequency;
        if (!freq || freq === 'off') { setAiTriggerConfig(null); return; }

        const lastRunStr = company.settings.last_auto_payroll_date;
        const now = new Date();

        if (freq === 'monthly') {
            const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
            const lastRunDate     = lastRunStr ? new Date(lastRunStr) : null;
            const lastRunMonthKey = lastRunDate
                ? `${lastRunDate.getFullYear()}-${lastRunDate.getMonth()}`
                : null;

            if (currentMonthKey !== lastRunMonthKey) {
                const prevMonthDate = new Date(now.getFullYear(), now.getMonth(), 0);
                const start = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1)
                    .toISOString().split('T')[0];
                const end = prevMonthDate.toISOString().split('T')[0];
                setAiTriggerConfig({ startDate: start, endDate: end });
            } else {
                setAiTriggerConfig(null);
            }

        } else if (freq === 'weekly') {
            const lastSunday = new Date(now);
            lastSunday.setDate(now.getDate() - now.getDay());
            lastSunday.setHours(0, 0, 0, 0);

            const lastRunDate = lastRunStr ? new Date(lastRunStr) : new Date(0);
            if (lastRunDate < lastSunday) {
                const prevSat = new Date(lastSunday);
                prevSat.setDate(lastSunday.getDate() - 1);
                const prevSun = new Date(prevSat);
                prevSun.setDate(prevSat.getDate() - 6);

                setAiTriggerConfig({
                    startDate: prevSun.toISOString().split('T')[0],
                    endDate:   prevSat.toISOString().split('T')[0],
                });
            } else {
                setAiTriggerConfig(null);
            }
        }
    }, [company?.settings]);


// -------------------------------------------------------------------------
    const fetchDashboardData = useCallback(async () => {
        if (!company) { setIsLoading(false); return; }

        setIsLoading(true);
        setError(null);

        const today          = new Date().toISOString().split('T')[0];
        const currentYear    = new Date().getFullYear();
        const currentMonthNum = new Date().getMonth() + 1;
        const firstDayOfMonth = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}-01`;

        try {
// -------------------------------------------------------------------------
            const [
                activeEmpsResult,
                shiftsResult,
                shiftEmpsResult,
                todayAttResult,
                payrollResult,
                leavesCountResult,
                deptCountResult,
            ] = await Promise.all([
                // 1. الموظفون النشطون (id فقط لحساب العدد والشيفتات)
                supabase
                    .from('employees')
                    .select('id')
                    .eq('company_id', company.id)
                    .eq('status', 'active'),

                // 2. كل الشيفتات (للحساب المحلي)
                supabase
                    .from('shifts')
                    .select('id, work_days')
                    .eq('company_id', company.id),

                // 3. ربط الموظفين بالشيفتات
                supabase
                    .from('shift_employees')
                    .select('employee_id, shift_id')
                    .eq('company_id', company.id),

                // 4. حضور اليوم
                supabase
                    .from('processed_attendance')
                    .select('status')
                    .eq('company_id', company.id)
                    .eq('date', today),

                // 5. رواتب الشهر الحالي
                supabase
                    .from('payrolls')
                    .select('net_salary, overtime_hours')
                    .eq('company_id', company.id)
                    .gte('start_date', firstDayOfMonth),

                // 6. عدد طلبات الإجازات المعلقة (count فقط — لا نجلب بيانات)
                supabase
                    .from('leave_requests')
                    .select('id', { count: 'exact', head: true })
                    .eq('company_id', company.id)
                    .eq('status', 'pending'),

                // 7. عدد الأقسام (count فقط)
                supabase
                    .from('departments')
                    .select('id', { count: 'exact', head: true })
                    .eq('company_id', company.id),
            ]);

            // التحقق من الأخطاء
            const wave1Errors = [
                activeEmpsResult, shiftsResult, shiftEmpsResult,
                todayAttResult, payrollResult, leavesCountResult, deptCountResult,
            ].filter(r => r.error);

            if (wave1Errors.length > 0) {
                wave1Errors.forEach(r =>
                    console.error('[useDashboardStats] Wave-1 query error:', r.error.message)
                );
                throw new Error('WAVE_1_PARTIAL_FAILURE');
            }

// -------------------------------------------------------------------------
            const activeEmployees = activeEmpsResult.data || [];
            const shifts          = shiftsResult.data    || [];
            const shiftEmps       = shiftEmpsResult.data || [];

            const dayNames = [
                t.sunday, t.monday, t.tuesday, t.wednesday,
                t.thursday, t.friday, t.saturday,
            ];
            const todayName = dayNames[new Date().getDay()];

            // بناء map للشيفتات — O(n) بدل O(n²)
            const shiftEmpMap = new Map(shiftEmps.map(se => [se.employee_id, se.shift_id]));
            const shiftMap    = new Map(shifts.map(s => [s.id, s]));

            let expectedTodayEmployees = 0;
            for (const emp of activeEmployees) {
                const shiftId = shiftEmpMap.get(emp.id);
                const shift   = shiftId ? shiftMap.get(shiftId) : (shifts[0] ?? null);

                // يُحتسب إذا لم يُعيَّن له شيفت، أو إذا اليوم ضمن أيام عمله
                if (!shift || !shift.work_days || shift.work_days.includes(todayName)) {
                    expectedTodayEmployees++;
                }
            }

            const att     = todayAttResult.data || [];
            const present = att.filter(a => ['present', 'late', 'early_leave'].includes(a.status)).length;
            const absent  = Math.max(0, expectedTodayEmployees - present);

            const payrolls     = payrollResult.data || [];
            const totalPayroll = payrolls.reduce((s, p) => s + Number(p.net_salary || 0), 0);
            const overtimeHours = payrolls.reduce((s, p) => s + Number(p.overtime_hours || 0), 0);

            setStats({
                present,
                absent,
                totalEmployees: activeEmployees.length,
                totalPayroll,
                overtimeHours,
                pendingLeaves: leavesCountResult.count || 0,
                totalDept:     deptCountResult.count   || 0,
            });


// -------------------------------------------------------------------------
            // نُشغّلهما بالتوازي
            const [chartResult, activityResult] = await Promise.all([

// -------------------------------------------------------------------------
                // تستدعي دالة PostgreSQL: get_weekly_attendance_chart(p_company_id, p_day_names)
                // تُرجع: [{ day_label, present, late, absent }]
                supabase.rpc('get_weekly_attendance_chart', {
                    p_company_id: company.id,
                    p_day_names: JSON.stringify({
                        0: t.sunday,
                        1: t.monday,
                        2: t.tuesday,
                        3: t.wednesday,
                        4: t.thursday,
                        5: t.friday,
                        6: t.saturday,
                    }),
                }),

// -------------------------------------------------------------------------
                supabase
                    .from('raw_attendance_logs')
                    .select('id, user_pin, status, timestamp')
                    .eq('company_id', company.id)
                    .order('timestamp', { ascending: false })
                    .limit(6),
            ]);

            if (chartResult.error) {
                console.error('[useDashboardStats] RPC chart error:', chartResult.error.message);
                throw chartResult.error;
            }
            if (activityResult.error) {
                console.error('[useDashboardStats] Activity logs error:', activityResult.error.message);
                throw activityResult.error;
            }

            setChartData(chartResult.data || []);

// -------------------------------------------------------------------------
            // نجلب أسماء الموظفين بناءً على الـ PINs الظاهرة في السجلات فعلاً
            const recentLogs = activityResult.data || [];

            if (recentLogs.length > 0) {
                const uniquePins = [...new Set(recentLogs.map(l => l.user_pin))];

                const { data: empsByPin, error: empPinError } = await supabase
                    .from('employees')
                    .select('device_pin, name')
                    .eq('company_id', company.id)
                    .in('device_pin', uniquePins);

                if (empPinError) {
                    console.error('[useDashboardStats] empsByPin error:', empPinError.message);
                }

                const pinToName = {};
                if (empsByPin) {
                    empsByPin.forEach(emp => { pinToName[emp.device_pin] = emp.name; });
                }

                setRecentActivity(recentLogs.map(log => ({
                    id:            log.id,
                    type:          log.status === '0' ? 'check_in' : 'check_out',
                    employee_name: pinToName[log.user_pin] || log.user_pin,
                    // التنسيق يستخدم locale الشركة — يتوافق مع القسم 14 من الميثاق
                    time:          new Date(log.timestamp).toLocaleTimeString(
                        t.current_locale === 'ar' ? 'ar-SA' : 'en-US',
                        { hour: '2-digit', minute: '2-digit' }
                    ),
                    // النصوص تأتي من t — لا نص ثابت (القسم 6 من الميثاق)
                    message: log.status === '0' ? t.checkInLabel : t.checkOutLabel,
                })));
            } else {
                setRecentActivity([]);
            }

        } catch (err) {
            console.error('[useDashboardStats] fetchDashboardData failed:', err.message);
            toast.error(t.errFetchFailed);
            setError(err.message || 'FETCH_ERROR');
        } finally {
            setIsLoading(false);
        }
    }, [company, t]);


// -------------------------------------------------------------------------
    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);


    return {
        stats,
        chartData,
        recentActivity,
        aiTriggerConfig,
        setAiTriggerConfig,  // يُمرَّر لـ Dashboard.js ليُستخدم مع AiPayrollAgent
        isLoading,
        error,
        refresh: fetchDashboardData,  // للتحديث اليدوي بعد إجراء
    };
}
