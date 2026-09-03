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
import { LanguageProvider } from './context/LanguageContext';

const LandingPageContent = () => {
  const location = useLocation();

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
        <AttendPaySection />
        <HowItWorks />
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
