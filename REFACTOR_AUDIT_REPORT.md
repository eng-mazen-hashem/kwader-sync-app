# REFACTOR_AUDIT_REPORT.md
## Kwader Platform — Phase 1: Grand Audit
**Charter Reference:** `ARCHITECTURE_CHARTER.md` v3.1  
**Audit Date:** 2026-04-07  
**Auditor:** Antigravity AI Architect  
**Status:** ✅ READ-ONLY — No code was modified in this phase.

---

## How to Read This Report

| Severity | Meaning |
|----------|---------|
| 🔴 **CRITICAL** | Security risk or data integrity violation. Fix first. |
| 🟠 **HIGH** | Performance or reliability issue. Fix in Phase 2. |
| 🟡 **MEDIUM** | Code quality / UX violation. Fix in Phase 3. |
| 🟢 **LOW** | Style / convention violation. Fix in Phase 4. |

---

## Violation Category 1 — `alert()` / `window.confirm()` Instead of `sonner` Toast

> **Charter Rule:** "جميع التنبيهات يجب أن تمر عبر `toast` من مكتبة `sonner`. استخدام `alert()` أو `confirm()` ممنوع منعاً باتاً."

| File | Line(s) | Severity | Details |
|------|---------|----------|---------|
| `src/pages/Employees.js` | handleSave | 🔴 CRITICAL | `alert()` used for save errors |
| `src/pages/Payroll.js` | handleCalculatePayroll | 🔴 CRITICAL | `alert()` used for payroll errors |
| `src/pages/Devices.js` | handleSave, handleDelete | 🔴 CRITICAL | `alert()` used for device CRUD errors |
| `src/pages/Settings.js` | L283 | 🔴 CRITICAL | `alert('خطأ في الحفظ: ' + e.message)` |
| `src/pages/Shifts.js` | L656, L659, L680 | 🔴 CRITICAL | `alert('خطأ: ' + error.message)` in handleSaveShift & handleSaveAssignments |
| `src/pages/Shifts.js` | L665 | 🟠 HIGH | `window.confirm('هل تريد حذف هذا الشيفت؟')` — must use a confirmation modal |
| `src/pages/RuleBuilder.js` | L379-381 | 🔴 CRITICAL | `alert('يرجى إدخال اسم القانون')` and similar validation alerts in `handleSave` |

---

## Violation Category 2 — Inline Styles / Hardcoded Color Values (No CSS Variables)

> **Charter Rule:** "يُحظر استخدام قيم ألوان ثابتة (Hardcoded Colors) خارج ملف CSS المتغيرات. يجب استخدام CSS Variables حصراً."

| File | Severity | Examples |
|------|----------|---------|
| `src/pages/Settings.js` | 🟡 MEDIUM | `color: '#6c63ff'`, `background: '#10b981'`, `boxShadow: '0 4px 16px rgba(108,99,255,0.35)'`; `StatBadge` accepts raw `accent` hex prop |
| `src/pages/Shifts.js` | 🟡 MEDIUM | Static UI chrome uses hardcoded values like `'rgba(16,185,129,0.15)'` instead of CSS variables |
| `src/pages/RuleBuilder.js` | 🟡 MEDIUM | ENTIRE file uses inline `style={{}}`. Zero `className` usage for layout. Every color and spacing is hardcoded. |
| `src/pages/Payroll.js` | 🟡 MEDIUM | Inline `background`, `color`, `border` throughout |
| `src/pages/Leaves.js` | 🟡 MEDIUM | Hardcoded label colors and border styles |
| `src/pages/Loans.js` | 🟡 MEDIUM | Same pattern as Leaves.js |
| `src/pages/Dashboard.js` | 🟡 MEDIUM | Stat cards and chart wrappers use hardcoded colors |
| `src/components/AiPayrollAgent.js` | 🟡 MEDIUM | Entire component is inline styles with `'rgba(10,10,20,0.95)'`, `'#10b981'`, `'#020617'` |

---

## Violation Category 3 — Complex Forms Without `React Hook Form` + `Zod`

> **Charter Rule:** "أي نموذج يحتوي على أكثر من 3 حقول يجب أن يُبنى باستخدام `React Hook Form` مع تعريف `Zod Schema`."

| File | Form | Field Count | Severity | Details |
|------|------|-------------|----------|---------|
| `src/pages/Employees.js` | Employee create/edit modal | ~8 fields | 🔴 CRITICAL | Raw `useState`. No Zod schema. No validation before Supabase insert. |
| `src/pages/Payroll.js` | Payroll calculation form | ~5 fields | 🟠 HIGH | Raw `useState`. No schema validation before payroll generation. |
| `src/pages/Leaves.js` | Leave request form | ~4 fields | 🟠 HIGH | Raw `useState`. Date range not validated against business rules. |
| `src/pages/Loans.js` | Loan creation form | ~4 fields | 🟠 HIGH | Raw `useState`. Amount and duration not validated. |
| `src/pages/Settings.js` | Company settings form | ~5 fields | 🟡 MEDIUM | Raw `useState` via `set()` helper. Violates charter. |
| `src/pages/Shifts.js` | ShiftModal | ~7 fields | 🟡 MEDIUM | Uses `alert()` for validation instead of Zod schema. |
| `src/pages/RuleBuilder.js` | RuleModal | ~6+ fields | 🟡 MEDIUM | Uses `alert()` for validation. No Zod schema defined. |
| `src/pages/Devices.js` | Device add/edit form | ~4 fields | 🟠 HIGH | Raw `useState`. No validation. |

