import React, { useState, useEffect } from 'react';
import { useLocale } from '../context/LocaleContext';
import './PwaInstaller.css';

const PwaInstaller = () => {
    const { language } = useLocale();
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isStandalone, setIsStandalone] = useState(false);
    const [isIos, setIsIos] = useState(false);
    const [showOverlay, setShowOverlay] = useState(false);

    const isMobileDevice = () => {
        const ua = window.navigator.userAgent || window.navigator.vendor || window.opera;
        return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua.toLowerCase());
    };

    useEffect(() => {
        // 1. Check if already running in standalone mode (installed)
        const checkStandalone = () => {
            const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                               window.navigator.standalone === true;
            setIsStandalone(standalone);
            return standalone;
        };

        const alreadyStandalone = checkStandalone();

        // 2. Check if iOS
        const userAgent = window.navigator.userAgent || '';
        const ios = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
        setIsIos(ios);

        // 3. Listen for the native PWA install prompt event (Only prompt on mobile)
        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            if (!checkStandalone() && isMobileDevice()) {
                setShowOverlay(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // If it is iOS, not standalone, and is a mobile device, show instructions
        if (ios && !alreadyStandalone && isMobileDevice()) {
            setShowOverlay(true);
        }

        // Periodically check in case display mode changes
        const interval = setInterval(checkStandalone, 2000);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            clearInterval(interval);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        
        // Show the native installation prompt
        deferredPrompt.prompt();
        
        // Wait for the user's response
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setShowOverlay(false);
        }
        // 'dismissed' — no action needed, overlay stays until user installs or closes
    };

    // If already installed or shouldn't show overlay, render nothing
    if (isStandalone || !showOverlay || !isMobileDevice()) return null;

    const isRtl = language === 'ar';

    return (
        <div className="pwa-install-overlay animate-fadeIn" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="pwa-install-glow1" />
            <div className="pwa-install-glow2" />

            <div className="pwa-install-card animate-scaleUp">
                
                {/* Glowing Logo */}
                <div className="pwa-logo-container">
                    <div className="pwa-logo-ring animate-pulse" />
                    <img src="/logo.png" alt="KWADER" className="pwa-logo-img" />
                </div>

                {/* Heading */}
                <h2 className="pwa-title">
                    {isRtl ? 'تحميل تطبيق كوادر مطلوب' : 'Kwader App Installation Required'}
                </h2>
                <p className="pwa-subtitle">
                    {isRtl 
                        ? 'لضمان أعلى مستويات الأمان واستقرار ميزات تتبع الحضور والرواتب، يرجى إضافة كوادر لشاشتك الرئيسية.'
                        : 'To ensure data security, high stability, and smooth tracking of attendance & payroll, please add Kwader to your home screen.'}
                </p>

                {isIos ? (
                    /* iOS Specific Guide (Safari) */
                    <div className="pwa-ios-guide">
                        <div className="pwa-ios-step">
                            <span className="pwa-step-num">1</span>
                            <p>
                                {isRtl 
                                    ? 'اضغط على زر المشاركة 📥 في شريط أدوات متصفح Safari.'
                                    : 'Tap the Share button 📥 in the Safari toolbar.'}
                            </p>
                        </div>
                        <div className="pwa-ios-step">
                            <span className="pwa-step-num">2</span>
                            <p>
                                {isRtl 
                                    ? 'اسحب للأعلى واختر "إضافة إلى الشاشة الرئيسية" ➕.'
                                    : 'Scroll down and select "Add to Home Screen" ➕.'}
                            </p>
                        </div>
                        <div className="pwa-ios-step">
                            <span className="pwa-step-num">3</span>
                            <p>
                                {isRtl 
                                    ? 'اضغط على "إضافة" في الزاوية العلوية لتثبيت التطبيق.'
                                    : 'Tap "Add" in the top-right corner to complete.'}
                            </p>
                        </div>
                        
                        <div className="pwa-ios-indicator animate-bounce">
                            <span className="pwa-indicator-arrow">↓</span>
                            <span className="pwa-indicator-text">
                                {isRtl ? 'اضغط بالأسفل للبدء' : 'Tap below to start'}
                            </span>
                        </div>
                    </div>
                ) : (
                    /* Android / Desktop / Chrome Guide */
                    <div className="pwa-android-guide">
                        <button 
                            onClick={handleInstall}
                            className="pwa-install-btn animate-shimmer"
                        >
                            <span>{isRtl ? 'تثبيت التطبيق الآن 📱' : 'Install App Now 📱'}</span>
                        </button>
                        <p className="pwa-install-tip">
                            {isRtl 
                                ? 'سيتم تنزيل التطبيق فوراً وسيعمل بكامل كفاءته مباشرة من شاشتك الرئيسية.'
                                : 'The app installs instantly and runs in fullscreen directly from your home screen.'}
                        </p>
                    </div>
                )}

                {/* Skip/Dismiss Button */}
                <button 
                    onClick={() => setShowOverlay(false)}
                    className="pwa-skip-btn"
                >
                    {isRtl ? 'المتابعة عبر المتصفح 🌐' : 'Continue in Browser 🌐'}
                </button>

            </div>
        </div>
    );
};

export default PwaInstaller;
