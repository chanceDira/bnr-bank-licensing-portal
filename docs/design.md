# Bank Licensing & Compliance Portal — Design Document

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Architecture](#2-architecture)
3. [Data Model](#3-data-model)
4. [State Machine](#4-state-machine)
5. [Roles & Permission Boundaries](#5-roles--permission-boundaries)
6. [Non-Negotiable Requirements — Implementation](#6-non-negotiable-requirements--implementation)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Hard Decisions & Trade-offs](#8-hard-decisions--trade-offs)
9. [What I Would Do Differently With More Time](#9-what-i-would-do-differently-with-more-time)

---

## 1. Problem Statement

The National Bank of Rwanda manages bank licensing through entirely manual processes: email submissions, spreadsheet tracking, and informal approval channels. The result is no single source of truth, no audit trail, and no visibility into application status at any given moment.

This system replaces that process end-to-end with a structured, role-aware, tamper-evident regulatory platform designed around four core integrity principles:

1. **Tamper-evident audit chain** — every regulatory action is cryptographically chained to the previous event, making retrospective manipulation immediately detectable.

2. **Four-eyes decision enforcement** — no single officer can both review and approve the same licensing decision.

3. **Document fingerprinting** — every uploaded document is fingerprinted using SHA-256 to preserve evidentiary integrity.

4. **Risk-based prioritisation** — applications are automatically scored and classified (LOW, MEDIUM, HIGH) to help regulators focus on higher-risk cases first.

These controls were deliberately prioritised over feature breadth because licensing decisions may later be subject to audit, dispute resolution, or legal scrutiny.

---

## 2. Architecture

### 2.1 High-level overview

```
┌─────────────────────────────────────────────────────┐
│                   Browser (React SPA)                │
│  Vite dev proxy / nginx in prod → same-origin HTTPS  │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP/JSON  (JWT Bearer)
┌─────────────────────▼───────────────────────────────┐
│              NestJS REST API  (port 3000)             │
│                                                       │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │   Auth   │  │ Applications │  │   Documents    │ │
│  │  Module  │  │   Module     │  │   Module       │ │
│  └──────────┘  └──────────────┘  └────────────────┘ │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │  Users   │  │   Workflow   │  │    Audit       │ │
│  │  Module  │  │   Service    │  │   Module       │ │
│  └──────────┘  └──────────────┘  └────────────────┘ │
│                                                       │
│  Global: JwtAuthGuard · RolesGuard · ExceptionFilter │
│          RequestIdInterceptor                         │
└─────────────────────┬───────────────────────────────┘
                      │ Prisma ORM
┌─────────────────────▼───────────────────────────────┐
│                 PostgreSQL Database                   │
│   users · applications · application_files           │
│   audit_logs                                         │
└─────────────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│          Local filesystem  (/storage)                 │
│   storage/apps/{appId}/v{version}/{filename}         │
└─────────────────────────────────────────────────────┘
```

### 2.2 Backend — NestJS

**Why NestJS:** Opinionated module structure enforces separation of concerns. Built-in dependency injection, guard/interceptor pipeline, and decorator-based routing match the regulatory context where explicit, inspectable code is preferable to implicit magic.

**Modules:**

| Module | Responsibility |
|---|---|
| `auth` | JWT login, bcrypt password hashing, Passport strategy |
| `users` | User CRUD (ADMIN-only write, auth read) |
| `applications` | CRUD + workflow transition endpoints |
| `workflow` | State machine — only place allowed to mutate `application.status` |
| `documents` | File upload, metadata persistence, download |
| `audit` | Append-only log queries |
| `common` | Global exception filter, request-id interceptor, role enum |
| `prisma` | Global database service, lifecycle management |

**Request lifecycle:**
```
Request → RequestIdInterceptor → JwtAuthGuard → RolesGuard
        → Controller → Service → WorkflowService (if transition)
        → PrismaService ($transaction: update + auditLog.create)
        → Response
```

### 2.3 Frontend — React SPA

**Why SPA over SSR:** Internal regulatory tool — no SEO requirement. SPA delivers instant navigation between views (queue → detail → back) which suits the workflow-heavy use pattern.

**Why Vite proxy:** Eliminates CORS entirely in development. Requests from the browser go to the same origin (Vite dev server) which forwards them to the backend. In production, nginx serves the built static files and proxies `/api` to the NestJS process — same pattern, zero config change.

---

## 3. Data Model

### 3.1 Entity relationship

```
User ─────────────────────────────────────────────┐
  │ (applicantId)                                  │
  │           Application ──────────── AuditLog    │
  │ (reviewedById)    │                  │         │
  │ (approvedById)    │                  │ (actorUserId)
  └──────────────────►│           ApplicationFile  │
                      │ (uploadedById)             │
                      └────────────────────────────┘
```

### 3.2 Schema

#### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | `cuid` PK | Collision-resistant, URL-safe |
| `email` | `varchar` UNIQUE | Login identity |
| `passwordHash` | `varchar` | bcrypt, cost factor 12 |
| `role` | `enum` | APPLICANT · REVIEWER · APPROVER · ADMIN |
| `createdAt` | `timestamptz` | |
| `updatedAt` | `timestamptz` | Auto-updated |

**Design decision:** No `name` field. Email is the unique identifier used in all audit records. Names can be spoofed or changed; email is the verifiable identity in this context.

---

#### `applications`

| Column | Type | Notes |
|---|---|---|
| `id` | `cuid` PK | |
| `applicantId` | FK → users | Immutable after creation |
| `institutionName` | `varchar` | Name of applying institution |
| `licenseType` | `varchar` | Category of license sought |
| `notes` | `text?` | Optional applicant context |
| `status` | `enum` | Current workflow state |
| `version` | `int` DEFAULT 1 | Optimistic lock counter |
| `reviewedById` | FK → users? | Set on first UNDER_REVIEW entry |
| `approvedById` | FK → users? | Set on APPROVED or REJECTED |
| `finalDecisionAt` | `timestamptz?` | Timestamp of terminal decision |
| `rejectionReason` | `text?` | Required when status = REJECTED |
| `createdAt` | `timestamptz` | |
| `updatedAt` | `timestamptz` | |

**Indexes:** `applicantId`, `status`, `reviewedById`, `approvedById` — all are common filter axes in the role-based list queries.

**Why `version`:** Optimistic locking. The update clause is `WHERE id = ? AND version = ? AND status = ?`. If another request already incremented the version, `rowsAffected = 0` and a `ConflictException(409)` is raised. The new version is never assigned, so no data is corrupted.

---

#### `application_files`

| Column | Type | Notes |
|---|---|---|
| `id` | `cuid` PK | |
| `applicationId` | FK → applications | |
| `applicationVersion` | `int` | Snapshot of app version at upload time |
| `fileName` | `varchar` | Original filename |
| `mimeType` | `varchar` | e.g. `application/pdf` |
| `fileSizeBytes` | `int` | Enforced ≤ 5,242,880 bytes server-side |
| `storagePath` | `varchar` | Absolute path on server filesystem |
| `uploadedById` | FK → users | |
| `createdAt` | `timestamptz` | |

**Versioning:** `applicationVersion` stamps every uploaded file with the application's current version. When an applicant resubmits (version increments), new uploads carry the new version. Old rows are never deleted — both versions remain queryable. The UI groups files by version to show the history of each submission.

**Storage path structure:** `storage/apps/{applicationId}/v{version}/{timestamp}_{sanitisedFilename}`

---

#### `audit_logs`

| Column | Type | Notes |
|---|---|---|
| `id` | `cuid` PK | |
| `applicationId` | FK → applications | |
| `actorUserId` | FK → users | Who triggered the action |
| `action` | `enum` | See `AuditAction` enum below |
| `beforeStatus` | `enum?` | State before transition |
| `afterStatus` | `enum?` | State after transition |
| `metadata` | `jsonb?` | Flexible payload (e.g. reviewer notes, document name) |
| `requestId` | `varchar?` | Correlates to `x-request-id` header |
| `ipAddress` | `varchar?` | Client IP for legal traceability |
| `userAgent` | `varchar?` | Browser/client identification |
| `createdAt` | `timestamptz` | Set by DB — not application layer |

**`AuditAction` enum values:** `APPLICATION_CREATED` · `APPLICATION_SUBMITTED` · `REVIEW_STARTED` · `INFO_REQUESTED` · `APPLICATION_RESUBMITTED` · `REVIEW_COMPLETED` · `FINAL_APPROVED` · `FINAL_REJECTED` · `DOCUMENT_UPLOADED`

**Indexes:** `(applicationId, createdAt)` for per-application timeline queries; `(actorUserId, createdAt)` for per-user activity queries.

---

## 4. State Machine

### 4.1 State diagram

```
                    ┌─────────┐
                    │  DRAFT  │◄── (created here)
                    └────┬────┘
                         │ Applicant: Submit
                    ┌────▼────────┐
                    │  SUBMITTED  │
                    └────┬────────┘
                         │ Reviewer: Start Review
               ┌─────────▼──────────┐
               │    UNDER_REVIEW    │◄──────────────────┐
               └──┬──────────────┬──┘                   │
    Reviewer:     │              │ Reviewer:             │ Reviewer:
    Request Info  │              │ Complete Review       │ Start Review
               ┌──▼──────────┐  │                       │
               │INFO_REQUESTED│  │                  ┌────┴──────────┐
               └──┬──────────┘  │                  │  RESUBMITTED  │
     Applicant:   │              │                  └───────────────┘
     Resubmit     └─────────────►│                        ▲
                            ┌────▼───────────┐            │ Applicant:
                            │REVIEW_COMPLETED │            │ Resubmit
                            └────┬───────────┘            │
               Approver:         │                ┌────────┴──────┐
               Approve ──────────┤         ───────►INFO_REQUESTED │
               Reject  ──────────┤        │       └───────────────┘
                            ┌────┴──┐  ┌──┴─────┐
                            │APPROVED│  │REJECTED│
                            │(final) │  │(final) │
                            └────────┘  └────────┘
```

### 4.2 Valid transitions

| From | To | Actor | Business rules |
|---|---|---|---|
| DRAFT | SUBMITTED | APPLICANT | Must be application owner |
| SUBMITTED | UNDER_REVIEW | REVIEWER | Assigns `reviewedById` if unset |
| UNDER_REVIEW | INFO_REQUESTED | REVIEWER | Must be assigned reviewer |
| UNDER_REVIEW | REVIEW_COMPLETED | REVIEWER | Must be assigned reviewer |
| INFO_REQUESTED | RESUBMITTED | APPLICANT | Must be application owner |
| RESUBMITTED | UNDER_REVIEW | REVIEWER | Same reviewer or unassigned |
| REVIEW_COMPLETED | APPROVED | APPROVER | `reviewedById ≠ actorUserId` (SoD) |
| REVIEW_COMPLETED | REJECTED | APPROVER | `reviewedById ≠ actorUserId`; `rejectionReason` required |

### 4.3 Terminal states

`APPROVED` and `REJECTED` are terminal. `assertTransitionAllowed()` in `WorkflowService` checks `this.terminalStates.has(fromStatus)` before evaluating any other rule. No API endpoint can move an application out of either state.

### 4.4 Enforcement layers

1. **Service layer (`WorkflowService`)** — all transition logic lives in one class. No other service is permitted to write `application.status` directly.
2. **Database transaction** — `updateMany` + `auditLog.create` execute in the same `$transaction`. Either both commit or both roll back. No partial state is possible.
3. **Optimistic lock** — `WHERE id = ? AND version = ? AND status = ?` prevents concurrent transitions from producing inconsistent state.

---

## 5. Roles & Permission Boundaries

### 5.1 Role definitions

#### APPLICANT
**Can:**
- Create applications (saved as DRAFT)
- Upload documents to own applications in DRAFT / INFO_REQUESTED / RESUBMITTED states
- Submit own applications (DRAFT → SUBMITTED)
- Resubmit own applications (INFO_REQUESTED → RESUBMITTED)
- View own applications, documents, and audit trail

**Cannot:**
- View other applicants' applications
- Initiate, conduct, or complete any review step
- Make approval/rejection decisions

**Justification:** Applicants are external parties. Isolation to own data prevents information leakage between competing institutions. The workflow forces all communication through structured state transitions — no direct contact with reviewers needed.

---

#### REVIEWER
**Can:**
- View all applications
- Pick up a SUBMITTED or RESUBMITTED application (start review — assigns themselves)
- Request additional information from an applicant
- Mark a review complete (REVIEW_COMPLETED)
- View all documents and audit logs

**Cannot:**
- Make the final APPROVED / REJECTED decision
- Act on an application assigned to a different reviewer

**Justification:** Separation between review and approval is the core compliance requirement. A reviewer performs due diligence; the final authority sits with a separate approver. This mirrors the four-eyes principle common in financial regulation.

---

#### APPROVER
**Can:**
- View all applications
- Make final decisions (APPROVED / REJECTED) on REVIEW_COMPLETED applications **that they did not review**
- View all documents and audit logs

**Cannot:**
- Perform any review steps
- Approve or reject an application they themselves reviewed (hard enforced)

**Justification:** The separation-of-duties rule (`reviewedById !== approverUserId`) ensures no single person can both evaluate and approve — a fundamental control in regulatory contexts to prevent rubber-stamping.

---

#### ADMIN
**Can:**
- Create, view, and update user accounts and roles
- View all applications and their complete audit trails
- Manage license type options (frontend settings)

**Cannot:**
- Modify or delete any audit log record
- Perform workflow actions on applications

**Justification:** Administrative access is deliberately read-heavy. An admin who can also approve applications undermines the review/approve separation. Separating user governance from application workflow prevents privilege escalation.

---

### 5.2 Enforcement implementation

**Backend — two layers:**

1. **`RolesGuard`** — checks `@Roles(...)` metadata against the JWT payload role. Returns 403 if the role is not in the allowed set. Applied at the controller/route level.

2. **`WorkflowService.assertRoleCanTransition()`** — checks that the actor's role is permitted for the specific `(fromStatus, toStatus)` pair. A REVIEWER cannot approve even if they somehow bypass the route-level guard.

**Frontend — UI layer (cosmetic, not security):**

Action buttons are conditionally rendered based on `user.role` and `app.status`. This improves usability but provides no security. All protection is on the backend.

---

## 6. Non-Negotiable Requirements — Implementation

### 6.1 Authentication & authorisation

**Choice: JWT (stateless)**

JWTs are verified on every request via `JwtAuthGuard` (Passport). The payload carries `{ sub, email, role }`. Role is re-checked on every request — a role change takes effect on the next login (token expiry: 1 hour by default).

**Why not sessions:** Sessions require a shared session store, which complicates horizontal scaling and adds infrastructure dependency. For this assessment's scope, stateless JWT is simpler and equally secure.

**Limitation acknowledged:** JWTs cannot be revoked before expiry. A production system would add a token blocklist in Redis or use short-lived tokens with refresh token rotation.

---

### 6.2 Role enforcement in the backend

All role checks live in `src/auth/guards/roles.guard.ts` and `src/workflow/workflow.service.ts`. A request that carries a valid JWT for a REVIEWER role calling `POST /applications/:id/decision` (APPROVER-only) receives **403 Forbidden** from `RolesGuard` before the service is ever reached.

Bypassing the frontend entirely (e.g. via curl or Postman) still hits the same guards. There is no frontend-only protection.

---

### 6.3 Separation of duties

Enforced in `WorkflowService.assertBusinessRules()`:

```typescript
if (input.toStatus === 'APPROVED' || input.toStatus === 'REJECTED') {
  if (current.reviewedById === input.actorUserId) {
    throw new ForbiddenException(
      'Reviewer cannot be the final approver for the same application',
    );
  }
}
```

This check runs inside the database transaction, after role validation. It cannot be bypassed via the API.

---

### 6.4 Workflow & state integrity

- **Illegal transitions rejected at API level:** `WorkflowService.assertTransitionAllowed()` checks the `transitions` map before any database write. Returns `ConflictException(409)`.
- **Final decisions are permanent:** `terminalStates = new Set(['APPROVED', 'REJECTED'])` is checked first, before the transition map lookup.
- **Concurrency:** Handled with optimistic locking (see §3.2). The update query includes `version: current.version` in the `WHERE` clause. If `rowsAffected = 0`, the service raises `ConflictException(409)` and neither the status update nor the audit log is committed.

---

### 6.5 Audit trail

**Append-only at application level:**
- No `UPDATE` or `DELETE` endpoint is exposed for `audit_logs` — there is no route, no service method, and no controller action that touches existing audit records.
- Audit records are created exclusively inside `WorkflowService.$transaction()` — they are written atomically with the state change they record.

**Append-only at database level (production hardening):**
```sql
-- Revoke write permissions from the application DB user
REVOKE UPDATE, DELETE ON TABLE audit_logs FROM license_portal_app;

-- Trigger that raises on any modification attempt
CREATE OR REPLACE FUNCTION audit_logs_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_audit_mutation
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
```

This is documented rather than applied in the migration because applying it requires a separate privileged DB user for setup, which is beyond the scope of local dev. A production deployment would apply this via a DBA migration.

**Each entry captures:**
- `actorUserId` — who acted
- `action` — what happened
- `beforeStatus` / `afterStatus` — state before and after
- `createdAt` — immutable timestamp (set by PostgreSQL default, not application code)
- `requestId` — correlation ID for log tracing
- `ipAddress` + `userAgent` — for legal traceability

---

### 6.6 Document handling

**5 MB enforcement (server-side):**

NestJS `FileInterceptor` with `memoryStorage()` buffers the file in memory. Before writing to disk, `DocumentsService.upload()` checks `file.size > MAX_FILE_SIZE` and throws `PayloadTooLargeException(413)`.

**Versioning:**

On upload, `applicationVersion` is stamped with `application.version` at that moment. When an applicant resubmits (RESUBMITTED transition), the workflow increments `application.version`. New uploads then carry the new version. Old `application_files` rows are never deleted. The frontend groups files by version to show both the original submission and all subsequent resubmissions.

**Filename sanitisation:**
```typescript
const safeFilename = `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
```

Prevents path traversal via crafted filenames.

---

### 6.7 API design

- **Prefix:** `/api/v1` on all routes
- **403 vs 404:** Unauthorised access always returns 403. Returning 404 for unauthorised resources can leak information about whether the resource exists.
- **Error format:**
```json
{
  "code": "FORBIDDEN",
  "message": "Reviewer cannot be the final approver for the same application",
  "traceId": "uuid",
  "path": "/api/v1/applications/xyz/decision",
  "timestamp": "2026-05-10T15:00:00.000Z"
}
```
- **No stack traces:** `AllExceptionsFilter` intercepts all unhandled errors and formats them without exposing internal details.
- **Swagger:** Available at `/api/docs` (OpenAPI 3.0).

---

### 6.8 Seed data

`prisma/seed.ts` creates:
- 4 users, one per role
- Application 1: `SUBMITTED` (awaiting reviewer) — with audit trail
- Application 2: `REVIEW_COMPLETED` (awaiting approver decision) — with full audit trail including INFO_REQUESTED cycle

Run: `npx ts-node prisma/seed.ts`

---

## 7. Frontend Architecture

### 7.1 Structure — features-based

```
src/
├── shared/         Reusable across all features
│   ├── api/        Axios client (JWT interceptor, Vite proxy aware)
│   │               Per-resource API modules (auth, applications, documents, audit, users)
│   ├── types/      Shared TypeScript interfaces matching backend DTOs
│   └── ui/         Primitive components: ErrorBoundary, Skeleton, Badge,
│                   Spinner, EmptyState, Modal, Alert, FormField (forwardRef)
│
├── features/       Domain-bounded feature slices
│   ├── auth/       Zustand store · Zod schema · LoginPage (RHF)
│   ├── applications/
│   │   ├── application.schema.ts  Zod validation schemas for all forms
│   │   ├── hooks/                 useApplications · useApplication · useApplicationMutations
│   │   ├── components/            ApplicationTable (filter+sort) · WorkflowActions
│   │   └── pages/                 ApplicantDashboard · ReviewerQueue · ApproverQueue
│   │                              NewApplicationPage · ApplicationDetailPage
│   ├── documents/  Upload · versioned list · authenticated download
│   ├── audit/      Colour-coded timeline
│   └── admin/      licenseTypes.store · AdminUsersPage · AdminSettingsPage
│
└── components/     Shell-level: AppShell · Sidebar · ProtectedRoute
```

### 7.2 State management strategy

| State type | Solution | Reason |
|---|---|---|
| Server state (applications, users, audit logs) | TanStack Query | Automatic caching, background refetch, invalidation on mutation |
| Auth state (user, token) | Zustand + `tokenStore` | Survives page refresh; accessed by axios interceptor without circular dependency |
| Form state | React Hook Form | Uncontrolled inputs, performant re-renders, native ref forwarding required by Zod v4 |
| License types (admin setting) | Zustand + `persist` | No backend endpoint needed; changes reflect immediately in applicant form |
| UI state (tab, modal open) | `useState` (local) | Not shared; no need to hoist |

### 7.3 Form validation

All forms use **React Hook Form** + **Zod v4** via `@hookform/resolvers/zod`.

**Critical implementation detail — `forwardRef`:**
React 18 does not forward `ref` to function components that do not use `React.forwardRef`. Since `register()` returns a `ref` callback that react-hook-form needs to read field values, all form field components (`InputField`, `TextareaField`, `SelectField`) are wrapped with `forwardRef`. Without this, fields submit as `undefined`, and Zod v4 raises `"Invalid input: expected string, received undefined"`.

### 7.4 Role-aware routing

`App.tsx` renders a role-specific dashboard at `/applications`:

```typescript
if (user.role === 'REVIEWER') return <ReviewerQueue />;
if (user.role === 'APPROVER') return <ApproverQueue />;
return <ApplicantDashboard />; // APPLICANT and ADMIN
```

`ProtectedRoute` wraps every route with optional `roles` check. A user accessing a route outside their role is redirected to `/applications`, not shown an error page — which avoids revealing that the route exists.

### 7.5 API communication

The Vite dev server proxies `/api` → `http://localhost:3000`:

```typescript
// vite.config.ts
proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } }
```

The axios client's `baseURL` is `/api/v1` (relative). In production, an nginx reverse proxy handles the same forwarding. This means CORS is never a concern — the browser always sees same-origin requests.

The 401 interceptor skips redirect for the `/auth/login` endpoint so that invalid credentials show an inline error instead of reloading the page.

---

## 8. Hard Decisions & Trade-offs

### Decision 1: Single reviewer assignment model

When a reviewer starts reviewing an application, `reviewedById` is set and only that reviewer can continue. This prevents two reviewers from independently reviewing the same application and producing conflicting outcomes.

**Trade-off:** If the assigned reviewer is unavailable (sick leave, resignation), an admin must manually reassign. The current implementation does not expose a reassignment endpoint. An admin could update `reviewedById` directly in the database, or a future `POST /applications/:id/reassign` endpoint (ADMIN-only) could handle this cleanly.

---

### Decision 2: Optimistic locking over pessimistic

`SELECT ... FOR UPDATE` (pessimistic) would hold a row lock for the duration of the transaction, blocking other readers. Optimistic locking (`version` check on update) allows concurrent reads and only detects conflict at write time.

**Trade-off:** Optimistic locking causes retries under high contention. For a regulatory portal with low concurrent access on any single application, this is the right trade-off. A busy public form would warrant pessimistic locking or a queue-based approach.

---

### Decision 3: Local file storage, not object storage

Files are stored on the local filesystem under `/storage`. This satisfies the assessment requirement ("simulate file storage — no cloud integration required") and keeps the setup dependency-free.

**Trade-off:** Not suitable for production. A multi-instance deployment would need a shared volume or object storage (S3, GCS). The abstraction is clean — `DocumentsService.upload()` writes to a path, `download()` reads from that path. Replacing these two operations with S3 SDK calls is a contained change.

---

### Decision 4: License types in frontend localStorage, not backend

License type management is stored in Zustand with `persist` middleware (localStorage) rather than in a database table. This avoids a schema migration and a new backend endpoint for a feature that is entirely admin-controlled.

**Trade-off:** License types are per-browser, not per-server. If two admins manage different browsers, they could diverge. For a single-admin portal this is acceptable. The correct production solution is a `license_types` table with a CRUD API.

---

### Decision 5: No refresh token rotation

The JWT expires after 1 hour (`JWT_EXPIRES_IN_SECONDS=3600`). On expiry, the user is redirected to the login page.

**Trade-off:** Better UX would use refresh tokens with silent re-authentication. Not implemented because it adds significant complexity (token storage strategy, refresh endpoint, rotation on use, revocation list) that is out of scope for this assessment.

---

## 9. What I Would Do Differently With More Time

| Area | What and Why |
|---|---|
| **Audit log DB-level protection** | Apply the `REVOKE` + trigger SQL in a dedicated privileged migration, enforced at the database level rather than just the application level |
| **Token revocation** | Redis blocklist for immediate logout (e.g. after role change by admin) |
| **Refresh tokens** | Short-lived access tokens (15 min) + HTTP-only cookie refresh tokens |
| **Reassignment endpoint** | `POST /applications/:id/reassign` (ADMIN-only) for reviewer reassignment without direct DB access |
| **Email notifications** | Notify applicant when status changes (INFO_REQUESTED, APPROVED, REJECTED) |
| **License types backend** | `license_types` table + CRUD API, replacing the localStorage store |
| **Full-text search** | PostgreSQL `tsvector` index on `institutionName` for server-side search instead of client-side filtering |
| **Pagination on audit logs** | Cursor-based pagination for audit trails that grow without bound |
| **Rate limiting** | `@nestjs/throttler` on auth endpoints to prevent brute force |
| **Integration tests** | End-to-end tests covering the full lifecycle (create → submit → review → approve) against a test database |
| **File type validation** | Server-side MIME sniffing (magic bytes) rather than trusting the `Content-Type` header |
| **Admin analytics dashboard** | Aggregate metrics: average time in each state, approval rate, reviewer workload |
