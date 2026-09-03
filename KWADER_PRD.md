# KWADER — Product Requirements Document (PRD)
**Version:** 1.0  
**Status:** Draft for Review  
**Classification:** Internal — Confidential  
**Date:** June 2026  
**Authors:** Product & Architecture Team

---

## 1. Product Overview & Vision

### 1.1 Strategic Vision

KWADER is a cloud-native, multi-tenant SaaS platform engineered to be the **operational backbone for modern businesses** managing distributed workforces. The name, derived from the Arabic word for *cadres* or *workforce*, reflects the platform's mission: to give organizations of any size — from a 20-person regional firm to a 5,000-employee enterprise with multiple branches — the infrastructure to **hire, schedule, pay, and retain their people with precision and compliance**.

KWADER sits at the intersection of HR management, operational payroll processing, and real-time attendance intelligence. Where legacy HR software is either monolithic and expensive or fragmented and unreliable, KWADER delivers a unified, API-first platform with strict tenant data isolation, biometric device integration, and deterministic payroll logic — all accessible through an intuitive, role-aware web interface.

### 1.2 Core Problems Solved

| Problem | How KWADER Solves It |
|---|---|
| Fragmented HR data across spreadsheets and siloed tools | Single source of truth per tenant with unified employee records, documents, and history |
| Manual, error-prone payroll calculations | Deterministic, hardcoded payroll engine with auditable calculation logs |
| Inaccurate attendance from manual punch cards | Automated time-tracking with biometric device sync (ZKTeco & compatible) |
| No visibility for multi-branch operations | Branch-level dashboards with roll-up analytics to corporate admin |
| Leave and request approvals via email chains | Structured multi-step approval workflows with SLA tracking |
| Compliance risk from missing audit trails | Immutable audit log for every HR action, accessible for regulatory review |

### 1.3 Multi-Tenant Agency Value Proposition

KWADER operates as a **shared-infrastructure, isolated-data** SaaS utilizing an **HR Agency Model**:

- **Workspace (Agency):** An HR professional or firm acts as the primary subscriber. They have a single workspace from which they can manage multiple independent companies.
- **Client Companies:** Each company is an isolated entity within the HR's workspace. Company A data is strictly isolated from Company B data, even if both are managed by the same HR professional.
- **Client Portals:** The HR professional can invite the business owner of a specific company. The business owner gets a read-only portal to view *only their company's data*, maintaining the HR's professional image without exposing other clients.
- All tenant data is row-level isolated at the database layer using advanced `user_company_ids` logic — no cross-tenant data leakage is architecturally possible.
- The Super Admin manages the platform layer (infrastructure, subscriptions) independently of any tenant's operational data.

---

## 2. User Personas & Role-Based Access Control (RBAC)

### 2.1 Persona Overview

#### Persona 1: Super Admin (Platform Operator)
- **Who:** The KWADER operations team or designated platform administrators.
- **Context:** Has no visibility into tenant business data. Manages the SaaS layer only.
- **Pain Points:** Managing subscription lifecycle, monitoring platform health, onboarding new tenants, and handling escalations.
- **Goals:** Ensure platform uptime, enforce plan limits, and provide tenant provisioning without manual intervention.

#### Persona 2: Tenant Admin (Business Owner / HR Director)
- **Who:** The primary company decision-maker or HR director of a subscribing business.
- **Context:** Has full, isolated control over their company's KWADER instance.
- **Pain Points:** Configuring payroll policies, managing branches, onboarding employees, and generating compliance reports.
- **Goals:** Run payroll on time, enforce attendance rules, manage leave budgets, and oversee all branch activity.

#### Persona 3: Branch / Department Manager
- **Who:** A regional manager, department head, or supervisor.
- **Context:** Scoped strictly to their assigned branch(es).
- **Pain Points:** Managing shift schedules, approving leave, and tracking team attendance in real time.
- **Goals:** Keep the team on schedule, process approvals quickly, and flag anomalies to the Tenant Admin.

