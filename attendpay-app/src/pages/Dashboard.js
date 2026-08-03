import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
    HiOutlineUserGroup, HiOutlineXCircle, HiOutlineClock, HiOutlineCash,
    HiOutlineArrowSmUp, HiOutlineLogin, HiOutlineLogout,
    HiOutlineExclamation, HiOutlineRefresh
} from 'react-icons/hi';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { HiOutlineCalendar } from 'react-icons/hi';
import AiPayrollAgent from '../components/AiPayrollAgent';
import './Dashboard.css';

function Dashboard() {
    const { company } = useAuth();
    const { t, currencySymbol } = useLocale();

    const [stats, setStats] = useState({
        present: 0, absent: 0, totalEmployees: 0, totalPayroll: 0, overtimeHours: 0,
        pendingLeaves: 0, totalDept: 0
    });
    const [chartData, setChartData] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [aiTriggerConfig, setAiTriggerConfig] = useState(null);

    useEffect(() => {
        if (!company?.settings) return;
        const freq = company.settings.ai_payroll_frequency;
        if (!freq || freq === 'off') return;

        const lastRunStr = company.settings.last_auto_payroll_date;
        const now = new Date();

        if (freq === 'monthly') {
            const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
            const lastRunDate = lastRunStr ? new Date(lastRunStr) : null;
            const lastRunMonthKey = lastRunDate ? `${lastRunDate.getFullYear()}-${lastRunDate.getMonth()}` : null;

            if (currentMonthKey !== lastRunMonthKey) {
                const prevMonthDate = new Date(now.getFullYear(), now.getMonth(), 0);
                const start = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1).toISOString().split('T')[0];
                const end = prevMonthDate.toISOString().split('T')[0];
                setAiTriggerConfig({ startDate: start, endDate: end });
            }
        } else if (freq === 'weekly') {
            const lastSunday = new Date(now);
            lastSunday.setDate(now.getDate() - now.getDay());
            lastSunday.setHours(0,0,0,0);
            
            const lastRunDate = lastRunStr ? new Date(lastRunStr) : new Date(0);
            if (lastRunDate < lastSunday) {
                const prevSat = new Date(lastSunday);
                prevSat.setDate(lastSunday.getDate() - 1);
                const prevSun = new Date(prevSat);
                prevSun.setDate(prevSat.getDate() - 6);
                
                const start = prevSun.toISOString().split('T')[0];
                const end = prevSat.toISOString().split('T')[0];
                setAiTriggerConfig({ startDate: start, endDate: end });
            }
        }
    }, [company]);

    const fetchDashboardData = useCallback(async () => {
        if (!company) { setLoading(false); return; }
        setLoading(true);

        try {
            const today = new Date().toISOString().split('T')[0];
            const currentYear = new Date().getFullYear();
            const currentMonthNum = new Date().getMonth() + 1;
            const firstDayOfMonth = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}-01`;

            // Calculate dates for weekly chart
            const last7DaysDates = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                last7DaysDates.push(d.toISOString().split('T')[0]);
            }
            const minChartDate = last7DaysDates[0];

            // 1. Parallel Batch Queries
            const [
                { data: activeEmployees },
                { data: shifts },
                { data: shiftEmps },
                { data: todayAttendance },
                { data: payrollDataState },
                { count: pendingLeavesCount },
                { count: totalDeptCount },
                { data: weeklyAttendanceData },
                { data: recentLogs }
            ] = await Promise.all([
                supabase.from('employees').select('id').eq('company_id', company.id).eq('status', 'active'),
                supabase.from('shifts').select('id, work_days').eq('company_id', company.id),
                supabase.from('shift_employees').select('employee_id, shift_id').eq('company_id', company.id),
                supabase.from('processed_attendance').select('status').eq('company_id', company.id).eq('date', today),
                supabase.from('payrolls').select('net_salary, overtime_hours').eq('company_id', company.id).gte('start_date', firstDayOfMonth),
                supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('company_id', company.id).eq('status', 'pending'),
                supabase.from('departments').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
                supabase.from('processed_attendance').select('status, date').eq('company_id', company.id).gte('date', minChartDate),
                supabase.from('raw_attendance_logs').select('id, status, user_pin, timestamp').eq('company_id', company.id).order('timestamp', { ascending: false }).limit(6)
            ]);

            // 2. Process Stats
            const dayNames = [t.sunday, t.monday, t.tuesday, t.wednesday, t.thursday, t.friday, t.saturday];
            const todayName = dayNames[new Date().getDay()];

            const getShiftForEmp = (empId) => {
                const row = shiftEmps?.find(se => se.employee_id === empId);
                if (row && shifts) return shifts.find(s => s.id === row.shift_id) || null;
                return shifts && shifts.length > 0 ? shifts[0] : null;
            };

            const totalEmployeesCount = activeEmployees?.length || 0;
            let expectedTodayEmployees = 0;
            if (activeEmployees) {
                for (const emp of activeEmployees) {
                    const shift = getShiftForEmp(emp.id);
                    if (!shift || !shift.work_days || shift.work_days.includes(todayName)) {
                        expectedTodayEmployees++;
                    }
                }
            }

            const presentCount = (todayAttendance || []).filter(a => ['present', 'late', 'early_leave'].includes(a.status)).length;
            const absentCount = Math.max(0, expectedTodayEmployees - presentCount);

            const netSalarySum = (payrollDataState || []).reduce((s, p) => s + Number(p.net_salary), 0);
            const overtimeHoursSum = (payrollDataState || []).reduce((s, p) => s + Number(p.overtime_hours), 0);

            setStats({
                present: presentCount,
                absent: absentCount,
                totalEmployees: totalEmployeesCount,
                totalPayroll: netSalarySum,
                overtimeHours: overtimeHoursSum,
                pendingLeaves: pendingLeavesCount || 0,
                totalDept: totalDeptCount || 0
            });

            // 3. Process Weekly Chart
            const chartMapping = (weeklyAttendanceData || []).reduce((acc, curr) => {
                if (!acc[curr.date]) acc[curr.date] = [];
                acc[curr.date].push(curr.status);
                return acc;
            }, {});

            const dayNamesList = [t.sunday, t.monday, t.tuesday, t.wednesday, t.thursday, t.friday, t.saturday];
            const processedChartData = last7DaysDates.map(dateStr => {
                const statuses = chartMapping[dateStr] || [];
                const d = new Date(dateStr);
                return {
                    day: dayNamesList[d.getDay()],
                    present: statuses.filter(s => s === 'present').length,
                    late: statuses.filter(s => s === 'late').length,
                    absent: statuses.filter(s => s === 'absent').length,
                };
            });
            setChartData(processedChartData);

            // 4. Process Recent Activity
            if (recentLogs && recentLogs.length > 0) {
                const uniquePins = [...new Set(recentLogs.map(l => l.user_pin))];
                const { data: employeesData } = await supabase
                    .from('employees')
                    .select('device_pin, name')
                    .eq('company_id', company.id)
                    .in('device_pin', uniquePins);

                const pinToName = {};
                if (employeesData) employeesData.forEach(emp => { pinToName[emp.device_pin] = emp.name; });

                setRecentActivity(recentLogs.map(log => ({
                    id: log.id,
                    type: log.status === '0' ? 'check_in' : 'check_out',
                    employee_name: pinToName[log.user_pin] || log.user_pin,
                    time: new Date(log.timestamp).toLocaleTimeString(t.current_locale === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
                    message: log.status === '0' ? t.checkInLabel : t.checkOutLabel,
                })));
            } else {
                setRecentActivity([]);
            }

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }, [company, t]);

    useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

    const getActivityIcon = (type) => {
        switch (type) {
            case 'check_in':  return <HiOutlineLogin className="icon-type-check_in" />;
            case 'check_out': return <HiOutlineLogout className="icon-type-check_out" />;
            case 'late':      return <HiOutlineClock className="icon-type-late" />;
            case 'absent':    return <HiOutlineExclamation className="icon-type-absent" />;
            case 'sync':      return <HiOutlineRefresh className="icon-type-sync" />;
            default:          return <HiOutlineClock />;
        }
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        return (
            <div className="dash-tooltip">
                <p className="dash-tooltip-label">{label}</p>
                {payload.map((p, i) => (
                    <p key={i} className="dash-tooltip-item" style={{ color: p.color }}>
                        {p.name}: {p.value}
                    </p>
                ))}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="dash-loading">
                <p>{t.loading}</p>
            </div>
        );
    }

    const containerVariants = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
    };

    return (
        <motion.div 
            className="fade-in"
            variants={containerVariants}
            initial="hidden"
            animate="show"
        >
            {/* AI Auto-Payroll Modal Overlay if triggered */}
            {aiTriggerConfig && (
                <AiPayrollAgent 
                    company={company}
                    startDate={aiTriggerConfig.startDate}
                    endDate={aiTriggerConfig.endDate}
                    onComplete={() => setAiTriggerConfig(null)}
                />
            )}

            {/* Quick Actions Bar for Admin / Client */}
            <motion.div variants={itemVariants} className="dash-quick-actions">
                <div className="dash-quick-actions-scroll">
                    <button type="button" className="dash-quick-btn primary" onClick={() => window.location.href = '/employees'}>
                        <span className="dash-quick-icon">👤+</span>
                        <span>{t.addEmployee || 'إضافة موظف'}</span>
                    </button>
                    <button type="button" className="dash-quick-btn success" onClick={() => window.location.href = '/attendance'}>
                        <span className="dash-quick-icon">⏱️</span>
                        <span>{t.titleAttendance || 'سجل الحضور'}</span>
                    </button>
                    <button type="button" className="dash-quick-btn warning" onClick={() => window.location.href = '/payroll'}>
                        <span className="dash-quick-icon">💰</span>
                        <span>{t.titlePayroll || 'مسيرات الرواتب'}</span>
                    </button>
                    <button type="button" className="dash-quick-btn info" onClick={() => window.location.href = '/shifts'}>
                        <span className="dash-quick-icon">📅</span>
                        <span>{t.titleShifts || 'إدارة الشيفتات'}</span>
                    </button>
                    <button type="button" className="dash-quick-btn purple" onClick={() => window.location.href = '/assistant'}>
                        <span className="dash-quick-icon">✨</span>
                        <span>{t.titleAssistant || 'المساعد الذكي'}</span>
                    </button>
                </div>
            </motion.div>
            {/* Stats Grid */}
            <div className="dash-stats-grid">
                <motion.div variants={itemVariants} className="dash-stat-card">
                    <div className="dash-stat-header">
                        <span className="dash-stat-title">{t.presentToday}</span>
                        <div className="dash-stat-icon dash-icon-success">
                            <HiOutlineUserGroup />
                        </div>
                    </div>
                    <div className="dash-stat-value dash-val-success">{stats.present}</div>
                    <div className="dash-stat-label">
                        {t.ofTotalEmployees.replace('{count}', stats.totalEmployees)}
                    </div>
                    <span className="dash-stat-change positive"><HiOutlineArrowSmUp /> {t.activeStatus}</span>
                </motion.div>

                <motion.div variants={itemVariants} className="dash-stat-card">
                    <div className="dash-stat-header">
                        <span className="dash-stat-title">{t.absentToday}</span>
                        <div className="dash-stat-icon dash-icon-danger">
                            <HiOutlineXCircle />
                        </div>
                    </div>
                    <div className="dash-stat-value dash-val-danger">{stats.absent}</div>
                    <div className="dash-stat-label">{t.unauthorizedAbsence}</div>
                </motion.div>

                <motion.div variants={itemVariants} className="dash-stat-card">
                    <div className="dash-stat-header">
                        <span className="dash-stat-title">{t.overtimeHoursLabel}</span>
                        <div className="dash-stat-icon dash-icon-warning">
                            <HiOutlineClock />
                        </div>
                    </div>
                    <div className="dash-stat-value dash-val-warning">{stats.overtimeHours}</div>
                    <div className="dash-stat-label">{t.thisMonth}</div>
                </motion.div>

                <motion.div variants={itemVariants} className="dash-stat-card">
                    <div className="dash-stat-header">
                        <span className="dash-stat-title">{t.totalPayrollLabel}</span>
                        <div className="dash-stat-icon dash-icon-info">
                            <HiOutlineCash />
                        </div>
                    </div>
                    <div className="dash-stat-value dash-val-info privacy-blur">
                        {stats.totalPayroll.toLocaleString()}
                    </div>
                    <div className="dash-stat-label">{currencySymbol}</div>
                </motion.div>

                <motion.div variants={itemVariants} className="dash-stat-card">
                    <div className="dash-stat-header">
                        <span className="dash-stat-title">{t.leaveRequestsLabel}</span>
                        <div className="dash-stat-icon dash-icon-primary">
                            <HiOutlineCalendar />
                        </div>
                    </div>
                    <div className="dash-stat-value dash-val-primary">{stats.pendingLeaves}</div>
                    <div className="dash-stat-label">{t.pendingApproval}</div>
                </motion.div>
            </div>

            {/* Chart + Activity */}
            <div className="dash-content-grid">
                <motion.div variants={itemVariants} className="dash-card">
                    <div className="dash-card-header">
                        <h3 className="dash-card-title">{t.weeklyAttendanceHeader}</h3>
                    </div>
                    <div className="dash-chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} barCategoryGap="20%">
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 12, fontFamily: 'inherit' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-glass)' }} />
                                <Legend wrapperStyle={{ fontSize: '0.82rem' }} />
                                <Bar dataKey="present" name={t.statusPresent} fill="var(--color-success)" radius={[8, 8, 0, 0]} />
                                <Bar dataKey="late" name={t.statusLate} fill="var(--color-warning)" radius={[8, 8, 0, 0]} />
                                <Bar dataKey="absent" name={t.statusAbsent} fill="var(--color-danger)" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                <motion.div variants={itemVariants} className="dash-card">
                    <div className="dash-card-header">
                        <h3 className="dash-card-title">{t.lastActivitiesHeader}</h3>
                    </div>
                    <div className="dash-activity-list">
                        {recentActivity.length === 0 ? (
                            <p className="dash-empty">{t.noActivitiesFound}</p>
                        ) : (
                            recentActivity.map(activity => (
                                <div key={activity.id} className="dash-activity-item">
                                    <div className="dash-activity-icon-wrap">
                                        {getActivityIcon(activity.type)}
                                    </div>
                                    <div className="dash-activity-info">
                                        <div className="dash-activity-emp">
                                            {t.fingerprintActivity.replace('{name}', activity.employee_name)}
                                        </div>
                                        <div className="dash-activity-msg">
                                            {activity.message}
                                        </div>
                                    </div>
                                    <span className="dash-activity-time">
                                        {activity.time}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}

export default Dashboard;