# Compliance Features

This project includes compliance-oriented features designed for a regulated licensing workflow.

## Tamper-Evident Audit Chain

Every workflow transition and document upload appends an audit event. Each event stores:

- `sequence`
- `previousHash`
- `canonicalPayload`
- `recordHash`

Hash formula:

```text
recordHash = SHA-256(previousHash + canonicalAuditPayload)
```

The first entry uses a fixed genesis hash. Every later row depends on the previous row. If a row is changed, removed, or reordered, verification fails. The writer locks the audit table while assigning the next sequence so concurrent audit writes cannot choose the same chain head.

Verification endpoint:

```text
GET /api/v1/audit-log/verify
```

The audit table is also protected by a database trigger that rejects `UPDATE` and `DELETE`.

If a local database already had audit rows before the hash-chain fields were introduced, run this one-time repair command from the backend directory to rebuild `sequence`, `previousHash`, `canonicalPayload`, and `recordHash` in chronological order:

```bash
npm run audit:repair-chain
```

## Four-Eyes Principle

The system formalizes the banking Four-Eyes Principle:

> The officer who reviews an application cannot be the same officer who makes the final decision.

The rule applies to both approval and rejection.

When a final decision is made, the audit metadata records:

- Reviewer user id.
- Decision-maker user id.
- Four-Eyes check result.

This makes the governance control visible in the audit trail.

## Document Fingerprinting

Each uploaded document receives a SHA-256 fingerprint computed from the uploaded bytes.

Stored metadata includes:

- `sha256Hash`
- `hashAlgorithm`
- File name, MIME type, file size, uploader, and application version.

The document upload audit event also includes the SHA-256 hash. Downloads re-check the file bytes against the stored hash before streaming.

Why this matters:

- Reviewers can cite a specific evidence fingerprint.
- If a stored file is changed outside the app, the mismatch is detected.
- The audit log links each upload event to the exact evidence hash.

## Risk Scoring

The backend calculates an explainable compliance risk score.

| Factor | Score |
|---|---:|
| Missing supporting documents | +20 |
| Resubmissions | +15 each, capped at +30 |
| Prior rejection history for applicant or institution | +30 |
| High-impact license type | +10 |
| Pending over 7 days | +10 |
| Pending over 14 days | +25 |

Risk levels:

| Score | Level |
|---:|---|
| 0-30 | `LOW` |
| 31-70 | `MEDIUM` |
| 71-100 | `HIGH` |

Risk is recalculated after:

- Application creation.
- Document upload.
- Workflow transitions.

Reviewer queues sort higher-risk applications first, then older applications.

## Evidence Posture

Together, these controls support a regulator-friendly evidence story:

- Audit records are append-only and tamper-evident.
- Final decisions require independent review and approval.
- Supporting documents have cryptographic fingerprints.
- Reviewer prioritization is explainable and deterministic.
