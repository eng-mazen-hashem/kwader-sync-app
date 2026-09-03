import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, CheckCircle2, XCircle, Fingerprint, Info, Locate } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useEmployeeAuth } from '../context/EmployeeAuthContext';
import { useLocale } from '../context/LocaleContext';
import { toast } from 'sonner';

const MobilePunch = () => {
    const { employee } = useEmployeeAuth();
    const { t, formatTime, language } = useLocale();
    const [location, setLocation] = useState(null);
    const [loadingLocation, setLoadingLocation] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [punchSuccess, setPunchSuccess] = useState(null);

    const getLocation = useCallback(() => {
        setLoadingLocation(true);
        setErrorMsg('');
        
        if (!navigator.geolocation) {
            setErrorMsg(t.errGeolocationNotSupported || 'متصفحك لا يدعم تحديد الموقع.');
            setLoadingLocation(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
                setLoadingLocation(false);
            },
            (error) => {
                console.error("Error getting location:", error);
                if (error.code === 1) setErrorMsg(t.errGeolocationDenied || 'يرجى السماح بالوصول لموقعك الجغرافي.');
                else setErrorMsg(t.errGeolocationFailed || 'تعذر تحديد موقعك الحالي.');
                setLoadingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }, [t]);

    useEffect(() => {
        getLocation();
    }, [getLocation]);

    const handlePunch = async () => {
        if (!location) {
            toast.error(t.errCannotDetermineLocation || 'لا يمكن تحديد الموقع');
            return;
        }

        setIsSubmitting(true);
        try {
            const { data, error } = await supabase.rpc('submit_gps_punch', {
                p_employee_id: employee.id,
                p_pin: employee.pin,
                p_lat: location.lat,
                p_lng: location.lng
            });

            if (error) throw error;

            if (data && data.success) {
                const punchTypeLabel = data.punch_type === 'check_in' 
                    ? (t.empCheckIn || 'حضور') 
                    : (t.empCheckOut || 'انصراف');
                setPunchSuccess({
                    type: punchTypeLabel,
                    time: formatTime(data.timestamp)
                });
                toast.success(language === 'ar' 
                    ? `تم تسجيل ال${punchTypeLabel} بنجاح!` 
                    : `Punch ${data.punch_type === 'check_in' ? 'in' : 'out'} registered successfully!`);
            }
        } catch (err) {
            console.error('Punch error:', err);
            toast.error(err.message || (t.errGeneric || 'حدث خطأ أثناء تسجيل البصمة.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const isRtl = language === 'ar';

    if (!employee?.allow_gps_punch) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 mt-6 bg-slate-900/20 rounded-3xl border border-red-500/10">
                <XCircle size={56} className="text-red-500 mb-4 opacity-90" />
                <h2 className="text-xl font-bold mb-2 text-white">{t.unauthorizedTitle || 'غير مصرح'}</h2>
                <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
                    {t.empGpsNotEnabled || 'حسابك غير مفعل لاستخدام البصمة عبر الموقع (GPS). يرجى استخدام جهاز البصمة أو مراجعة الإدارة.'}
                </p>
            </div>
        );
    }

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="space-y-6 flex flex-col items-center pt-4"
            dir={isRtl ? 'rtl' : 'ltr'}
        >
            <div className="text-center w-full max-w-sm">
                <h2 className="text-2xl font-black tracking-tight text-white mb-1.5">{t.empPunchTitle || 'تسجيل البصمة'}</h2>
                <p className="text-slate-400 text-xs leading-relaxed max-w-xs mx-auto">
                    {t.empPunchSubtitle || 'اضغط على الزر لتسجيل حضورك أو انصرافك في موقع عملك.'}
                </p>
            </div>

            <AnimatePresence mode="wait">
                {punchSuccess ? (
                    <motion.div 
                        key="success"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="flex flex-col items-center justify-center text-center p-6 bg-slate-900/40 rounded-3xl border border-slate-800/40 w-full max-w-sm shadow-xl"
                    >
                        <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
                            <CheckCircle2 size={52} className="text-emerald-500" />
                        </div>
                        <h3 className="text-xl font-black text-white mb-2">{t.empPunchSuccessTitle || 'تم التسجيل بنجاح'}</h3>
                        
                        <div className="bg-slate-950/40 p-4 rounded-2xl w-full space-y-2.5 text-sm text-slate-300 mb-6">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">{t.empPunchTypeLabel || 'نوع الحركة:'}</span>
                                <span className="font-extrabold text-emerald-400">{punchSuccess.type}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">{t.timeLabel || 'الوقت:'}</span>
                                <span className="font-bold text-white">{punchSuccess.time}</span>
                            </div>
                        </div>

                        <button 
                            onClick={() => setPunchSuccess(null)}
                            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-2xl transition-all"
                        >
                            {t.empNewPunchBtn || 'بصمة جديدة'}
                        </button>
                    </motion.div>
                ) : (
                    <motion.div 
                        key="punch-active"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="w-full flex flex-col items-center"
                    >
                        {/* Status box */}
                        <div className="bg-slate-900/40 p-4 rounded-2xl w-full max-w-sm flex items-center justify-between shadow-md mb-8">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${location ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-500"}`}>
                                    <MapPin size={16} />
                                </div>
                                <span className="text-xs font-bold text-slate-300">
                                    {loadingLocation ? (t.empLocating || 'جاري تحديد الموقع...') : errorMsg ? errorMsg : (t.empLocationDetected || 'تم تحديد الموقع')}
                                </span>
                            </div>
                            {!loadingLocation && !location && (
                                <button 
                                    onClick={getLocation} 
                                    className="text-xs text-indigo-400 font-bold bg-indigo-500/10 px-2.5 py-1.5 rounded-lg hover:bg-indigo-500/20 transition-all"
                                >
                                    {t.retryBtn || 'إعادة المحاولة'}
                                </button>
                            )}
                        </div>

                        {/* Interactive Ripple Button */}
                        <div className="relative flex justify-center items-center h-56 w-full mb-8">
                            {location && !isSubmitting && (
                                <>
                                    <motion.div 
                                        initial={{ scale: 0.8, opacity: 0.5 }}
                                        animate={{ scale: 1.4, opacity: 0 }}
                                        transition={{ repeat: Infinity, duration: 2.5, ease: 'easeOut' }}
                                        className="absolute w-44 h-44 rounded-full border border-indigo-500/30"
                                    />
                                    <motion.div 
                                        initial={{ scale: 0.8, opacity: 0.3 }}
                                        animate={{ scale: 1.6, opacity: 0 }}
                                        transition={{ repeat: Infinity, duration: 2.5, delay: 0.8, ease: 'easeOut' }}
                                        className="absolute w-44 h-44 rounded-full border border-purple-500/20"
                                    />
                                </>
                            )}
                            
                            <button
                                onClick={handlePunch}
                                disabled={!location || isSubmitting}
                                className={`relative w-36 h-36 rounded-full flex flex-col items-center justify-center gap-1.5 shadow-2xl transition-all duration-300
                                    ${!location 
                                        ? 'bg-slate-900 text-slate-500 cursor-not-allowed border border-slate-800' 
                                        : 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(99,102,241,0.45)]'}`}
                            >
                                <Fingerprint size={38} className={isSubmitting ? 'animate-pulse' : ''} />
                                <span className="font-extrabold text-sm">{isSubmitting ? (t.sending || 'جاري...') : (t.empPunchNowBtn || 'بصم الآن')}</span>
                            </button>
                        </div>

                        {/* GPS Accuracy / Coordinates Card (M3 High Density Detail) */}
                        {location && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-slate-900/40 p-4 rounded-2xl w-full max-w-sm space-y-2 text-xs text-slate-400"
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-medium flex items-center gap-1">
                                        <Locate size={12} className="text-slate-500" />
                                        {isRtl ? 'خط العرض:' : 'Latitude:'}
                                    </span>
                                    <span className="font-mono text-slate-300">{location.lat.toFixed(5)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-medium flex items-center gap-1">
                                        <Locate size={12} className="text-slate-500" />
                                        {isRtl ? 'خط الطول:' : 'Longitude:'}
                                    </span>
                                    <span className="font-mono text-slate-300">{location.lng.toFixed(5)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-medium flex items-center gap-1">
                                        <Info size={12} className="text-slate-500" />
                                        {isRtl ? 'دقة التحديد:' : 'Accuracy:'}
                                    </span>
                                    <span className="font-mono text-slate-300">± {Math.round(location.accuracy)} m</span>
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default MobilePunch;
