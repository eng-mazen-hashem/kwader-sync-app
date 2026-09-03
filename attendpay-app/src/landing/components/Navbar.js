import { useState, useEffect, useRef } from "react";
import { Menu, X, ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../context/LanguageContext";

const languages = [
  { code: "en", label: "English", flag: "🇺🇸", native: "English" },
  { code: "ar", label: "Arabic", flag: "🇸🇦", native: "العربية" },
  { code: "de", label: "German", flag: "🇩🇪", native: "Deutsch" },
  { code: "es", label: "Spanish", flag: "🇪🇸", native: "Español" },
];

export function Navbar({ onLoginClick }) {
  const { t, language, setLanguage, isRTL } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setLangOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLinkClick = (href) => {
    setIsOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const navLinks = [
    { label: t.nav.features, href: "#features" },
    { label: t.nav.howItWorks, href: "#how-it-works" },
    { label: t.nav.pricing, href: "#pricing" },
    { label: t.nav.testimonials, href: "#testimonials" },
    { label: t.nav.faq, href: "#faq" },
  ];

  const currentLang = languages.find((l) => l.code === language);

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 backdrop-blur-xl shadow-lg shadow-indigo-100/50 border-b border-indigo-50"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <div className="flex items-center flex-shrink-0 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
            <div className="h-10 px-1 flex items-center justify-center">
              <img src="/logo.png" alt="Kwader Logo" className="h-full w-auto object-contain" />
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-7">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => handleLinkClick(link.href)}
                className="text-sm text-gray-600 hover:text-indigo-600 transition-colors duration-200 whitespace-nowrap"
                style={{ fontWeight: 500 }}
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="hidden md:flex items-center gap-3">
            {/* Language Switcher */}
            <div ref={langRef} className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-indigo-600 transition-colors px-3 py-2 rounded-lg hover:bg-gray-50"
                style={{ fontWeight: 500 }}
              >
                <span className="text-base">{currentLang.flag}</span>
                <span className="hidden lg:block">{currentLang.native}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${langOpen ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {langOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute top-full mt-2 w-44 bg-white rounded-xl border border-gray-100 shadow-xl shadow-gray-100/80 overflow-hidden z-50 ${
                      isRTL ? "left-0" : "right-0"
                    }`}
                  >
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => { setLanguage(lang.code); setLangOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-indigo-50 transition-colors text-left ${
                          language === lang.code ? "bg-indigo-50/50" : ""
                        }`}
                      >
                        <span className="text-base flex-shrink-0">{lang.flag}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-gray-900" style={{ fontWeight: 600 }}>{lang.native}</div>
                          <div className="text-gray-400" style={{ fontSize: "0.72rem" }}>{lang.label}</div>
                        </div>
                        {language === lang.code && (
                          <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={onLoginClick}
              className="text-sm text-gray-700 hover:text-indigo-600 transition-colors px-4 py-2"
              style={{ fontWeight: 500 }}
            >
              {t.nav.login}
            </button>
            <button
              onClick={onLoginClick}
              className="text-sm text-white px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 transition-all duration-200 shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 whitespace-nowrap"
              style={{ fontWeight: 600 }}
            >
              {t.nav.startTrial}
            </button>
          </div>

          {/* Mobile: Lang + Hamburger */}
          <div className="md:hidden flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1 text-gray-600 p-2 rounded-lg hover:bg-gray-50"
              >
                <span className="text-base">{currentLang.flag}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${langOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {langOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute top-full mt-1 w-40 bg-white rounded-xl border border-gray-100 shadow-xl overflow-hidden z-50 ${
                      isRTL ? "left-0" : "right-0"
                    }`}
                  >
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => { setLanguage(lang.code); setLangOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-indigo-50 transition-colors"
                      >
                        <span>{lang.flag}</span>
                        <span className="text-gray-700" style={{ fontWeight: language === lang.code ? 700 : 400 }}>{lang.native}</span>
                        {language === lang.code && <Check className="w-3 h-3 text-indigo-600 ms-auto" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              className="p-2 rounded-lg text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden bg-white/95 backdrop-blur-xl border-t border-gray-100 overflow-hidden"
          >
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  onClick={() => handleLinkClick(link.href)}
                  className="block w-full text-left px-4 py-3 text-sm text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  {link.label}
                </button>
              ))}
              <div className="pt-3 pb-1 flex flex-col gap-2">
                <button
                  onClick={onLoginClick}
                  className="w-full text-sm text-gray-700 py-2.5 rounded-xl border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  {t.nav.login}
                </button>
                <button
                  onClick={onLoginClick}
                  className="w-full text-sm text-white py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600"
                  style={{ fontWeight: 600 }}
                >
                  {t.nav.startTrial}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
