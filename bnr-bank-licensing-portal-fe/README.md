# Bank Licensing & Compliance Portal — Frontend

React web interface for the National Bank of Rwanda licensing portal. It supports applicant submissions, reviewer queues, approver decisions, document upload/download, audit visibility, and admin user management.

Built with React 18, TypeScript, Vite, React Router, TanStack Query, Zustand, React Hook Form, and Zod.

Project-wide documentation lives in [`../docs`](../docs/README.md).

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | >= 20 |
| npm | >= 9 |
| Backend API | running on `http://localhost:3000` |

## Setup

```bash
npm install
cp .env.example .env
```

Environment variables:

```env
VITE_API_URL=/api/v1
```

The default value works with the Vite dev proxy in `vite.config.ts`, which forwards `/api` requests to the backend on port `3000`. If the API is hosted elsewhere, set `VITE_API_URL` to the full URL, for example `http://localhost:3000/api/v1`.

## Run

```bash
npm run dev
```

Open `http://localhost:5173`.

## Seed Logins

After running the backend seed script, all users use password `Password123!`.

| Role | Email |
|---|---|
| Applicant | `applicant@example.com` |
| Reviewer | `reviewer@bnr.rw` |
| Approver | `approver@bnr.rw` |
| Admin | `admin@bnr.rw` |

## User Flows

- Applicant: create an application, upload supporting documents, submit, respond to information requests, export application reports, and view audit history.
- Reviewer: pick up submitted or resubmitted applications prioritized by risk, request additional information, complete reviews, export queue reports, and see final outcomes for reviewed applications.
- Approver: view review-completed applications, export pending/history reports, and make final approve/reject decisions, excluding applications reviewed by the same user.
- Admin: manage users and configure local license-type labels.

The UI hides actions a role cannot perform, but backend authorization remains the source of truth.

## Compliance Features

- Risk score and risk level are visible in reviewer queues and application details.
- Application tables can export the current filtered and sorted rows as CSV, Excel, or PDF reports.
- Uploaded documents show a shortened SHA-256 fingerprint, with the full hash available in the tooltip.
- Audit entries show ledger sequence and hash information where available.
- Rejected applications remain visible to reviewers in the final decisions tab with the approver's rejection reason.

## Scripts

```bash
npm run dev       # development server
npm run build     # type-check and production build
npm run lint      # eslint
npm run test      # frontend unit tests
```

## Notes

See [`../docs/architecture.md`](../docs/architecture.md) and the rest of [`../docs`](../docs/README.md) for architecture, role boundaries, workflow state machine, audit strategy, and requirement coverage.
