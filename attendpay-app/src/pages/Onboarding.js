import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ChevronLeft, ChevronRight, Building2, Globe2, Users, Rocket, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import './Onboarding.css';

const STEPS = [
    { id: 'welcome', title: 'الملف التعريفي', icon: <Building2 size={20} /> },
    { id: 'regional', title: 'الإعدادات الإقليمية', icon: <Globe2 size={20} /> },
    { id: 'shift', title: 'شيفت العمل', icon: <Clock size={20} /> },
    { id: 'team', title: 'الهيكل والalerts', icon: <Users size={20} /> },
    { id: 'finish', title: 'الانطلاق', icon: <Rocket size={20} /> }
];

const Onboarding = () => {
    const navigate = useNavigate();
    const { user, company, updateCompanySettings, activeRole } = useAuth();
    const { language } = useLocale();

    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        companyName: company?.name || '',
        companySize: '1-10',
        sector: 'technology',
        timezone: 'Asia/Riyadh',
        weekend: 'friday_saturday',
        shiftName: 'صباحي',
        shiftType: 'fixed', // fixed or flexible
        shiftStartTime: '09:00',
        shiftEndTime: '17:00',
        shiftTargetHours: '8',
        firstDepartment: 'الإدارة العامة',
        enableWhatsapp: true,
        enableTelegram: false,
        enableEmailDigest: true
    });

    // Security Check: If they are not org_admin or already completed, boot them.
    useEffect(() => {
        if (!user || !company) return;
        if (activeRole !== 'org_admin') {
            navigate('/dashboard');
        }
        if (company?.settings?.onboarding_completed) {
            navigate('/dashboard');
        }
    }, [user, company, activeRole, navigate]);

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleComplete = async (startTour = true) => {
        setLoading(true);
        try {
            // 1. Build the settings object and update company settings
            const newSettings = {
                ...(company?.settings || {}),
                onboarding_completed: true,
                timezone: formData.timezone,
                weekend_days: formData.weekend,
                company_size: formData.companySize,
                sector: formData.sector,
                enable_whatsapp: formData.enableWhatsapp,
                enable_telegram: formData.enableTelegram,
                enable_email_digest: formData.enableEmailDigest,
                setup_date: new Date().toISOString()
            };

            await updateCompanySettings(newSettings);

            // 2. Insert first department
            if (formData.firstDepartment.trim()) {
                await supabase
                    .from('departments')
                    .insert({
                        company_id: company.id,
                        name: formData.firstDepartment.trim()
                    });
            }

            // 3. Insert first shift
            const workDaysMapping = {
                friday_saturday: ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"],
                saturday_sunday: ["الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"],
                friday: ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"],
                sunday: ["الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
            };
            const activeWorkDays = workDaysMapping[formData.weekend] || ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"];

            await supabase
                .from('shifts')
                .insert({
                    company_id: company.id,
                    name: formData.shiftName.trim() || 'صباحي',
                    shift_type: formData.shiftType,
                    start_time: formData.shiftType === 'fixed' ? `${formData.shiftStartTime}:00` : '09:00:00',
                    end_time: formData.shiftType === 'fixed' ? `${formData.shiftEndTime}:00` : '17:00:00',
                    target_hours: formData.shiftType === 'flexible' ? parseFloat(formData.shiftTargetHours) : 8,
                    work_days: activeWorkDays,
                    color: '#818cf8',
                    is_active: true
                });

            // 4. Save tour state in SessionStorage to trigger it upon dashboard mount
            if (startTour) {
                sessionStorage.setItem('start_tour_on_mount', 'true');
            }

            toast.success(language === 'ar' ? 'تم إعداد حسابك وتهيئة بيئة العمل بنجاح! 🎉' : 'Account and work environment configured successfully! 🎉');
            navigate('/dashboard');
        } catch (error) {
            console.error('Error saving onboarding:', error);
            toast.error(language === 'ar' ? 'حدث خطأ أثناء حفظ الإعدادات.' : 'Error saving settings.');
        } finally {
            setLoading(false);
        }
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 0:
                return (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                    >
                        <div className="onb-header">
                            <h2 className="onb-title">أهلاً بك يا {user?.user_metadata?.full_name?.split(' ')[0] || 'مدير'}! 👋</h2>
                            <p className="onb-subtitle">لنقم بإعداد منصة {formData.companyName} في خطوات بسيطة لتبدأ فوراً.</p>
                        </div>

                        <div className="onb-form-group">
                            <label className="onb-label">قطاع عمل المنشأة (Industry)</label>
                            <select 
                                className="onb-select"
                                value={formData.sector}
                                onChange={(e) => setFormData({...formData, sector: e.target.value})}
                            >
                                <option value="technology">تقنية معلومات وبرمجيات</option>
                                <option value="retail">تجزئة ومبيعات</option>
                                <option value="manufacturing">صناعة وتشغيل</option>
                                <option value="services">خدمات واستشارات</option>
                                <option value="healthcare">رعاية صحية وطبية</option>
                                <option value="other">قطاعات أخرى</option>
                            </select>
                        </div>

                        <div className="onb-form-group">
                            <label className="onb-label">حجم الشركة المتوقع</label>
                            <div className="onb-options-grid">
                                {['1-10', '11-50', '51-200', '+200'].map(size => (
                                    <div 
                                        key={size}
                                        className={`onb-option-card ${formData.companySize === size ? 'selected' : ''}`}
                                        onClick={() => setFormData({...formData, companySize: size})}
                                    >
                                        <div className="onb-radio-circle">
                                            <div className="onb-radio-dot" />
                                        </div>
                                        <span className="font-medium">{size} موظف</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                );
            case 1:
                return (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                    >
                        <div className="onb-header">
                            <h2 className="onb-title">الإعدادات الإقليمية 🌍</h2>
                            <p className="onb-subtitle">تساعدنا هذه الإعدادات في ضبط الحضور وحساب ساعات التأخير والعمل بدقة.</p>
                        </div>

                        <div className="onb-form-group">
                            <label className="onb-label">المنطقة الزمنية (Timezone)</label>
                            <select 
                                className="onb-select"
                                value={formData.timezone}
                                onChange={(e) => setFormData({...formData, timezone: e.target.value})}
                                dir="ltr"
                            >
                                <option value="Asia/Riyadh">Asia/Riyadh (KSA)</option>
                                <option value="Asia/Dubai">Asia/Dubai (UAE)</option>
                                <option value="Africa/Cairo">Africa/Cairo (Egypt)</option>
                                <option value="Europe/London">Europe/London (GMT)</option>
                            </select>
                        </div>

                        <div className="onb-form-group">
                            <label className="onb-label">أيام العطلة الأسبوعية (Weekend)</label>
                            <div className="onb-options-grid">
                                {[
                                    { id: 'friday_saturday', label: 'الجمعة والسبت' },
                                    { id: 'saturday_sunday', label: 'السبت والأحد' },
                                    { id: 'friday', label: 'الجمعة فقط' },
                                    { id: 'sunday', label: 'الأحد فقط' }
                                ].map(wknd => (
                                    <div 
                                        key={wknd.id}
                                        className={`onb-option-card ${formData.weekend === wknd.id ? 'selected' : ''}`}
                                        onClick={() => setFormData({...formData, weekend: wknd.id})}
                                    >
                                        <div className="onb-radio-circle">
                                            <div className="onb-radio-dot" />
                                        </div>
                                        <span className="font-medium">{wknd.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                );
            case 2:
                return (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                    >
                        <div className="onb-header">
                            <h2 className="onb-title">شيفت العمل الأساسي ⏰</h2>
                            <p className="onb-subtitle">إنشاء أول شيفت عمل للموظفين وسيتم تطبيقه وتفعيله فوراً.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="onb-form-group">
                                <label className="onb-label">اسم الشيفت</label>
                                <input 
                                    type="text" 
                                    className="onb-input" 
                                    value={formData.shiftName} 
                                    onChange={(e) => setFormData({...formData, shiftName: e.target.value})}
                                />
                            </div>
                            <div className="onb-form-group">
                                <label className="onb-label">نوع الدوام</label>
                                <select 
                                    className="onb-select"
                                    value={formData.shiftType}
                                    onChange={(e) => setFormData({...formData, shiftType: e.target.value})}
                                >
                                    <option value="fixed">ثابت (مواعيد محددة)</option>
                                    <option value="flexible">مرن (ساعات مستهدفة)</option>
                                </select>
                            </div>
                        </div>

                        {formData.shiftType === 'fixed' ? (
                            <div className="grid grid-cols-2 gap-4 animate-fade-in">
                                <div className="onb-form-group">
                                    <label className="onb-label">حضور (يبدأ من)</label>
                                    <input 
                                        type="time" 
                                        className="onb-input" 
                                        value={formData.shiftStartTime} 
                                        onChange={(e) => setFormData({...formData, shiftStartTime: e.target.value})}
                                    />
                                </div>
                                <div className="onb-form-group">
                                    <label className="onb-label">انصراف (ينتهي في)</label>
                                    <input 
                                        type="time" 
                                        className="onb-input" 
                                        value={formData.shiftEndTime} 
                                        onChange={(e) => setFormData({...formData, shiftEndTime: e.target.value})}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="onb-form-group animate-fade-in">
                                <label className="onb-label">ساعات العمل المستهدفة يومياً</label>
                                <input 
                                    type="number" 
                                    className="onb-input" 
                                    min="1" 
                                    max="24"
                                    value={formData.shiftTargetHours} 
                                    onChange={(e) => setFormData({...formData, shiftTargetHours: e.target.value})}
                                />
                            </div>
                        )}
                    </motion.div>
                );
            case 3:
                return (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                    >
                        <div className="onb-header">
                            <h2 className="onb-title">الهيكلة والتنبيهات 🏢</h2>
                            <p className="onb-subtitle">إنشاء القسم الإداري الأول وضبط قنوات الاتصال والتقارير.</p>
                        </div>

                        <div className="onb-form-group">
                            <label className="onb-label">اسم القسم الأول في المنشأة</label>
                            <input 
                                type="text" 
                                className="onb-input" 
                                placeholder="مثال: الإدارة، المبيعات"
                                value={formData.firstDepartment} 
                                onChange={(e) => setFormData({...formData, firstDepartment: e.target.value})}
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="onb-label">قنوات التنبيهات والتقارير المفضلة</label>
                            
                            <label className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={formData.enableWhatsapp}
                                    onChange={(e) => setFormData({...formData, enableWhatsapp: e.target.checked})}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4.5 h-4.5"
                                />
                                <div className="text-right">
                                    <div className="text-sm font-semibold text-white">إرسال إشعارات عبر الواتساب (WhatsApp)</div>
                                    <div className="text-xs text-slate-400">إشعار فوري عند انقطاع أجهزة البصمة المحلية أو تأخر الموظفين</div>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={formData.enableEmailDigest}
                                    onChange={(e) => setFormData({...formData, enableEmailDigest: e.target.checked})}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4.5 h-4.5"
                                />
                                <div className="text-right">
                                    <div className="text-sm font-semibold text-white">تقرير يومي عبر البريد (Email Digest)</div>
                                    <div className="text-xs text-slate-400">ملخص إحصائي يومي لحالة حضور وغياب وتأخيرات الموظفين</div>
                                </div>
                            </label>
                        </div>
                    </motion.div>
                );
            case 4:
                return (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                        className="onb-success text-center space-y-6"
                    >
                        <div className="onb-success-icon mx-auto">
                            <Check size={40} className="text-emerald-500" />
                        </div>
                        <h2 className="onb-title text-3xl font-bold">كل شيء جاهز! 🚀</h2>
                        <p className="onb-subtitle max-w-md mx-auto text-slate-300 text-sm">
                            لقد تم تهيئة بيئة العمل الخاصة بك وإنشاء الشيفت والأقسام الافتراضية بنجاح.
                            ننصح ببدء جولة تعريفية سريعة بالبرنامج للتعرف على كامل القوة البرمجية للنظام ومميزاته الفعالة.
                        </p>

                        <div className="flex flex-col gap-3 max-w-xs mx-auto pt-4">
                            <button 
                                onClick={() => handleComplete(true)}
                                disabled={loading}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold transition-all shadow-lg shadow-indigo-500/20"
                            >
                                {loading ? 'جاري حفظ الإعدادات...' : 'ابدأ الجولة التعريفية السريعة 🔮'}
                            </button>
                            <button 
                                onClick={() => handleComplete(false)}
                                disabled={loading}
                                className="w-full py-2.5 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 font-semibold text-sm transition-colors"
                            >
                                تخطي والذهاب مباشرة للوحة التحكم
                            </button>
                        </div>
                    </motion.div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="onboarding-container" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            <div className="onb-bg-glow" />
            <div className="onb-bg-glow-2" />
            
            <div className="onb-card">
                {/* Progress Bar */}
                {currentStep < STEPS.length - 1 && (
                    <div className="onb-steps-header">
                        <div className="onb-progress-container">
                            <div 
                                className="onb-progress-bar" 
                                style={{ width: `${((currentStep + 1) / (STEPS.length - 1)) * 100}%` }}
                            />
                        </div>
                        <div className="onb-steps-indicator">
                            {STEPS.slice(0, 4).map((step, idx) => (
                                <div key={step.id} className={`onb-step-dot-wrap ${idx <= currentStep ? 'active' : ''}`}>
                                    <div className="onb-step-dot">
                                        {idx < currentStep ? <Check size={12} /> : step.icon}
                                    </div>
                                    <span className="onb-step-text">{step.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="onb-content">
                    <AnimatePresence mode="wait">
                        {renderStepContent()}
                    </AnimatePresence>
                </div>

                {/* Footer Controls */}
                {currentStep < STEPS.length - 1 && (
                    <div className="onb-footer">
                        {currentStep > 0 ? (
                            <button 
                                className="onb-btn onb-btn-secondary" 
                                onClick={handlePrev}
                                disabled={loading}
                            >
                                <ChevronRight size={18} />
                                السابق
                            </button>
                        ) : <div />}

                        <button 
                            className="onb-btn onb-btn-primary" 
                            onClick={handleNext}
                            disabled={loading}
                        >
                            التالي
                            <ChevronLeft size={18} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Onboarding;
