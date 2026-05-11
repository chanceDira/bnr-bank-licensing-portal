# Testing

## Backend

Run:

```bash
cd bnr-bank-licensing-portal-be
npm run test
npm run test:e2e
npm run build
npm run lint
```

For Coverage Report:
```bash
cd bnr-bank-licensing-portal-be
npm run test:cov
```

Covered areas:

- Workflow state-machine valid transitions.
- Workflow invalid transitions.
- Terminal state immutability.
- Role authorization boundaries.
- Four-Eyes Principle for approval and rejection.
- Optimistic concurrency conflict handling.
- Document upload validation.
- Document SHA-256 persistence and audit metadata.
- Audit-chain genesis and broken-chain detection.
- Risk scoring low/high scenarios and capped factors.
- Protected route behavior at HTTP level.

## Frontend

Run:

```bash
cd bnr-bank-licensing-portal-fe
npm run test
npm run build
npm run lint
```

Covered areas:

- Workflow action visibility by role and status.
- Reviewer completion recommendation modal.
- Risk badge rendering.
- Document fingerprint rendering.

## Manual Smoke Test

1. Start backend and frontend.
2. Log in as applicant.
3. Create an application.
4. Upload a document and confirm the fingerprint appears.
5. Submit the application.
6. Log in as reviewer.
7. Start review, add a recommendation, and complete review.
8. Log in as approver.
9. Confirm reviewer recommendation and risk are visible.
10. Approve or reject the application.
11. Log in as reviewer and confirm the final decision appears.
12. Verify the audit chain via `GET /api/v1/audit-log/verify`.

## Remaining Production Test Ideas

- Database-backed integration tests for the audit trigger.
- Full lifecycle E2E test through a browser.
- File tampering simulation against downloaded files.
- Performance tests for large audit chains.
- Accessibility tests for role-specific screens.
