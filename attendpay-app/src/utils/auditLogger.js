import { supabase } from '../supabaseClient';

export async function logAudit({ companyId, userId, action, tableName, recordId, oldData, newData }) {
    if (!companyId || !userId) {
        console.warn('[Audit] Missing companyId or userId', { action, tableName });
        return;
    }
    
    try {
        await supabase.from('audit_logs').insert({
            company_id: companyId,
            user_id: userId,
            action,
            table_name: tableName,
            record_id: recordId || null,
            old_data: oldData ?? null,
            new_data: newData ?? null
        });
    } catch (err) {
        // We log silently so that the main operation isn't necessarily interrupted,
        // but we ensure visibility for developers.
        console.error('[Audit] Failed to log:', err.message);
    }
}
