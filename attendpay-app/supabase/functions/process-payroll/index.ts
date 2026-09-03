import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const respond = (body: object) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });

const fail = (msg: string) => respond({ success: false, error: msg });

function num(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(/[^0-9.-]+/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── خريطة أسماء أيام الأسبوع (عربي → JS getDay()) ──────────────────────────
const AR_DAY_TO_JS: Record<string, number> = {
  'الأحد':    0,
  'الاثنين':  1,  'الإثنين': 1,
  'الثلاثاء': 2,
  'الأربعاء': 3,
  'الخميس':   4,
  'الجمعة':   5,
  'السبت':    6,
};

function countScheduledDays(
  periodStart: Date,
  periodEnd: Date,
  workDaysNames: string[]
): number {
  const workDayNums = new Set(workDaysNames.map(d => AR_DAY_TO_JS[d] ?? -1).filter(d => d >= 0));
  let count = 0;
  const cur = new Date(periodStart);
  while (cur <= periodEnd) {
    if (workDayNums.has(cur.getDay())) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function shiftDailyHours(startTime: string, endTime: string, breakMinutes: number, shiftType?: string, targetHours?: number): number {
  if (shiftType === 'flexible' && targetHours && targetHours > 0) {
    return targetHours;
  }
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let startMins = sh * 60 + sm;
  let endMins   = eh * 60 + em;
  if (endMins <= startMins) endMins += 24 * 60;
  const totalMins = endMins - startMins - (breakMinutes || 0);
  return totalMins > 0 ? totalMins / 60 : 8;
}

function getPeriodRatio(start: Date, end: Date, totalDays: number): number {
  const isFullCalendarMonth =
    start.getDate() === 1 &&
    end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();

  if (isFullCalendarMonth) {
    return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
  }
  return totalDays / 30;
}

// ─── تحقق: هل الفترة شهر كامل (من أول إلى آخر يوم)؟ ─────────────────────────
function isFullCalendarMonth(start: Date, end: Date): boolean {
  return (
    start.getDate() === 1 &&
    end.getFullYear() === start.getFullYear() &&
    end.getMonth() === start.getMonth() &&
    end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate()
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { start_date, end_date, company_id } = body;

    if (!start_date || !end_date || !company_id) {
      return fail('المعاملات المطلوبة مفقودة: start_date أو end_date أو company_id');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const periodStart = new Date(start_date);
    const periodEnd   = new Date(end_date);
    const periodTotalDays = Math.round(
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    // ═══════════════════════════════════════════════════════════════════════
    // تحديد نوع المسيرة
    // ═══════════════════════════════════════════════════════════════════════
    const isFinalMonthly = isFullCalendarMonth(periodStart, periodEnd);

    // ═══════════════════════════════════════════════════════════════════════
    // جلب إعدادات الشركة (advance_rate)
    // ═══════════════════════════════════════════════════════════════════════
    const { data: companyData } = await supabase
      .from('companies')
      .select('settings')
      .eq('id', company_id)
      .single();

    const companySettings = companyData?.settings || {};
    const advanceRate      = num(companySettings.weekly_advance_rate || 0); // 0-100
    const isAdvanceMode    = advanceRate > 0 && companySettings.payroll_mode === 'weekly_advance';

    // ═══════════════════════════════════════════════════════════════════════
    // تحديد run_type للمسيرة الحالية
    // ═══════════════════════════════════════════════════════════════════════
    let currentRunType = 'regular';
    if (isAdvanceMode) {
      currentRunType = isFinalMonthly ? 'monthly_final' : 'weekly_advance';
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 0.5. استرجاع السلف المخصومة والمكافآت اليدوية إذا كانت هذه إعادة احتساب لنفس الفترة
    // ═══════════════════════════════════════════════════════════════════════
    const { data: existingPayrolls } = await supabase
      .from('payrolls')
      .select('employee_id, breakdown')
      .eq('company_id', company_id)
      .eq('start_date', start_date)
      .eq('end_date', end_date);

    const customBonusesByEmp: Record<string, { reason: string, percentage: number, amount: number }[]> = {};

    if (existingPayrolls && existingPayrolls.length > 0) {
      const loanReverts: Record<string, number> = {};
      for (const ep of existingPayrolls) {
        let bd = [];
        try {
          bd = typeof ep.breakdown === 'string' ? JSON.parse(ep.breakdown) : (ep.breakdown || []);
        } catch (e) {}
        
        // استرجاع أقساط السلف لإعادة رصيدها قبل الحذف
        const loanEntries = bd.filter((i: any) => i.action_type === 'deduct_loan' && i.loan_id);
        for (const le of loanEntries) {
          loanReverts[le.loan_id] = (loanReverts[le.loan_id] || 0) + num(le.amount);
        }

        // الاحتفاظ بالمكافآت الاستثنائية التي أضافها المدير يدوياً
        const customBonuses = bd.filter((i: any) => i.action_type === 'custom_bonus');
        if (customBonuses.length > 0) {
          customBonusesByEmp[ep.employee_id] = customBonuses.map((cb: any) => ({
            reason: cb.rule_name || cb.reason || 'مكافأة تميز',
            percentage: num(cb.percentage || 0),
            amount: num(cb.amount || 0),
          }));
        }
      }

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
              status: newRemaining > 0 ? 'active' : loanData.status
            })
            .eq('id', loanId);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // إذا كانت مسيرة شهرية نهائية: جلب السلف الأسبوعية السابقة لنفس الشهر
    // ═══════════════════════════════════════════════════════════════════════
    // السلف = مسيرات أسبوعية موجودة في نفس الشهر (start >= أول الشهر، end <= آخر الشهر)
    // وهي ليست نفس هذه المسيرة الشهرية
    const weeklyAdvancesByEmp: Record<string, { period: string; advance_paid: number; gross_earned: number }[]> = {};

    if (isFinalMonthly && isAdvanceMode) {
      const { data: weeklyRuns, error: weeklyErr } = await supabase
        .from('payrolls')
        .select('employee_id, start_date, end_date, advance_paid, gross_earned, run_type')
        .eq('company_id', company_id)
        .eq('run_type', 'weekly_advance')
        .gte('start_date', start_date)  // >= أول الشهر
        .lte('end_date', end_date);     // <= آخر الشهر

      if (weeklyErr) {
        console.error('[process-payroll] Error fetching weekly advances:', weeklyErr.message);
      }

      for (const wr of (weeklyRuns || [])) {
        if (!weeklyAdvancesByEmp[wr.employee_id]) weeklyAdvancesByEmp[wr.employee_id] = [];
        weeklyAdvancesByEmp[wr.employee_id].push({
          period: `${wr.start_date} → ${wr.end_date}`,
          advance_paid: num(wr.advance_paid),
          gross_earned: num(wr.gross_earned),
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 1. جلب كل البيانات موازياً
    // ═══════════════════════════════════════════════════════════════════════
    const [rulesRes, empRes, attRes, loansRes, leavesRes, shiftsRes] = await Promise.all([

      supabase
        .from('hr_rules')
        .select('id, name, trigger_event, conditions, actions, logic_mode, priority')
        .eq('company_id', company_id)
        .eq('is_active', true)
        .order('priority', { ascending: false }),

      supabase
        .from('employees')
        .select('id, name, base_salary, status, housing_allowance, transport_allowance, exclude_from_weekly_advance')
        .eq('company_id', company_id)
        .neq('status', 'inactive'),

      supabase
        .from('processed_attendance')
        .select('employee_id, date, status, late_minutes, early_leave_minutes, work_hours')
        .eq('company_id', company_id)
        .gte('date', start_date)
        .lte('date', end_date),

      supabase
        .from('employee_loans')
        .select('id, employee_id, monthly_installment, remaining_amount, status, is_fixed')
        .eq('company_id', company_id)
        .eq('status', 'active')
        .gt('remaining_amount', 0),

      supabase
        .from('leave_requests')
        .select('employee_id, start_date, end_date, leave_type')
        .eq('company_id', company_id)
        .eq('status', 'approved')
        .lte('start_date', end_date)
        .gte('end_date', start_date),

      supabase
        .from('shifts')
        .select('id, work_days, start_time, end_time, break_duration, shift_type, target_hours, deduct_half_on_missing, shift_employees(employee_id)')
        .eq('company_id', company_id)
        .eq('is_active', true),
    ]);

    if (rulesRes.error)  return fail(`خطأ في جلب قواعد الرواتب: ${rulesRes.error.message}`);
    if (empRes.error)    return fail(`خطأ في جلب بيانات الموظفين: ${empRes.error.message}`);
    if (attRes.error)    return fail(`خطأ في جلب سجلات الحضور: ${attRes.error.message}`);
    if (loansRes.error)  return fail(`خطأ في جلب بيانات السلف: ${loansRes.error.message}`);
    if (leavesRes.error) return fail(`خطأ في جلب الإجازات: ${leavesRes.error.message}`);
    if (shiftsRes.error) return fail(`خطأ في جلب الشيفتات: ${shiftsRes.error.message}`);

    const rules      = rulesRes.data  || [];
    const employees  = empRes.data    || [];
    const attendance = attRes.data    || [];
    const loans      = loansRes.data  || [];
    const leaves     = leavesRes.data || [];
    const shifts     = shiftsRes.data || [];

    if (employees.length === 0) {
      return fail('لا يوجد موظفون نشطون في هذه الشركة');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 2. فهرسة البيانات بالموظف
    // ═══════════════════════════════════════════════════════════════════════
    const attByEmp: Record<string, any[]> = {};
    for (const rec of attendance) {
      if (!attByEmp[rec.employee_id]) attByEmp[rec.employee_id] = [];
      attByEmp[rec.employee_id].push(rec);
    }

    const loansByEmp: Record<string, any[]> = {};
    for (const loan of loans) {
      if (!loansByEmp[loan.employee_id]) loansByEmp[loan.employee_id] = [];
      loansByEmp[loan.employee_id].push(loan);
    }

    const leavesByEmp: Record<string, Map<string, string>> = {};
    for (const lv of leaves) {
      if (!leavesByEmp[lv.employee_id]) leavesByEmp[lv.employee_id] = new Map<string, string>();
      const cur = new Date(lv.start_date);
      const end = new Date(lv.end_date);
      while (cur <= end) {
        leavesByEmp[lv.employee_id].set(cur.toISOString().split('T')[0], lv.leave_type);
        cur.setDate(cur.getDate() + 1);
      }
    }

    const shiftByEmp: Record<string, any> = {};
    for (const shift of shifts) {
      for (const se of (shift.shift_employees || [])) {
        shiftByEmp[se.employee_id] = shift;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 3. حساب الراتب لكل موظف
    // ═══════════════════════════════════════════════════════════════════════
    const payrollsToInsert: any[] = [];
    const periodRatio = getPeriodRatio(periodStart, periodEnd, periodTotalDays);

    const employeesWithoutShift = employees.filter((emp: any) => !shiftByEmp[emp.id]);
    if (employeesWithoutShift.length > 0) {
      const displayNames = employeesWithoutShift.slice(0, 3).map((e: any) => e.name).join('، ');
      const extraCount = employeesWithoutShift.length - 3;
      const extraText = extraCount > 0 ? ` و ${extraCount} آخرين` : '';
      return fail(`العملية متوقفة: يوجد ${employeesWithoutShift.length} موظف بدون شيفت عمل (مثال: ${displayNames}${extraText}). يجب تعيين شيفت لجميع الموظفين لحساب الرواتب بشكل صحيح.`);
    }

    for (const emp of employees) {
      const bs           = num(emp.base_salary);
      const period_bs    = bs * periodRatio;
      const housingAmt   = num(emp.housing_allowance) * periodRatio;
      const transportAmt = num(emp.transport_allowance) * periodRatio;

      const shift          = shiftByEmp[emp.id];
      const workDaysNames: string[] = shift.work_days || [];
      const scheduledDays  = countScheduledDays(periodStart, periodEnd, workDaysNames);

      const dailyShiftHours = shift
        ? shiftDailyHours(
            shift.start_time,
            shift.end_time,
            num(shift.break_duration),
            shift.shift_type,
            num(shift.target_hours)
          )
        : 8;

      const scheduledHours = scheduledDays * dailyShiftHours;
      const hourlyRate  = scheduledHours > 0 ? period_bs / scheduledHours : 0;
      const minuteRate  = hourlyRate / 60;
      const dailyRate   = dailyShiftHours > 0 ? hourlyRate * dailyShiftHours : 0;

      const empAtt    = attByEmp[emp.id]    || [];
      const empLeaves = leavesByEmp[emp.id] || new Map<string, string>();

      let totalWorkHrs   = 0;
      let ruleDeductions = 0;
      let ruleBonuses    = 0;
      let daysPresent    = 0;
      const breakdown: any[] = [];

      const attMap: Record<string, any> = {};
      for (const a of empAtt) attMap[a.date] = a;

      const cur = new Date(periodStart);
      while (cur <= periodEnd) {
        const dateStr    = cur.toISOString().split('T')[0];
        const dayOfWeek  = cur.getDay();
        const isWorkDay  = workDaysNames.some(d => AR_DAY_TO_JS[d] === dayOfWeek);
        const att        = attMap[dateStr];
        const leaveType  = empLeaves.get(dateStr);
        const isLeaveDay = !!leaveType;

        if (isLeaveDay && isWorkDay) {
          const isPaidLeave = ['annual', 'sick', 'emergency'].includes(leaveType!);
          const dayAmount = round2(dailyShiftHours * hourlyRate);
          if (isPaidLeave) {
            totalWorkHrs += dailyShiftHours;
            daysPresent++;
            breakdown.push({
              date: dateStr,
              rule_name: `إجازة مدفوعة (${leaveType === 'annual' ? 'سنوية' : leaveType === 'sick' ? 'مرضية' : 'طارئة'})`,
              action_type: 'paid_leave',
              amount: round2(dayAmount),
              is_deduction: false,
            });
          } else {
            breakdown.push({
              date: dateStr,
              rule_name: 'إجازة غير مدفوعة الأجر',
              action_type: 'unpaid_leave',
              amount: round2(dayAmount),
              is_deduction: true,
            });
          }
        } else if (isWorkDay && !isLeaveDay) {
          if (att) {
            const lateMins  = num(att.late_minutes);
            const earlyMins = num(att.early_leave_minutes);
            let workHrs     = num(att.work_hours);
            const isMissingPunch = att.status === 'missing_checkout' || att.status === 'missing_checkin';

            if (isMissingPunch && shift?.deduct_half_on_missing) {
              const halfShiftHrs = round2(dailyShiftHours / 2);
              workHrs = halfShiftHrs;
            }

            if (att.status === 'present' || att.status === 'late' || att.status === 'early_leave' || isMissingPunch) {
              if (!isMissingPunch) {
                daysPresent++;
              } else if (workHrs > 0) {
                daysPresent += shift?.deduct_half_on_missing ? 0.5 : 1;
              }
              totalWorkHrs += workHrs;

              if (isMissingPunch && shift?.deduct_half_on_missing) {
                breakdown.push({
                  date: dateStr,
                  rule_name: `خصم نصف الشفت (${att.status === 'missing_checkin' ? 'بصمة دخول مفقودة' : 'بصمة انصراف مفقودة'})`,
                  action_type: 'deduct_half_shift',
                  amount: round2(dailyRate / 2),
                  is_deduction: true,
                });
              }
            }

            for (const rule of rules) {
              const isLate   = att.status === 'late' || lateMins > 0;
              const isAbsent = att.status === 'absent';
              const isEarly  = earlyMins > 0;

              let fired = false;
              if (rule.trigger_event === 'late_arrival'    && isLate)   fired = true;
              if (rule.trigger_event === 'absence'         && isAbsent) fired = true;
              if (rule.trigger_event === 'early_departure' && isEarly)  fired = true;
              if (!fired) continue;

              const conds: any[] = rule.conditions || [];
              let metCount = 0;
              for (const c of conds) {
                let tv = 0;
                if (c.field === 'minutes_late')  tv = lateMins;
                if (c.field === 'minutes_early') tv = earlyMins;
                const cv  = parseFloat(c.value)  || 0;
                const cv2 = parseFloat(c.value2) || 0;
                let met = false;
                switch (c.operator) {
                  case 'gt':      met = tv >  cv; break;
                  case 'gte':     met = tv >= cv; break;
                  case 'lt':      met = tv <  cv; break;
                  case 'lte':     met = tv <= cv; break;
                  case 'eq':      met = tv === cv; break;
                  case 'between': met = tv >= cv && tv <= cv2; break;
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
                const isDeduction = (act.type as string).startsWith('deduct');
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
                }
                if (amount <= 0) continue;
                if (isDeduction) ruleDeductions += amount;
                else             ruleBonuses    += amount;
                breakdown.push({
                  date: dateStr, rule_name: rule.name,
                  action_type: act.type, amount: round2(amount),
                  is_deduction: isDeduction,
                });
              }
            }
          }
        }

        cur.setDate(cur.getDate() + 1);
      }

      // ── الراتب المستحق بالساعات الفعلية ──────────────────────────────────
      const earnedBase = totalWorkHrs > 0 && hourlyRate > 0
        ? round2(totalWorkHrs * hourlyRate)
        : 0;

      // ── خصم السلف (employee_loans) ────────────────────────────────────────
      const empLoansArr = loansByEmp[emp.id] || [];
      let loanDeduction = 0;

      for (const l of empLoansArr) {
        // If it's a weekly run, or a 1-month loan (short-term), deduct the entire remaining amount in full
        const isShortTerm = num(l.repayment_months) <= 1 || currentRunType === 'weekly_advance';
        const deductAmt = isShortTerm 
          ? num(l.remaining_amount)
          : Math.min(
              l.is_fixed ? num(l.monthly_installment) : num(l.monthly_installment) * periodRatio,
              num(l.remaining_amount)
            );

        if (deductAmt > 0) {
          loanDeduction += deductAmt;
          breakdown.push({
            date: start_date,
            rule_name: isShortTerm ? 'خصم سلفة بالكامل' : (l.is_fixed ? 'قسط سلفة ثابت' : 'قسط سلفة (حسب أيام الراتب)'),
            action_type: 'deduct_loan',
            amount: round2(deductAmt),
            is_deduction: true,
            loan_id: l.id
          });
        }
      }

      // ── تطبيق المكافآت الاستثنائية المحفوظة مسبقاً للموظف ───────────────────
      const savedBonuses = customBonusesByEmp[emp.id] || [];
      for (const bonus of savedBonuses) {
        let amt = bonus.amount;
        if (bonus.percentage > 0) {
          amt = round2(period_bs * bonus.percentage / 100);
        }
        if (amt > 0) {
          ruleBonuses += amt;
          breakdown.push({
            date: start_date,
            rule_name: bonus.reason,
            action_type: 'custom_bonus',
            amount: amt,
            percentage: bonus.percentage,
            is_deduction: false,
          });
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // ── منطق السلف الأسبوعية ─────────────────────────────────────────────
      // ═══════════════════════════════════════════════════════════════════════
      let grossEarned   = round2(earnedBase + housingAmt + transportAmt + ruleBonuses);
      let advancePaid   = 0;
      let weeklyAdvancesDeduction = 0;

      if (isAdvanceMode) {
        if (currentRunType === 'weekly_advance') {
          // ─── مسيرة أسبوعية: ندفع نسبة (advance_rate%) من المستحق ──────────
          // السلفة تحسب من الراتب الأساسي المستحق فقط (لا البدلات)
          if (emp.exclude_from_weekly_advance) {
            advancePaid = 0;
            breakdown.push({
              date: start_date,
              rule_name: 'مستبعد من السلفة الأسبوعية (يُصرف شهرياً بالكامل)',
              action_type: 'weekly_advance_excluded',
              amount: 0,
              is_deduction: false,
            });
          } else {
            advancePaid = round2(earnedBase * advanceRate / 100);
          }
        } else if (currentRunType === 'monthly_final') {
          // ─── مسيرة شهرية نهائية: نخصم السلف الأسبوعية السابقة ──────────
          const empWeeklyAdvances = weeklyAdvancesByEmp[emp.id] || [];
          const totalPrevAdvances = round2(
            empWeeklyAdvances.reduce((sum, w) => sum + w.advance_paid, 0)
          );

          if (totalPrevAdvances > 0) {
            weeklyAdvancesDeduction = totalPrevAdvances;

            // نضيف كل سلفة أسبوعية بشكل مفصّل في الـ breakdown
            for (const wa of empWeeklyAdvances) {
              breakdown.push({
                date: wa.period,
                rule_name: `سلفة أسبوعية مدفوعة مسبقاً (${wa.period})`,
                action_type: 'deduct_weekly_advance',
                amount: round2(wa.advance_paid),
                is_deduction: true,
              });
            }
          }
        }
      }

      // ── الخصومات الكلية والصافي ───────────────────────────────────────────
      const totalDeductions = round2(ruleDeductions + loanDeduction + weeklyAdvancesDeduction);
      const totalBonuses    = round2(ruleBonuses);

      let netSalary: number;

      if (currentRunType === 'weekly_advance') {
        // في المسيرة الأسبوعية: الصافي = السلفة ناقص الخصومات
        netSalary = round2(advancePaid - totalDeductions);
        if (netSalary < 0) netSalary = 0;
      } else {
        // في المسيرة العادية أو الشهرية النهائية: الصافي الكامل
        netSalary = round2(earnedBase + housingAmt + transportAmt + totalBonuses - totalDeductions);
        if (netSalary < 0) netSalary = 0; // لا يمكن أن يكون سالباً
      }

      payrollsToInsert.push({
        company_id,
        employee_id:      emp.id,
        start_date,
        end_date,
        run_type:         currentRunType,
        advance_rate:     isAdvanceMode ? advanceRate : 0,
        gross_earned:     round2(earnedBase), // الراتب المستحق قبل السلفة
        advance_paid:     advancePaid,        // ما دُفع كسلفة (في المسيرة الأسبوعية)
        base_salary:      round2(period_bs),
        net_salary:       netSalary,
        deductions:       totalDeductions,
        housing:          round2(housingAmt),
        transport:        round2(transportAmt),
        overtime_hours:   0,
        overtime_amount:  totalBonuses,
        days_worked:      daysPresent,
        total_days:       scheduledDays,
        total_work_hours: round2(totalWorkHrs),
        extra_allowances: breakdown.filter(r => !r.is_deduction),
        extra_deductions: breakdown.filter(r =>  r.is_deduction),
        breakdown,
        created_at:       new Date().toISOString(),
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 4. حذف القديم وإدراج الجديد
    // ═══════════════════════════════════════════════════════════════════════
    const { error: delErr } = await supabase
      .from('payrolls')
      .delete()
      .eq('company_id', company_id)
      .eq('start_date', start_date)
      .eq('end_date', end_date);
    if (delErr) return fail(`خطأ في حذف بيانات الرواتب القديمة: ${delErr.message}`);

    const { error: insErr } = await supabase
      .from('payrolls')
      .insert(payrollsToInsert);
    if (insErr) return fail(`خطأ في إدخال بيانات الرواتب: ${insErr.message}`);

    // ── تحديث رصيد السلف (employee_loans) بعد خصم الأقساط ───────────────
    for (const [empId, empLoansArr] of Object.entries(loansByEmp)) {
      const empNewPayroll = payrollsToInsert.find(p => p.employee_id === empId);
      if (!empNewPayroll) continue;

      const loanEntries = empNewPayroll.breakdown.filter((i: any) => i.action_type === 'deduct_loan' && i.loan_id);

      for (const le of loanEntries) {
        const loan = empLoansArr.find((l: any) => l.id === le.loan_id);
        if (loan) {
          const newRemaining = round2(Math.max(0, num(loan.remaining_amount) - num(le.amount)));
          await supabase
            .from('employee_loans')
            .update({ remaining_amount: newRemaining, status: newRemaining <= 0 ? 'paid' : 'active' })
            .eq('id', loan.id);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 5. استجابة النجاح
    // ═══════════════════════════════════════════════════════════════════════

    // إجماليات مختلفة بحسب نوع المسيرة
    const totalGross   = round2(payrollsToInsert.reduce((s, r) => s + r.gross_earned, 0));
    const totalAdvance = round2(payrollsToInsert.reduce((s, r) => s + r.advance_paid, 0));
    const totalNet     = round2(payrollsToInsert.reduce((s, r) => s + r.net_salary, 0));

    return respond({
      success: true,
      run_type: currentRunType,
      message: currentRunType === 'weekly_advance'
        ? `تم احتساب مسيرة أسبوعية لـ ${payrollsToInsert.length} موظف — السلفة المدفوعة: ${totalAdvance}`
        : currentRunType === 'monthly_final'
          ? `تم احتساب المسيرة الشهرية النهائية لـ ${payrollsToInsert.length} موظف — الصافي بعد خصم السلف: ${totalNet}`
          : `تم احتساب رواتب ${payrollsToInsert.length} موظف بنجاح`,
      processed_employees: payrollsToInsert.length,
      period: { start_date, end_date, total_calendar_days: periodTotalDays },
      summary: {
        total_gross_earned: totalGross,
        total_advance_paid: totalAdvance,
        total_deductions:   round2(payrollsToInsert.reduce((s, r) => s + r.deductions, 0)),
        total_net_salary:   totalNet,
        advance_mode: isAdvanceMode,
        advance_rate: advanceRate,
      },
    });

  } catch (e: any) {
    return fail(`خطأ غير متوقع: ${e?.message ?? String(e)}`);
  }
});
