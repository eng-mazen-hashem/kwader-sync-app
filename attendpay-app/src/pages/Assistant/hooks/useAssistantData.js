import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { useAuth } from '../../../context/AuthContext';

// Max records to fetch per table to prevent UI thread freeze (constitution §22)
const ATTENDANCE_LIMIT = 500;
const PAYROLL_LIMIT    = 200;

export const useAssistantData = () => {
    const { user } = useAuth();
    const [company, setCompany] = useState(null);
    const [data, setData] = useState({ employees: [], attendance: [], payrolls: [], schedules: [], departments: [], shifts: [] });
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Resolve company with only needed columns (constitution §7.2)
            const { data: comp, error: compError } = await supabase
                .from('companies')
                .select('id, name, settings, owner_id, status, subscription_end_date')
                .eq('owner_id', user.id)
                .maybeSingle();

            if (compError) {
                console.error('[useAssistantData] comp query error:', compError);
            }

            if (comp) {
                const mappedComp = {
                    ...comp,
                    subscription_status: comp.status,
                    timezone: comp.settings?.timezone || 'Asia/Riyadh'
                };
                setCompany(mappedComp);

                // Load related data in parallel — explicit columns only, with limits (constitution §17)
                const [empsRes, attRes, payRes, schedRes, deptsRes, shiftsRes] = await Promise.all([
                    supabase
                        .from('employees')
                        .select('id, name, phone, base_salary, position, status, joining_date, department_id, departments(name), shifts(name)')
                        .eq('company_id', comp.id)
                        .eq('status', 'active')           // active employees first for AI context
                        .order('name', { ascending: true })
                        .limit(300),

                    supabase
                        .from('processed_attendance')
                        .select('id, employee_id, check_in, check_out, date, status, work_hours')
                        .eq('company_id', comp.id)
                        .order('date', { ascending: false })
                        .limit(ATTENDANCE_LIMIT),           // prevent fetching tens of thousands of rows

                    supabase
                        .from('payrolls')
                        .select('id, employee_id, start_date, end_date, net_salary, base_salary, status, created_at')
                        .eq('company_id', comp.id)
                        .order('created_at', { ascending: false })
                        .limit(PAYROLL_LIMIT),

                    supabase
                        .from('report_schedules')
                        .select('id, report_type, frequency, send_time, send_day, channels, is_active, created_at, updated_at, company_id')
                        .eq('company_id', comp.id),

                    supabase
                        .from('departments')
                        .select('id, name, company_id')
                        .eq('company_id', comp.id),

                    supabase
                        .from('shifts')
                        .select('id, name, start_time, end_time')
                        .eq('company_id', comp.id)
                ]);

                // Surface errors to console without crashing the AI assistant
                if (deptsRes.error)  console.warn('[useAssistantData] departments:', deptsRes.error.message);
                if (shiftsRes.error) console.warn('[useAssistantData] shifts:', shiftsRes.error.message);
                if (empsRes.error)   console.warn('[useAssistantData] employees:', empsRes.error.message);
                if (attRes.error)    console.warn('[useAssistantData] attendance:', attRes.error.message);
                if (payRes.error)    console.warn('[useAssistantData] payrolls:', payRes.error.message);

                setData({
                    employees:   empsRes.data || [],
                    attendance:  attRes.data || [],
                    payrolls:    payRes.data || [],
                    schedules:   (schedRes.data || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
                    departments: deptsRes.data || [],
                    shifts:      shiftsRes.data || []
                });
            }
        } catch (error) {
            console.error('[useAssistantData] loadData:', error.message);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    return { company, data, loading, reloadData: loadData, setCompany };
};
