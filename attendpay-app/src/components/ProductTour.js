import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, X, Map, Sparkles } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import './ProductTour.css';

// ─────────────────────────────────────────────────────────────────────────────
// TOUR STEPS — each step can specify a `path` to auto-navigate to before
//              trying to find `target`. Steps with target:null show centered.
// ─────────────────────────────────────────────────────────────────────────────
const TOUR_STEPS = [
    // ① Welcome — no target, centered modal
    {
        path: null,
        target: null,
        title_ar: "مرحباً في AttendPay! 🔮",
        title_en: "Welcome to AttendPay! 🔮",
        desc_ar: "يسعدنا انضمامك. دعنا نأخذك في جولة سريعة مدتها دقيقة واحدة تعرف خلالها على أقوى مميزات المنصة وكيف ستوفر عليك ساعات من الجهد الإداري. يمكنك تخطيها في أي وقت.",
        desc_en: "We're thrilled to have you on board. Let's take a 1-minute interactive tour through the platform's most powerful features. You can skip at any time.",
        icon: "🔮",
        position: "center"
    },
    // ② Dashboard — stats cards
    {
        path: '/dashboard',
        target: '.dash-stats-grid',
        title_ar: "بطاقات الإحصائيات الفورية 📊",
        title_en: "Live Stats Dashboard 📊",
        desc_ar: "نظرة عامة فورية على حضور الموظفين اليوم، الغيابات، ساعات الإضافي، والرواتب المستحقة هذا الشهر — كل شيء محدّث تلقائياً ومتزامن مع أجهزة البصمة.",
        desc_en: "An instant overview of today's attendance, absences, overtime hours, and monthly payroll — all auto-synced from your fingerprint devices in real-time.",
        icon: "📊",
        position: "bottom"
    },
    // ③ Dashboard — charts
    {
        path: '/dashboard',
        target: '.dash-chart-container',
        title_ar: "مخططات الانضباط الأسبوعية 📈",
        title_en: "Weekly Discipline Charts 📈",
        desc_ar: "رسومات بيانية تفاعلية تلخص نسب الحضور والتأخر والغياب لكل أسبوع. اكتشف الأنماط واتخذ قرارات إدارية مبنية على البيانات الحقيقية.",
        desc_en: "Interactive charts summarizing weekly attendance, lateness, and absences — discover patterns and make data-driven decisions.",
        icon: "📈",
        position: "top"
    },
    // ④ Employees page
    {
        path: '/employees',
        target: '.page-header, .employees-header, h1, .header-actions',
        title_ar: "إدارة الموظفين 👥",
        title_en: "Employee Management 👥",
        desc_ar: "أضف موظفين جدد، عدّل بياناتهم، وارسل دعوات إلكترونية تلقائية. كل موظف مرتبط ببصمته، قسمه، وورديته — كل شيء في مكان واحد.",
        desc_en: "Add new employees, update their profiles, and send automated invitation emails. Each employee is linked to their fingerprint, department, and shift — all in one place.",
        icon: "👥",
        position: "bottom"
    },
    // ⑤ Attendance page
    {
        path: '/attendance',
        target: '.page-header, .attendance-header, h1',
        title_ar: "سجلات الحضور والانصراف ⏱️",
        title_en: "Attendance Records ⏱️",
        desc_ar: "اعرض وفلتر جميع بصمات الدخول والخروج. يكتشف النظام تلقائياً التأخر، الخروج المبكر، والعمل الإضافي — مع إمكانية التعديل اليدوي عند نسيان البصمة.",
        desc_en: "View and filter all punch-in/out records. The system auto-detects lateness, early exit, and overtime — with manual correction support for missed punches.",
        icon: "⏱️",
        position: "bottom"
    },
    // ⑥ Payroll page
    {
        path: '/payroll',
        target: '.page-header, .payroll-header, h1',
        title_ar: "مسير الرواتب التلقائي 💰",
        title_en: "Automated Payroll 💰",
        desc_ar: "يحسب النظام الراتب النهائي لكل موظف تلقائياً بناءً على حضوره الفعلي وقواعد التحكم التي تحددها. اعتمد الرواتب وأصدر كشوفاً احترافية بنقرة واحدة.",
        desc_en: "The system auto-calculates net salaries based on actual attendance and your custom rules. Approve payroll and generate professional payslips with one click.",
        icon: "💰",
        position: "bottom"
    },
    // ⑦ Shifts page
    {
        path: '/shifts',
        target: '.page-header, .shifts-header, h1',
        title_ar: "الورديات (الشيفتات) المرنة 🕐",
        title_en: "Flexible Shift Management 🕐",
        desc_ar: "أنشئ ورديات ثابتة أو مرنة وعيّنها للأقسام أو الموظفين منفردين. يدعم النظام الشيفتات الليلية، والعمل عبر منتصف الليل، وتسامح التأخر.",
        desc_en: "Create fixed or flexible shifts and assign them to departments or individual employees. Supports night shifts, midnight crossover, and lateness tolerance.",
        icon: "🕐",
        position: "bottom"
    },
    // ⑧ Leaves page
    {
        path: '/leaves',
        target: '.page-header, .leaves-header, h1',
        title_ar: "طلبات الإجازات والغيابات 🏖️",
        title_en: "Leave & Absence Requests 🏖️",
        desc_ar: "يتقدم الموظفون بطلبات الإجازة عبر تطبيق الجوال، وأنت تعتمد أو ترفض من لوحة التحكم. رصيد الإجازات يُحدَّث تلقائياً ويؤثر على مسير الرواتب.",
        desc_en: "Employees submit leave requests via the mobile app, and you approve or reject from the dashboard. Leave balance auto-updates and affects payroll calculations.",
        icon: "🏖️",
        position: "bottom"
    },
    // ⑨ Assistant page
    {
        path: '/assistant',
        target: '.assistant-input-area, .chat-input-wrapper, textarea, .page-header',
        title_ar: "المساعد الذكي AttendPay AI 🤖",
        title_en: "AttendPay AI Assistant 🤖",
        desc_ar: "أهم ميزة تنافسية! اسأل المساعد بالعربية أو الإنجليزية: \"من تأخر هذا الأسبوع؟\" أو \"احسب راتب أحمد\" أو \"أصدر تقرير الغياب\" — يجيبك فوراً بتقارير حية.",
        desc_en: "The key differentiator! Ask in Arabic or English: 'Who was late this week?' or 'Calculate Ahmad's salary' or 'Generate absence report' — instant live reports.",
        icon: "🤖",
        position: "bottom"
    },
    // ⑩ Devices page
    {
        path: '/devices',
        target: '.page-header, .devices-header, h1',
        title_ar: "إدارة أجهزة البصمة 🔌",
        title_en: "Fingerprint Devices 🔌",
        desc_ar: "راقب حالة أجهزة البصمة المتصلة بالشبكة. برنامج المزامنة AttendSync يعمل في الخلفية ويرفع البيانات تلقائياً — يمكنك تحميله ومراقبة وضعه من هنا.",
        desc_en: "Monitor your fingerprint devices' connection status. The AttendSync agent runs in the background uploading data automatically — download and track it here.",
        icon: "🔌",
        position: "bottom"
    },
    // ⑪ Back to Sidebar — finish
    {
        path: '/dashboard',
        target: 'aside.sidebar',
        title_ar: "أنت جاهز تماماً! 🚀",
        title_en: "You're all set! 🚀",
        desc_ar: "لديك الآن كل الأدوات التي تحتاجها لإدارة حضور وانصراف موظفيك بكفاءة واحترافية. يمكنك دائماً إعادة هذه الجولة من أيقونة (؟) في الشريط العلوي.",
        desc_en: "You now have everything you need to manage your workforce attendance professionally. You can always re-run this tour from the (?) icon in the top bar.",
        icon: "🚀",
        position: "right"
    }
];

