# Security

## Authentication

- JWT bearer authentication.
- Passwords are hashed with bcrypt.
- Startup fails outside tests if `JWT_SECRET` is missing or left as the placeholder.
- Auth and role failures return `403` to match the assignment requirement.

## Role-Based Access Control

Role enforcement is layered:

1. **Endpoint-level** — `RolesGuard` checks the user's role against `@Roles(...)` metadata on each controller method.
2. **Service-level** — ownership and assigned-reviewer checks on the resource.
3. **Workflow-level** — the state machine rejects role/context combinations that should never happen.

The frontend hides actions for unauthorized roles, but the backend remains the single source of truth.

| Role | Can do | Cannot do |
|---|---|---|
| `APPLICANT` | Create, submit, resubmit own applications; upload documents; view own audit trail | Review or approve applications |
| `REVIEWER` | Pick applications, request info, complete reviews with recommendations, view final outcomes | Make final decisions |
| `APPROVER` | Approve or reject `REVIEW_COMPLETED` applications | Review applications or decide an application they reviewed |
| `ADMIN` | Manage users and read audit data | Modify audit records |

## Four-Eyes Principle

The user who reviewed an application cannot be the final decision maker for that same application. The rule applies to both approval and rejection. Final-decision audit metadata records reviewer id, decision-maker id, and the governance check result.

Implementation lives in `WorkflowService.assertFourEyesPrinciple`. See [Compliance Features](./compliance.md#four-eyes-principle) for the audit-metadata details.

## Audit Integrity

- A PostgreSQL trigger rejects `UPDATE` and `DELETE` on `AuditLog`.
- Each row is part of a SHA-256 hash chain.
- The chain is verifiable via `GET /api/v1/audit-log/verify`.

Chain mechanics, sequence locking, and the one-time repair command are documented in [Compliance Features](./compliance.md#tamper-evident-audit-chain).

## Document Integrity

- Uploads are capped at 5 MB server-side.
- Allowed types: PDF, Word, Excel, JPEG, PNG.
- Each upload stores a SHA-256 fingerprint.
- Downloads re-check the file bytes against the stored fingerprint before streaming.

## API Hardening

- Global DTO validation rejects unknown fields.
- Errors use a structured envelope with no stack traces.
- Helmet is enabled.
- Login is throttled.
- CORS defaults to the frontend dev origin and is configurable via `CORS_ORIGIN`.

## Known Production Follow-Ups

- Refresh-token rotation and revocation.
- Object storage (with signed download URLs) instead of local file storage.
- Malware scanning for uploads.
- Replicate audit rows to immutable storage.
- Stricter database role permissions in addition to application-level controls.