---

## Violation Category 4 — Missing Pagination on Data-Heavy Lists

> **Charter Rule:** "يُمنع جلب أكثر من 100 سجل في طلب واحد. يجب استخدام `.range()` أو cursor-based pagination."

| File | Query | Issue | Severity |
|------|-------|-------|----------|
| `src/pages/Attendance.js` | `raw_attendance_logs.select(...)` | Fetches ALL logs with no `.range()`. A company with 100 devices × 365 days = tens of thousands of rows. | 🔴 CRITICAL |
| `src/pages/Dashboard.js` | Multiple select calls | No pagination; fetches everything for aggregation. | 🟠 HIGH |
| `src/pages/Payroll.js` | `payroll_records.select(...)` | No pagination. History grows unboundedly. | 🟠 HIGH |
| `src/pages/Employees.js` | `employees.select(...)` | No pagination. Will break at scale (1000+ employees). | 🟡 MEDIUM |
| `src/pages/Leaves.js` | `leaves.select(...)` | No pagination. | 🟡 MEDIUM |
| `src/pages/Loans.js` | `loans.select(...)` | No pagination. | 🟡 MEDIUM |

---

## Violation Category 5 — `select('*')` Instead of Explicit Column Lists

> **Charter Rule:** "استخدام `select('*')` ممنوع. يجب تحديد الأعمدة المطلوبة صراحةً لتقليل الحمل على الشبكة ومنع تسرب البيانات الحساسة."

| File | Severity |
|------|----------|
| `src/pages/Attendance.js` | 🔴 CRITICAL (combined with missing pagination) |
| `src/pages/Dashboard.js` | 🟠 HIGH — Multiple `select('*')` in `fetchDashboardData` |
| `src/pages/Shifts.js` | 🟠 HIGH — L632: `shifts.select('*')` |
| `src/pages/Payroll.js` | 🟠 HIGH — `payroll_records.select('*')` |
| `src/pages/RuleBuilder.js` | 🟡 MEDIUM — `payroll_rules.select('*')` |
| `src/pages/Leaves.js` | 🟡 MEDIUM |
| `src/pages/Loans.js` | 🟡 MEDIUM |
| `src/pages/Devices.js` | 🟡 MEDIUM |

---

## Violation Category 6 — Missing Audit Trail (`audit_logs`)

> **Charter Rule:** "جميع عمليات الكتابة الحساسة يجب أن تُسجَّل في جدول `audit_logs`."

| File | Operation | Severity |
|------|-----------|----------|
| `src/pages/Employees.js` | Create/Update/Delete employee | 🔴 CRITICAL — Most sensitive HR operation |
| `src/pages/Payroll.js` | `handleCalculatePayroll` | 🔴 CRITICAL — Financial record, must be audited |
| `src/pages/Leaves.js` | Approve/Reject/Create leave | 🟠 HIGH |
| `src/pages/Loans.js` | Create/Update loan | 🟠 HIGH |
| `src/pages/RuleBuilder.js` | Create/Update/Delete payr
oll rules | 🟠 HIGH — Rules directly affect salary calculations |
| `src/pages/Settings.js` | Update company settings | 🟡 MEDIUM |
| `src/pages/Shifts.js` | Create/Delete shift, manage assignments | 🟡 MEDIUM |
| `src/pages/Devices.js` | Add/Delete fingerprint device | 🟡 MEDIUM |

---

## Violation Category 7 — Missing `useCallback` / `useMemo`

> **Charter Rule:** "يجب استخدام `useCallback` لجميع الدوال التي تُمرَّر كـ props، و`useMemo` لأي عملية حسابية معقدة."

| File | Issue | Severity |
|------|-------|----------|
| `src/pages/Employees.js` | `handleSave`, `handleDelete` passed as props without `useCallback` | 🟡 MEDIUM |
| `src/pages/Attendance.js` | Multiple inline handlers passed to child components | 🟡 MEDIUM |
| `src/pages/Payroll.js` | Complex calculation logic not memoized | 🟡 MEDIUM |
| `src/pages/Leaves.js` | `handleApprove`, `handleReject` not in `useCallback` | 🟡 MEDIUM |
| `src/pages/Dashboard.js` | Aggregation calculations not in `useMemo` | 🟡 MEDIUM |
| `src/pages/RuleBuilder.js` | `RuleModal` handlers recreated on every render | 🟡 MEDIUM |

---

## Violation Category 8 — Hardcoded Arabic UI Strings (Not in `translations.js`)

> **Charter Rule:** "يُمنع كتابة أي نص يظهر للمستخدم مباشرةً داخل الكود. جميع النصوص في `translations.js`."

