# Bank Licensing & Compliance Portal — Backend

REST API for the National Bank of Rwanda bank licensing portal. Replaces a manual, email-and-spreadsheet process with a structured workflow system covering application submission, multi-stage review, document management, and a tamper-proof audit trail.

Built with **NestJS + PostgreSQL + Prisma + JWT**.

Project-wide documentation lives in [`../docs`](../docs/README.md).

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 20 |
| PostgreSQL | ≥ 14 |
| npm | ≥ 9 |

---

## Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd license-portal-be
npm install
```

### 2. Configure environment

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/license_portal"

JWT_SECRET="your-long-random-secret-min-32-chars"
JWT_EXPIRES_IN_SECONDS=3600

PORT=3000

CORS_ORIGIN="http://localhost:5173"
```

Replace `yourpassword` with your PostgreSQL password.

### 3. Create the database

```bash
psql -U postgres -c "CREATE DATABASE license_portal;"
```

### 4. Run migrations

Applies the full schema (users, applications, documents, audit log):

```bash
npx prisma migrate dev
```

### 5. Seed the database

Creates one user per role and two applications in different workflow states:

```bash
npm run seed
```

Seed output:

```
APPLICANT : applicant@example.com  / Password123!
REVIEWER  : reviewer@bnr.rw        / Password123!
APPROVER  : approver@bnr.rw        / Password123!
ADMIN     : admin@bnr.rw           / Password123!
```

Two seeded applications:
- Application 1 → `SUBMITTED` (awaiting reviewer)
- Application 2 → `REVIEW_COMPLETED` (awaiting approver decision, full audit trail attached)

---

## Running the server

```bash
# development (watch mode)
npm run start:dev

# production
npm run build
npm run start:prod
```

Server starts at `http://localhost:3000`.

Interactive API docs (Swagger UI): `http://localhost:3000/api/docs`
Health check: `http://localhost:3000/api/v1/health`

All endpoints are prefixed `/api/v1`.

---

## Running tests

```bash
# all unit tests
npm run test

# with coverage report
npm run test:cov

# specific test file
npx jest --testPathPattern=workflow --verbose
```

### What the tests cover

**State machine (`workflow.service.spec.ts`) — 22 tests**

| Category | Tests |
|---|---|
| Valid transitions | DRAFT→SUBMITTED, SUBMITTED→UNDER_REVIEW, UNDER_REVIEW→INFO_REQUESTED, INFO_REQUESTED→RESUBMITTED, RESUBMITTED→UNDER_REVIEW, UNDER_REVIEW→REVIEW_COMPLETED, REVIEW_COMPLETED→APPROVED, REVIEW_COMPLETED→REJECTED |
| Invalid transitions | Skip-step (DRAFT→UNDER_REVIEW), skip-review (SUBMITTED→APPROVED), missing rejection reason |
| Application not found | NotFoundException on unknown ID |
| Terminal state immutability | APPROVED and REJECTED cannot transition to any state |
| Role authorization | APPLICANT blocked from reviewer actions, REVIEWER blocked from final decision, APPROVER blocked from starting review, APPLICANT blocked from completing review |
| Separation of duties | Reviewer cannot approve their own reviewed application |
| Concurrent access | Optimistic lock — second concurrent transition on same version returns ConflictException (409) |

**What would be added with more time:**

- Integration tests for every HTTP endpoint (auth, applications, documents, audit) using a test database
- File upload tests: reject files > 5 MB, accept valid files, verify metadata persisted
- Audit log immutability test: assert no UPDATE/DELETE is possible on `audit_logs` via DB trigger
- End-to-end workflow test: full application lifecycle from DRAFT to APPROVED in one test
- Role boundary tests at HTTP layer: assert 403 returned when wrong role calls protected endpoint

---

## API reference

Full interactive documentation at `/api/docs` (Swagger UI) once the server is running.

### Authentication

