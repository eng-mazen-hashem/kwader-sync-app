# 🏛️ KWADER — Project Constitution
**Version:** 4.0 (SaaS Production Edition)
**Last Updated:** 2026-05-26
**Status:** Active — Law of the Codebase

> This file is the absolute single source of truth for any modifications in the project.
> Before adding or altering any code, read this file. No exceptions.

---

## 📜 Table of Contents
1. [The Stack](#1-the-stack)
2. [Project Architecture & Directory Structure](#2-project-architecture--directory-structure)
3. [Styling & CSS Rules](#3-styling--css-rules)
4. [Component Rules](#4-component-rules)
5. [Context & State Management Rules](#5-context--state-management-rules)
6. [Internationalization & Localization (i18n)](#6-internationalization--localization-i18n)
7. [Supabase & Database Rules](#7-supabase--database-rules)
8. [Role-Based Access Control (RBAC)](#8-role-based-access-control-rbac)
9. [Error Handling Rules](#9-error-handling-rules)
10. [Performance Optimization Rules](#10-performance-optimization-rules)
11. [Strictly Forbidden Anti-Patterns](#11-strictly-forbidden-anti-patterns)
12. [Pre-Commit Checklist](#12-pre-commit-checklist)
13. [Forms & Validation](#13-forms--validation)
14. [Dates & Timezones](#14-dates--timezones)
15. [Audit Trails](#15-audit-trails)
16. [Storage & Sensitive Data (PII)](#16-storage--sensitive-data-pii)
17. [Handling Large Datasets (Pagination)](#17-handling-large-datasets-pagination)
18. [Hardware Sync & Idempotency](#18-hardware-sync--idempotency)
19. [Bulk Operations (Excel/CSV)](#19-bulk-operations-excelcsv)
20. [Real-time Subscriptions vs Polling](#20-real-time-subscriptions-vs-polling)
21. [Offline Resilience](#21-offline-resilience)
22. [Heavy Background Operations (Edge Functions)](#22-heavy-background-operations-edge-functions)
23. [Appendix: Strict AI Token Optimization Guidelines](#23-appendix-strict-ai-token-optimization-guidelines)

---

## 1. The Stack

This project is strictly built on JavaScript and Supabase (NOT TypeScript, NOT Firebase).

| Layer | Approved Technology | Version |
|---|---|---|
| Framework | React | 19.x |
| Language | JavaScript (ES2022+) | — |
| Database / Auth | Supabase | 2.x |
| Styling | CSS Variables + Tailwind CSS | Tailwind 3.x |
| Routing | React Router DOM | v7 |
| Animations | motion/react (Framer Motion) | 12.x |
| Charts | Recharts | 3.x |
| Icons | react-icons (Hi2 set) | 5.x |
| Toasts | sonner | 2.x |
| Excel | xlsx | 0.18.x |
| State | Context API (Auth, Locale, Theme) | Native React |

**Golden Rule:** No new libraries allowed without clear, justified necessity. Bundle size matters.

---

## 2. Project Architecture & Directory Structure

```text
src/
├── App.js                    ← Routing + Main Layout only
├── supabaseClient.js         ← Single Supabase Client Instance
├── index.css                 ← CSS Variables + Global Styles
│
├── context/                  ← Global State Only
│   ├── AuthContext.js        ← Authentication + Global Roles
│   ├── LocaleContext.jsx     ← Language + Currency + Timezone
│   └── ThemeContext.js       ← Dark/Light Mode
│
├── constants/
│   └── translations.js       ← Central Localization File. No hardcoded strings outside this file.
│
├── utils/                    ← Pure Utility Functions (no side-effects)
│   ├── countries.js
│   ├── attendanceCalculator.js
│   ├── statusMaps.js
│   └── demoGenerator.js
│
├── components/               ← Shared Reusable Components
│   ├── Sidebar.js + Sidebar.css
│   ├── TopBar.js + TopBar.css
│   ├── Modal.js
│   └── AiPayrollAgent.js
│
├── pages/                    ← Route Pages (Page View & Logic)
│   ├── Dashboard.js
│   ├── Employees.js
│   ├── Attendance.js
│   ├── Payroll.js
│   └── ...
│
├── styles/                   ← Organized Additional Themes
│   └── admin-theme.css
│
└── landing/                  ← Completely Independent Landing Page
    └── LandingPage.js
Architectural Rules:
✅ Each route page = Single .js file inside pages/.

✅ Reusable UI elements go inside components/.

✅ If a component requires custom styles, create ComponentName.css right next to it.

❌ No direct database queries inside components/ — database interactions are handled by pages/.

❌ No multiple Supabase clients. Use import { supabase } from '../supabaseClient'.

3. Styling & CSS Rules
Rule 1: CSS Variables First
All colors, spacing, and shadows must utilize the variables defined in index.css:

/* ✅ Correct */
color: var(--text-primary);
background: var(--bg-card);
border-radius: var(--radius-md);

/* ❌ Incorrect */
color: #0f172a;
background: rgba(26, 26, 46, 0.65);
Rule 2: Inline Styles Restrictions
Inline styles are permitted strictly for dynamically computed values that cannot be defined via CSS classes:


// ✅ Allowed: True dynamic values
<div style={{ width: `${progress}%` }} />
<div style={{ background: employee.color }} />

// ✅ Allowed: CSS Variables inside styles
<div style={{ color: 'var(--text-primary)' }} />

/* ❌ Forbidden: Static values that belong in a class */
<div style={{ display: 'flex', gap: 12, alignItems: 'center' }} />

Rule 3: Dark Mode Integrity
Never hardcode colors like #ffffff or #000000 as it breaks the dark mode switch. Use themed variables like var(--bg-card) and var(--text-primary).

Rule 4: Native Dropdowns Forbidden (Contrast Integrity)
Never use native browser `<select>` and `<option>` elements for critical UI dropdowns (like company/branch switchers or role toggles) in dark mode environments. Native browser options inherit platform-level defaults causing low contrast (e.g., white text on white backgrounds on Windows Chrome/Edge). Always construct custom, accessible React dropdown components to ensure full CSS control over contrast, hover states, and dark/light mode consistency.

## 4. Component Rules
Standard Component Structure:
JavaScript
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { supabase } from '../supabaseClient';
import './ComponentName.css';

function ComponentName({ prop1, prop2 }) {
    // 1. Hooks first
    const { company } = useAuth();
    const { t, formatCurrency } = useLocale();
    
    // 2. Local State
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // 3. Callbacks (Memoized for useEffect safety)
    const fetchData = useCallback(async () => {
        if (!company) return;
        // Logic...
    }, [company]);
    
    // 4. Effects
    useEffect(() => { fetchData(); }, [fetchData]);
    
    // 5. Event Handlers
    const handleDelete = async (id) => { /* ... */ };
    
    // 6. Derived Values (Calculated directly, NO extra useState)
    const totalCount = data.length;
    
    // 7. Early Returns
    if (loading) return <div className="loading-state">{t.loading}</div>;
    
    // 8. Render JSX
    return (
        <div className="component-name">
            {/* Content */}
        </div>
    );
}

export default ComponentName;
5. Context & State Management Rules
Global Context Responsibility Matrix:
AuthContext: Manages user, company, roles, and signIn/signOut. No page-specific states.

LocaleContext: Manages language (t), formatters, and currency. No business logic.

ThemeContext: Manages theme and toggleTheme.

Local State Rules:
Avoid splitting complex forms into fragmented single states. Group fields into an object:

// ✅ Correct for multiple form fields
const [form, setForm] = useState({ name: '', phone: '', salary: '' });

// ❌ Incorrect: Hard to track and causes excessive re-renders
const [name, setName] = useState('');
const [phone, setPhone] = useState('');
6. Internationalization & Localization (i18n)
Absolute Rule: Zero Hardcoded Strings in JSX
JavaScript
// ✅ Correct
<button>{t.saveChangesBtn}</button>

// ❌ Incorrect
<button>Save Changes</button>
<button>حفظ التعديلات</button>
Keys must be added to translations.js for both languages simultaneously using conventions: thXxx (Table Header), btnXxx (Button), lblXxx (Label), msgXxx (Message), errXxx (Error).

7. Supabase & Database Rules
Rule 1: Multi-Tenant Data Isolation (CRITICAL)
Every single tenant query must filter by company_id to prevent data leakage:


// ✅ Correct
const { data } = await supabase
    .from('employees')
    .select('id, name, status')
    .eq('company_id', company.id); // Mandatory Enforced Isolation
Rule 2: Explicit Column Selection
Never use .select('*') unless absolutely required. Select only the necessary columns:


// ✅ Correct
.select('id, name, device_pin, status')

Rule 3: Database Column Verification (CRITICAL)
Never select or query columns in a `.select()` statement that do not explicitly exist on the database table in the active schema.
- **Verification Requirement**: Before editing, adding, or modifying any Supabase queries, you **MUST** verify the actual table columns in the database using schema tools (`list_tables` or inspecting SQL migration files).
- **Forbidden Anti-Pattern**: Never guess column names or assume that legacy/derived frontend properties (e.g. `subscription_status`, `trial_ends_at`, `max_employees`, `full_name`, `timezone`) exist as physical database columns in the `select` statement.
- **Approved Pattern**: Query only the actual database columns. If legacy or derived properties are required by the frontend, fetch the underlying raw columns (e.g., `status`, `name`, `settings`) and then dynamically map/reconstruct the derived properties in Javascript before returning the object.

Rule 4: Query Stability & Database Security (CRITICAL)
Never change the names of existing queries or database tables without strict verification and migration plans. Always verify that queries are secure and properly aligned with Database Row-Level Security (RLS) policies to prevent unauthorized access or data exposure. Never use `SUPABASE_SERVICE_ROLE_KEY` inside edge functions triggered by users, as it bypasses RLS completely.

8. Role-Based Access Control (RBAC)
Three distinct authorization tiers are enforced:

super_admin: Validated against the super_admins table. Accesses /super-admin.

reseller: Validated against the resellers table. Accesses /reseller.

org_admin: Linked to an active company entry inside companies. Accesses /.

Never cache permissions or roles inside localStorage. Always resolve them dynamically via AuthContext.

9. Error Handling Rules
Principle: Log Internally, Notify Gracefully
JavaScript
import { toast } from 'sonner';

try {
    await riskyOperation();
    toast.success(t.msgSuccessOperation);
} catch (err) {
    console.error('[PageName] operationName:', err.message);
    toast.error(t.errGenericOperation); // Show descriptive localization, NOT raw system errors
}
10. Performance Optimization Rules
useCallback is mandatory for functions passed as a dependency array in useEffect.

useMemo must only be used for heavy computational arrays or filters.

Tree-shaking icons is mandatory: import { HiOutlineUserGroup } from 'react-icons/hi';

11. Strictly Forbidden Anti-Patterns
❌ Raw text/strings directly rendered in JSX.

❌ Fixed color hex codes outside CSS variables.

❌ Queries to multi-tenant tables missing .eq('company_id', company.id).

❌ Persistent console.log statements remaining in production commits.

❌ Missing component cleanup functions for intervals, timeouts, or stream listeners.

12. Pre-Commit Checklist
[ ] Are all styles mapped to CSS Variables and verified for Dark Mode functionality?

[ ] Are i18n keys successfully added to both English and Arabic objects inside translations.js?

[ ] Is company_id properly configured on both data reads and writes?

[ ] Are Loading, Empty, and Error UI states completely covered?

13. Forms & Validation
Rule: Any form containing more than 3 fields MUST use React Hook Form + Zod.

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const employeeSchema = z.object({
    name:   z.string().min(3, 'Name is too short'),
    phone:  z.string().regex(/^05\d{8}$/, 'Invalid phone number'),
    salary: z.number().positive('Salary must be positive'),
});
14. Dates & Timezones
Golden Rule: Database stores UTC, Client displays Company Local Timezone
Plaintext
[Device/Field Check-in] → [UTC Conversion] → [Supabase DB] → [UTC Payload] → [UI: company.timezone parsing]
Conduct all algorithmic datetime calculations using timezone-aware libraries (date-fns or dayjs) configured with company.timezone.

15. Audit Trails
Rule: Sensitive actions (salary updates, structural deletion, role assignment) must log entries to audit_logs.
Capture the preceding state (old_data) and subsequent state (new_data) as JSONB to prevent internal tampering and enable security accounting.

16. Storage & Sensitive Data (PII)
Absolute Rule: No personal documentation inside Public Buckets
Employee contracts, IDs, and passports must be uploaded to a Private Bucket structured as: {company_id}/{employee_id}/{filename}.

Serving private storage assets is restricted to dynamically generated temporary links (Signed URLs) with an expiration threshold capped at 60 seconds.

17. Handling Large Datasets (Pagination)
Querying transactional or extensive operational datasets (attendance logs, logs, employee matrices) without strict bounds (.range(from, to)) is forbidden.

Sorting, filtering, and term queries must be processed server-side (via Supabase queries) rather than filtering full data streams via client JavaScript.

18. Hardware Sync & Idempotency
When synchronizing attendance logs from external IoT machines or edge agents, connection drops can prompt multiple transmissions of identical logs.

Rule 1: Operational Idempotency
Do not rely on auto-incrementing integers or single database-generated IDs for event stream inputs. Enforce a composite unique constraint in the database schema to automatically reject duplicate check-ins.

ALTER TABLE attendance 
ADD CONSTRAINT unique_attendance_log 
UNIQUE (company_id, employee_id, check_in);
Rule 2: Retroactive Log Windows
If an edge agent syncs historical offline logs, prevent the automated modification of finalized payroll periods. Queue them for review or trigger a system-controlled re-calculation routine.

19. Bulk Operations (Excel/CSV)
Rules for handling bulk uploads via xlsx:
Client-Side Validation: Parse and evaluate all sheet rows against your Zod Schema inside the browser before sending any payload rows to the database.

Chunked Insertion: If a sheet file holds more than 50 rows, partition insertions into sequential batches of 50 rows per API call to avoid triggering Gateway Timeout parameters.

Partial Failure Accounting: Do not roll back an entire document if a few rows contain errors. Record the failures separately and report an exact log error array to the operator (e.g., "Row 14: Phone duplicate").

20. Real-time Subscriptions vs Polling
Realtime listeners (Supabase Realtime) are resource-intensive and must be managed conservatively.

Usage Restrictions:
❌ Forbidden: Real-time listeners on heavy tabular analytical workflows, audit history panels, or payroll ledgers. Use manual query parameters or standard pagination.

✅ Permitted: Live operations dashboard panels where administrators track field check-ins in real-time.

⚠️ Mandatory Cleanup: Unsubscribe and destroy every active supabase.channel instance inside the useEffect cleanup return block to avert severe memory leaks.


useEffect(() => {
    const channel = supabase
        .channel('live-attendance')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance' }, payload => { /* ... */ })
        .subscribe();

    return () => { supabase.removeChannel(channel); }; // Enforced Cleanup
}, []);
21. Offline Resilience
Architecture Rules for Field Deployments:
Internet Presence Verification: Critical state actions (issuing payroll payouts, structural migrations) must verify network status before sending requests to prevent half-dropped connections:


if (!navigator.onLine) {
    toast.error(t.errNoInternetConnection);
    return;
}
Optimistic Form Locking: Lock submit buttons immediately upon submission (disabled={loading}) to block double-tap duplicate records caused by latency.

22. Heavy Background Operations (Edge Functions)
Complex relational computing tasks (e.g., parsing monthly payroll distributions for thousands of personnel against adaptive shifting matrices) must not execute locally.

Absolute Rule: No Heavy Processing on the UI Thread
If an operation demands processing or matching structural matrices of over 200 data objects, never calculate the core logic on the client's device to avoid freezing the browser thread (UI Thread Freeze).

Approved Pattern: Delegate computational flows to Supabase Database RPC functions or Supabase Edge Functions. The frontend should simply trigger the execution handle and listen to progress percentages or a definitive outcome indicator.

## 23. Global Scale & Multi-Region Support
When preparing the app for global scale and cross-border operations:
- **Logical CSS Properties:** Never hardcode directional spacing (`margin-left`, `padding-right`). Use logical properties (`margin-inline-start`, `padding-inline-end`) to ensure flawless bidirectional (RTL/LTR) transitions without writing separate CSS rules.
- **Currency Agnosticism:** Never hardcode currency symbols. Always use `Intl.NumberFormat` mapped to `company.currency` and `company.locale` to format monetary values dynamically.
- **Data Sovereignty Compliance:** Follow soft-deletion architectures. Never hard-delete relational records (to preserve audit logs), but mark them as `deleted_at` to comply with international data privacy laws (e.g. GDPR, PDPL) while protecting data integrity.

## 24. Future Evolution & Bug Prevention (Anti-Fragility)
- **Feature Flags:** Wrap highly experimental or risky new modules in Feature Flags (controlled via `system_settings`). This allows global or per-tenant rollout and instantaneous rollback without needing a code deployment.
- **Strict Payload Validation:** Never trust the shape of incoming JSON payloads from external integrations or IoT edge devices. Validate incoming payloads using Zod schemas before inserting into the database to prevent poisoning the dataset.
- **Graceful Degradation:** If non-critical services (like SMS gateways or external mailing APIs) go offline, the core application must survive. Catch errors, queue the operation, and notify the user without crashing the primary UI thread.

## 25. Appendix: Strict AI Token Optimization Guidelines
When this document is fed into an AI assistant or coding tool (such as Antigravity), the following behavioral rules apply to minimize token consumption:

- No Explanations: Do not append structural descriptions, pleasantries, apologies, or conversational intros/outros. Jump directly into code generation.
- Surgical Diff Updates Only: When modifying existing files, never regenerate the entire file structure. Output strictly the lines or specific sub-functions being adjusted with descriptive comments indicating the target line context.
- Tenant Validation Rule: Prior to outputting any data selection or insertion query block, verify that the .eq('company_id', company.id) isolation boundary constraint is present.