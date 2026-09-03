# Spec: Branding and Global Localization

## Context
The project is being rebranded to **KWADER (كوادر)**. The UI needs to be premium, localized for multiple regions (Arabic first, but English ready), and follow a consistent design system.

## Goals
1.  **Identity**: Enforce "KWADER" branding across all pages.
2.  **Localization**: Replace hardcoded language strings with a dynamic system.
3.  **UI/UX**: Upgrade the Login and Registration flow to feel "Wowed" and premium.
4.  **Multi-Tenant**: Support country-specific formatting (Currency, Timezone) based on selected region during signup.

## Implementation Steps

### 1. Localization Foundation
- [ ] Create a `src/constants/locales.js` file to store all translatable strings.
- [ ] Extend `LocaleContext.jsx` to expose a `setLanguage` function and a current `language` state ('ar' | 'en').
- [ ] Save the user's preferred language in `localStorage` for returning users.

### 2. Login Page Enhancements
- [x] (Partial) Update "Login.js" visual side for KWADER.
- [ ] Connect `Login.js` to `LocaleContext`.
- [ ] Add a floating language switcher (AR/EN) to the Login page.
- [ ] Remove hardcoded `const language = 'ar'` and use the context instead.
- [ ] Fix country selection in Registration to show both Arabic and English names based on current UI language.

### 3. App-Wide Branding
- [ ] Review `Sidebar.js` and `TopBar.js` for branding consistency.
- [ ] Ensure the "Assisstant" (AI Chat) uses the branding name.

## Success Criteria
- Users can switch between Arabic and English on the login page seamlessly.
- The UI reflects the "KWADER" brand with premium glassmorphism and animations.
- All errors, successes, and labels are correctly translated.
