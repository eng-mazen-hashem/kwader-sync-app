import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { HiOutlineCheckCircle, HiOutlineSparkles, HiOutlineTerminal, HiExclamation, HiArrowRight } from 'react-icons/hi';
import './AiPayrollAgent.css';

function AiPayrollAgent({ company, startDate, endDate, onComplete }) {
    const { updateCompanySettings } = useAuth();
    const { t, language } = useLocale();
    const [step, setStep] = useState(0);
    const [messages, setMessages] = useState([]);
    const [skippedEmployees, setSkippedEmployees] = useState([]);

    const addMsg = (msg) => {
        setMessages(p => [...p, msg]);
    };

    useEffect(() => {
        let isSubscribed = true;

        const runAI = async () => {
            setTimeout(() => { if (isSubscribed) addMsg(t.aiInitAgent); }, 500);
            setTimeout(() => { if (isSubscribed) addMsg(t.aiSelectPeriod.replace('{start}', startDate).replace('{end}', endDate)); }, 1500);
            setTimeout(() => { if (isSubscribed) addMsg(t.aiFetchLogs); }, 3000);
            setTimeout(() => { if (isSubscribed) addMsg(t.aiAuditLogs); }, 4500);
            setTimeout(() => { if (isSubscribed) setStep(1); }, 6500);

            let rpcSuccess = false;
            let resultCount = 0;
            let skipped = [];
            try {
                const { data, error } = await supabase.rpc('generate_payroll_period', {
                    p_company_id: company.id,
                    p_start_date: startDate,
                    p_end_date: endDate,
                });
                if (!error && data?.success) {
                    rpcSuccess = true;
                    resultCount = data.processed_employees;
                    // الدالة تُرجع الآن مصفوفة من الموظفين المتخطيين
                    skipped = Array.isArray(data.skipped_employees) ? data.skipped_employees : [];
                }
            } catch (err) {
                console.error('[AI Agent] RPC Error:', err);
            }

            setTimeout(async () => {
                if (!isSubscribed) return;

                if (rpcSuccess) {
                    addMsg(t.aiSuccessProcessed.replace('{count}', resultCount));

                    if (skipped.length > 0) {
                        addMsg(`⚠️ تم تخطي ${skipped.length} موظف — لا يوجد شيفت عمل مخصص لهم.`);
                        setSkippedEmployees(skipped);
                    }

                    addMsg(t.aiArchive);
                    await updateCompanySettings({ last_auto_payroll_date: new Date().toISOString() });
                    setStep(2);
                } else {
                    addMsg(t.aiErrorProcess);
                    setStep(3);
                }
            }, 7500);
        };

        runAI();
        return () => { isSubscribed = false; };
    }, [company.id, startDate, endDate, updateCompanySettings, t]);

    return (
        <div className={`ai-agent-overlay ${language === 'ar' ? 'rtl' : 'ltr'}`}>
            <div className="ai-agent-glow-bg" />

            <div className="ai-agent-card">
                {/* Header */}
                <div className="ai-agent-header">
                    <div className="ai-agent-icon-box">
                        <HiOutlineSparkles />
                    </div>
                    <div className="ai-agent-title-stack">
                        <h2>{t.aiTitleAgent}</h2>
                        <div className="ai-agent-status">
                            <div className="status-indicator" />
                            {t.aiActiveNetwork}
                        </div>
                    </div>
                </div>

                {/* Terminal Window */}
                <div className="ai-terminal-window custom-scrollbar">
                    <div className="terminal-icon"><HiOutlineTerminal /></div>

                    <AnimatePresence>
                        {messages.map((m, i) => {
                            const isErr = m.includes('❌');
                            const isSuccess = m.includes('✅');
                            const isWarn = m.includes('⚠️');
                            return (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: language === 'ar' ? 10 : -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className={`terminal-msg ${isErr ? 'error' : isWarn ? 'warning' : isSuccess ? 'success' : 'info'}`}
                                >
                                    <span className="terminal-prompt">❯</span>
                                    {m}
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>

                    {step < 2 && (
                        <motion.div
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ repeat: Infinity, duration: 1.2 }}
                            className="terminal-cursor"
                        />
                    )}
                </div>

                {/* ⚠️ لوحة تحذير الموظفين بدون شيفت */}
                <AnimatePresence>
                    {skippedEmployees.length > 0 && step >= 2 && (
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="ai-skipped-warning"
                        >
                            <div className="skipped-warning-header">
                                <div className="skipped-warning-icon">
                                    <HiExclamation />
                                </div>
                                <div className="skipped-warning-text">
                                    <strong>تنبيه: موظفون بدون شيفت مخصص</strong>
                                    <p>
                                        لم يُحتسب راتب {skippedEmployees.length} موظف لأنه لا يوجد شيفت عمل مخصص لهم.
                                        يرجى تحديد الشيفت من صفحة الشيفتات ثم إعادة احتساب الرواتب.
                                    </p>
                                </div>
                            </div>

                            <ul className="skipped-employee-list">
                                {skippedEmployees.map((emp, i) => (
                                    <li key={i} className="skipped-employee-row">
                                        <span className="skipped-index">{i + 1}</span>
                                        <span className="skipped-emp-name">{emp.employee_name}</span>
                                        <span className="skipped-reason-badge">بدون شيفت</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                className="skipped-goto-shifts"
                                onClick={() => { onComplete(); window.location.href = '/shifts'; }}
                            >
                                <HiArrowRight />
                                الذهاب إلى إدارة الشيفتات
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Footer Action */}
                <div className="ai-agent-footer">
                    <AnimatePresence>
                        {step >= 2 && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                onClick={onComplete}
                                className="ai-agent-action-btn"
                            >
                                <HiOutlineCheckCircle /> {t.aiCloseAndContinue}
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

export default AiPayrollAgent;
