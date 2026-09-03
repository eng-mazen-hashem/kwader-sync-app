import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Mail,
  Phone,
  MapPin,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Shield,
  Zap,
  Globe,
  ExternalLink,
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

// ─── Custom Social SVG Icons (lucide-react removed brand icons) ────────────────
const XIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedInIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const YoutubeIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const GithubIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);


// ─── Social Links ──────────────────────────────────────────────────────────────
const socials = [
  {
    icon: XIcon,
    label: "Twitter / X",
    href: "https://twitter.com/kwader",
    color: "#f0f6fc",
  },
  {
    icon: LinkedInIcon,
    label: "LinkedIn",
    href: "https://linkedin.com/company/kwader",
    color: "#0A66C2",
  },
  {
    icon: YoutubeIcon,
    label: "YouTube",
    href: "https://youtube.com/@kwader",
    color: "#FF0000",
  },
  {
    icon: GithubIcon,
    label: "GitHub",
    href: "https://github.com/kwader",
    color: "#f0f6fc",
  },
];

// ─── Trust Badges ──────────────────────────────────────────────────────────────
const trustBadges = [
  { icon: Shield, label: "SOC 2 Type II" },
  { icon: Globe, label: "GDPR Compliant" },
  { icon: Zap, label: "99.9% Uptime" },
];

// ─── Footer Column links with optional href ────────────────────────────────────
const columnLinks = {
  en: {
    Product: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Integrations", href: "/integrations" },
      { label: "Changelog", href: "/changelog" },
      { label: "Roadmap", href: "/roadmap" },
      { label: "Security", href: "/security" },
    ],
    Solutions: [
      { label: "Startups", href: "/startups" },
      { label: "SMBs", href: "/smbs" },
      { label: "Enterprise", href: "/enterprise" },
      { label: "Agencies", href: "/agencies" },
      { label: "Remote Teams", href: "/remote-teams" },
      { label: "Multi-country", href: "/multi-country" },
    ],
    Resources: [
      { label: "Documentation", href: "/documentation" },
      { label: "Blog", href: "/blog" },
      { label: "HR Templates", href: "/hr-templates" },
      { label: "Webinars", href: "/webinars" },
      { label: "Case Studies", href: "/case-studies" },
      { label: "API Reference", href: "/api-reference" },
    ],
    Company: [
      { label: "About Us", href: "/about" },
      { label: "Careers", href: "/careers", badge: "Hiring" },
      { label: "Press Kit", href: "/press-kit" },
      { label: "Partners", href: "/partners" },
      { label: "Contact", href: "/contact" },
      { label: "Legal", href: "/legal" },
    ],
  },
  ar: {
    المنتج: [
      { label: "المميزات", href: "/#features" },
      { label: "الأسعار", href: "/#pricing" },
      { label: "التكاملات", href: "/integrations" },
      { label: "سجل التغييرات", href: "/changelog" },
      { label: "خارطة الطريق", href: "/roadmap" },
      { label: "الأمان", href: "/security" },
    ],
    الحلول: [
      { label: "الشركات الناشئة", href: "/startups" },
      { label: "الشركات الصغيرة", href: "/smbs" },
      { label: "المؤسسات", href: "/enterprise" },
      { label: "الوكالات", href: "/agencies" },
      { label: "الفرق عن بُعد", href: "/remote-teams" },
      { label: "متعدد الدول", href: "/multi-country" },
    ],
    الموارد: [
      { label: "التوثيق", href: "/documentation" },
      { label: "المدونة", href: "/blog" },
      { label: "قوالب HR", href: "/hr-templates" },
      { label: "ندوات الويب", href: "/webinars" },
      { label: "دراسات الحالة", href: "/case-studies" },
      { label: "مرجع API", href: "/api-reference" },
    ],
    الشركة: [
      { label: "عن كوادر", href: "/about" },
      { label: "الوظائف", href: "/careers", badge: "نوظّف" },
      { label: "مجموعة الصحافة", href: "/press-kit" },
      { label: "الشركاء", href: "/partners" },
      { label: "تواصل معنا", href: "/contact" },
      { label: "القانونية", href: "/legal" },
    ],
  },
};

const legalLinks = {
  en: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Cookie Policy", href: "/cookie-policy" },
    { label: "GDPR", href: "/gdpr" },
    { label: "Security", href: "/security" },
  ],
  ar: [
    { label: "سياسة الخصوصية", href: "/privacy" },
    { label: "شروط الخدمة", href: "/terms" },
    { label: "سياسة الكوكيز", href: "/cookie-policy" },
    { label: "GDPR", href: "/gdpr" },
    { label: "الأمان", href: "/security" },
  ],
};

