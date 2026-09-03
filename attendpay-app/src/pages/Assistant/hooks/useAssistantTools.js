import { useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../../supabaseClient';

export const useAssistantTools = (company, reloadData, setMessages) => {

    const executeAddEmployee = useCallback(async (empData) => {
        try {
            const pinToUse = empData.device_pin || Math.floor(1000 + Math.random() * 9000).toString();
            const { error } = await supabase.from('employees').insert([{
                name: empData.name,
                base_salary: Number(empData.base_salary) || 0,
                phone: empData.phone || null,
                device_pin: String(pinToUse),
                position: empData.position || null,
                company_id: company.id
            }]);

            if (error) {
                // constitution §9: surface errors via toast, not alert()
                toast.error(`فشلت إضافة الموظف: ${error.message}`);
                throw error;
            }

            setMessages(p => [...p, {
                id: Date.now().toString(),
                role: 'assistant',
                content: `✅ تمت المهمة بنجاح! تم حفظ الموظف **${empData.name}** في قاعدة بيانات النظام.`,
                time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
            }]);

            if (reloadData) reloadData();
        } catch (err) {
            console.error('[useAssistantTools] executeAddEmployee:', err.message);
        }
    }, [company, reloadData, setMessages]);

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
        // constitution §9: confirmation must come from a UI modal, not window.confirm()
        // Caller is responsible for passing a confirmed=true flag after showing a modal
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

    return { executeAddEmployee, toggleSchedule, deleteSchedule, saveSchedule };
};
