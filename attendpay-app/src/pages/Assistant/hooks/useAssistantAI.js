import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { getSystemPrompt } from './systemPrompt';
import { getCountryByCode } from '../../../utils/countries';

const DEFAULT_WELCOME_MESSAGE = {
    id: 'welcome_1',
    role: 'assistant',
    content: `مرحباً بك! أنا "وتين"، مساعدك الإداري الذكي.
يمكنني مساعدتك في حساب الرواتب، متابعة الحضور، إرسال التقارير عبر الواتساب، أو حتى إضافة موظفين جدد.

جرب أن تقول: "أرسل تقرير راتب أحمد على الواتس" أو "أحسب رواتب الموظفين".`,
    time: '',
    isHistorical: false
};

const MAX_SAVED_MESSAGES = 40;

export const useAssistantAI = (company, data, reloadData) => {
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

    const timezone = company?.settings?.timezone || countryInfo.timezone || 'Africa/Cairo';
    const locale = countryInfo.locale || (countryInfo.code === 'EG' ? 'ar-EG' : 'ar-SA');

    const getLocalTime = useCallback(() => {
        try {
            return new Date().toLocaleTimeString(locale, { timeZone: timezone, hour: '2-digit', minute: '2-digit' });
        } catch {
            return new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        }
    }, [locale, timezone]);

    const getStorageKey = useCallback((compId) => {
        return compId ? `wateen_chat_messages_${compId}` : 'wateen_chat_messages_default';
    }, []);

    const isLoadedRef = useRef(false);
    const [messages, setMessages] = useState([DEFAULT_WELCOME_MESSAGE]);
    const [loading, setLoading] = useState(false);
    const [input, setInput] = useState('');

    // Load saved messages from localStorage when company is available
    useEffect(() => {
        if (!company?.id) return;
        try {
            const key = getStorageKey(company.id);
            const saved = localStorage.getItem(key);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Mark all loaded previous messages as historical so they don't consume AI quota
                    setMessages(parsed.map(m => ({ ...m, isHistorical: true })));
                    isLoadedRef.current = true;
                    return;
                }
            }
        } catch (e) {
            console.warn('[useAssistantAI] Failed to load messages from localStorage:', e);
        }
        isLoadedRef.current = true;
    }, [company?.id, getStorageKey]);

    // Save messages to localStorage (excluding temporary loading message)
    useEffect(() => {
        if (!company?.id || !isLoadedRef.current) return;
        try {
            const key = getStorageKey(company.id);
            const toSave = messages
                .filter(m => !m.loading && m.id !== 'ld')
                .slice(-MAX_SAVED_MESSAGES);
            if (toSave.length > 0) {
                localStorage.setItem(key, JSON.stringify(toSave));
            }
        } catch (e) {
            console.warn('[useAssistantAI] Failed to save messages to localStorage:', e);
        }
    }, [messages, company?.id, getStorageKey]);

    // Clear chat handler
    const clearChat = useCallback(() => {
        const fresh = [{ ...DEFAULT_WELCOME_MESSAGE, id: Date.now().toString() }];
        setMessages(fresh);
        if (company?.id) {
            try {
                localStorage.removeItem(getStorageKey(company.id));
            } catch (e) {
                console.warn('[useAssistantAI] Failed to remove chat from localStorage:', e);
            }
        }
    }, [company?.id, getStorageKey]);

    const sendMessage = useCallback(async (text) => {
        const query = (text || input).trim();
        if (!query || loading) return;

        const userMsgId = Date.now().toString();
        const userMsg = { 
            id: userMsgId, 
            role: 'user', 
            content: query, 
            time: getLocalTime(),
            isHistorical: false
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

            // Strict context filter: only messages from the CURRENT session are sent to the AI API.
            // Historical messages saved from previous visits remain in the UI for review only and consume 0 tokens.
            // Action notices, errors, and system notifications are also excluded.
            const history = messages
                .filter(m => 
                    !m.loading && 
                    m.id !== 'ld' && 
                    !m.isHistorical &&
                    !m.id?.startsWith('err_') &&
                    (m.role === 'user' || m.role === 'assistant') &&
                    !m.content?.startsWith('✅') &&
                    !m.content?.startsWith('⚠️')
                )
                .slice(-4)
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
                    model: 'qwen/qwen3.8-27b',
                    max_tokens: 1000,
                    system: getSystemPrompt(data, company),
                    messages: [...history, { role: 'user', content: query }],
                    company_id: company.id,
                    companyData: company
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
                time: getLocalTime(),
                action: action,
                isHistorical: false
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
                time: getLocalTime(),
                isHistorical: false
            }));
        } finally {
            setLoading(false);
        }
    }, [input, loading, messages, data, company, getLocalTime]);

    return { messages, loading, input, setInput, sendMessage, setMessages, clearChat };
};