#### Persona 4: Employee (End User)
- **Who:** Any staff member registered in the system.
- **Context:** Self-service access only. Cannot see peer salary or HR data.
- **Pain Points:** Not knowing leave balances, waiting for payslip information, and lacking a channel for requests.
- **Goals:** Submit leave requests, view payslips, track attendance, and manage personal profile.

---

### 2.2 RBAC Permission Matrix

> **Scope Key:** ✅ Full Access | 🔵 Scoped Access | 👁 Read Only | ❌ No Access

| Capability | Super Admin | Tenant Admin | Branch Manager | Employee |
|---|:---:|:---:|:---:|:---:|
| **Platform & Tenant Management** | | | | |
| Create / suspend tenants | ✅ | ❌ | ❌ | ❌ |
| Manage subscription plans & billing | ✅ | 👁 | ❌ | ❌ |
| View platform-wide audit logs | ✅ | ❌ | ❌ | ❌ |
| Configure global feature flags | ✅ | ❌ | ❌ | ❌ |
| **Organization & Branch Setup** | | | | |
| Create / edit company profile | ❌ | ✅ | ❌ | ❌ |
| Create / deactivate branches | ❌ | ✅ | ❌ | ❌ |
| Assign managers to branches | ❌ | ✅ | ❌ | ❌ |
| View own branch data | ❌ | ✅ | 🔵 | ❌ |
| **Employee Management** | | | | |
| Create / terminate employee records | ❌ | ✅ | ❌ | ❌ |
| View all employee records (tenant) | ❌ | ✅ | ❌ | ❌ |
| View branch employees | ❌ | ✅ | 🔵 | ❌ |
| Edit own profile | ❌ | ✅ | ✅ | ✅ |
| **Time & Attendance** | | | | |
| Configure shift templates | ❌ | ✅ | 🔵 | ❌ |
| Assign shifts to employees | ❌ | ✅ | 🔵 | ❌ |
| View branch attendance dashboard | ❌ | ✅ | 🔵 | ❌ |
| View own attendance | ❌ | ✅ | ✅ | 👁 |
| Manually override attendance record | ❌ | ✅ | 🔵 (with log) | ❌ |
| Configure biometric device sync | ❌ | ✅ | ❌ | ❌ |
| **Payroll** | | | | |
| Configure pay grades & allowances | ❌ | ✅ | ❌ | ❌ |
| Run payroll for pay period | ❌ | ✅ | ❌ | ❌ |
| Review payroll draft (branch scope) | ❌ | ✅ | 👁 | ❌ |
| Approve / lock payroll run | ❌ | ✅ | ❌ | ❌ |
| View own payslip | ❌ | ✅ | ✅ | 👁 |
| Export payroll reports | ❌ | ✅ | ❌ | ❌ |
| **Leave & Requests** | | | | |
| Configure leave policies & quotas | ❌ | ✅ | ❌ | ❌ |
| Submit leave request | ❌ | ✅ | ✅ | ✅ |
| Approve / reject leave (branch) | ❌ | ✅ | 🔵 | ❌ |
| Approve / reject leave (tenant-wide) | ❌ | ✅ | ❌ | ❌ |
| View team leave calendar | ❌ | ✅ | 🔵 | ❌ |
| Submit expense reimbursement | ❌ | ✅ | ✅ | ✅ |
| Approve expense reimbursement | ❌ | ✅ | 🔵 | ❌ |
| **Reporting & Audit** | | | | |
| Tenant-wide HR reports | ❌ | ✅ | ❌ | ❌ |
| Branch-level reports | ❌ | ✅ | 🔵 | ❌ |
| Audit log (tenant actions) | ❌ | ✅ | ❌ | ❌ |
| Export audit log | ❌ | ✅ | ❌ | ❌ |

> **Note on Branch Manager Scoping:** All `🔵` permissions are enforced at the row-level — Branch Managers can only access records where `branch_id` matches their assigned branch(es). This is enforced via RLS policies at the database layer, not solely at the application layer.

---

## 3. Core Functional Requirements — Module Breakdown

---

### Module 1: Tenant & Organization Management

