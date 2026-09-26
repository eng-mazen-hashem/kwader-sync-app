import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../../supabaseClient';
import { logAudit } from '../../../utils/auditLogger';
import { getCountryByCode } from '../../../utils/countries';

export const useAssistantTools = (company, reloadData, setMessages) => {
    const rawCountryCode = company?.settings?.country || company?.country || 'EG';
    const countryInfo = useMemo(() => {
        return getCountryByCode(rawCountryCode) || {
            code: 'EG',
            nameAr: 'مصر',
            currency: 'EGP',
            currencySymbol: 'ج.م',
            timezone: 'Africa/Cairo',
            locale: 'ar-EG'
        };
    }, [rawCountryCode]);

    const currencyWord = countryInfo.code === 'EG' ? 'جنيه' : countryInfo.code === 'SA' ? 'ريال' : (countryInfo.currencySymbol || countryInfo.currency);
    const timezone = company?.settings?.timezone || countryInfo.timezone || 'Africa/Cairo';
    const locale = countryInfo.locale || (countryInfo.code === 'EG' ? 'ar-EG' : 'ar-SA');

    const getLocalTime = useCallback(() => {
        try {
            return new Date().toLocaleTimeString(locale, { timeZone: timezone, hour: '2-digit', minute: '2-digit' });
        } catch {
            return new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        }
    }, [locale, timezone]);

    // Helper: Find employee record by partial or full name
    const findEmployeeByName = useCallback(async (searchName) => {
        if (!searchName || !company?.id) return null;
        try {
            const cleanName = searchName.trim().replace(/^ل(?=[\u0621-\u064A])/, '').trim();
            const { data, error } = await supabase
                .from('employees')
                .select('id, name, base_salary, phone, position')
                .eq('company_id', company.id)
                .ilike('name', `%${cleanName}%`)
                .limit(1);
            if (error || !data || data.length === 0) return null;
            return data[0];
        } catch {
            return null;
        }
    }, [company?.id]);

    // 1. Add Employee
    const executeAddEmployee = useCallback(async (empData) => {
        try {
            const pinToUse = empData.device_pin || Math.floor(1000 + Math.random() * 9000).toString();
            const payload = {
                name: empData.name,
                base_salary: Number(empData.base_salary) || 0,
                phone: empData.phone || null,
                device_pin: String(pinToUse),
                position: empData.position || null,
                company_id: company.id
            };

            const { data: inserted, error } = await supabase
                .from('employees')
                .insert([payload])
                .select()
                .single();

            if (error) {
                toast.error(`فشلت إضافة الموظف: ${error.message}`);
                throw error;
            }

            const { data: { user } } = await supabase.auth.getUser();
            await logAudit({
                companyId: company.id,
                userId: user?.id,
                action: 'ADD_EMPLOYEE_AI',
                tableName: 'employees',
                recordId: inserted?.id,
                newData: payload
            });

            toast.success(`تمت إضافة الموظف ${empData.name} بنجاح`);

            setMessages(p => [...p, {
                id: Date.now().toString(),
                role: 'assistant',
                content: `✅ تمت العملية بنجاح! تم حفظ الموظف **${empData.name}** في قاعدة البيانات (الراتب: ${payload.base_salary} ${currencyWord}، الوظيفة: ${payload.position || 'موظف'}).`,
                time: getLocalTime()
            }]);

            if (reloadData) reloadData();
        } catch (err) {
            console.error('[useAssistantTools] executeAddEmployee:', err.message);
        }
    }, [company, reloadData, setMessages, currencyWord, getLocalTime]);

    // 2. Update Employee Info / Salary
    const executeUpdateEmployee = useCallback(async (actionData) => {
        try {
            const data = actionData || {};
            const empName = (data.employee_name || data.name || '').trim();
            if (!empName) {
                toast.error('يرجى تحديد اسم الموظف المراد تحديث بياناته.');
                return;
            }

            const emp = await findEmployeeByName(empName);
            if (!emp) {
                toast.error(`لم يتم العثور على الموظف "${empName}" في النظام.`);
                return;
            }

            const updates = data.updates || {};
            const payload = {};
            if (updates.base_salary !== undefined) payload.base_salary = Number(updates.base_salary);
            if (updates.position !== undefined) payload.position = updates.position;
            if (updates.phone !== undefined) payload.phone = updates.phone;
            if (updates.status !== undefined) payload.status = updates.status;

            if (Object.keys(payload).length === 0) {
                toast.error('لم يتم تحديد أي حقول لتحديثها.');
                return;
            }

            const { error } = await supabase
                .from('employees')
                .update(payload)
                .eq('id', emp.id)
                .eq('company_id', company.id);

            if (error) throw error;

            const { data: { user } } = await supabase.auth.getUser();
            await logAudit({
                companyId: company.id,
                userId: user?.id,
                action: 'UPDATE_EMPLOYEE_AI',
                tableName: 'employees',
                recordId: emp.id,
                oldData: emp,
                newData: payload
            });

            toast.success(`تم تحديث بيانات الموظف ${emp.name} بنجاح`);
            setMessages(p => [...p, {
                id: Date.now().toString(),
                role: 'assistant',
                content: `✅ تم بنجاح تحديث بيانات الموظف **${emp.name}** في قاعدة البيانات:\n` +
                         Object.entries(payload).map(([k, v]) => `• ${k === 'base_salary' ? 'الراتب الأساسي' : k === 'position' ? 'المسمى الوظيفي' : k === 'phone' ? 'رقم الهاتف' : k}: **${v}**`).join('\n'),
                time: getLocalTime()
            }]);

            if (reloadData) reloadData();
        } catch (err) {
            console.error('[useAssistantTools] executeUpdateEmployee:', err.message);
            toast.error(`فشل تحديث بيانات الموظف: ${err.message}`);
        }
    }, [company, findEmployeeByName, reloadData, setMessages, getLocalTime]);

    // 3. Create Leave Request
    const executeCreateLeave = useCallback(async (actionData) => {
        try {
            const data = actionData || {};
            const empName = (data.employee_name || data.name || '').trim();
            if (!empName) {
                toast.error('يرجى تحديد اسم الموظف لطلب الإجازة.');
                return;
            }

            const emp = await findEmployeeByName(empName);
            if (!emp) {
                toast.error(`لم يتم العثور على الموظف "${empName}".`);
                return;
            }

            const payload = {
                company_id: company.id,
                employee_id: emp.id,
                leave_type: data.leave_type || 'annual',
                start_date: data.start_date || new Date().toISOString().split('T')[0],
                end_date: data.end_date || new Date().toISOString().split('T')[0],
                reason: data.reason || 'طلب إجازة مسجل عبر المساعد الإداري الذكي',
                status: data.status || 'pending'
            };

            const { data: inserted, error } = await supabase
                .from('leave_requests')
                .insert([payload])
                .select()
                .single();

            if (error) throw error;

            const { data: { user } } = await supabase.auth.getUser();
            await logAudit({
                companyId: company.id,
                userId: user?.id,
                action: 'CREATE_LEAVE_REQUEST_AI',
                tableName: 'leave_requests',
                recordId: inserted?.id,
                newData: payload
            });

            const leaveTypeText = payload.leave_type === 'annual' ? 'سنوية' : payload.leave_type === 'sick' ? 'مرضية' : payload.leave_type === 'unpaid' ? 'بدون راتب' : payload.leave_type;
            toast.success(`تم قيد طلب إجازة ${leaveTypeText} للموظف ${emp.name}`);
            setMessages(p => [...p, {
                id: Date.now().toString(),
                role: 'assistant',
                content: `🏖️ تم تسجيل طلب إجازة **${leaveTypeText}** للموظف **${emp.name}** من **${payload.start_date}** إلى **${payload.end_date}** (الحالة: ${payload.status === 'approved' ? 'معتمدة' : 'معلقة بانتظار الموافقة'}).`,
                time: getLocalTime()
            }]);

            if (reloadData) reloadData();
        } catch (err) {
            console.error('[useAssistantTools] executeCreateLeave:', err.message);
            toast.error(`فشل تسجيل طلب الإجازة: ${err.message}`);
        }
    }, [company, findEmployeeByName, reloadData, setMessages, getLocalTime]);

    // 4. Update Leave Status (Approve / Reject)
    const executeUpdateLeaveStatus = useCallback(async (actionData) => {
        try {
            const data = actionData || {};
            const empName = (data.employee_name || data.name || '').trim();
            if (!empName) {
                toast.error('يرجى تحديد اسم الموظف لتحديث حالة الإجازة.');
                return;
            }

            const emp = await findEmployeeByName(empName);
            if (!emp) {
                toast.error(`لم يتم العثور على الموظف "${empName}".`);
                return;
            }

            const newStatus = data.status || 'approved';

            // Find the most recent pending leave for this employee
            const { data: leaves, error: fetchErr } = await supabase
                .from('leave_requests')
                .select('id, leave_type, start_date, end_date, status')
                .eq('company_id', company.id)
                .eq('employee_id', emp.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1);

            if (fetchErr) throw fetchErr;

            if (!leaves || leaves.length === 0) {
                toast.error(`لا توجد طلبات إجازة معلقة للموظف ${emp.name}.`);
                return;
            }

            const targetLeave = leaves[0];
            const { error: updateErr } = await supabase
                .from('leave_requests')
                .update({ status: newStatus })
                .eq('id', targetLeave.id)
                .eq('company_id', company.id);

            if (updateErr) throw updateErr;

            // Notify employee in system
            await supabase.from('employee_notifications').insert([{
                employee_id: emp.id,
                title: newStatus === 'approved' ? 'الموافقة على الإجازة' : 'رفض طلب الإجازة',
                message: `تمت ${newStatus === 'approved' ? 'الموافقة على' : 'رفض'} طلب الإجازة للفترة من ${targetLeave.start_date} إلى ${targetLeave.end_date}.`,
                type: newStatus === 'approved' ? 'success' : 'warning'
            }]);

            const { data: { user } } = await supabase.auth.getUser();
            await logAudit({
                companyId: company.id,
                userId: user?.id,
                action: newStatus === 'approved' ? 'APPROVE_LEAVE_AI' : 'REJECT_LEAVE_AI',
                tableName: 'leave_requests',
                recordId: targetLeave.id,
                oldData: { status: 'pending' },
                newData: { status: newStatus }
            });

            const statusAr = newStatus === 'approved' ? 'الموافقة على' : 'رفض';
            toast.success(`تمت ${statusAr} إجازة ${emp.name} بنجاح`);
            setMessages(p => [...p, {
                id: Date.now().toString(),
                role: 'assistant',
                content: `✅ تمت العملية بنجاح! تم **${statusAr}** طلب إجازة الموظف **${emp.name}** للفترة من **${targetLeave.start_date}** إلى **${targetLeave.end_date}**.`,
                time: getLocalTime()
            }]);

            if (reloadData) reloadData();
        } catch (err) {
            console.error('[useAssistantTools] executeUpdateLeaveStatus:', err.message);
            toast.error(`فشل تحديث حالة الإجازة: ${err.message}`);
        }
    }, [company, findEmployeeByName, reloadData, setMessages, getLocalTime]);

    // 5. Record Loan / Advance
    const executeRecordLoan = useCallback(async (actionData) => {
        try {
            const data = actionData || {};
            const rawName = (data.employee_name || data.name || data.employee || '').trim();
            const isAll = data.all_employees === true || 
                          data.all_employees === 'true' || 
                          data.all === true ||
                          data.for_all === true ||
                          data.target === 'all' ||
                          !rawName ||
                          ['all', 'الكل', 'جميع الموظفين', 'كل الموظفين', 'الجميع', 'لكل الموظفين', 'كافة الموظفين'].includes(rawName);

            let targetEmployees = [];
            if (isAll) {
                const { data: allEmps, error: empsErr } = await supabase
                    .from('employees')
                    .select('id, name, base_salary, status')
                    .eq('company_id', company.id);
                if (empsErr) throw empsErr;

                const activeEmps = (allEmps || []).filter(e => !e.status || e.status.toLowerCase() === 'active');
                targetEmployees = activeEmps.length > 0 ? activeEmps : (allEmps || []);
            } else {
                const emp = await findEmployeeByName(rawName);
                if (emp) targetEmployees = [emp];
            }

            if (targetEmployees.length === 0) {
                toast.error(isAll ? 'لا يوجد موظفون مسجلون في الشركة لتسجيل السلفة لهم.' : `لم يتم العثور على الموظف "${rawName}".`);
                return;
            }

            const totalAmount = Number(data.total_amount) || Number(data.amount) || 0;
            if (totalAmount <= 0) {
                toast.error('مبلغ السلفة يجب أن يكون أكبر من صفر.');
                return;
            }

            let repaymentMonths = Number(data.repayment_months) || 1;
            let monthlyInstallment = Number(data.monthly_installment);
            if (!monthlyInstallment || monthlyInstallment <= 0) {
                monthlyInstallment = Math.round((totalAmount / repaymentMonths) * 100) / 100;
            }

            const payloads = targetEmployees.map(emp => ({
                company_id: company.id,
                employee_id: emp.id,
                total_amount: totalAmount,
                monthly_installment: monthlyInstallment,
                repayment_months: repaymentMonths,
                remaining_amount: totalAmount,
                status: 'active',
                notes: data.notes || 'سلفة مسجلة عبر المساعد الذكي وتين'
            }));

            const { data: inserted, error } = await supabase
                .from('employee_loans')
                .insert(payloads)
                .select();

            if (error) throw error;

            const { data: { user } } = await supabase.auth.getUser();
            for (const item of (inserted || [])) {
                await logAudit({
                    companyId: company.id,
                    userId: user?.id,
                    action: 'CREATE_LOAN_AI',
                    tableName: 'employee_loans',
                    recordId: item.id,
                    newData: item
                });
            }

            const msgContent = isAll
                ? `💰 تم قيد سلفة جديدة لجميع الموظفين (${targetEmployees.length} موظف) بمبلغ **${totalAmount} ${currencyWord}** لكل موظف، بقسط شهري **${monthlyInstallment} ${currencyWord}** على مدار **${repaymentMonths} شهر**، وظهرت فوراً في تابة السلف.`
                : `💰 تم قيد سلفة جديدة للموظف **${targetEmployees[0].name}** بمبلغ إجمالي **${totalAmount} ${currencyWord}**، بقسط شهري **${monthlyInstallment} ${currencyWord}** على مدار **${repaymentMonths} شهر** (ظهرت في تابة السلف).`;

            toast.success(isAll ? `تم قيد السلفة لـ ${targetEmployees.length} موظفاً بنجاح` : `تم قيد السلفة للموظف ${targetEmployees[0].name}`);
            setMessages(p => [...p, {
                id: Date.now().toString(),
                role: 'assistant',
                content: msgContent,
                time: getLocalTime()
            }]);

            if (reloadData) reloadData();
        } catch (err) {
            console.error('[useAssistantTools] executeRecordLoan:', err.message);
            toast.error(`فشل تسجيل السلفة: ${err.message}`);
        }
    }, [company, findEmployeeByName, reloadData, setMessages, currencyWord, getLocalTime]);

    // 6. Record Bonus / Deduction (appears in employee_loans & payrolls)
    const executeRecordAdjustment = useCallback(async (actionData) => {
        try {
            const data = actionData || {};
            const rawName = (data.employee_name || data.name || data.employee || '').trim();
            const isAll = data.all_employees === true || 
                          data.all_employees === 'true' || 
                          data.all === true ||
                          data.for_all === true ||
                          data.target === 'all' ||
                          !rawName ||
                          ['all', 'الكل', 'جميع الموظفين', 'كل الموظفين', 'الجميع', 'لكل الموظفين', 'كافة الموظفين'].includes(rawName);

            let targetEmployees = [];
            if (isAll) {
                const { data: allEmps, error: empsErr } = await supabase
                    .from('employees')
                    .select('id, name, base_salary, status')
                    .eq('company_id', company.id);
                if (empsErr) throw empsErr;

                const activeEmps = (allEmps || []).filter(e => !e.status || e.status.toLowerCase() === 'active');
                targetEmployees = activeEmps.length > 0 ? activeEmps : (allEmps || []);
            } else {
                const emp = await findEmployeeByName(rawName);
                if (emp) targetEmployees = [emp];
            }

            if (targetEmployees.length === 0) {
                toast.error(isAll ? 'لا يوجد موظفون مسجلون بالشركة لتطبيق العملية عليهم.' : `لم يتم العثور على الموظف "${rawName}".`);
                return;
            }

            const amount = Number(data.amount) || 0;
            if (amount <= 0) {
                toast.error('مبلغ المكافأة أو الخصم يجب أن يكون أكبر من صفر.');
                return;
            }

            const isBonus = (data.type || 'bonus') === 'bonus';
            const reason = data.reason || (isBonus ? 'مكافأة عبر المساعد الذكي' : 'خصم / استقطاع عبر المساعد الذكي');
            const { data: { user } } = await supabase.auth.getUser();

            // A. If it's a DEDUCTION: register in employee_loans so it appears in "السلف والاستقطاعات"
            if (!isBonus) {
                const loanPayloads = targetEmployees.map(emp => ({
                    company_id: company.id,
                    employee_id: emp.id,
                    total_amount: amount,
                    monthly_installment: amount,
                    repayment_months: 1,
                    remaining_amount: amount,
                    status: 'active',
                    notes: `استقطاع / خصم: ${reason}`
                }));

                const { data: insertedLoans, error: loanErr } = await supabase
                    .from('employee_loans')
                    .insert(loanPayloads)
                    .select();

                if (loanErr) {
                    console.error('[useAssistantTools] loan insert error:', loanErr.message);
                    throw loanErr;
                } else if (insertedLoans) {
                    for (const l of insertedLoans) {
                        await logAudit({
                            companyId: company.id,
                            userId: user?.id,
                            action: 'CREATE_DEDUCTION_LOAN_AI',
                            tableName: 'employee_loans',
                            recordId: l.id,
                            newData: l
                        });
                    }
                }
            }

            // B. Also update or append to open payrolls if they exist
            for (const emp of targetEmployees) {
                try {
                    const { data: payrolls } = await supabase
                        .from('payrolls')
                        .select('*')
                        .eq('company_id', company.id)
                        .eq('employee_id', emp.id)
                        .order('start_date', { ascending: false })
                        .limit(1);

                    if (payrolls && payrolls.length > 0) {
                        const payroll = payrolls[0];
                        const currentBreakdown = Array.isArray(payroll.breakdown) ? [...payroll.breakdown] : [];
                        currentBreakdown.push({
                            date: new Date().toISOString().split('T')[0],
                            rule_name: reason,
                            action_type: isBonus ? 'custom_bonus' : 'custom_deduction',
                            amount: amount,
                            is_deduction: !isBonus
                        });

                        const ruleBonusesSum = currentBreakdown
                            .filter(item => !item.is_deduction && item.action_type !== 'paid_leave')
                            .reduce((sum, item) => sum + Number(item.amount || 0), 0);

                        const totalDeductions = currentBreakdown
                            .filter(item => item.is_deduction)
                            .reduce((sum, item) => sum + Number(item.amount || 0), 0);

                        const baseSalary = Number(payroll.base_salary) || 0;
                        const housing = Number(payroll.housing) || 0;
                        const transport = Number(payroll.transport) || 0;
                        let newNet = baseSalary + housing + transport + ruleBonusesSum - totalDeductions;
                        if (newNet < 0) newNet = 0;

                        await supabase
                            .from('payrolls')
                            .update({
                                breakdown: currentBreakdown,
                                deductions: totalDeductions,
                                overtime_amount: ruleBonusesSum,
                                net_salary: Math.round(newNet * 100) / 100,
                                extra_allowances: currentBreakdown.filter(item => !item.is_deduction)
                            })
                            .eq('id', payroll.id);
                    }
                } catch (pErr) {
                    console.warn('[useAssistantTools] payroll update skip:', pErr.message);
                }
            }

            const actionTitle = isBonus ? 'مكافأة' : 'خصم / استقطاع';
            const msgContent = isAll
                ? `🎯 تم بنجاح تسجيل **${actionTitle}** قدره **${amount} ${currencyWord}** لجميع الموظفين النشطين (${targetEmployees.length} موظف)، وتم قيده فوراً في تابة **السلف والاستقطاعات** ومسيرات الرواتب بنجاح (السبب: ${reason}).`
                : `🎯 تم بنجاح تسجيل **${actionTitle}** قدره **${amount} ${currencyWord}** للموظف **${targetEmployees[0].name}**، وتم قيده فوراً في تابة **السلف والاستقطاعات** ومسير الراتب (السبب: ${reason}).`;

            toast.success(isAll ? `تم تسجيل ${actionTitle} لجميع الموظفين (${targetEmployees.length} موظف)` : `تم تسجيل ${actionTitle} للموظف ${targetEmployees[0].name}`);
            setMessages(p => [...p, {
                id: Date.now().toString(),
                role: 'assistant',
                content: msgContent,
                time: getLocalTime()
            }]);

            if (reloadData) reloadData();
        } catch (err) {
            console.error('[useAssistantTools] executeRecordAdjustment:', err.message);
            toast.error(`فشل قيد البند المالي: ${err.message}`);
        }
    }, [company, findEmployeeByName, reloadData, setMessages, currencyWord, getLocalTime]);

    // Schedule management
    const toggleSchedule = useCallback(async (sched) => {
        try {
            const { error } = await supabase
                .from('report_schedules')
                .update({ is_active: !sched.is_active })
                .eq('id', sched.id);
            if (error) throw error;
            reloadData();
        } catch (err) {
            console.error('[useAssistantTools] toggleSchedule:', err.message);
            toast.error('فشل تحديث حالة الجدول');
        }
    }, [reloadData]);

    const deleteSchedule = useCallback(async (id, onConfirmed) => {
        if (!onConfirmed) return;
        try {
            const { error } = await supabase
                .from('report_schedules')
                .delete()
                .eq('id', id);
            if (error) throw error;
            toast.success('تم حذف الجدول بنجاح');
            reloadData();
        } catch (err) {
            console.error('[useAssistantTools] deleteSchedule:', err.message);
            toast.error('فشل حذف الجدول');
        }
    }, [reloadData]);

    const saveSchedule = useCallback(async (form, isEdit) => {
        try {
            const payload = {
                ...form,
                company_id: company.id,
                updated_at: new Date()
            };

            const { error } = isEdit
                ? await supabase.from('report_schedules').update(payload).eq('id', form.id)
                : await supabase.from('report_schedules').insert([payload]);

            if (error) throw error;
            toast.success(isEdit ? 'تم تحديث الجدول بنجاح' : 'تم إنشاء الجدول بنجاح');
            reloadData();
            return true;
        } catch (err) {
            console.error('[useAssistantTools] saveSchedule:', err.message);
            toast.error(`فشل حفظ الجدول: ${err.message}`);
            return false;
        }
    }, [company, reloadData]);

    // 7. Generate & Process Payroll Period
    const executeGeneratePayroll = useCallback(async (actionData) => {
        try {
            const data = actionData || {};
            const startDate = data.start_date;
            const endDate = data.end_date;
            const empName = (data.employee_name || data.name || '').trim();

            if (!startDate || !endDate) {
                toast.error('يرجى تحديد تاريخ بداية ونهاية الفترة لحساب مسير الرواتب.');
                return;
            }

            toast.info(`جارٍ تشغيل وحساب مسير الرواتب للفترة من ${startDate} إلى ${endDate}...`);

            const { data: resData, error } = await supabase.functions.invoke('process-payroll', {
                body: {
                    company_id: company.id,
                    start_date: startDate,
                    end_date: endDate,
                }
            });

            if (error) {
                let errMsg = error.message;
                try {
                    const body = typeof error.context?.body === 'string' ? JSON.parse(error.context.body) : error.context?.body;
                    if (body?.error) errMsg = body.error;
                } catch (_) {}
                throw new Error(errMsg);
            }

            if (!resData?.success) {
                throw new Error(resData?.error || 'تعذر حساب مسير الرواتب');
            }

            // Find the generated payroll for this employee or the first employee in this run
            let targetPayroll = null;
            if (empName) {
                const emp = await findEmployeeByName(empName);
                if (emp) {
                    const { data: pData } = await supabase
                        .from('payrolls')
                        .select('id, net_salary, base_salary, days_worked, total_days')
                        .eq('company_id', company.id)
                        .eq('employee_id', emp.id)
                        .eq('start_date', startDate)
                        .eq('end_date', endDate)
                        .maybeSingle();
                    if (pData) targetPayroll = { ...pData, empName: emp.name };
                }
            }

            const count = resData.processed_employees ?? 0;
            toast.success(`تم إنشاء وحساب مسير الرواتب بنجاح لـ ${count} موظف.`);

            if (targetPayroll) {
                setMessages(p => [...p, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: `🎉 **تم احتساب مسيرة الرواتب بنجاح للموظف ${targetPayroll.empName}!**\n- صافي الراتب: **${Number(targetPayroll.net_salary).toLocaleString()} ${currencyWord}**\n- أيام العمل المسجلة: **${targetPayroll.days_worked} من أصل ${targetPayroll.total_days} يوم**\n\nيمكنك الآن فتح قسيمة الراتب الرسمية وطباعتها مباشرة من الزر أدناه:`,
                    time: getLocalTime(),
                    action: {
                        type: 'view_salary_slip',
                        payroll_id: targetPayroll.id,
                        employee_name: targetPayroll.empName
                    }
                }]);
            }

            if (reloadData) reloadData();
        } catch (err) {
            console.error('[useAssistantTools] executeGeneratePayroll:', err.message);
            toast.error(`فشل إنشاء مسير الرواتب: ${err.message}`);
        }
    }, [company, findEmployeeByName, reloadData, setMessages, currencyWord, getLocalTime]);

    return { 
        executeAddEmployee, 
        executeUpdateEmployee,
        executeCreateLeave,
        executeUpdateLeaveStatus,
        executeRecordLoan,
        executeRecordAdjustment,
        executeGeneratePayroll,
        toggleSchedule, 
        deleteSchedule, 
        saveSchedule 
    };
};
