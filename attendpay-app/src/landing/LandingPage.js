import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { TrustedBy } from './components/TrustedBy';
import { Features } from './components/Features';
import { AttendPaySection } from './components/AttendPaySection';
import { HowItWorks } from './components/HowItWorks';
import { Pricing } from './components/Pricing';
import { Testimonials } from './components/Testimonials';
import { FAQ } from './components/FAQ';
import { CTASection } from './components/CTASection';
import { Footer } from './components/Footer';
import { RoiCalculator } from './components/RoiCalculator';
import { ComplianceSecurity } from './components/ComplianceSecurity';
import { LanguageProvider } from './context/LanguageContext';

import { useLanguage } from './context/LanguageContext';
import { useSEO } from '../utils/useSEO';

const LandingPageContent = () => {
  const location = useLocation();
  const { language } = useLanguage();

  const seoData = {
    ar: {
      title: "نظام كوادر (KWADER) | أفضل برنامج لإدارة الموارد البشرية والرواتب وبصمة الحضور",
      description: "نظام كوادر (KWADER) لإدارة الموارد البشرية وشؤون الموظفين، أتمتة مسير الرواتب ومزامنة بصمة الحضور والواتساب للشركات في الخليج ومصر. ابدأ تجربتك المجانية 35 يوماً.",
      canonical: "https://kwader-system.web.app/",
    },
    en: {
      title: "KWADER HR | Cloud HR, Biometric Attendance & Automated Payroll",
      description: "The all-in-one HR platform that automates attendance, runs error-free payroll in seconds, and reclaims 40 hours monthly. Start your 35-day free trial.",
      canonical: "https://kwader-system.web.app/?lang=en",
    },
    de: {
      title: "KWADER HR | Cloud-Personalverwaltung & Gehaltsabrechnung",
      description: "Die All-in-One-HR-Plattform für Zeiterfassung, automatisierte Gehaltsabrechnung und Mitarbeiterverwaltung. Jetzt 35 Tage kostenlos testen.",
      canonical: "https://kwader-system.web.app/?lang=de",
    },
    es: {
      title: "KWADER HR | Plataforma de RRHH, Asistencia Biométrica y Nómina",
      description: "Automatice nóminas, asistencia de empleados y gestión de personal sin errores. Comience su prueba gratuita de 35 días hoy mismo.",
      canonical: "https://kwader-system.web.app/?lang=es",
    }
  };

  const currentSeo = seoData[language] || seoData.ar;

  useSEO({
    title: currentSeo.title,
    description: currentSeo.description,
    canonical: currentSeo.canonical,
    lang: language,
  });

  useEffect(() => {
    if (location.hash) {
      setTimeout(() => {
        const el = document.querySelector(location.hash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [location]);

  const handleAction = () => {
    // Navigate to login or signup
    window.location.href = '/login';
  };

  return (
    <div className="h-screen overflow-y-auto w-full bg-white">
      <Navbar onLoginClick={handleAction} />
      <main>
        <Hero onStartTrial={handleAction} />
        <TrustedBy />
        <Features />
        <RoiCalculator onStartTrial={handleAction} />
        <AttendPaySection />
        <HowItWorks />
        <ComplianceSecurity />
        <Testimonials />
        <Pricing />
        <FAQ />
        <CTASection onStartTrial={handleAction} />
      </main>
      <Footer />
    </div>
  );
};

export default function LandingPage() {
  return (
    <LanguageProvider>
      <LandingPageContent />
    </LanguageProvider>
  );
}