#### 1.1 Tenant Provisioning (Super Admin)

- Super Admin can create a new tenant record via a secured admin portal (separate from the main app domain).
- Tenant creation flow provisions:
  - An isolated `tenant_id` (UUID) bound to all future records.
  - A Tenant Admin account with a secure invite link.
  - A default subscription plan assignment.
  - An audit log entry for the provisioning action.
- Super Admin can **suspend** a tenant (revokes all login access for that tenant's users without deleting data) or **terminate** a tenant (marks tenant as archived; data is retained per retention policy for 90 days).

#### 1.2 Subscription Plans

| Plan | Employee Limit | Branches | Biometric Integration | Retention | Price Tier |
|---|---|---|---|---|---|
| Starter | Up to 25 | 1 | ❌ | 12 months | Low |
| Growth | Up to 150 | 5 | ✅ | 24 months | Mid |
| Enterprise | Unlimited | Unlimited | ✅ | 60 months | Custom |

- Plan limits are enforced programmatically at record creation (e.g., attempting to add a 26th employee on Starter returns a `402 Plan Limit Exceeded` error).
- Plan upgrades are immediate; downgrades take effect at the end of the billing cycle.

#### 1.3 Organization Structure (Tenant Admin)

- **Company Profile:** Name, logo, legal registration number, country, primary currency, fiscal year start month, and working week definition (e.g., Sun–Thu vs. Mon–Fri).
- **Branch Setup:**
  - Each branch record contains: name, physical address, timezone, manager assignment(s), and an optional cost center code.
  - Branches can be deactivated but not deleted if they contain active employee records.
  - A branch-less "Head Office" entity is created by default for non-branch employees.
- **Department / Job Role Catalog:** Tenant-configurable list of departments and job titles used for organizational charting, payroll grade mapping, and reporting filters.

#### 1.4 Data Isolation — Technical Enforcement

- Every business-entity table in the database includes a `tenant_id` column (non-nullable, indexed).
- **Row-Level Security (RLS)** policies are enabled on all tenant-scoped tables. The authenticated database session context carries the `tenant_id` via a `SET LOCAL app.current_tenant_id = '...'` call at the start of every transaction.
- API middleware validates the JWT claim `tenant_id` and sets the session context before any query executes.
- Cross-tenant queries are structurally impossible: no API endpoint performs joins or subqueries across `tenant_id` boundaries.
- Super Admin operations use a separate elevated database role that bypasses RLS — this role is not accessible to any tenant-facing API endpoint.

---

### Module 2: Employee Lifecycle Management

#### 2.1 Employee Record (Core Fields)

| Field Group | Fields |
|---|---|
| Identity | Full name, national ID, date of birth, gender, nationality, photo |
| Contact | Personal phone, personal email, emergency contact |
| Employment | Employee number (auto-generated), hire date, employment type (full-time/part-time/contract), job title, department, branch, manager |
| Compensation | Pay grade, base salary, currency, payment method (bank transfer / cash), bank account details |
| Documents | Contract, ID copies, certifications (stored as encrypted file references) |
| Status | Active / On Probation / Suspended / Terminated |

#### 2.2 Onboarding Flow

1. Tenant Admin creates an employee record (partial data allowed initially).
2. System generates a unique onboarding link sent to the employee's personal email.
3. Employee completes their profile (contact info, bank details, document uploads).
4. Tenant Admin reviews and activates the record.
5. Biometric device enrollment is triggered (if applicable) — see Module 3.

#### 2.3 Offboarding Flow

1. Tenant Admin initiates termination with: last working day, reason code, and severance details.
2. System checks for: open leave requests (auto-rejected with notification), pending payroll (flagged for final settlement), and pending expense claims.
3. Final settlement payroll run is queued.
4. Employee access is revoked at midnight of the last working day.
5. Record is retained in `TERMINATED` status per the tenant's data retention policy.

---

### Module 3: Time & Attendance

#### 3.1 Shift Management

- **Shift Templates:** Tenant Admin defines reusable shift templates — name, start time, end time, break duration, overtime threshold, and applicable days.
- **Shift Assignment:** Managers assign shifts to employees on a weekly or period basis. The system prevents double-assigning conflicting shifts.
- **Roster View:** A calendar-style roster view (per branch) showing which employees are scheduled on each day, enabling drag-and-drop rescheduling.
- **Shift Swaps:** Employees can request a shift swap with a peer; the Manager must approve before the swap takes effect.

#### 3.2 Automated Attendance Tracking

- **Clock-In / Clock-Out:** Web portal and mobile-responsive interface for manual check-in with GPS location capture (optional, configurable per tenant).
- **Late Arrival / Early Departure Flags:** The system automatically flags records where check-in is > N minutes after the shift start (N is configurable per shift template). These flags appear on the Manager dashboard for review.
- **Overtime Calculation:** Overtime hours are calculated as time worked beyond the shift's defined end time (or beyond the daily legal limit, whichever the tenant configures). Overtime records are passed to the Payroll engine as structured data inputs — **no arithmetic is performed by AI logic**.
- **Absence Detection:** If no clock-in event exists for an employee on a scheduled shift day by a configurable cut-off time (e.g., 2 hours post shift start), the system automatically generates an `ABSENT` record and notifies the Manager.

#### 3.3 Biometric Device Integration (ZKTeco & Compatible)

This is a premium feature available on Growth and Enterprise plans.

**Integration Architecture:**

```
ZKTeco Device (on-premise)
        │
        │  [Push API / ZKTeco SDK pull]
        ▼
KWADER Biometric Sync Service (Background Worker)
        │
        │  [Validated, normalized records]
        ▼
attendance_raw_log table (tenant-isolated)
        │
        │  [Matching engine: employee_id ↔ device_user_id]
        ▼
attendance_records table
```

**Technical Requirements:**
- The Biometric Sync Service authenticates with ZKTeco devices using the device's IP, port, and a device-specific API key stored in the tenant's encrypted configuration vault.
- The service supports both **push mode** (device sends events via a webhook receiver) and **pull mode** (service polls the device on a configurable schedule, minimum 1-minute interval).
- Raw biometric logs are stored immutably in `attendance_raw_log`. Processed records are stored in `attendance_records` with a foreign key reference to the originating raw log entry.
- **Device Registration:** Tenant Admin registers each device by providing IP address, port, device ID, and credential type. The system performs a connectivity test before saving.
- **Employee-to-Device Mapping:** Each employee record can be mapped to one or more device user IDs (supporting multi-device environments).
- **Conflict Resolution:** If a biometric event arrives for a time that already has a manual clock-in record, the biometric record takes precedence and the manual record is flagged for Manager review.
- **Offline Device Handling:** Devices that fail to sync for > 30 minutes trigger an alert on the Tenant Admin dashboard. Backlogged events are ingested in batch when connectivity resumes, with correct timestamps preserved.

**Supported Devices (Initial Release):**
- ZKTeco K40, ZKTeco F22 (fingerprint series)
- Any device exposing the standard ZKTeco PUSH protocol

---

### Module 4: Payroll & Compensation Engine

> **⚠️ ABSOLUTE TECHNICAL CONSTRAINT — PAYROLL ARITHMETIC POLICY**
>
> All payroll calculations — including base salary computation, deduction amounts, overtime pay, tax withholding, allowances, and net pay — **must be executed exclusively by deterministic, hardcoded server-side business logic** written in a strongly-typed language (TypeScript/Node.js backend or equivalent).
>
> **Under no circumstances** shall any AI model, LLM inference call, or probabilistic system be involved in the direct computation of any financial figure. AI features within KWADER (e.g., anomaly detection, report summarization) operate strictly on **read-only aggregated outputs** of the payroll engine and cannot influence calculated values. This policy is non-negotiable and must be enforced via code review gates on all payroll-related modules.

#### 4.1 Compensation Structure Configuration

Tenant Admin defines the following before any payroll run:

| Component | Description | Type |
|---|---|---|
| Base Salary | Fixed monthly or hourly rate per employee or pay grade | Mandatory |
| Housing Allowance | Fixed or % of base salary | Optional |
| Transportation Allowance | Fixed amount | Optional |
| Meal Allowance | Fixed amount | Optional |
| Custom Allowances | Tenant-defined labels and amounts | Optional |
| Income Tax | Configurable tax brackets (by country) or flat rate | Mandatory if applicable |
| Social Insurance | Employer + Employee contributions (configurable %) | Optional |
| Custom Deductions | Loans, garnishments, fines (manual per-employee) | Optional |
| Overtime Rate | Multiplier of hourly rate (e.g., 1.5x or 2x) | Configurable |

#### 4.2 Payroll Generation Flow

```
Step 1: Pay Period Lock
├── Tenant Admin initiates payroll for a defined period (e.g., June 1–30).
├── System locks attendance records for that period (no further manual edits).
└── System snapshot: employee list as of period end date (terminated employees included for final settlement).

Step 2: Data Aggregation (Deterministic — Server Side)
├── For each employee in scope:
│   ├── Fetch base salary (from compensation record effective on period start date).
│   ├── Count working days (period calendar − public holidays − approved absence days).
│   ├── Count actual worked days from attendance_records.
│   ├── Identify approved overtime hours from attendance_records (overtime_hours field).
│   ├── Sum approved deductions (loans, fines) for the period.
│   └── Pull applicable allowances (active as of period end date).

Step 3: Calculation Engine (Hardcoded Logic — No AI)
│
│  GROSS PAY =
│    (Base Salary / Working Days in Period) × Actual Worked Days
│    + (Overtime Hours × Hourly Rate × Overtime Multiplier)
│    + Sum of Active Allowances
│
│  TOTAL DEDUCTIONS =
│    Income Tax (calculated from tax bracket table)
│    + Social Insurance Employee Portion
│    + Sum of Approved Custom Deductions
│
│  NET PAY = GROSS PAY − TOTAL DEDUCTIONS
│
└── Each calculation step is written to a `payroll_calculation_log` table with: input values, formula applied, and output value. This log is immutable.

Step 4: Draft Review
├── Payroll draft is presented to Tenant Admin showing:
│   ├── Per-employee: gross, each deduction line-item, net pay.
│   ├── Aggregate: total payroll cost, total deductions, total net disbursement.
│   └── Anomaly flags (e.g., >20% change from prior period) for manual review.
└── Tenant Admin can add one-time adjustments (bonuses, corrections) with mandatory notes. Each adjustment is logged.

Step 5: Approval & Lock
├── Tenant Admin reviews and approves the draft.
├── Payroll status transitions: DRAFT → APPROVED → LOCKED.
├── Once LOCKED, no further changes are permitted.
└── Payroll lock is recorded in the audit log.

Step 6: Payslip Generation & Distribution
├── Background job generates a PDF payslip per employee.
├── Payslip is stored in encrypted object storage with a tenant-scoped path.
├── Employees receive an in-app notification and can view/download their payslip.
└── Bulk export (ZIP of all payslips) is available to Tenant Admin.
```

#### 4.3 Payroll Batch Processing

- For tenants with > 50 employees, payroll generation (Step 2–3) is dispatched as a background job (see NFR: Performance).
- The UI displays a real-time progress indicator.
- If a batch job fails mid-run (e.g., missing compensation record for an employee), the job is rolled back for that tenant, an error report is generated, and the Tenant Admin is notified with specific employee records that need correction.

#### 4.4 Payroll Reports

- **Payroll Summary:** Aggregate gross, deductions, and net per period.
- **Payroll Ledger:** Line-item detail per employee per period.
- **Bank Transfer File:** Exportable in standard formats (CSV with bank reference, IBAN, amount).
- **Year-to-Date Summary:** Per employee, cumulative compensation for the current fiscal year.
- All reports are filtered strictly to the requesting tenant's data.

---

### Module 5: Leave & Request Workflows

#### 5.1 Leave Policy Configuration (Tenant Admin)

| Setting | Options |
|---|---|
| Leave Types | Annual, Sick, Unpaid, Maternity, Paternity, Emergency, Compensatory |
| Annual Quota | Fixed days per year, or accrual rate (days per month worked) |
| Carry-Over Policy | None, or up to N days carried into next year |
| Negative Balance | Allow (pending approval) or Block |
| Approval Tiers | 1-step (Manager only) or 2-step (Manager → HR/Tenant Admin) |
| Notice Period | Minimum advance notice required per leave type |
| Blackout Dates | Company-defined dates when leave cannot be taken (e.g., fiscal year end) |

#### 5.2 Leave Request Workflow

```
Employee Submits Request
  │
  ▼
System Validates:
  ├── Is requested period within a blackout date? → Reject with reason.
  ├── Does employee have sufficient balance? → Warn or block per policy.
  └── Does request overlap with an approved shift? → Flag for Manager.
  │
  ▼
Tier 1: Branch Manager Review (within SLA: 48 hours)
  ├── Approve → proceeds to Tier 2 (if configured) or auto-approved.
  ├── Reject → Employee notified with reason. Request closed.
  └── [SLA Breach] → Escalate to Tenant Admin with alert.
  │
  ▼
Tier 2 (if enabled): Tenant Admin / HR Review (within SLA: 24 hours)
  ├── Approve → Leave balance deducted. Attendance records updated.
  └── Reject → Employee notified. Leave balance unchanged.
  │
  ▼
Post-Approval:
  ├── Leave balance updated in real time.
  ├── Team leave calendar updated.
  ├── Attendance engine marks approved leave days as non-working (no absence flag).
  └── Payroll engine reads approved leave days as input (no pay deduction for Annual/Sick; deduction for Unpaid per policy).
```

#### 5.3 Other Request Types

**Overtime Authorization Request:**
- Employee or Manager submits a pre-authorization for overtime work.
- Tenant Admin or Manager approves.
- Approved overtime records are tagged in the attendance engine as pre-authorized, which the payroll engine treats with the configured overtime multiplier.

**Expense Reimbursement:**
- Employee submits a request with: category, amount, date, description, and receipt upload (image/PDF).
- Manager approves within their branch scope.
- Tenant Admin reviews for amounts exceeding a configurable threshold.
- Approved reimbursements are listed as a pending disbursement item in the next payroll run or as an immediate off-cycle payment (Tenant Admin's choice).

**Document Request:**
- Employee requests HR-issued documents: employment certificate, salary certificate, experience letter.
- Request routes to Tenant Admin for generation (manual fulfillment in MVP; template-based generation in Phase 2).

---

## 4. Non-Functional Requirements

### 4.1 Architecture & Database

#### Multi-Tenancy Model
- **Strategy:** Shared database, shared schema with Row-Level Security (RLS).
- **Database:** PostgreSQL 15+ via Supabase (managed) or self-hosted equivalent.
- **Why Shared Schema Over Per-Tenant Schema:** Reduces operational overhead at scale; RLS provides equivalent data isolation guarantees. Per-tenant schema migration complexity is avoided.

#### Database Design Principles
- Every tenant-scoped table: `tenant_id UUID NOT NULL REFERENCES tenants(id)`, covered by a composite index.
- All financial figures stored as `BIGINT` representing the smallest currency unit (e.g., fils/cents) to prevent floating-point arithmetic errors.
- `updated_at` and `created_at` timestamps on all tables, with `updated_by` (user UUID) for audit purposes.
- Soft deletes (`deleted_at TIMESTAMP NULL`) on all employee and HR records — hard deletes are prohibited.

#### Backend Services
- **API Gateway:** Single entry point for all tenant-facing API traffic. Handles JWT validation, tenant context injection, and rate limiting.
- **Core API (REST/GraphQL):** Handles all synchronous CRUD operations for HR data.
- **Payroll Engine Service:** Isolated microservice that receives a payroll run request, executes deterministic calculations, writes results, and returns a structured result set. Has no outbound AI/ML dependencies.
- **Biometric Sync Service:** Background worker handling device polling and push webhook reception.
- **Notification Service:** Email (transactional), in-app notifications, and optionally SMS for critical alerts.
- **Report Generation Service:** Handles asynchronous PDF/CSV generation for payslips and reports.

#### Frontend
- Single-page application (React/Next.js).
- Role-aware routing — UI components and navigation items are conditionally rendered based on the authenticated user's role and `branch_id` scope.
- Branch Managers accessing other branches' data receive a `403 Forbidden` at the API layer, not merely hidden in the UI.

### 4.2 Security & Compliance

| Requirement | Implementation |
|---|---|
| Authentication | JWT-based with short expiry (15 min access token, 7-day refresh token rotation). OAuth2/SSO (Google, Microsoft) in Phase 2. |
| Password Policy | Minimum 10 characters, complexity enforced, bcrypt hashing (cost factor ≥ 12). |
| Data in Transit | TLS 1.3 enforced on all API endpoints. HSTS enabled. |
| Data at Rest | AES-256 encryption for database volumes and object storage (payslips, documents). |
| Sensitive Field Encryption | Employee bank account details and national ID numbers are encrypted at the column level using a tenant-specific derived key. |
| API Authorization | Every endpoint validates: (1) valid JWT, (2) role has permission to the operation, (3) tenant_id in JWT matches tenant_id in the requested resource. |
| Biometric Device Credentials | Stored in an encrypted credentials vault, never returned in API responses. |
| Audit Log | Immutable `audit_log` table: records `actor_id`, `actor_role`, `tenant_id`, `action`, `resource_type`, `resource_id`, `before_state` (JSON), `after_state` (JSON), `ip_address`, `timestamp`. Writes are append-only; no UPDATE or DELETE is permitted on this table. |
| GDPR / Data Privacy | Right-to-erasure requests handled by anonymizing PII fields on terminated employees after the retention period, not hard deletion, to preserve payroll history integrity. |
| Rate Limiting | Per-IP and per-tenant API rate limits to prevent abuse and scraping. |
| Penetration Testing | Scheduled annually and after major releases. Critical findings block release. |

### 4.3 Performance & Scalability

| Scenario | Requirement |
|---|---|
| API Response Time (p95) | ≤ 300ms for CRUD operations under normal load |
| Payroll Batch (50 employees) | Complete within 30 seconds |
| Payroll Batch (1,000 employees) | Complete within 5 minutes (background job) |
| Biometric Sync Latency | Clock events reflected in UI within ≤ 2 minutes of device event |
| Concurrent Tenant Users | Platform supports 10,000 concurrent authenticated sessions without degradation |
| Database Query Performance | All critical queries (attendance lookups, payroll aggregations) covered by appropriate composite indexes; query plan reviewed before each release |

#### Background Job Infrastructure
- All non-synchronous operations (payroll batch, payslip generation, biometric sync, report exports) are dispatched to a **managed job queue** (e.g., BullMQ with Redis, or Inngest for serverless deployments).
- Jobs are retryable with exponential backoff (max 3 retries).
- Failed jobs are moved to a dead-letter queue with structured error context for debugging.
- Job status is exposed to the Tenant Admin UI as a real-time progress tracker.

### 4.4 Availability & Reliability

- **Uptime SLA:** 99.9% monthly uptime for Growth and Enterprise plans.
- **Database Backups:** Automated daily backups with point-in-time recovery (PITR) up to 7 days (14 days for Enterprise).
- **Disaster Recovery RTO:** < 4 hours; RPO: < 1 hour.
- **Health Monitoring:** Internal service health endpoints (`/health`, `/ready`) consumed by a monitoring stack (e.g., Grafana + Prometheus or equivalent). Alerts for: API error rate spikes, job queue depth anomalies, and database connection pool saturation.

---

## 5. Milestones & Phased Rollout

### Phase 1 — MVP (Months 1–4)

**Goal:** Deliver a production-deployable system covering the core HR loop: onboard, schedule, track attendance, and run payroll.

| MVP Feature | Scope |
|---|---|
| Super Admin portal | Tenant creation, suspension, plan assignment |
| Tenant Admin portal | Company/branch setup, employee onboarding |
| Employee self-service | Profile, payslip view, leave requests |
| RBAC | All 4 roles fully implemented with RLS |
| Shift management | Templates, assignment, roster view |
| Manual attendance | Clock-in/out via web portal; late/absence detection |
| Payroll engine v1 | Base salary, allowances, manual deductions, net pay, payslip PDF |
| Leave workflows | Annual and Sick leave; 1-step approval chain |
| Audit log | Append-only for all write operations |
| Notifications | In-app and email for key events |
| Security foundation | JWT auth, TLS, column encryption, RLS |

**MVP Exclusions:** Biometric integration, 2-step leave approvals, expense reimbursements, payroll bank export, SSO, mobile app.

---

### Phase 2 — Core Expansion (Months 5–8)

| Feature | Notes |
|---|---|
| ZKTeco biometric device integration | Push and pull modes; Growth+ plans |
| 2-step leave approval workflows | Configurable per leave type |
| Expense reimbursement module | With receipt upload and approval chain |
| Overtime pre-authorization requests | Manager-initiated |
| Payroll bank transfer file export | CSV with IBAN/reference |
| Year-to-date payroll reports | Per employee, per fiscal year |
| Shift swap requests | Peer-to-peer with manager approval |
| Document request workflow | HR-issued certificate requests |
| Branch Manager scoped analytics | Attendance and leave dashboards |

---

### Phase 3 — Scale & Intelligence (Months 9–14)

| Feature | Notes |
|---|---|
| SSO / OAuth2 | Google Workspace, Microsoft Entra ID |
| Mobile application (iOS + Android) | Employee self-service; clock-in with GPS |
| Multi-currency payroll | Enterprise tenants with international workforce |
| Configurable tax bracket tables (multi-country) | Saudi Arabia, UAE, Egypt, Jordan initial set |
| Payroll anomaly flagging | Read-only AI comparison of current vs. prior period to surface outliers for human review |
| Advanced reporting suite | Custom report builder, scheduled email delivery |
| API webhooks for tenants | Push events to tenant's own systems |
| HRIS integrations | ATS handoff (candidate → employee), accounting system export |
| Reseller / Partner portal | White-label onboarding for KWADER reseller partners |

---

## 6. Open Technical Decisions (To Be Resolved Before Phase 1 Development)

| Decision | Options | Recommendation |
|---|---|---|
| Backend runtime | Node.js (TypeScript) vs. Go | TypeScript for consistency with frontend ecosystem; Go if payroll engine demands performance at scale |
| Job queue infrastructure | BullMQ + Redis vs. Inngest vs. Temporal | BullMQ for self-hosted; Inngest if serverless deployment is prioritized |
| Object storage for payslips | Supabase Storage vs. AWS S3 | AWS S3 for enterprise durability guarantees |
| Frontend framework | Next.js App Router vs. Vite + React SPA | Next.js for SSR-friendly auth flows and SEO on marketing pages |
| Biometric SDK approach | ZKTeco official SDK vs. open-source zklib | Evaluate zklib (Node.js) for MVP; official SDK for enterprise compliance |

---

## 7. Glossary

| Term | Definition |
|---|---|
| Tenant | A subscribing business with isolated data in KWADER |
| Pay Period | The defined time window for a payroll calculation (e.g., monthly, bi-weekly) |
| RLS | Row-Level Security — a PostgreSQL feature enforcing per-row access control |
| Deterministic Logic | Business logic that produces the same output for the same inputs every time, with no probabilistic variance |
| PITR | Point-in-Time Recovery — the ability to restore a database to any past moment |
| Biometric Sync | The automated process of ingesting attendance clock events from a physical device |
| Attendance Override | A Manager-authorized manual correction to an attendance record, logged in the audit trail |
| Dead-Letter Queue | A holding area for background jobs that have failed all retry attempts, pending manual review |

---

*End of Document — KWADER PRD v1.0*  
*Next Review: After Phase 1 architecture sign-off*
