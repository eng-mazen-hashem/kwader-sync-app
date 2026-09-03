// -------------------------------------------------------------------------
// Pure data — no imports, no side effects, no dependencies.
// Each entry: { code, nameAr, nameEn, currency, currencySymbol,
//              timezone, locale, flag }
//
// currency  → ISO 4217
// timezone  → IANA tz database
// locale    → BCP 47 (for Intl.NumberFormat / Intl.DateTimeFormat)
// -------------------------------------------------------------------------

export const COUNTRIES = [
// -------------------------------------------------------------------------
    { code: 'SA', nameAr: 'المملكة العربية السعودية', nameEn: 'Saudi Arabia', currency: 'SAR', currencySymbol: 'ر.س', timezone: 'Asia/Riyadh', locale: 'ar-SA', flag: '🇸🇦' },
    { code: 'EG', nameAr: 'مصر', nameEn: 'Egypt', currency: 'EGP', currencySymbol: 'ج.م', timezone: 'Africa/Cairo', locale: 'ar-EG', flag: '🇪🇬' },
    { code: 'AE', nameAr: 'الإمارات العربية المتحدة', nameEn: 'UAE', currency: 'AED', currencySymbol: 'د.إ', timezone: 'Asia/Dubai', locale: 'ar-AE', flag: '🇦🇪' },
    { code: 'KW', nameAr: 'الكويت', nameEn: 'Kuwait', currency: 'KWD', currencySymbol: 'د.ك', timezone: 'Asia/Kuwait', locale: 'ar-KW', flag: '🇰🇼' },
    { code: 'QA', nameAr: 'قطر', nameEn: 'Qatar', currency: 'QAR', currencySymbol: 'ر.ق', timezone: 'Asia/Qatar', locale: 'ar-QA', flag: '🇶🇦' },
    { code: 'BH', nameAr: 'البحرين', nameEn: 'Bahrain', currency: 'BHD', currencySymbol: 'د.ب', timezone: 'Asia/Bahrain', locale: 'ar-BH', flag: '🇧🇭' },
    { code: 'OM', nameAr: 'عُمان', nameEn: 'Oman', currency: 'OMR', currencySymbol: 'ر.ع', timezone: 'Asia/Muscat', locale: 'ar-OM', flag: '🇴🇲' },
    { code: 'JO', nameAr: 'الأردن', nameEn: 'Jordan', currency: 'JOD', currencySymbol: 'د.أ', timezone: 'Asia/Amman', locale: 'ar-JO', flag: '🇯🇴' },
    { code: 'LB', nameAr: 'لبنان', nameEn: 'Lebanon', currency: 'LBP', currencySymbol: 'ل.ل', timezone: 'Asia/Beirut', locale: 'ar-LB', flag: '🇱🇧' },
    { code: 'SY', nameAr: 'سوريا', nameEn: 'Syria', currency: 'SYP', currencySymbol: 'ل.س', timezone: 'Asia/Damascus', locale: 'ar-SY', flag: '🇸🇾' },
    { code: 'IQ', nameAr: 'العراق', nameEn: 'Iraq', currency: 'IQD', currencySymbol: 'د.ع', timezone: 'Asia/Baghdad', locale: 'ar-IQ', flag: '🇮🇶' },
    { code: 'YE', nameAr: 'اليمن', nameEn: 'Yemen', currency: 'YER', currencySymbol: 'ر.ي', timezone: 'Asia/Aden', locale: 'ar-YE', flag: '🇾🇪' },
    { code: 'LY', nameAr: 'ليبيا', nameEn: 'Libya', currency: 'LYD', currencySymbol: 'د.ل', timezone: 'Africa/Tripoli', locale: 'ar-LY', flag: '🇱🇾' },
    { code: 'TN', nameAr: 'تونس', nameEn: 'Tunisia', currency: 'TND', currencySymbol: 'د.ت', timezone: 'Africa/Tunis', locale: 'ar-TN', flag: '🇹🇳' },
    { code: 'DZ', nameAr: 'الجزائر', nameEn: 'Algeria', currency: 'DZD', currencySymbol: 'د.ج', timezone: 'Africa/Algiers', locale: 'ar-DZ', flag: '🇩🇿' },
    { code: 'MA', nameAr: 'المغرب', nameEn: 'Morocco', currency: 'MAD', currencySymbol: 'د.م', timezone: 'Africa/Casablanca', locale: 'ar-MA', flag: '🇲🇦' },
    { code: 'SD', nameAr: 'السودان', nameEn: 'Sudan', currency: 'SDG', currencySymbol: 'ج.س', timezone: 'Africa/Khartoum', locale: 'ar-SD', flag: '🇸🇩' },
    { code: 'PS', nameAr: 'فلسطين', nameEn: 'Palestine', currency: 'ILS', currencySymbol: '₪', timezone: 'Asia/Gaza', locale: 'ar-PS', flag: '🇵🇸' },
    { code: 'SO', nameAr: 'الصومال', nameEn: 'Somalia', currency: 'SOS', currencySymbol: 'Sh', timezone: 'Africa/Mogadishu', locale: 'ar-SO', flag: '🇸🇴' },
    { code: 'MR', nameAr: 'موريتانيا', nameEn: 'Mauritania', currency: 'MRU', currencySymbol: 'أ.م', timezone: 'Africa/Nouakchott', locale: 'ar-MR', flag: '🇲🇷' },

// -------------------------------------------------------------------------
    { code: 'US', nameAr: 'الولايات المتحدة', nameEn: 'United States', currency: 'USD', currencySymbol: '$', timezone: 'America/New_York', locale: 'en-US', flag: '🇺🇸' },
    { code: 'GB', nameAr: 'المملكة المتحدة', nameEn: 'United Kingdom', currency: 'GBP', currencySymbol: '£', timezone: 'Europe/London', locale: 'en-GB', flag: '🇬🇧' },
    { code: 'EU', nameAr: 'منطقة اليورو', nameEn: 'Euro Zone', currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Berlin', locale: 'de-DE', flag: '🇪🇺' },
    { code: 'TR', nameAr: 'تركيا', nameEn: 'Turkey', currency: 'TRY', currencySymbol: '₺', timezone: 'Europe/Istanbul', locale: 'tr-TR', flag: '🇹🇷' },
    { code: 'PK', nameAr: 'باكستان', nameEn: 'Pakistan', currency: 'PKR', currencySymbol: '₨', timezone: 'Asia/Karachi', locale: 'ur-PK', flag: '🇵🇰' },
    { code: 'IN', nameAr: 'الهند', nameEn: 'India', currency: 'INR', currencySymbol: '₹', timezone: 'Asia/Kolkata', locale: 'en-IN', flag: '🇮🇳' },
    { code: 'CN', nameAr: 'الصين', nameEn: 'China', currency: 'CNY', currencySymbol: '¥', timezone: 'Asia/Shanghai', locale: 'zh-CN', flag: '🇨🇳' },
    { code: 'JP', nameAr: 'اليابان', nameEn: 'Japan', currency: 'JPY', currencySymbol: '¥', timezone: 'Asia/Tokyo', locale: 'ja-JP', flag: '🇯🇵' },
    { code: 'KR', nameAr: 'كوريا الجنوبية', nameEn: 'South Korea', currency: 'KRW', currencySymbol: '₩', timezone: 'Asia/Seoul', locale: 'ko-KR', flag: '🇰🇷' },
    { code: 'AU', nameAr: 'أستراليا', nameEn: 'Australia', currency: 'AUD', currencySymbol: 'A$', timezone: 'Australia/Sydney', locale: 'en-AU', flag: '🇦🇺' },
    { code: 'CA', nameAr: 'كندا', nameEn: 'Canada', currency: 'CAD', currencySymbol: 'C$', timezone: 'America/Toronto', locale: 'en-CA', flag: '🇨🇦' },
    { code: 'BR', nameAr: 'البرازيل', nameEn: 'Brazil', currency: 'BRL', currencySymbol: 'R$', timezone: 'America/Sao_Paulo', locale: 'pt-BR', flag: '🇧🇷' },
    { code: 'RU', nameAr: 'روسيا', nameEn: 'Russia', currency: 'RUB', currencySymbol: '₽', timezone: 'Europe/Moscow', locale: 'ru-RU', flag: '🇷🇺' },
    { code: 'ZA', nameAr: 'جنوب أفريقيا', nameEn: 'South Africa', currency: 'ZAR', currencySymbol: 'R', timezone: 'Africa/Johannesburg', locale: 'en-ZA', flag: '🇿🇦' },
    { code: 'NG', nameAr: 'نيجيريا', nameEn: 'Nigeria', currency: 'NGN', currencySymbol: '₦', timezone: 'Africa/Lagos', locale: 'en-NG', flag: '🇳🇬' },
    { code: 'ET', nameAr: 'إثيوبيا', nameEn: 'Ethiopia', currency: 'ETB', currencySymbol: 'Br', timezone: 'Africa/Addis_Ababa', locale: 'am-ET', flag: '🇪🇹' },
    { code: 'KE', nameAr: 'كينيا', nameEn: 'Kenya', currency: 'KES', currencySymbol: 'KSh', timezone: 'Africa/Nairobi', locale: 'sw-KE', flag: '🇰🇪' },
    { code: 'ID', nameAr: 'إندونيسيا', nameEn: 'Indonesia', currency: 'IDR', currencySymbol: 'Rp', timezone: 'Asia/Jakarta', locale: 'id-ID', flag: '🇮🇩' },
    { code: 'MY', nameAr: 'ماليزيا', nameEn: 'Malaysia', currency: 'MYR', currencySymbol: 'RM', timezone: 'Asia/Kuala_Lumpur', locale: 'ms-MY', flag: '🇲🇾' },
    { code: 'SG', nameAr: 'سنغافورة', nameEn: 'Singapore', currency: 'SGD', currencySymbol: 'S$', timezone: 'Asia/Singapore', locale: 'en-SG', flag: '🇸🇬' },
    { code: 'MX', nameAr: 'المكسيك', nameEn: 'Mexico', currency: 'MXN', currencySymbol: 'Mex$', timezone: 'America/Mexico_City', locale: 'es-MX', flag: '🇲🇽' },
    { code: 'IR', nameAr: 'إيران', nameEn: 'Iran', currency: 'IRR', currencySymbol: '﷼', timezone: 'Asia/Tehran', locale: 'fa-IR', flag: '🇮🇷' },
];

// -------------------------------------------------------------------------

/** Get a country entry by its ISO 3166-1 alpha-2 code */
export const getCountryByCode = (code) =>
    COUNTRIES.find(c => c.code === code) ?? null;

/** Default fallback when no country has been selected */
export const DEFAULT_COUNTRY = COUNTRIES.find(c => c.code === 'SA');