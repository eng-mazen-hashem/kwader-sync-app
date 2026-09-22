/**
 * ============================================================
 * KWADER AI Engine - Sales Qualification & Tool Declarations
 * ============================================================
 * Defines Gemini Tools (Function Calling) for lead extraction and
 * human escalation, along with server-side execution handlers.
 */

const AI_TOOLS = [
    {
        name: 'capture_lead',
        description: 'تسجيل وحفظ بيانات العميل المحتمل (Lead) في نظام المبيعات عندما يشارك اسمه أو شركته أو عدد موظفيه أو رغبته في الاشتراك أو التجربة.',
        parameters: {
            type: 'OBJECT',
            properties: {
                contact_name: {
                    type: 'STRING',
                    description: 'اسم العميل أو الشخص المتواصل'
                },
                company_name: {
                    type: 'STRING',
                    description: 'اسم الشركة أو المؤسسة'
                },
                employee_count: {
                    type: 'INTEGER',
                    description: 'العدد التقريبي للموظفين في شركته إن تم ذكره'
                },
                interested_products: {
                    type: 'ARRAY',
                    items: { type: 'STRING' },
                    description: 'الخدمات المهتم بها مثل: أجهزة البصمة، الرواتب، إشعارات الواتساب، باقة متقدمة'
                },
                customer_notes: {
                    type: 'STRING',
                    description: 'ملخص موجز لمتطلبات العميل وأهدافه'
                }
            },
            required: ['contact_name']
        }
    },
    {
        name: 'request_human_handoff',
        description: 'طلب تحويل المحادثة فوراً إلى موظف دعم فني أو مسؤول مبيعات بشري عند طلب العميل الصريح أو المشاكل المعقدة.',
        parameters: {
            type: 'OBJECT',
            properties: {
                reason: {
                    type: 'STRING',
                    description: 'سبب طلب التحويل إلى موظف بشري'
                }
            },
            required: ['reason']
        }
    }
];

const { 
    DB_MAINTENANCE_TOOLS, 
    findCompanyBySerial, 
    runCompanyDiagnostics, 
    executeDatabaseRepair 
} = require('./dbTroubleshooter');

const ALL_AI_TOOLS = [
    ...AI_TOOLS,
    ...DB_MAINTENANCE_TOOLS
];

/**
 * Execute a tool call triggered by the AI
 * @param {Object} supabase - Supabase client instance
 * @param {Object} conversation - Active conversation record
 * @param {Object} channel - Active channel record
 * @param {string} toolName - Name of the function
 * @param {Object} args - Arguments passed by the model
 * @returns {Promise<{success: boolean, message: string, data?: any}>}
 */
