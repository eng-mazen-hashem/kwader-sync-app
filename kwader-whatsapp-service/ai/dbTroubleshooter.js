/**
 * ============================================================
 * KWADER AI Engine - Database Diagnostics & Autonomous Repair
 * ============================================================
 * Enables WhatsApp AI agent to authenticate companies via serial/license key,
 * inspect database health (devices, shifts, logs, employees), and execute
 * automated repairs directly in Supabase.
 */

/**
 * Extract a candidate serial/license key from raw user text.
 * Matches standard UUIDs (8-4-4-4-12) or custom alphanumeric keys.
 * @param {string} text
 * @returns {string|null}
 */
function extractSerial(text) {
    if (!text || typeof text !== 'string') return null;

    // 1. Check for standard UUID (e.g. 3eb4de22-2cf5-4d11-9e43-d887fe3613f5)
    const uuidRegex = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/;
    const uuidMatch = text.match(uuidRegex);
    if (uuidMatch) return uuidMatch[0].trim();

    // 2. Check for explicit keywords like "سيريال:", "كود:", "serial:"
    const kwRegex = /(?:سيريال|سريال|ترخيص|كود الشركة|license|serial)\s*[:=]?\s*([a-zA-Z0-9_-]{6,64})/i;
    const kwMatch = text.match(kwRegex);
    if (kwMatch && kwMatch[1]) {
        return kwMatch[1].trim();
    }

    return null;
}

/**
 * Find and verify a company in Supabase by its serial (license_key) or ID.
 * @param {Object} supabase - Supabase client
 * @param {string} serialInput - The serial or license key
 * @returns {Promise<Object|null>}
 */
async function findCompanyBySerial(supabase, serialInput) {
    if (!serialInput || typeof serialInput !== 'string') return null;
    const cleanSerial = serialInput.trim();

    // 1. Try matching license_key
    let { data: company, error } = await supabase
        .from('companies')
        .select('id, name, license_key, status, subscription_end_date, settings')
        .ilike('license_key', cleanSerial)
        .maybeSingle();

    // 2. If not found and input looks like a UUID, try matching company ID
    if (!company) {
        const uuidCheck = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        if (uuidCheck.test(cleanSerial)) {
            const { data: compById } = await supabase
                .from('companies')
                .select('id, name, license_key, status, subscription_end_date, settings')
                .eq('id', cleanSerial)
                .maybeSingle();
            company = compById;
        }
    }

    return company || null;
}

/**
 * Run a full diagnostic check on a company's database data.
 * Checks devices, shifts, unassigned employees, raw attendance logs, and mobile bindings.
 * @param {Object} supabase - Supabase client
 * @param {string} companyId - UUID of the company
 * @returns {Promise<Object>} Detailed diagnostic report
 */
