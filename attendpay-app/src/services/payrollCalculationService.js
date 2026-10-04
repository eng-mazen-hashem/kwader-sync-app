/**
 * In-App Payroll Calculation Service
 * Fully client-side compatible payroll engine mirroring the Edge Function logic.
 * Acts as a rock-solid fallback whenever the Supabase Edge Function is unreachable,
 * offline, un-deployed, or blocked by network/CORS issues.
 */

// Arabic day name to JS Date.getDay() mapping
const AR_DAY_TO_JS = {
  'الأحد': 0,
  'الاثنين': 1,
  'الإثنين': 1,
  'الثلاثاء': 2,
  'الأربعاء': 3,
  'الخميس': 4,
  'الجمعة': 5,
  'السبت': 6,
};

function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(/[^0-9.-]+/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function isFullCalendarMonth(start, end) {
  return (
    start.getDate() === 1 &&
    end.getFullYear() === start.getFullYear() &&
    end.getMonth() === start.getMonth() &&
    end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate()
  );
}

function getPeriodRatio(start, end, totalDays) {
  if (isFullCalendarMonth(start, end)) {
    return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
  }
  if (totalDays >= 28 && totalDays <= 31) {
    return 1.0;
  }
  return totalDays / 30;
}

function countScheduledDays(periodStart, periodEnd, workDaysNames) {
  const workDayNums = new Set((workDaysNames || []).map(d => AR_DAY_TO_JS[d] ?? -1).filter(d => d >= 0));
  // If no work days defined, default to 6 days/week (except Friday or Sunday)
  if (workDayNums.size === 0) {
    for (let i = 0; i <= 6; i++) {
      if (i !== 5) workDayNums.add(i); // except Friday
    }
  }
  let count = 0;
  const cur = new Date(periodStart);
  while (cur <= periodEnd) {
    if (workDayNums.has(cur.getDay())) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(1, count);
}

function shiftDailyHours(startTime, endTime, breakMinutes, shiftType, targetHours) {
  if (shiftType === 'flexible' && targetHours && targetHours > 0) {
    return targetHours;
  }
  if (!startTime || !endTime) return 8;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let startMins = sh * 60 + (sm || 0);
  let endMins = eh * 60 + (em || 0);
  if (endMins <= startMins) endMins += 24 * 60;
  const totalMins = endMins - startMins - (breakMinutes || 0);
  return totalMins > 0 ? totalMins / 60 : 8;
}

/**
 * Calculates payroll directly using Supabase DB tables.
 *
 * @param {object} params
 * @param {object} params.supabase Supabase client instance
 * @param {string} params.companyId Company UUID
 * @param {string} params.startDate 'YYYY-MM-DD'
 * @param {string} params.endDate 'YYYY-MM-DD'
 */
export async function calculatePayrollLocally({ supabase, companyId, startDate, endDate }) {
  if (!supabase || !companyId || !startDate || !endDate) {
    throw new Error('المعاملات المطلوبة مفقودة: startDate أو endDate أو companyId');
  }

  const periodStart = new Date(startDate);
  const periodEnd = new Date(endDate);
  const periodTotalDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const isFinalMonthly = isFullCalendarMonth(periodStart, periodEnd) || (periodTotalDays >= 28 && periodTotalDays <= 31);

  // 1. Fetch company settings
  const { data: companyData, error: compErr } = await supabase
    .from('companies')
    .select('settings')
    .eq('id', companyId)
    .single();

  if (compErr) {
    console.warn('[payrollService] Error fetching company settings, using defaults:', compErr.message);
  }

  const companySettings = companyData?.settings || {};
  const advanceRate = num(companySettings.weekly_advance_rate || 0);
  const isAdvanceMode = advanceRate > 0 && companySettings.payroll_mode === 'weekly_advance';
  const currentRunType = isAdvanceMode ? (isFinalMonthly ? 'monthly_final' : 'weekly_advance') : 'regular';

  // 2. Fetch existing payrolls for manual bonuses & slip IDs preservation
  const { data: existingPayrolls } = await supabase
    .from('payrolls')
    .select('id, employee_id, breakdown')
    .eq('company_id', companyId)
    .eq('start_date', startDate)
    .eq('end_date', endDate);

  const customBonusesByEmp = {};
  const existingIdByEmp = {};
  const loanReverts = {};

  for (const ep of (existingPayrolls || [])) {
    if (ep.id) existingIdByEmp[ep.employee_id] = ep.id;
    let bd = [];
    try {
      bd = typeof ep.breakdown === 'string' ? JSON.parse(ep.breakdown) : (ep.breakdown || []);
    } catch (_) {}

    // 1. Revert previous loan deductions before recalculating so loans are never double-deducted
    const loanEntries = bd.filter(i => i.action_type === 'deduct_loan' && i.loan_id);
    for (const le of loanEntries) {
      loanReverts[le.loan_id] = (loanReverts[le.loan_id] || 0) + num(le.amount);
    }

    // 2. Preserve custom bonuses added manually
    const bonuses = bd.filter(b => b.action_type === 'custom_bonus');
    if (bonuses.length > 0) {
      customBonusesByEmp[ep.employee_id] = bonuses.map(b => ({
        reason: b.rule_name || 'مكافأة استثنائية',
        amount: num(b.amount),
        percentage: num(b.percentage || 0),
      }));
    }
  }

  // Restore reverted loan amounts back to employee_loans before recalculating
  for (const [loanId, amountToRevert] of Object.entries(loanReverts)) {
    if (amountToRevert <= 0) continue;
    const { data: loanData } = await supabase
      .from('employee_loans')
      .select('remaining_amount, status')
      .eq('id', loanId)
      .single();
    if (loanData) {
      const newRemaining = round2(num(loanData.remaining_amount) + amountToRevert);
      await supabase
        .from('employee_loans')
        .update({
          remaining_amount: newRemaining,
          status: newRemaining > 0 ? 'active' : loanData.status,
        })
        .eq('id', loanId);
    }
  }

  // 3. Fetch weekly advances if monthly_final
  const weeklyAdvancesByEmp = {};
  if (isFinalMonthly && isAdvanceMode) {
    const { data: weeklyRuns } = await supabase
      .from('payrolls')
      .select('employee_id, start_date, end_date, advance_paid, gross_earned, run_type')
      .eq('company_id', companyId)
      .eq('run_type', 'weekly_advance')
      .gte('start_date', startDate)
      .lte('end_date', endDate);

    for (const wr of (weeklyRuns || [])) {
      if (!weeklyAdvancesByEmp[wr.employee_id]) weeklyAdvancesByEmp[wr.employee_id] = [];
      weeklyAdvancesByEmp[wr.employee_id].push({
        period: `${wr.start_date} → ${wr.end_date}`,
        advance_paid: num(wr.advance_paid),
        gross_earned: num(wr.gross_earned),
      });
    }
  }

  // 4. Parallel fetch of all required data
  const [rulesRes, empRes, attRes, loansRes, leavesRes, shiftsRes] = await Promise.all([
    supabase
      .from('hr_rules')
      .select('id, name, trigger_event, conditions, actions, logic_mode, priority')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('priority', { ascending: false }),

    supabase
      .from('employees')
      .select('id, name, base_salary, status, housing_allowance, transport_allowance, exclude_from_weekly_advance')
      .eq('company_id', companyId)
      .neq('status', 'inactive'),

    supabase
      .from('processed_attendance')
      .select('employee_id, date, status, late_minutes, early_leave_minutes, work_hours')
      .eq('company_id', companyId)
      .gte('date', startDate)
      .lte('date', endDate),

    supabase
      .from('employee_loans')
      .select('id, employee_id, monthly_installment, remaining_amount, status, is_fixed')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .gt('remaining_amount', 0),

    supabase
      .from('leave_requests')
      .select('employee_id, start_date, end_date, leave_type')
      .eq('company_id', companyId)
      .eq('status', 'approved')
      .lte('start_date', endDate)
      .gte('end_date', startDate),

    supabase
      .from('shifts')
      .select('id, name, work_days, start_time, end_time, break_duration, shift_type, target_hours, deduct_half_on_missing, early_arrival_grace_minutes, overtime_start_after_minutes, overtime_rate, overtime_rate_start_hours, shift_employees(employee_id)')
      .eq('company_id', companyId),
  ]);

  if (empRes.error) throw new Error(`خطأ في جلب بيانات الموظفين: ${empRes.error.message}`);
  const employees = empRes.data || [];
  if (employees.length === 0) {
    throw new Error('لا يوجد موظفون نشطون في هذه الشركة');
  }

  const rules = rulesRes.data || [];
  const attendance = attRes.data || [];
  const loans = loansRes.data || [];
  const leaves = leavesRes.data || [];
  const shifts = shiftsRes.data || [];

  // Index by employee
  const attByEmp = {};
  for (const rec of attendance) {
    if (!attByEmp[rec.employee_id]) attByEmp[rec.employee_id] = [];
    attByEmp[rec.employee_id].push(rec);
  }

  const loansByEmp = {};
  for (const loan of loans) {
    if (!loansByEmp[loan.employee_id]) loansByEmp[loan.employee_id] = [];
    loansByEmp[loan.employee_id].push(loan);
  }

  const leavesByEmp = {};
  for (const lv of leaves) {
    if (!leavesByEmp[lv.employee_id]) leavesByEmp[lv.employee_id] = new Map();
    const cur = new Date(lv.start_date);
    const end = new Date(lv.end_date);
    while (cur <= end) {
      leavesByEmp[lv.employee_id].set(cur.toISOString().split('T')[0], lv.leave_type);
      cur.setDate(cur.getDate() + 1);
    }
  }

  // Shift assignment mapping with robust fallback to default/first company shift
  const defaultShift = shifts[0] || {
    work_days: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
    start_time: '09:00:00',
    end_time: '17:00:00',
    break_duration: 60,
    shift_type: 'standard',
    target_hours: 8,
    deduct_half_on_missing: false,
    overtime_rate: 1.0,
  };

  const shiftByEmp = {};
  for (const shift of shifts) {
    for (const se of (shift.shift_employees || [])) {
      shiftByEmp[se.employee_id] = shift;
    }
  }

  // 5. Calculate each employee's payroll
  const payrollsToInsert = [];
  const periodRatio = getPeriodRatio(periodStart, periodEnd, periodTotalDays);

  for (const emp of employees) {
    const bs = num(emp.base_salary);
    const period_bs = bs * periodRatio;
    const housingAmt = num(emp.housing_allowance) * periodRatio;
    const transportAmt = num(emp.transport_allowance) * periodRatio;

    // Use assigned shift or graceful default fallback
    const shift = shiftByEmp[emp.id] || defaultShift;
    const workDaysNames = shift.work_days && shift.work_days.length > 0
      ? shift.work_days
      : ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
    
    const scheduledDays = countScheduledDays(periodStart, periodEnd, workDaysNames);
    const dailyShiftHours = shiftDailyHours(
      shift.start_time,
      shift.end_time,
      num(shift.break_duration),
      shift.shift_type,
      num(shift.target_hours)
    );

    const scheduledHours = scheduledDays * dailyShiftHours;
    const hourlyRate = scheduledHours > 0 ? period_bs / scheduledHours : 0;
    const minuteRate = hourlyRate / 60;
    const dailyRate = dailyShiftHours > 0 ? hourlyRate * dailyShiftHours : 0;

    const empAtt = attByEmp[emp.id] || [];
    const empLeaves = leavesByEmp[emp.id] || new Map();

    let totalWorkHrs = 0;
    let totalRegularWorkHrs = 0;
    let totalOvertimeHrs = 0;
    let totalOvertimePay = 0;
    let ruleDeductions = 0;
    let ruleBonuses = 0;
    let daysPresent = 0;
    const breakdown = [];

    let missingRegularHrs = 0;
    const attMap = {};
    for (const a of empAtt) attMap[a.date] = a;

    const cur = new Date(periodStart);
    while (cur <= periodEnd) {
      const dateStr = cur.toISOString().split('T')[0];
      const dayOfWeek = cur.getDay();
      const isWorkDay = workDaysNames.some(d => AR_DAY_TO_JS[d] === dayOfWeek);
      const att = attMap[dateStr];
      const leaveType = empLeaves.get(dateStr);
      const isLeaveDay = !!leaveType;

      if (isLeaveDay && isWorkDay) {
        const isPaidLeave = ['annual', 'sick', 'emergency'].includes(leaveType);
        const dayAmount = round2(dailyShiftHours * hourlyRate);
        if (isPaidLeave) {
          totalWorkHrs += dailyShiftHours;
          totalRegularWorkHrs += dailyShiftHours;
          daysPresent++;
          breakdown.push({
            date: dateStr,
            rule_name: `إجازة مدفوعة (${leaveType === 'annual' ? 'سنوية' : leaveType === 'sick' ? 'مرضية' : 'طارئة'})`,
            action_type: 'paid_leave',
            amount: round2(dayAmount),
            is_deduction: false,
          });
        } else {
          ruleDeductions += round2(dayAmount);
          breakdown.push({
            date: dateStr,
            rule_name: 'إجازة غير مدفوعة الأجر',
            action_type: 'unpaid_leave',
            amount: round2(dayAmount),
            is_deduction: true,
          });
        }
      } else if (isWorkDay && !isLeaveDay) {
        if (!att || att.status === 'absent') {
          missingRegularHrs += dailyShiftHours;
        } else {
          let workHrs = num(att.work_hours);
          const isMissingPunch = att.status === 'missing_checkout' || att.status === 'missing_checkin';

          if (isMissingPunch && shift?.deduct_half_on_missing) {
            const halfDayAmount = round2(dailyRate / 2);
            ruleDeductions += halfDayAmount;
            breakdown.push({
              date: dateStr,
              rule_name: `خصم نصف الشفت (${att.status === 'missing_checkin' ? 'بصمة دخول مفقودة' : 'بصمة انصراف مفقودة'})`,
              action_type: 'deduct_half_shift',
              amount: halfDayAmount,
              is_deduction: true,
            });
            workHrs = dailyShiftHours;
          }

          if (!isMissingPunch) {
            daysPresent++;
          } else {
            daysPresent += shift?.deduct_half_on_missing ? 0.5 : 1;
          }
          totalWorkHrs += workHrs;

          const regularHrs = Math.min(workHrs, dailyShiftHours);
          totalRegularWorkHrs += regularHrs;
          
          missingRegularHrs += Math.max(0, dailyShiftHours - regularHrs);

          if (workHrs > dailyShiftHours) {
            const otHours = round2(workHrs - dailyShiftHours);
            const otRate = num(shift?.overtime_rate || 1.5);
            const otTierStart = num(shift?.overtime_rate_start_hours || 0);

            let weightedOtHours = 0;
            if (otTierStart <= 0) {
              weightedOtHours = otHours * otRate;
            } else {
              const tier1 = Math.min(otHours, otTierStart);
              const tier2 = Math.max(0, otHours - otTierStart);
              weightedOtHours = tier1 * 1.0 + tier2 * otRate;
            }

            const dayOtPay = round2(weightedOtHours * hourlyRate);
            if (dayOtPay > 0) {
              totalOvertimeHrs += otHours;
              totalOvertimePay += dayOtPay;
              breakdown.push({
                date: dateStr,
                rule_name: `ساعات عمل إضافية (${otHours}س بمعدل ${otRate}x)`,
                action_type: 'overtime_pay',
                amount: dayOtPay,
                hours: otHours,
                rate: otRate,
                is_deduction: false,
              });
            }
          }
        }

        // Apply HR Rules regardless of present or absent
        const lateMins = att ? num(att.late_minutes) : 0;
        const earlyMins = att ? num(att.early_leave_minutes) : 0;
        const attStatus = att ? att.status : 'absent';

        for (const rule of rules) {
          const isLate = attStatus === 'late' || lateMins > 0;
          const isAbsent = attStatus === 'absent';
          const isEarly = earlyMins > 0;

          let fired = false;
          if (rule.trigger_event === 'late_arrival' && isLate) fired = true;
          if (rule.trigger_event === 'absence' && isAbsent) fired = true;
          if (rule.trigger_event === 'early_departure' && isEarly) fired = true;
          if (!fired) continue;

          const conds = rule.conditions || [];
          let metCount = 0;
          for (const c of conds) {
            let tv = 0;
            if (c.field === 'minutes_late') tv = lateMins;
            if (c.field === 'minutes_early') tv = earlyMins;
            const cv = parseFloat(c.value) || 0;
            const cv2 = parseFloat(c.value2) || 0;
            let met = false;
            switch (c.operator) {
              case 'gt': met = tv > cv; break;
              case 'gte': met = tv >= cv; break;
              case 'lt': met = tv < cv; break;
              case 'lte': met = tv <= cv; break;
              case 'eq': met = tv === cv; break;
              case 'between': met = tv >= cv && tv <= cv2; break;
              default: break;
            }
            if (met) metCount++;
          }

          const passed =
            conds.length === 0 ||
            (rule.logic_mode === 'ALL' && metCount === conds.length) ||
            (rule.logic_mode === 'ANY' && metCount > 0);
          if (!passed) continue;

          for (const act of rule.actions || []) {
            let amount = 0;
            const isDeduction = String(act.type).startsWith('deduct');
            switch (act.type) {
              case 'deduct_fixed':
              case 'add_bonus':
                amount = parseFloat(act.value) || 0; break;
              case 'deduct_percentage':
              case 'add_percentage':
                amount = (bs * (parseFloat(act.value) || 0)) / 100; break;
              case 'deduct_daily_rate':
                amount = dailyRate * (parseFloat(act.value) || 0); break;
              case 'deduct_per_minute':
              case 'add_per_minute': {
                const mins = rule.trigger_event === 'late_arrival' ? lateMins : earlyMins;
                amount = mins * minuteRate * (parseFloat(act.value) || 1); break;
              }
              default: break;
            }
            if (amount <= 0) continue;
            if (isDeduction) ruleDeductions += amount;
            else ruleBonuses += amount;
            breakdown.push({
              date: dateStr,
              rule_name: rule.name,
              action_type: act.type,
              amount: round2(amount),
              is_deduction: isDeduction,
            });
          }
        }
      }

      cur.setDate(cur.getDate() + 1);
    }

    const earnedBase = totalRegularWorkHrs > 0 && hourlyRate > 0
      ? round2(totalRegularWorkHrs * hourlyRate)
      : 0;

    const unworkedAmount = round2(missingRegularHrs * hourlyRate);
    if (currentRunType !== 'weekly_advance' && unworkedAmount > 0) {
      ruleDeductions += unworkedAmount;
      breakdown.push({
        date: startDate,
        rule_name: `استقطاع ساعات وأيام عدم الحضور (${round2(missingRegularHrs)} ساعة)`,
        action_type: 'deduct_unworked_hours',
        amount: unworkedAmount,
        is_deduction: true,
      });
    }

    // Loans deduction
    const empLoansArr = loansByEmp[emp.id] || [];
    let loanDeduction = 0;
    for (const l of empLoansArr) {
      // Do not deduct loans during weekly advances; they are settled in the monthly_final run.
      if (currentRunType === 'weekly_advance') continue;

      const isShortTerm = num(l.repayment_months) <= 1;
      const deductAmt = isShortTerm
        ? num(l.remaining_amount)
        : Math.min(
            l.is_fixed ? num(l.monthly_installment) : num(l.monthly_installment) * periodRatio,
            num(l.remaining_amount)
          );

      if (deductAmt > 0) {
        loanDeduction += deductAmt;
        breakdown.push({
          date: startDate,
          rule_name: isShortTerm ? 'خصم سلفة بالكامل' : (l.is_fixed ? 'قسط سلفة ثابت' : 'قسط سلفة'),
          action_type: 'deduct_loan',
          amount: round2(deductAmt),
          is_deduction: true,
          loan_id: l.id,
        });
      }
    }

    // Custom bonuses
    const savedBonuses = customBonusesByEmp[emp.id] || [];
    for (const bonus of savedBonuses) {
      let amt = bonus.amount;
      if (bonus.percentage > 0) {
        amt = round2(period_bs * bonus.percentage / 100);
      }
      if (amt > 0) {
        ruleBonuses += amt;
        breakdown.push({
          date: startDate,
          rule_name: bonus.reason,
          action_type: 'custom_bonus',
          amount: amt,
          percentage: bonus.percentage,
          is_deduction: false,
        });
      }
    }

    // Weekly advance logic
    let advancePaid = 0;
    let weeklyAdvancesDeduction = 0;
    if (isAdvanceMode) {
      if (currentRunType === 'weekly_advance') {
        if (!emp.exclude_from_weekly_advance) {
          advancePaid = round2(earnedBase * (advanceRate / 100));
        }
      } else if (currentRunType === 'monthly_final') {
        const empPrevAdvances = weeklyAdvancesByEmp[emp.id] || [];
        weeklyAdvancesDeduction = empPrevAdvances.reduce((s, a) => s + a.advance_paid, 0);
      }
    }

    const totalDeductions = round2(ruleDeductions + loanDeduction + weeklyAdvancesDeduction);
    const totalBonuses = round2(ruleBonuses + totalOvertimePay);

    let netSalary = 0;
    if (currentRunType === 'weekly_advance') {
      netSalary = round2(advancePaid - totalDeductions);
      if (netSalary < 0) netSalary = 0;
    } else {
      netSalary = round2(period_bs + housingAmt + transportAmt + totalBonuses - totalDeductions);
      if (netSalary < 0) netSalary = 0;
    }

    const existingId = existingIdByEmp[emp.id];
    payrollsToInsert.push({
      ...(existingId ? { id: existingId } : {}),
      company_id: companyId,
      employee_id: emp.id,
      start_date: startDate,
      end_date: endDate,
      run_type: currentRunType,
      advance_rate: isAdvanceMode ? advanceRate : 0,
      gross_earned: round2(earnedBase + totalOvertimePay),
      advance_paid: advancePaid,
      base_salary: round2(period_bs),
      net_salary: netSalary,
      deductions: totalDeductions,
      housing: round2(housingAmt),
      transport: round2(transportAmt),
      overtime_hours: round2(totalOvertimeHrs),
      overtime_amount: round2(totalOvertimePay),
      days_worked: daysPresent,
      total_days: scheduledDays,
      total_work_hours: round2(totalWorkHrs),
      extra_allowances: breakdown.filter(r => !r.is_deduction),
      extra_deductions: breakdown.filter(r => r.is_deduction),
      breakdown,
      created_at: new Date().toISOString(),
    });
  }

  // 6. Delete old payrolls for the same company and date range
  await supabase
    .from('payrolls')
    .delete()
    .eq('company_id', companyId)
    .eq('start_date', startDate)
    .eq('end_date', endDate);

  // 7. Insert newly calculated payrolls
  const { error: insErr } = await supabase
    .from('payrolls')
    .insert(payrollsToInsert);

  if (insErr) {
    throw new Error(`خطأ في حفظ مسير الرواتب: ${insErr.message}`);
  }

  // 8. Update loans remaining balance if loans were deducted
  for (const [empId, empLoansArr] of Object.entries(loansByEmp)) {
    const empNewPayroll = payrollsToInsert.find(p => p.employee_id === empId);
    if (!empNewPayroll) continue;

    const loanEntries = empNewPayroll.breakdown.filter(i => i.action_type === 'deduct_loan' && i.loan_id);
    for (const le of loanEntries) {
      const loan = empLoansArr.find(l => l.id === le.loan_id);
      if (loan) {
        const newRemaining = round2(Math.max(0, num(loan.remaining_amount) - num(le.amount)));
        await supabase
          .from('employee_loans')
          .update({
            remaining_amount: newRemaining,
            status: newRemaining <= 0 ? 'paid' : 'active',
          })
          .eq('id', loan.id);
      }
    }
  }

  return {
    success: true,
    processed_employees: payrollsToInsert.length,
    run_type: currentRunType,
  };
}