async function executeToolCall(supabase, conversation, channel, toolName, args) {
    try {
        if (toolName === 'capture_lead') {
            const { data, error } = await supabase
                .from('ai_leads')
                .insert({
                    conversation_id: conversation.id,
                    channel_id: channel?.id || null,
                    company_id: channel?.company_id || null,
                    contact_name: args.contact_name || conversation.customer_name || 'عميل محتمل',
                    contact_phone: conversation.customer_phone || conversation.session_id || '',
                    company_name: args.company_name || null,
                    employee_count: args.employee_count ? parseInt(args.employee_count) : null,
                    interested_products: Array.isArray(args.interested_products) ? args.interested_products : [],
                    customer_notes: args.customer_notes || 'تم استخراجه بواسطة وكيل المبيعات الذكي',
                    status: 'new'
                })
                .select()
                .single();

            if (error) throw error;

            // Update conversation lead status
            await supabase
                .from('ai_conversations')
                .update({
                    lead_status: 'lead_captured',
                    customer_name: args.contact_name || conversation.customer_name,
                    context_state: {
                        ...(conversation.context_state || {}),
                        captured_lead_id: data.id,
                        company_name: args.company_name,
                        employee_count: args.employee_count
                    }
                })
                .eq('id', conversation.id);

            return {
                success: true,
                message: 'تم تسجيل بيانات العميل بنجاح في نظام المبيعات وتم إشعار الفريق المختص.'
            };
        }

        if (toolName === 'request_human_handoff') {
            await supabase
                .from('ai_conversations')
                .update({
                    status: 'human_takeover',
                    summary: `تم التحويل لبشري: ${args.reason || 'بناء على طلب العميل'}`,
                    updated_at: new Date().toISOString()
                })
                .eq('id', conversation.id);

            return {
                success: true,
                message: 'تم تحويل المحادثة إلى موظف بشري بنجاح.'
            };
        }

        // --- Database Maintenance Tools Execution ---
        const targetCompanyId = args.company_id || 
            conversation?.context_state?.authenticated_company_id || 
            conversation?.company_id || 
            channel?.company_id;

        if (toolName === 'verify_company_serial') {
            const company = await findCompanyBySerial(supabase, args.serial);
            if (!company) {
                return {
                    success: false,
                    message: `عذراً، لم يتم العثور على أي شركة مسجلة بالسيريال (${args.serial}). يرجى التأكد من السيريال أو مفتاح الترخيص من إعدادات الشركة وإعادة إرساله.`
                };
            }

            // Save authenticated company in conversation session context
            await supabase
                .from('ai_conversations')
                .update({
                    company_id: company.id,
                    context_state: {
                        ...(conversation.context_state || {}),
                        authenticated_company_id: company.id,
                        authenticated_company_name: company.name,
                        authenticated_license_key: company.license_key
                    }
                })
                .eq('id', conversation.id);

            // Fetch quick initial diagnostics
            const diag = await runCompanyDiagnostics(supabase, company.id);

            return {
                success: true,
                company: { id: company.id, name: company.name },
                message: `يا أهلاً بك! تم التحقق بنجاح من سيريال شركة (${company.name}) وربط الحساب. نقدر نربط جهاز البصمة ونظبط الإعدادات فوراً يا غالي. 👍`,
                diagnostics: diag
            };
        }

        if (toolName === 'diagnose_company_database') {
            if (!targetCompanyId) {
                return { success: false, message: 'يرجى تزويدنا برقم سيريال الشركة أولاً لنتمكن من فحص قاعدة البيانات الخاصة بها.' };
            }
            const diag = await runCompanyDiagnostics(supabase, targetCompanyId);
            return {
                success: true,
                message: 'تم فحص قاعدة البيانات بنجاح.',
                diagnostics: diag
            };
        }

        if (toolName === 'reprocess_attendance') {
            if (!targetCompanyId) {
                return { success: false, message: 'يرجى تزويدنا برقم سيريال الشركة أولاً لإعادة احتساب البصمات.' };
            }
            const res = await executeDatabaseRepair(supabase, targetCompanyId, 'reprocess_attendance', { date: args.date });
            return res;
        }

        if (toolName === 'assign_employee_to_shift') {
            if (!targetCompanyId) {
                return { success: false, message: 'يرجى تزويدنا برقم سيريال الشركة أولاً لتسكين الموظف في الوردية.' };
            }
            const res = await executeDatabaseRepair(supabase, targetCompanyId, 'assign_shift', args);
            return res;
        }

        if (toolName === 'reset_employee_mobile_device') {
            if (!targetCompanyId) {
                return { success: false, message: 'يرجى تزويدنا برقم سيريال الشركة أولاً لفك قفل الجهاز.' };
            }
            const res = await executeDatabaseRepair(supabase, targetCompanyId, 'reset_employee_device', args);
            return res;
        }

        return { success: false, message: `Unknown tool: ${toolName}` };
    } catch (err) {
        console.error('⚠️ [SalesQualifier] Error executing tool call:', err.message);
        return { success: false, message: err.message };
    }
}

module.exports = {
    AI_TOOLS: ALL_AI_TOOLS,
    executeToolCall
};