// ─── Main Footer Component ─────────────────────────────────────────────────────
export function Footer() {
  const { t, language, isRTL } = useLanguage();
  const f = t.footer;
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [hovered, setHovered] = useState(null);

  const currentYear = new Date().getFullYear();
  const cols = columnLinks[language] || columnLinks.en;
  const legal = legalLinks[language] || legalLinks.en;

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
    setEmail("");
    setTimeout(() => setSubscribed(false), 4000);
  };

  return (
    <footer
      dir={isRTL ? "rtl" : "ltr"}
      style={{
        background: "linear-gradient(180deg, #0a0a0f 0%, #050508 100%)",
        color: "#94a3b8",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', 'IBM Plex Sans', system-ui, sans-serif",
      }}
    >
      {/* ── Ambient Gradient Glow ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "800px",
          height: "2px",
          background:
            "linear-gradient(90deg, transparent, #6366f1 30%, #8b5cf6 50%, #06b6d4 70%, transparent)",
          opacity: 0.8,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          height: "200px",
          background:
            "radial-gradient(ellipse at top, rgba(99,102,241,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0 24px",
        }}
      >
        {/* ── Newsletter CTA Strip ─────────────────────────────────────── */}
        <div
          style={{
            margin: "0 -24px",
            padding: "40px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "32px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 700,
                color: "#f1f5f9",
                letterSpacing: "-0.3px",
              }}
            >
              {isRTL
                ? "ابقَ على اطلاع بآخر رؤى الموارد البشرية"
                : "Stay ahead with HR insights"}
            </h3>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "14px",
                color: "#64748b",
              }}
            >
              {isRTL
                ? "رؤى شهرية منتقاة من فريق كوادر — بدون سبام."
                : "Monthly curated insights from the Kwader team — no spam, ever."}
            </p>
          </div>

          <form
            onSubmit={handleSubscribe}
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            {subscribed ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "#10b981",
                  fontSize: "14px",
                  fontWeight: 600,
                  padding: "10px 20px",
                  background: "rgba(16,185,129,0.1)",
                  borderRadius: "10px",
                  border: "1px solid rgba(16,185,129,0.2)",
                }}
              >
                <CheckCircle2 size={16} />
                {isRTL ? "تم الاشتراك بنجاح!" : "You're subscribed!"}
              </div>
            ) : (
              <>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={f.emailPlaceholder || "your@email.com"}
                  required
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "10px",
                    padding: "10px 16px",
                    fontSize: "14px",
                    color: "#f1f5f9",
                    outline: "none",
                    width: "240px",
                    transition: "border-color 0.2s",
                    fontFamily: "inherit",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderColor = "rgba(99,102,241,0.6)")
                  }
                  onBlur={(e) =>
                    (e.target.style.borderColor = "rgba(255,255,255,0.1)")
                  }
                />
                <button
                  type="submit"
                  style={{
                    background:
                      "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "10px",
                    padding: "10px 18px",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "opacity 0.2s",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  {isRTL ? "اشترك" : "Subscribe"}
                  {isRTL ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
                </button>
              </>
            )}
          </form>
        </div>

        {/* ── Main Content Grid ────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.8fr repeat(4, 1fr)",
            gap: "48px",
            padding: "64px 0 48px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
          className="footer-grid"
        >
          {/* Brand Column */}
          <div>
            {/* Logo */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <div style={{ height: "36px" }}>
                <img
                  src="/logo.png"
                  alt="Kwader"
                  style={{
                    height: "100%",
                    width: "auto",
                    objectFit: "contain",
                    filter: "brightness(1.1)",
                  }}
                  onError={(e) => {
                    e.target.style.display = "none";
                    e.target.nextSibling.style.display = "flex";
                  }}
                />
                <div
                  style={{
                    display: "none",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      background:
                        "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      borderRadius: "8px",
                    }}
                  />
                  <span
                    style={{
                      color: "#f1f5f9",
                      fontWeight: 800,
                      fontSize: "18px",
                      letterSpacing: "-0.5px",
                    }}
                  >
                    KWADER
                  </span>
                </div>
              </div>
            </div>

            <p
              style={{
                fontSize: "13.5px",
                lineHeight: "1.7",
                color: "#64748b",
                marginBottom: "24px",
                maxWidth: "240px",
              }}
            >
              {f.description}
            </p>

            {/* Trust Badges */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                marginBottom: "28px",
              }}
            >
              {trustBadges.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    fontSize: "12px",
                    color: "#475569",
                  }}
                >
                  <Icon
                    size={12}
                    style={{ color: "#6366f1", flexShrink: 0 }}
                  />
                  {label}
                </div>
              ))}
            </div>

            {/* Social Icons */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {socials.map(({ icon: Icon, label, href, color }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  onMouseEnter={() => setHovered(label)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "9px",
                    background:
                      hovered === label
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(255,255,255,0.04)",
                    border:
                      hovered === label
                        ? "1px solid rgba(255,255,255,0.12)"
                        : "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: hovered === label ? color : "#475569",
                    textDecoration: "none",
                    transition: "all 0.2s ease",
                    transform: hovered === label ? "translateY(-2px)" : "none",
                  }}
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(cols).map(([category, links]) => (
            <div key={category}>
              <h4
                style={{
                  color: "#f1f5f9",
                  fontSize: "13px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  marginBottom: "20px",
                  margin: "0 0 20px",
                }}
              >
                {category}
              </h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {links.map(({ label, href, badge }) => {
                  const isInternal = href && href.startsWith("/");
                  const LinkComponent = isInternal ? Link : "a";
                  const linkProps = isInternal ? { to: href } : { href };
                  return (
                    <li key={label} style={{ marginBottom: "12px" }}>
                      <LinkComponent
                        {...linkProps}
                        onClick={(e) => {
                          if (href === "#") {
                            e.preventDefault();
                          }
                        }}
                        style={{
                          fontSize: "13.5px",
                          color: "#64748b",
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          transition: "color 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "#c7d2fe";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "#64748b";
                        }}
                      >
                        {label}
                        {badge && (
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              padding: "1px 6px",
                              borderRadius: "4px",
                              background:
                                "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))",
                              color: "#a5b4fc",
                              border: "1px solid rgba(99,102,241,0.2)",
                              letterSpacing: "0.3px",
                            }}
                          >
                            {badge}
                          </span>
                        )}
                      </LinkComponent>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Contact Info Strip ───────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "40px",
            padding: "24px 0",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            flexWrap: "wrap",
          }}
        >
          {[
            {
              icon: Mail,
              text: "hello@kwader.io",
              href: "mailto:hello@kwader.io",
            },
            {
              icon: Phone,
              text: "+1 (800) 555-0100",
              href: "tel:+18005550100",
            },
            {
              icon: MapPin,
              text: isRTL
                ? "الرياض · دبي · لندن"
                : "Riyadh · Dubai · London",
              href: null,
            },
          ].map(({ icon: Icon, text, href }) => (
            <div
              key={text}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Icon size={14} style={{ color: "#6366f1", flexShrink: 0 }} />
              {href ? (
                <a
                  href={href}
                  style={{
                    fontSize: "13px",
                    color: "#64748b",
                    textDecoration: "none",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "#c7d2fe")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "#64748b")
                  }
                >
                  {text}
                </a>
              ) : (
                <span style={{ fontSize: "13px", color: "#64748b" }}>
                  {text}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* ── Bottom Bar ───────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "24px 0",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          {/* Copyright */}
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "#334155",
            }}
          >
            {isRTL
              ? `© ${currentYear} كوادر. جميع الحقوق محفوظة.`
              : `© ${currentYear} Kwader, Inc. All rights reserved.`}
          </p>

          {/* Legal Links */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              flexWrap: "wrap",
            }}
          >
            {legal.map(({ label, href }, idx) => {
              const isInternal = href && href.startsWith("/");
              const LinkComponent = isInternal ? Link : "a";
              const linkProps = isInternal ? { to: href } : { href };
              return (
                <React.Fragment key={label}>
                  <LinkComponent
                    {...linkProps}
                    onClick={(e) => {
                      if (href === "#") {
                        e.preventDefault();
                      }
                    }}
                    style={{
                      fontSize: "12px",
                      color: "#334155",
                      textDecoration: "none",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#94a3b8";
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#334155";
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {label}
                  </LinkComponent>
                  {idx < legal.length - 1 && (
                    <span style={{ color: "#1e293b", fontSize: "11px" }}>·</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Status badge */}
          <a
            href="https://status.kwader.io"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: "#334155",
              textDecoration: "none",
              padding: "4px 10px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.05)",
              background: "rgba(255,255,255,0.02)",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#10b981";
              e.currentTarget.style.borderColor = "rgba(16,185,129,0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#334155";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#10b981",
                boxShadow: "0 0 6px #10b981",
                flexShrink: 0,
                animation: "footerPulse 2s ease-in-out infinite",
              }}
            />
            {isRTL ? "كل الأنظمة تعمل" : "All systems operational"}
            <ExternalLink size={10} style={{ opacity: 0.5 }} />
          </a>
        </div>
      </div>

      {/* ── Responsive Styles ──────────────────────────────────────────── */}
      <style>{`
        @keyframes footerPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #10b981; }
          50% { opacity: 0.6; box-shadow: 0 0 12px #10b981; }
        }

        @media (max-width: 1024px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr 1fr !important;
          }
        }

        @media (max-width: 640px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 32px !important;
          }
        }
      `}</style>
    </footer>
  );
}
