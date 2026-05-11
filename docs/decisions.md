# Technical Decisions

The most important implementation decisions and their trade-offs.

## JWT Over Server Sessions

The frontend is a standalone React SPA and the challenge does not require session revocation infrastructure. JWT keeps the API stateless and the local setup simple.

**Trade-off**: production should add short-lived access tokens, refresh-token rotation, and revocation (token blocklist or DB-backed sessions).

## Backend-Owned Authorization

The frontend hides unauthorized actions, but the backend is the single source of truth. Ownership, role, workflow, and Four-Eyes checks live close to the data mutations because users can bypass the UI.

## Explicit Workflow State Machine

Application status changes are centralized in `WorkflowService`. Illegal transitions are rejected consistently, terminal decisions are permanent, and optimistic locking applies in one place. Tests can focus on the highest-risk business rules.

## Optimistic Locking For Concurrency

Application updates use `id`, current `status`, and current `version` in the `WHERE` clause. The losing request receives `409 Conflict` and can refresh.

**Why**: avoids heavy database locks while cleanly detecting two users acting on the same application.

## Four-Eyes Principle

The original requirement says reviewer and approver cannot be the same person. The project formalizes it as the banking Four-Eyes Principle. It applies to both approval and rejection, and audit metadata makes the governance check visible.

## Tamper-Evident Audit Chain

Audit rows are append-only and chained with SHA-256 hashes:

- An append-only trigger prevents normal mutation.
- The hash chain makes out-of-band mutation detectable.
- A verification endpoint gives reviewers a direct integrity check.

**Trade-off**: tamper-evident, not tamper-proof. Production should replicate audit rows to immutable storage and restrict database permissions further.

## Simulated Local Document Storage

Files are stored on local disk while metadata lives in PostgreSQL.

**Why**: the assignment asks to simulate file storage without cloud integration. Versioned paths keep prior submissions available, and SHA-256 fingerprints provide evidence integrity despite local storage.

**Production follow-up**: object storage, signed URLs, malware scanning, retention policies.

## Deterministic Risk Scoring

Risk scoring is rule-based and explainable rather than ML-based:

- Regulators need explainable prioritization.
- Deterministic scoring is easy to test.
- Risk reasons can be shown directly to reviewers.

Current factors: missing documents, resubmissions, prior rejection history, high-impact license type, pending age.

## Swagger Plus Markdown Docs

Swagger documents the live API; Markdown docs in `docs/` explain architecture, trade-offs, and compliance posture. Reviewers can run the API and read design rationale without starting the server.