async function runCompanyDiagnostics(supabase, companyId) {
    try {
        if (!companyId) return { success: false, error: 'معرف الشركة غير محدد' };

        // 1. Fetch Company Record (resolves whether companyId is UUID id or license_key)
        let { data: company } = await supabase
            .from('companies')
            .select('id, name, license_key, status, subscription_end_date')
            .or(`id.eq.${companyId},license_key.eq.${companyId}`)
            .maybeSingle();

        if (!company) {
            return { success: false, error: 'الشركة غير موجودة في النظام' };
        }

        const resolvedCompanyId = company.id;

        // 2. Fetch Devices
        const { data: devices } = await supabase
            .from('devices')
            .select('id, device_name, serial_number, ip_address, port, status, last_sync')
            .eq('company_id', resolvedCompanyId);

        const totalDevices = devices ? devices.length : 0;
        const offlineDevices = (devices || []).filter(d => d.status !== 'online');

        // 3. Fetch Active Employees
        const { data: employees } = await supabase
            .from('employees')
            .select('id, name, device_pin, status, bound_device_id')
            .eq('company_id', resolvedCompanyId)
            .eq('status', 'active');

        const totalActiveEmployees = employees ? employees.length : 0;
        const missingPinEmployees = (employees || []).filter(e => !e.device_pin);
        const boundDeviceEmployees = (employees || []).filter(e => !!e.bound_device_id);

        // 4. Fetch Shifts & Shift Assignments
        const { data: shifts } = await supabase
            .from('shifts')
            .select('id, name, start_time, end_time, is_active')
            .eq('company_id', resolvedCompanyId);

        const activeShifts = (shifts || []).filter(s => s.is_active !== false);

        let unassignedEmployees = [];
        if (employees && employees.length > 0) {
            const empIds = employees.map(e => e.id);
            const { data: shiftAssignments } = await supabase
                .from('shift_employees')
                .select('employee_id')
                .in('employee_id', empIds);

            const assignedSet = new Set((shiftAssignments || []).map(a => a.employee_id));
            unassignedEmployees = employees.filter(e => !assignedSet.has(e.id));
        }

        // 5. Fetch Raw Attendance Logs Status
        const { count: unprocessedCount } = await supabase
            .from('raw_attendance_logs')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', resolvedCompanyId)
            .eq('is_processed', false);

        // Latest raw log
        const { data: latestLogs } = await supabase
            .from('raw_attendance_logs')
            .select('timestamp, user_pin, is_processed')
            .eq('company_id', resolvedCompanyId)
            .order('timestamp', { ascending: false })
            .limit(1);

        const latestLogTimestamp = latestLogs?.[0]?.timestamp || null;

        // Build list of diagnosed issues
        const issuesFound = [];

        if (unprocessedCount && unprocessedCount > 0) {
            issuesFound.push({
                type: 'UNPROCESSED_LOGS',
                severity: 'HIGH',
                message: `يوجد ${unprocessedCount} بصمة مسجلة في قاعدة البيانات لم تتم معالجتها واحتسابها بعد.`,
                suggestedAction: 'reprocess_attendance'
            });
        }

        if (unassignedEmployees.length > 0) {
            issuesFound.push({
                type: 'UNASSIGNED_SHIFTS',
                severity: 'HIGH',
                message: `يوجد ${unassignedEmployees.length} موظف نشط غير مربوطين بأي وردية عمل (مثل: ${unassignedEmployees.slice(0, 3).map(e => e.name).join('، ')}). عدم ربطهم بالوردية يمنع احتساب بصماتهم.`,
                suggestedAction: 'assign_shift',
                employees: unassignedEmployees.map(e => ({ id: e.id, name: e.name }))
            });
        }

        if (missingPinEmployees.length > 0) {
            issuesFound.push({
                type: 'MISSING_DEVICE_PIN',
                severity: 'MEDIUM',
                message: `يوجد ${missingPinEmployees.length} موظف بدون رقم بصمة (PIN) مسجل على النظام (مثل: ${missingPinEmployees.slice(0, 3).map(e => e.name).join('، ')}).`,
                suggestedAction: 'set_employee_pin'
            });
        }

        if (offlineDevices.length > 0) {
            issuesFound.push({
                type: 'OFFLINE_DEVICES',
                severity: 'MEDIUM',
                message: `يوجد ${offlineDevices.length} جهاز بصمة غير متصل حالياً (مثل: ${offlineDevices.map(d => d.device_name || d.serial_number).join('، ')}).`,
                suggestedAction: 'check_device_connection'
            });
        }

        return {
            success: true,
            company: {
                id: company.id,
                name: company.name,
                status: company.status,
                subscription_end_date: company.subscription_end_date
            },
            stats: {
                totalActiveEmployees,
                totalDevices,
                activeShiftsCount: activeShifts.length,
                unprocessedLogsCount: unprocessedCount || 0,
                unassignedEmployeesCount: unassignedEmployees.length,
                latestLogTimestamp
            },
            availableShifts: activeShifts.map(s => ({ id: s.id, name: s.name, time: `${s.start_time || ''} - ${s.end_time || ''}` })),
            issuesFound,
            isHealthy: issuesFound.length === 0
        };
    } catch (err) {
        console.error('❌ [DB Troubleshooter] Error running diagnostics:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Execute an automated repair on the database for a company.
 * @param {Object} supabase - Supabase client
 * @param {string} companyId - Company UUID
 * @param {string} action - The action type
 * @param {Object} params - Parameters for the action
 * @returns {Promise<Object>}
 */
async function executeDatabaseRepair(supabase, companyId, action, params = {}) {
    try {
        if (!companyId) return { success: false, message: 'معرف الشركة غير محدد' };

        // Resolve companyId: ensure it's the primary key id, not the license_key
        let resolvedCompanyId = companyId;
        const { data: matchedComp } = await supabase
            .from('companies')
            .select('id, name')
            .or(`id.eq.${companyId},license_key.eq.${companyId}`)
            .maybeSingle();

        if (matchedComp) {
            resolvedCompanyId = matchedComp.id;
        }

        console.log(`🔧 [DB Troubleshooter] Executing repair '${action}' for company ${resolvedCompanyId}:`, params);

        if (action === 'reprocess_attendance') {
            // Determine target dates: default to today, yesterday, and day before
            const datesToProcess = [];
            if (params.date) {
                datesToProcess.push(params.date);
            } else {
                const now = new Date();
                for (let i = 0; i < 3; i++) {
                    const d = new Date(now);
                    d.setDate(d.getDate() - i);
                    datesToProcess.push(d.toISOString().split('T')[0]);
                }
            }

            const results = [];
            for (const pDate of datesToProcess) {
                try {
                    const { error } = await supabase.rpc('process_daily_attendance', {
                        p_company_id: resolvedCompanyId,
                        p_date: pDate
                    });
                    results.push({ date: pDate, status: error ? 'error: ' + error.message : 'success' });
                } catch (e) {
                    results.push({ date: pDate, status: 'failed: ' + e.message });
                }
            }

            // Check remaining unprocessed
            const { count: remainingUnprocessed } = await supabase
                .from('raw_attendance_logs')
                .select('id', { count: 'exact', head: true })
                .eq('company_id', resolvedCompanyId)
                .eq('is_processed', false);

            return {
                success: true,
                action: 'reprocess_attendance',
                datesProcessed: datesToProcess,
                remainingUnprocessed: remainingUnprocessed || 0,
                message: `تم تشغيل محرك إعادة احتساب البصمات بنجاح للتواريخ (${datesToProcess.join('، ')}). المتبقي غير معالج: ${remainingUnprocessed || 0} بصمة.`
            };
        }

        if (action === 'assign_shift') {
            // Find target shift: either provided or the first active shift
            let shiftId = params.shift_id;
            if (!shiftId) {
                const { data: defaultShift } = await supabase
                    .from('shifts')
                    .select('id, name')
                    .eq('company_id', resolvedCompanyId)
                    .eq('is_active', true)
                    .limit(1)
                    .maybeSingle();

                if (!defaultShift) {
                    return { success: false, message: 'لم يتم العثور على وردية عمل مفعلة في هذه الشركة لربط الموظف بها.' };
                }
                shiftId = defaultShift.id;
            }

            // Find employees to assign
            let targetEmpIds = [];
            if (params.employee_id) {
                targetEmpIds = [params.employee_id];
            } else if (params.employee_name) {
                const { data: foundEmp } = await supabase
                    .from('employees')
                    .select('id, name')
                    .eq('company_id', resolvedCompanyId)
                    .ilike('name', `%${params.employee_name.trim()}%`)
                    .limit(1)
                    .maybeSingle();

                if (foundEmp) {
                    targetEmpIds = [foundEmp.id];
                }
            } else if (params.assign_all_unassigned) {
                // Find all active unassigned employees
                const { data: emps } = await supabase
                    .from('employees')
                    .select('id')
                    .eq('company_id', resolvedCompanyId)
                    .eq('status', 'active');

                if (emps && emps.length > 0) {
                    const allIds = emps.map(e => e.id);
                    const { data: assigned } = await supabase
                        .from('shift_employees')
                        .select('employee_id')
                        .in('employee_id', allIds);

                    const assignedIds = new Set((assigned || []).map(a => a.employee_id));
                    targetEmpIds = allIds.filter(id => !assignedIds.has(id));
                }
            }

            if (targetEmpIds.length === 0) {
                return { success: false, message: 'لم يتم تحديد موظفين أو جميع الموظفين مربوطين بالفعل بورديات.' };
            }

            // Insert into shift_employees (ignoring duplicates)
            const rows = targetEmpIds.map(eId => ({ shift_id: shiftId, employee_id: eId }));
            const { error: insertErr } = await supabase
                .from('shift_employees')
                .upsert(rows, { onConflict: 'shift_id,employee_id' });

            if (insertErr) throw insertErr;

            return {
                success: true,
                action: 'assign_shift',
                countAssigned: targetEmpIds.length,
                shiftId,
                message: `تم بنجاح ربط ${targetEmpIds.length} موظف بالوردية المحددة.`
            };
        }

        if (action === 'reset_employee_device') {
            // Find employee by name or pin or ID
            let query = supabase.from('employees').select('id, name, bound_device_id').eq('company_id', resolvedCompanyId);
            if (params.employee_id) {
                query = query.eq('id', params.employee_id);
            } else if (params.employee_name) {
                query = query.ilike('name', `%${params.employee_name.trim()}%`);
            } else if (params.device_pin) {
                query = query.eq('device_pin', String(params.device_pin).trim());
            }

            const { data: emp, error: empErr } = await query.limit(1).maybeSingle();
            if (empErr || !emp) {
                return { success: false, message: 'لم يتم العثور على الموظف المطلوب لفك ارتباط جهازه.' };
            }

            const { error: updateErr } = await supabase
                .from('employees')
                .update({
                    bound_device_id: null,
                    bound_device_name: null,
                    device_bound_at: null
                })
                .eq('id', emp.id);

            if (updateErr) throw updateErr;

            return {
                success: true,
                action: 'reset_employee_device',
                employeeName: emp.name,
                message: `تم فك ارتباط الهاتف بنجاح للموظف (${emp.name}). يستطيع الآن تسجيل الدخول فوراً من أي هاتف جديد.`
            };
        }

        if (action === 'set_employee_pin') {
            const { employee_name, device_pin } = params;
            if (!device_pin) {
                return { success: false, message: 'يرجى تحديد رقم البصمة (PIN) المطلوب للموظف.' };
            }

            const { data: emp } = await supabase
                .from('employees')
                .select('id, name')
                .eq('company_id', resolvedCompanyId)
                .ilike('name', `%${employee_name.trim()}%`)
                .limit(1)
                .maybeSingle();

            if (!emp) {
                return { success: false, message: `لم يتم العثور على موظف باسم (${employee_name}).` };
            }

            const { error } = await supabase
                .from('employees')
                .update({ device_pin: String(device_pin).trim() })
                .eq('id', emp.id);

            if (error) throw error;

            return {
                success: true,
                action: 'set_employee_pin',
                employeeName: emp.name,
                devicePin: device_pin,
                message: `تم تحديث رقم بصمة الموظف (${emp.name}) إلى (${device_pin}) بنجاح.`
            };
        }

        return { success: false, message: `إجراء الإصلاح غير معروف: ${action}` };
    } catch (err) {
        console.error('❌ [DB Troubleshooter] Repair execution error:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Tools declared for Gemini Function Calling for DB Maintenance
 */
const DB_MAINTENANCE_TOOLS = [
    {
        name: 'verify_company_serial',
        description: 'التحقق من سيريال أو مفتاح ترخيص الشركة (Serial / License Key) وتوثيق دخول الجلسة لقاعدة بيانات الشركة.',
        parameters: {
            type: 'OBJECT',
            properties: {
                serial: {
                    type: 'STRING',
                    description: 'الرقم التسلسلي أو مفتاح ترخيص الشركة (UUID أو الكود)'
                }
            },
            required: ['serial']
        }
    },
    {
        name: 'diagnose_company_database',
        description: 'إجراء فحص شامل لقاعدة بيانات الشركة، والتحقق من أجهزة البصمة، الموظفين غير المربوطين بشيفتات، والبصمات المعلقة.',
        parameters: {
            type: 'OBJECT',
            properties: {
                company_id: {
                    type: 'STRING',
                    description: 'معرف الشركة (إن وُجد)'
                }
            }
        }
    },
    {
        name: 'reprocess_attendance',
        description: 'إعادة معالجة واحتساب سجلات البصمات المعلقة لحساب الحضور والانصراف والتأخير وساعات العمل لتواريخ محددة أو الأيام الأخيرة.',
        parameters: {
            type: 'OBJECT',
            properties: {
                company_id: {
                    type: 'STRING',
                    description: 'معرف الشركة'
                },
                date: {
                    type: 'STRING',
                    description: 'تاريخ محدد بصيغة YYYY-MM-DD (اختياري، إن لم يُحدد يتم فحص الأيام الأخيرة تلقائياً)'
                }
            }
        }
    },
    {
        name: 'assign_employee_to_shift',
        description: 'ربط موظف (أو جميع الموظفين غير المربوطين) بوردية عمل لحل مشكلة عدم احتساب البصمات.',
        parameters: {
            type: 'OBJECT',
            properties: {
                company_id: {
                    type: 'STRING',
                    description: 'معرف الشركة'
                },
                employee_name: {
                    type: 'STRING',
                    description: 'اسم الموظف المراد ربطه'
                },
                assign_all_unassigned: {
                    type: 'BOOLEAN',
                    description: 'تعيين القيمة true لربط جميع الموظفين غير المربوطين تلقائياً بأول وردية مفعلة'
                }
            }
        }
    },
    {
        name: 'reset_employee_mobile_device',
        description: 'فك ارتباط قفل جهاز الهاتف المحمول للموظف (Device Lock Reset) عند تغيير هاتفه أو عدم تمكنه من تسجيل الدخول من التطبيق.',
        parameters: {
            type: 'OBJECT',
            properties: {
                company_id: {
                    type: 'STRING',
                    description: 'معرف الشركة'
                },
                employee_name: {
                    type: 'STRING',
                    description: 'اسم الموظف أو جزء من اسمه'
                },
                device_pin: {
                    type: 'STRING',
                    description: 'رقم الـ PIN الخاص بالموظف'
                }
            }
        }
    }
];

module.exports = {
    extractSerial,
    findCompanyBySerial,
    runCompanyDiagnostics,
    executeDatabaseRepair,
    DB_MAINTENANCE_TOOLS
};