| File | Examples | Severity |
|------|---------|----------|
| `src/components/AiPayrollAgent.js` | L22-57: All terminal messages hardcoded in Arabic. Zero use of `t` object. | 🟡 MEDIUM |
| `src/pages/RuleBuilder.js` | All trigger labels, action labels, tab names are hardcoded Arabic constants. Not from `translations.js`. | 🟡 MEDIUM |
| `src/pages/Shifts.js` | Day names array, break policy labels, `'جاري الحفظ...'` all hardcoded | 🟡 MEDIUM |

---

## Violation Category 9 — Missing / Incomplete `try-catch`

> **Charter Rule:** "كل استدعاء لـ Supabase يجب أن يكون داخل `try/catch`. يُمنع تجاهل الأخطاء صامتاً."

| File | Issue | Severity |
|------|-------|----------|
| `src/pages/Shifts.js` | `handleToggleActive` (L671), `handleDelete` (L666) — no `try/catch`, errors silently ignored | 🟠 HIGH |
| `src/pages/Attendance.js` | Some Supabase calls lack error propagation | 🟠 HIGH |
| `src/pages/Dashboard.js` | `Promise.all` catches errors only partially | 🟠 HIGH |
| `src/components/AiPayrollAgent.js` | L41-43: `catch (err) { console.error(err); }` — user never notified via toast | 🟠 HIGH |
| `src/pages/Departments.js` | CRUD operations lack consistent `try/catch` | 🟡 MEDIUM |

---

## Violation Category 10 — Inline `<style>` Tags Inside Components

> **Charter Rule:** "يُمنع إدراج `<style>` tags داخل مكونات React. جميع الأنماط في ملفات `.css`."

| File | Severity |
|------|----------|
| `src/pages/Settings.js` | L177-194: `<style>` tag in `CountryDropdown` for scrollbar and hover styles | 🟡 MEDIUM |
| `src/components/AiPayrollAgent.js` | L166-175: `<style>` tag for `@keyframes blink` and `@keyframes pulse` | 🟡 MEDIUM |

---

## Summary Matrix

| File | Cat1 alert | Cat2 CSS | Cat3 Forms | Cat4 Paging | Cat5 select* | Cat6 Audit | Issues |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `Attendance.js` | ✅ | 🟡 | — | ✅ | ✅ | — | 1 |
| `Dashboard.js` | — | 🟡 | — | ✅ | ✅ | — | 1 |
| `Devices.js` | ✅ | 🟡 | ✅ | — | ✅ | ✅ | 1 |
| `Employees.js` | ✅ | 🟡 | ✅ | ✅ | ✅ | ✅ | 1 |
| `Leaves.js` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 0 |
| `Loans.js` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 0 |
| `Payroll.js` | ✅ | 🟡 | ✅ | ✅ | ✅ | ✅ | 1 |
| `RuleBuilder.js` | ✅ | 🟡 | ✅ | — | ✅ | ✅ | 1 |
| `Settings.js` | 🔴 | 🟡 | 🟡 | — | — | 🟡 | 4 |
| `Shifts.js` | ✅ | 🟡 | ✅ | — | ✅ | ✅ | 1 |
| `AiPayrollAgent.js` | — | 🟡 | — | — | — | — | 2 |

---

## Recommended Refactoring Order (Phase 2+)

### 🔴 Phase 2A — Critical: Security & Data Integrity
1. ~~**`Employees.js`** — Replace `alert()` → `sonner toast`, add `try/catch`, add Audit Trail for all CRUD.~~ ✅
2. ~~**`Payroll.js`** — Replace `alert()`, add Audit Trail for payroll generation, add `try/catch`.~~ ✅
3. ~~**`Attendance.js`** — Add `.range()` pagination, replace `select('*')` with explicit columns.~~ ✅

### 🟠 Phase 2B — High Priority: Reliability
4. ~~**`Shifts.js`** — Replace `alert()` + `window.confirm()`, add `try/catch` to all handlers.~~ ✅
5. ~~**`RuleBuilder.js`** — Replace `alert()`, move constant strings to `translations.js`, add `react-hook-form` + `Zod`, add Audit Trail.~~ ✅
6. ~~**`Devices.js`** — Replace `alert()`, add `try/catch`, use explicit column selection.~~ ✅
7. ~~**`Dashboard.js`** — Add pagination (completed via range queries), specify columns, fix partial error handling.~~ ✅

### 🟡 Phase 3 — Code Quality & Form Architecture
8. ~~**`Employees.js`** — Migrate modal to `React Hook Form` + `Zod`.~~ ✅
9. ~~**`Leaves.js`** / **`Loans.js`** — Migrate forms to `React Hook Form` + `Zod`.~~ ✅
10. **`Settings.js`** — Remove inline `<style>` tag, extract to `.css` file.

### 🟢 Phase 4 — Style & Convention Cleanup
11. **`AiPayrollAgent.js`** — Remove `<style>` tag, connect messages to `translations.js`.
12. All files — Replace remaining hardcoded hex colors with CSS variables.
13. All files — Add `useCallback` / `useMemo` where missing.

---

> ✅ **Phase 1 Complete.** Awaiting your permission to begin Phase 2A.
