import { useState, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { getSystemPrompt } from './systemPrompt';

export const useAssistantAI = (company, data, reloadData) => {
    const [messages, setMessages] = useState([{
        id: '1',
        role: 'assistant',
        content: `مرحباً بك! أنا "وتين"، مساعدك الإداري الذكي.
يمكنني مساعدتك في حساب الرواتب، متابعة الحضور، إرسال التقارير عبر الواتساب، أو حتى إضافة موظفين جدد.

جرب أن تقول: "أرسل تقرير راتب أحمد على الواتس" أو "أحسب رواتب الموظفين".`,
        time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    }]);
    const [loading, setLoading] = useState(false);
    const [input, setInput] = useState('');

    const sendMessage = useCallback(async (text) => {
        const query = (text || input).trim();
        if (!query || loading) return;

        const userMsgId = Date.now().toString();
        const userMsg = { 
            id: userMsgId, 
            role: 'user', 
            content: query, 
            time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) 
        };

        const loadingMsg = { id: 'ld', role: 'assistant', content: '', loading: true, time: '' };

        setMessages(prev => [...prev, userMsg, loadingMsg]);
        setInput('');
        setLoading(true);

        try {
            // Safety check: company must be loaded
            if (!company?.id) {
                throw new Error('لم يتم تحميل بيانات الشركة بعد. يرجى الانتظار أو إعادة تحميل الصفحة.');
            }

            // Get the current session token, fallback to anon key
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData?.session?.access_token 
                || process.env.REACT_APP_SUPABASE_ANON_KEY;

            const history = messages
                .filter(m => !m.loading && m.id !== 'ld')
                .slice(-15)
                .map(m => ({ role: m.role, content: m.content }));

            const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
            const rawRes = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY
                },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    max_tokens: 1000,
                    system: getSystemPrompt(data),
                    messages: [...history, { role: 'user', content: query }],
                    company_id: company.id
                })
            });

            if (!rawRes.ok) {
                const errText = await rawRes.text();
                throw new Error(`خطأ من الخادم (${rawRes.status}): ${errText}`);
            }

            const response = await rawRes.json();

            const aiContent = response?.choices?.[0]?.message?.content 
                || response?.content 
                || "عذراً، أُرسل رد فارغ من الخادم.";
            
            // Handle actions hidden in <ACTION> tags
            let action = null;
            const actionMatch = aiContent.match(/<ACTION>(.*?)<\/ACTION>/s);
            if (actionMatch) {
                try {
                    action = JSON.parse(actionMatch[1]);
                } catch (e) {
                    console.error("Failed to parse action JSON:", e);
                }
            }

            const aiMsg = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: aiContent.replace(/<ACTION>.*?<\/ACTION>/gs, '').trim(),
                time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
                action: action
            };

            setMessages(prev => prev.filter(m => m.id !== 'ld').concat(aiMsg));
            
            return { action, content: aiContent };

        } catch (err) {
            console.error('AI Error:', err);
            const displayMsg = err?.message || 'حدث خطأ غير متوقع.';
            setMessages(prev => prev.filter(m => m.id !== 'ld').concat({
                id: 'err_' + Date.now(),
                role: 'assistant',
                content: `⚠️ ${displayMsg}`,
                time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
            }));
        } finally {
            setLoading(false);
        }
    }, [input, loading, messages, data, company]);

    return { messages, loading, input, setInput, sendMessage, setMessages };
};
