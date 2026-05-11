# Bank Licensing & Compliance Portal

A system of record for bank license applications, supporting documents, multi-stage review decisions, and a tamper-evident audit trail. Built for the National Bank of Rwanda compliance scenario.

- **Backend** — NestJS 11 + PostgreSQL + Prisma + JWT (`bnr-bank-licensing-portal-be/`)
- **Frontend** — React 18 + Vite + TanStack Query + Zustand (`bnr-bank-licensing-portal-fe/`)

```mermaid
flowchart LR
  browser[React SPA] -->|JWT Bearer requests| api[NestJS API]
  api --> prisma[Prisma Client]
  prisma --> postgres[(PostgreSQL)]
  api --> storage[Local File Storage]
  api --> swagger[Swagger Docs]
```

---

## What's in the box

- Four roles: `APPLICANT`, `REVIEWER`, `APPROVER`, `ADMIN`.
- Explicit workflow state machine with optimistic locking.
- Four-Eyes Principle: reviewer cannot be the final decision maker.
- Append-only audit log with a SHA-256 tamper-evident hash chain.
- Document upload with SHA-256 fingerprinting and download verification.
- Deterministic, explainable risk scoring (`LOW` / `MEDIUM` / `HIGH`).
- Swagger API documentation at `/api/docs`.

---

## Quick start

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 20 |
| npm | ≥ 9 |
| PostgreSQL | ≥ 14 |

### 1. Backend

```bash
cd bnr-bank-licensing-portal-be
npm install
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/license_portal"
JWT_SECRET="your-long-random-secret-min-32-chars"
```

Create the database, run migrations, seed it, and start the API:

```bash
psql -U postgres -c "CREATE DATABASE license_portal;"
npx prisma migrate dev
npm run seed
npm run start:dev
```

API ready at `http://localhost:3000/api/v1`. Swagger at `http://localhost:3000/api/docs`.

### 2. Frontend

In a second terminal:

```bash
cd bnr-bank-licensing-portal-fe
npm install
cp .env.example .env
```

Default frontend environment:

```env
VITE_API_URL=/api/v1
```

Run the SPA:

```bash
npm run dev
```

Open `http://localhost:5173`.

### 3. Sign in

All seed users use password `Password123!`.

| Role | Email |
|---|---|
| Applicant | `applicant@example.com` |
| Reviewer | `reviewer@bnr.rw` |
| Approver | `approver@bnr.rw` |
| Admin | `admin@bnr.rw` |

---

## Workflow

```mermaid
flowchart LR
  Draft[DRAFT] --> Submitted[SUBMITTED]
  Submitted --> UnderReview[UNDER_REVIEW]
  UnderReview --> InfoRequested[INFO_REQUESTED]
  InfoRequested --> Resubmitted[RESUBMITTED]
  Resubmitted --> UnderReview
  UnderReview --> ReviewCompleted[REVIEW_COMPLETED]
  ReviewCompleted --> Approved[APPROVED]
  ReviewCompleted --> Rejected[REJECTED]
```

`APPROVED` and `REJECTED` are terminal final decisions. The same user cannot act as both reviewer and final approver for an application (Four-Eyes Principle).

---

## Verify the install

```bash
# Backend
cd bnr-bank-licensing-portal-be
npm run test && npm run build && npm run lint

# Frontend
cd ../bnr-bank-licensing-portal-fe
npm run test && npm run build && npm run lint
```

---

## Documentation

| Topic | File |
|---|---|
| Complete design document and requirement coverage | [`docs/design.md`](./docs/design.md) |
| Architecture, data model, workflow, and role boundaries | [`docs/architecture.md`](./docs/architecture.md) |
| Security model | [`docs/security.md`](./docs/security.md) |
| Compliance features (audit chain, risk, fingerprints) | [`docs/compliance.md`](./docs/compliance.md) |
| Technical decisions and trade-offs | [`docs/decisions.md`](./docs/decisions.md) |
| Testing strategy | [`docs/testing.md`](./docs/testing.md) |