// ─────────────────────────────────────────────────────────────────────────────
// Utility: wait for an element to appear in the DOM (with timeout)
// ─────────────────────────────────────────────────────────────────────────────
function waitForElement(selector, timeoutMs = 3000) {
    return new Promise((resolve) => {
        const existing = document.querySelector(selector);
        if (existing) return resolve(existing);

        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                observer.disconnect();
                resolve(el);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            resolve(document.querySelector(selector)); // may be null
        }, timeoutMs);
    });
}

// Try multiple selectors (comma-joined) — return first element found
async function findFirstElement(selectorList) {
    const selectors = selectorList.split(',').map(s => s.trim());
    for (const sel of selectors) {
        const el = await waitForElement(sel, 1200);
        if (el) return el;
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
export function ProductTour() {
    const { company, updateCompanySettings } = useAuth();
    const { language } = useLocale();
    const navigate = useNavigate();
    const location = useLocation();

    const [isActive, setIsActive] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState(null);
    const [isNavigating, setIsNavigating] = useState(false);

    const resizeTimeout = useRef(null);
    const isMounted = useRef(true);

    useEffect(() => { return () => { isMounted.current = false; }; }, []);

    // ── Listen to manual tour trigger ────────────────────────────────────────
    useEffect(() => {
        const handleStartTour = () => {
            setCurrentStep(0);
            setIsActive(true);
        };
        window.addEventListener('start-product-tour', handleStartTour);
        return () => window.removeEventListener('start-product-tour', handleStartTour);
    }, []);

    // ── Auto-start from onboarding redirect ──────────────────────────────────
    useEffect(() => {
        const autoStart = sessionStorage.getItem('start_tour_on_mount');
        if (autoStart === 'true') {
            sessionStorage.removeItem('start_tour_on_mount');
            setCurrentStep(0);
            setIsActive(true);
        } else if (company && !company.settings?.tour_completed && company.settings?.onboarding_completed) {
            setCurrentStep(0);
            setIsActive(true);
        }
    }, [company]);

    // ── Core effect: navigate + find target on each step change ──────────────
    const resolveStep = useCallback(async (stepIndex) => {
        if (!isMounted.current) return;
        const step = TOUR_STEPS[stepIndex];
        if (!step) return;

        setTargetRect(null);
        setIsNavigating(false);

        // Navigate if needed
        if (step.path && location.pathname !== step.path) {
            setIsNavigating(true);
            navigate(step.path);
            // Give React Router + page render time to settle
            await new Promise(r => setTimeout(r, 600));
            if (!isMounted.current) return;
            setIsNavigating(false);
        }

        if (!step.target) return; // centered step — no element needed

        // Extra wait for page content to fully render
        await new Promise(r => setTimeout(r, 300));
        if (!isMounted.current) return;

        const element = await findFirstElement(step.target);
        if (!isMounted.current) return;

        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(r => setTimeout(r, 250));
            if (!isMounted.current) return;
            const rect = element.getBoundingClientRect();
            setTargetRect({
                top: rect.top + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width,
                height: rect.height
            });
        }
    }, [navigate, location.pathname]);

    useEffect(() => {
        if (!isActive) {
            setTargetRect(null);
            return;
        }
        resolveStep(currentStep);

        // Recalculate on resize
        const handleResize = () => {
            clearTimeout(resizeTimeout.current);
            resizeTimeout.current = setTimeout(() => resolveStep(currentStep), 200);
        };
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(resizeTimeout.current);
        };
    }, [currentStep, isActive, resolveStep]);

    // ── Navigation handlers ───────────────────────────────────────────────────
    const handleNext = () => {
        if (isNavigating) return;
        if (currentStep < TOUR_STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleComplete();
        }
    };

    const handlePrev = () => {
        if (isNavigating || currentStep === 0) return;
        setCurrentStep(prev => prev - 1);
    };

    const handleComplete = async () => {
        setIsActive(false);
        setTargetRect(null);
        if (company && !company.settings?.tour_completed) {
            try {
                await updateCompanySettings({
                    ...(company.settings || {}),
                    tour_completed: true
                });
            } catch (err) {
                console.error("Failed to save tour completion:", err);
            }
        }
    };

    if (!isActive) return null;

    const step = TOUR_STEPS[currentStep];
    const isRTL = language === 'ar';
    const title = isRTL ? step.title_ar : step.title_en;
    const desc = isRTL ? step.desc_ar : step.desc_en;
    const isLast = currentStep === TOUR_STEPS.length - 1;
    const progressPct = ((currentStep + 1) / TOUR_STEPS.length) * 100;

    // ── Tooltip position ──────────────────────────────────────────────────────
    const getTooltipStyle = () => {
        const width = 380;
        const height = 240;
        const margin = 20;

        if (!targetRect) {
            return {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10001,
                width: `${width}px`,
            };
        }

        let top, left;

        switch (step.position) {
            case 'top':
                top = targetRect.top - height - margin;
                left = targetRect.left + (targetRect.width / 2) - (width / 2);
                break;
            case 'left':
                top = targetRect.top + (targetRect.height / 2) - (height / 2);
                left = isRTL
                    ? targetRect.left + targetRect.width + margin
                    : targetRect.left - width - margin;
                break;
            case 'right':
                top = targetRect.top + (targetRect.height / 2) - (height / 2);
                left = isRTL
                    ? targetRect.left - width - margin
                    : targetRect.left + targetRect.width + margin;
                break;
            default: // bottom
                top = targetRect.top + targetRect.height + margin;
                left = targetRect.left + (targetRect.width / 2) - (width / 2);
        }

        // Clamp within viewport
        const vw = window.innerWidth;
        const scrollY = window.scrollY;
        top = Math.max(80 + scrollY, Math.min(top, scrollY + window.innerHeight - height - 40));
        left = Math.max(20, Math.min(left, vw - width - 20));

        return {
            position: 'absolute',
            top: `${top}px`,
            left: `${left}px`,
            width: `${width}px`,
            zIndex: 10001,
        };
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="product-tour-overlay-container">
            {/* Backdrop */}
            <div className="product-tour-backdrop" onClick={handleComplete} />

            {/* Highlight ring */}
            <AnimatePresence>
                {targetRect && (
                    <motion.div
                        key={`highlight-${currentStep}`}
                        className="product-tour-highlighter"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{
                            top: `${targetRect.top - 8}px`,
                            left: `${targetRect.left - 8}px`,
                            width: `${targetRect.width + 16}px`,
                            height: `${targetRect.height + 16}px`,
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Navigation indicator while loading */}
            {isNavigating && (
                <div className="tour-nav-indicator">
                    <div className="tour-nav-spinner" />
                    <span>{isRTL ? 'جارٍ الانتقال...' : 'Navigating...'}</span>
                </div>
            )}

            {/* Tooltip Card */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={`card-${currentStep}`}
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                    style={getTooltipStyle()}
                    className={`product-tour-card ${isRTL ? 'rtl' : 'ltr'}`}
                >
                    {/* Header */}
                    <div className="product-tour-header">
                        <div className="tour-title-row">
                            <span className="tour-step-icon">{step.icon}</span>
                            <h4 className="product-tour-title">{title}</h4>
                        </div>
                        <button className="product-tour-close" onClick={handleComplete} title={isRTL ? 'إغلاق' : 'Close'}>
                            <X size={15} />
                        </button>
                    </div>

                    {/* Description */}
                    <p className="product-tour-desc">{desc}</p>

                    {/* Progress bar */}
                    <div className="tour-progress-bar">
                        <motion.div
                            className="tour-progress-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPct}%` }}
                            transition={{ duration: 0.4 }}
                        />
                    </div>

                    {/* Footer */}
                    <div className="product-tour-footer">
                        <span className="product-tour-step">
                            <Map size={12} style={{ display: 'inline', marginInlineEnd: 4, verticalAlign: 'middle' }} />
                            {currentStep + 1} / {TOUR_STEPS.length}
                        </span>

                        <div className="product-tour-actions">
                            <button
                                className="product-tour-btn secondary"
                                onClick={handleComplete}
                            >
                                {isRTL ? 'تخطي' : 'Skip'}
                            </button>

                            {currentStep > 0 && (
                                <button
                                    className="product-tour-btn icon-btn"
                                    onClick={handlePrev}
                                    disabled={isNavigating}
                                >
                                    {isRTL ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                                </button>
                            )}

                            <button
                                className="product-tour-btn primary"
                                onClick={handleNext}
                                disabled={isNavigating}
                            >
                                {isNavigating ? (
                                    <span className="btn-spinner" />
                                ) : (
                                    <>
                                        <span>
                                            {isLast
                                                ? (isRTL ? 'إنهاء 🎉' : 'Finish 🎉')
                                                : (isRTL ? 'التالي' : 'Next')
                                            }
                                        </span>
                                        {!isLast && (isRTL ? <ChevronLeft size={16} /> : <ChevronRight size={16} />)}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
