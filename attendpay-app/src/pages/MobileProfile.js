import React from 'react';
import { motion } from 'motion/react';
import { Phone, ShieldCheck, HelpCircle } from 'lucide-react';
import { useEmployeeAuth } from '../context/EmployeeAuthContext';
import { useLocale } from '../context/LocaleContext';

const MobileProfile = () => {
    const { employee } = useEmployeeAuth();
    const { t, language } = useLocale();

    const isRtl = language === 'ar';

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="space-y-6"
            style={{ textAlign: isRtl ? 'right' : 'left' }}
            dir={isRtl ? 'rtl' : 'ltr'}
        >
            <h2 className="text-2xl font-black text-white tracking-tight">{t.empNavProfile}</h2>

            {/* Profile Avatar Header Card (M3 Premium Design) */}
            <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-800/40 shadow-xl flex flex-col items-center text-center relative overflow-hidden">
                {/* Visual Ambient Glows */}
                <div className="absolute -top-12 -left-12 w-28 h-28 rounded-full bg-indigo-500/10 blur-xl pointer-events-none" />
                <div className="absolute -bottom-12 -right-12 w-28 h-28 rounded-full bg-purple-500/10 blur-xl pointer-events-none" />

                <div className="relative mb-4">
                    {/* Glowing outer ring */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 blur-sm opacity-60 scale-105" />
                    <div className="relative w-20 h-20 rounded-full bg-slate-950 flex items-center justify-center text-white text-3xl font-black border-2 border-slate-800">
                        {employee?.name?.charAt(0).toUpperCase()}
                    </div>
                </div>

                <h3 className="font-black text-lg text-white mb-0.5">{employee?.name}</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider opacity-85">{employee?.company_name}</p>
            </div>

            {/* Account Details Group (No Borders, Spatial Hierarchy) */}
            <div className="bg-slate-900/40 p-5 rounded-3xl border border-slate-800/40 shadow-xl space-y-4">
                {/* Phone */}
                <div className="flex items-center gap-3.5 pb-3.5 border-b border-slate-800/40">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-slate-400">
                        <Phone size={16} />
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.phoneNumberLabel}</p>
                        <p className="font-bold text-sm text-slate-200">{employee?.phone}</p>
                    </div>
                </div>

                {/* Status */}
                <div className="flex items-center gap-3.5 pb-3.5 border-b border-slate-800/40">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-slate-400">
                        <ShieldCheck size={16} />
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.thStatus}</p>
                        <span className={`inline-block text-xs font-black ${employee?.status === 'active' ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {employee?.status === 'active' ? t.statusActive : t.statusInactive}
                        </span>
                    </div>
                </div>
                
                {/* Direct HR Support */}
                <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-slate-400">
                        <HelpCircle size={16} />
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.empSupportTitle}</p>
                        <p className="font-bold text-xs text-indigo-400">{t.empSupportContactHR}</p>
                    </div>
                </div>
            </div>

            {/* Version Information Block */}
            <div className="text-center text-[10px] text-slate-600 font-bold mt-12 flex flex-col gap-1">
                <p>AttendPay Employee Portal v1.2</p>
                <p className="opacity-65">&copy; 2026 Kwader. All rights reserved.</p>
            </div>
        </motion.div>
    );
};

export default MobileProfile;
