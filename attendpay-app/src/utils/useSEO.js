import { useEffect } from 'react';

/**
 * Custom React hook for dynamic SEO management in client-side React
 * Updates document.title, meta descriptions, canonical links, and OpenGraph/Twitter tags
 */
export function useSEO({
  title,
  description,
  canonical,
  keywords,
  ogTitle,
  ogDescription,
  ogImage,
  ogType = 'website',
  lang,
}) {
  useEffect(() => {
    // 1. Update Document Title
    if (title) {
      document.title = title;
    }

    // 2. Helper to set or create meta tag
    const setMetaTag = (attrName, attrValue, content) => {
      if (!content) return;
      let el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrValue);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // 3. Helper to set or create link tag
    const setLinkTag = (rel, href) => {
      if (!href) return;
      let el = document.querySelector(`link[rel="${rel}"]`);
      if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
      }
      el.setAttribute('href', href);
    };

    // Standard Meta
    if (description) setMetaTag('name', 'description', description);
    if (keywords) setMetaTag('name', 'keywords', keywords);

    // Open Graph
    if (ogTitle || title) setMetaTag('property', 'og:title', ogTitle || title);
    if (ogDescription || description) setMetaTag('property', 'og:description', ogDescription || description);
    if (ogType) setMetaTag('property', 'og:type', ogType);
    if (ogImage) setMetaTag('property', 'og:image', ogImage);

    // Twitter
    if (ogTitle || title) setMetaTag('name', 'twitter:title', ogTitle || title);
    if (ogDescription || description) setMetaTag('name', 'twitter:description', ogDescription || description);
    if (ogImage) setMetaTag('name', 'twitter:image', ogImage);

    // Canonical link
    if (canonical) {
      setLinkTag('canonical', canonical);
    }

    // Update HTML lang and direction attributes
    if (lang) {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
  }, [title, description, canonical, keywords, ogTitle, ogDescription, ogImage, ogType, lang]);
}

export default useSEO;