```
POST /api/v1/auth/login          — returns JWT access token
GET  /api/v1/auth/me             — returns current user profile
```

All other endpoints require `Authorization: Bearer <token>`.

### Applications

```
POST   /api/v1/applications                         — create (APPLICANT)
GET    /api/v1/applications                         — list, role-filtered, paginated
GET    /api/v1/applications/:id                     — get detail with documents
POST   /api/v1/applications/:id/submit              — DRAFT → SUBMITTED (APPLICANT)
POST   /api/v1/applications/:id/review/start        — SUBMITTED → UNDER_REVIEW (REVIEWER)
POST   /api/v1/applications/:id/review/request-info — UNDER_REVIEW → INFO_REQUESTED (REVIEWER)
POST   /api/v1/applications/:id/resubmit            — INFO_REQUESTED → RESUBMITTED (APPLICANT)
POST   /api/v1/applications/:id/review/complete     — UNDER_REVIEW → REVIEW_COMPLETED (REVIEWER)
POST   /api/v1/applications/:id/decision            — REVIEW_COMPLETED → APPROVED|REJECTED (APPROVER)
```

`POST /decision` body:
```json
{ "decision": "APPROVED" }
{ "decision": "REJECTED", "rejectionReason": "Insufficient capital reserve." }
```

### Documents

```
POST /api/v1/applications/:id/documents                    — upload file (APPLICANT, multipart/form-data, max 5 MB)
GET  /api/v1/applications/:id/documents                    — list all versions
GET  /api/v1/applications/:id/documents/:docId             — get metadata
GET  /api/v1/applications/:id/documents/:docId/download    — download file
```

### Audit log

```
GET /api/v1/applications/:id/audit-log    — audit trail for one application (all roles, access-controlled)
GET /api/v1/audit-log                     — global audit log (REVIEWER / APPROVER / ADMIN)
GET /api/v1/audit-log/verify              — verify tamper-evident audit hash chain
```

### Users (ADMIN only)

```
GET   /api/v1/users        — list all users
POST  /api/v1/users        — create user
GET   /api/v1/users/:id    — get user
PATCH /api/v1/users/:id    — update role
```

### Error format

All errors return:

```json
{
  "code": "FORBIDDEN",
  "message": "Reviewer cannot be the final approver for the same application",
  "traceId": "uuid",
  "path": "/api/v1/applications/xyz/decision",
  "timestamp": "2026-05-10T15:00:00.000Z"
}
```

- Protected endpoint without valid credentials: `403`
- Forbidden (wrong role, ownership violation, separation-of-duties): `403`
- Not found: `404`
- Illegal state transition / concurrency conflict: `409`
- No stack traces in any response.

---

## Design decisions

### Authentication: JWT (stateless)

Chosen over sessions for this context: no session store needed, works cleanly with the React SPA frontend, role is embedded in the token payload and re-validated on every request by `JwtStrategy`. Trade-off: token cannot be revoked before expiry. For production, add a token blocklist (Redis) or short expiry with refresh tokens.

### Role model

| Role | Can do | Cannot do |
|---|---|---|
| APPLICANT | Create, submit, resubmit applications; upload documents | Review or approve any application |
| REVIEWER | Start review, request info, complete review | Make final approval/rejection decision |
| APPROVER | Approve or reject applications at REVIEW_COMPLETED | Perform review steps |
| ADMIN | Manage users, read all audit logs | Modify or delete audit records |

Role enforcement lives exclusively in the backend (`RolesGuard` + resource-level checks in services). Frontend role-gating is cosmetic only.

### Separation of duties

The hard rule — reviewer cannot approve their own reviewed application — is enforced in `WorkflowService.assertBusinessRules()`. When transitioning to APPROVED or REJECTED, the service checks `application.reviewedById === input.actorUserId` and throws `ForbiddenException` if true. This cannot be bypassed via the API.

### State machine

