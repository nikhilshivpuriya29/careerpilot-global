# Security Verification Checklist

Use this checklist for every meaningful release. Mark an item complete only after a reproducible test or platform setting has been inspected.

- [ ] Secret scan passes; no keys, tokens, private keys, candidate resumes, or production data in Git.
- [ ] Any secret ever committed has been revoked/rotated; Git history purge is performed if needed.
- [ ] Browser bundles expose no service-role/admin keys or private credentials.
- [ ] Row-level security/ownership is tested with two accounts for SELECT, INSERT, UPDATE, DELETE, joins, and indirect IDs.
- [ ] Every private API route enforces server-side authentication.
- [ ] Ownership comes from authenticated server identity, never request body.
- [ ] Mutable fields are allowlisted; unexpected fields are rejected or ignored safely.
- [ ] SQL is parameterized.
- [ ] User/job content is escaped; no unsafe HTML insertion.
- [ ] Uploads are disabled until file type, size, scanning, and storage access controls are verified.
- [ ] Sensitive data encryption at rest and in transit is verified with platform documentation/settings.
- [ ] Session cookies have appropriate Secure, HttpOnly, and SameSite behavior.
- [ ] Login and expensive endpoints have tested rate limits and bot protection.
- [ ] Security headers and Content Security Policy are reviewed.
- [ ] API responses are minimized and do not expose credentials or other users' data.
- [ ] HTTPS and redirect behavior are verified.
- [ ] Secret scanning and dependency auditing run in CI.
- [ ] Authentication, authorization, input validation, and failure-path tests pass before deployment.
- [ ] Submission integrations comply with each provider's documented terms and have idempotency/retry tests.

Current status: **in progress**. The list above is not a claim that all items are already satisfied.
