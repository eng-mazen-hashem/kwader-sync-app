// -------------------------------------------------------------------------
// Completely independent context.
// Reads company.settings.country → resolves currency + timezone + formatters.
// Wrap your app with <LocaleProvider> INSIDE <AuthProvider>.
// -------------------------------------------------------------------------

import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useEmployeeAuth } from './EmployeeAuthContext';
import { getCountryByCode, DEFAULT_COUNTRY } from '../utils/countries';
import { TRANSLATIONS } from '../constants/translations';

// -------------------------------------------------------------------------

const LocaleContext = createContext(null);

export const useLocale = () => {
    const ctx = useContext(LocaleContext);
    if (!ctx) throw new Error('useLocale must be used within a LocaleProvider');
    return ctx;
};



// -------------------------------------------------------------------------

export function LocaleProvider({ children }) {
    const { company } = useAuth();
    const { employee } = useEmployeeAuth();
    const [employeeCompany, setEmployeeCompany] = useState(null);

    useEffect(() => {
        if (employee && employee.company_settings && !company) {
            setEmployeeCompany({ settings: employee.company_settings });
        } else {
            setEmployeeCompany(null);
        }
    }, [employee, company]);

// -------------------------------------------------------------------------
    // Initialized from localStorage if available, otherwise defaults to 'ar'.
    const [language, setLanguage] = React.useState(() => {
        return localStorage.getItem('kwader_lang') || 'ar';
    });

    const toggleLanguage = React.useCallback(() => {
        setLanguage(prev => {
            const next = prev === 'ar' ? 'en' : 'ar';
            localStorage.setItem('kwader_lang', next);
            return next;
        });
    }, []);

    const t = React.useMemo(() => TRANSLATIONS[language] || TRANSLATIONS.ar, [language]);

    // Derive the active country from company settings.
    // Falls back to DEFAULT_COUNTRY when nothing is saved yet.
    const country = React.useMemo(() => {
        const code = company?.settings?.country || employeeCompany?.settings?.country;
        return code ? (getCountryByCode(code) ?? DEFAULT_COUNTRY) : DEFAULT_COUNTRY;
    }, [company?.settings?.country, employeeCompany?.settings?.country]);

    // All formatters are memoized — they only rebuild when country changes.
    const value = useMemo(() => {
        const activeLocale = language === 'en' ? 'en-US' : country.locale;
        const activeCurrencySymbol = language === 'en' ? country.currency : country.currencySymbol;

        // e.g.  formatCurrency(1500.75)  →  "١٬٥٠٠٫٧٥ ر.س" or "SAR 1,500.75"
        const currencyFormatter = new Intl.NumberFormat(activeLocale, {
            style: 'currency',
            currency: country.currency,
            // Compact fractions for currencies that don't use decimals (JPY, KWD etc.)
            minimumFractionDigits: ['JPY', 'KRW', 'IRR', 'IQD', 'YER'].includes(country.currency) ? 0 : 2,
            maximumFractionDigits: ['KWD', 'BHD', 'OMR'].includes(country.currency) ? 3 : 2,
        });

        const formatCurrency = (amount) => {
            if (amount == null || isNaN(amount)) return '—';
            return currencyFormatter.format(amount);
        };

        // e.g.  formatAmount(1500.75)  →  "١٬٥٠٠٫٧٥" or "1,500.75"
        const amountFormatter = new Intl.NumberFormat(activeLocale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

        const formatAmount = (amount) => {
            if (amount == null || isNaN(amount)) return '—';
            return amountFormatter.format(amount);
        };

        // e.g.  formatDate(new Date())  →  "١٥ مارس ٢٠٢٦" or "March 15, 2026"
        const dateFormatter = new Intl.DateTimeFormat(activeLocale, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: country.timezone,
        });

        const formatDate = (date) => {
            if (!date) return '—';
            try { return dateFormatter.format(new Date(date)); }
            catch { return '—'; }
        };

        // e.g.  formatDateTime(new Date())  →  "١٥ مارس ٢٠٢٦، ١٠:٣٠ ص" or "March 15, 2026, 10:30 AM"
        const dateTimeFormatter = new Intl.DateTimeFormat(activeLocale, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: country.timezone,
        });

        const formatDateTime = (date) => {
            if (!date) return '—';
            try { return dateTimeFormatter.format(new Date(date)); }
            catch { return '—'; }
        };

        // e.g.  formatShortDate(new Date())  →  "15/03/2026"
        const shortDateFormatter = new Intl.DateTimeFormat(activeLocale, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: country.timezone,
        });

        const formatShortDate = (date) => {
            if (!date) return '—';
            try { return shortDateFormatter.format(new Date(date)); }
            catch { return '—'; }
        };

        // e.g.  formatTime(new Date())  →  "١٠:٣٠ ص" or "10:30 AM"
        const timeFormatter = new Intl.DateTimeFormat(activeLocale, {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: country.timezone,
        });

        const formatTime = (date) => {
            if (!date) return '—';
            try { return timeFormatter.format(new Date(date)); }
            catch { return '—'; }
        };

        const getNow = () => new Date();

        return {
            // Country meta
            country,                            // full country object
            countryCode: country.code,
            countryNameAr: country.nameAr,
            countryNameEn: country.nameEn,
            flag: country.flag,

            // Currency meta
            currency: country.currency,         // "SAR"
            currencySymbol: activeCurrencySymbol,   // "ر.س" or "SAR"

            // Timezone meta
            timezone: country.timezone,         // "Asia/Riyadh"
            locale: activeLocale,               // "ar-SA" or "en-US"

            // Formatters
            formatCurrency,       // formatCurrency(1500)      → "١٬٥٠٠٫٠٠ ر.س" or "SAR 1,500.00"
            formatAmount,         // formatAmount(1500)        → "١٬٥٠٠٫٠٠" or "1,500.00"
            formatDate,           // formatDate(date)          → "١٥ مارس ٢٠٢٦" or "March 15, 2026"
            formatDateTime,       // formatDateTime(date)      → "١٥ مارس ٢٠٢٦، ١٠:٣٠" or "March 15, 2026, 10:30 AM"
            formatShortDate,      // formatShortDate(date)     → "15/03/2026"
            formatTime,           // formatTime(date)          → "١٠:٣٠ ص" or "10:30 AM"
            getNow,               // getNow()                  → Date (use with formatters)

            // Language & Translation
            language,             // 'ar' | 'en'
            toggleLanguage,       // function to switch
            t,                    // translation object for current language
        };
    }, [country, language, toggleLanguage, t]);

    return (
        <LocaleContext.Provider value={value}>
            {children}
        </LocaleContext.Provider>
    );
}