```
DRAFT → SUBMITTED → UNDER_REVIEW ⇄ INFO_REQUESTED → RESUBMITTED → UNDER_REVIEW
                                ↓
                        REVIEW_COMPLETED → APPROVED (terminal)
                                        → REJECTED  (terminal)
```

All transition logic is centralised in `WorkflowService`. Illegal transitions throw `ConflictException` at the service layer before touching the database. Terminal states (`APPROVED`, `REJECTED`) are checked first; no transition out of either is permitted under any circumstance.

### Concurrency (optimistic locking)

`applications.version` is an integer that increments on every state change. The update query is:

```sql
UPDATE applications
SET status = $newStatus, version = version + 1, ...
WHERE id = $id AND version = $expectedVersion AND status = $expectedStatus
```

If `rowsAffected = 0`, another request won the race and the current request throws `ConflictException(409)`. Both the transition and the audit log insert happen inside a single `prisma.$transaction`, ensuring they are atomic.

### Audit trail (append-only and tamper-evident)

- No `UPDATE` or `DELETE` endpoint is exposed for `audit_logs`.
- The audit record is created inside the same DB transaction as the state change — they either both commit or both roll back.
- Each entry captures: actor, action, `beforeStatus`, `afterStatus`, timestamp, requestId, IP address, user agent.
- A database trigger rejects `UPDATE` and `DELETE` against `AuditLog`, including accidental writes by the application user.
- Each entry stores `sequence`, `previousHash`, `canonicalPayload`, and `recordHash`, where `recordHash = SHA-256(previousHash + canonicalPayload)`.
- Audit writes lock the table while assigning the next `sequence`, so concurrent requests cannot choose the same chain head.
- `GET /api/v1/audit-log/verify` replays the chain and reports the first broken sequence if any row has been changed, removed, or reordered.
- If local rows were created before the chain fields were populated correctly, run `npm run audit:repair-chain` once to rebuild the chain in chronological order.
- For production legal defensibility: also revoke `UPDATE` and `DELETE` on the `AuditLog` table from the application DB user and replicate audit rows to immutable storage.

### Document versioning

Files are stored at `storage/apps/{applicationId}/v{applicationVersion}/{timestamp}_{filename}`. Each upload creates a row in `application_files` with `applicationVersion` stamped. When an applicant resubmits from `INFO_REQUESTED`, the application version increments, and new uploads go to the new version path. Previous version files and metadata rows are never deleted.

Each document row also stores a SHA-256 fingerprint. The upload audit metadata includes the same fingerprint, and downloads verify the stored file still matches the saved hash before streaming.

### Risk scoring

Applications carry `riskScore`, `riskLevel`, and `riskReasons`. The score is recalculated after creation, document upload, and workflow transitions. Current factors are missing documents, resubmissions, prior rejection history, high-impact license type, and pending age. Reviewer list endpoints sort by risk score first, then age.

---

## Project structure

```
src/
├── applications/          — CRUD + all workflow transition endpoints
│   └── dto/
├── audit/                 — append-only audit log queries
│   └── dto/
├── auth/                  — JWT login, guards, decorators, strategies
│   ├── decorators/
│   ├── dto/
│   ├── guards/
│   ├── interfaces/
│   └── strategies/
├── common/
│   ├── enums/             — UserRole enum
│   ├── filters/           — global exception filter (no stack traces)
│   └── interceptors/      — request-id propagation
├── documents/             — file upload, versioning, download
├── prisma/                — PrismaService (global)
├── users/                 — admin user management
│   └── dto/
└── workflow/              — state machine (WorkflowService) + unit tests

prisma/
├── schema.prisma          — DB schema
├── seed.ts                — seed script (4 users, 2 applications)
└── migrations/            — migration history
```

---

## Environment variables reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Token signing secret; startup fails if missing or set to the old default placeholder |
| `JWT_EXPIRES_IN_SECONDS` | No | `3600` | Token lifetime in seconds |
| `PORT` | No | `3000` | HTTP port |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed CORS origin |
