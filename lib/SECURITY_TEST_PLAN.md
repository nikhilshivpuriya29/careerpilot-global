# CareerPilot — Automation Security & Quality Gate

## Engineering rule
Every new automation capability must include deterministic unit tests, positive and negative integration tests, and a hacker-minded review before production enablement. A successful deploy is not a successful security audit.

## External repository research
- ai-job-search-dev/ai-job-search (MIT per repository page): job ranking, fact-grounded resume/cover-letter generation, drafter/reviewer, ATS checks and interview tracking. Review individual files before copying.
- torontodeveloper/job-application-agent: managed browser form mapping and queue recovery, with human review before submit. Do not bypass CAPTCHAs or site restrictions.
- ShipItAndPray/job-apply-ai: job ingestion/filtering and browser-assisted ATS form completion with human review.

## Implemented in this iteration
- Pure helper lib/application-automation.js: provider allowlisting, HTTPS/host validation, bounded field summaries, upload/CAPTCHA detection, deterministic unit tests.
- Authenticated POST /api/applications/inspect-form: verifies application ownership, only navigates to allowlisted ATS hosts, inspects form metadata, and never submits or changes an application.
- Admin-only GET /api/quality/self-test: executes deterministic guardrail and field-mapping safety tests.
- Authenticated POST /api/applications/map-fields: checks application ownership and the saved profile, returns bounded field suggestions only, and never fills the remote form or submits an application. Sensitive/legal questions, CAPTCHA, consent controls and file uploads remain manual.
- Per-user minute-window rate limits on expensive ATS inspection, field mapping, AI package/review/submission actions, document uploads and manual job-discovery triggers. Email sign-in abuse protections are platform-owned and require separate platform verification.
- AI-provider configuration failures are classified by a tested helper. Scheduled scoring now returns an explicit `503 needs_ai_configuration` instead of a misleading successful run when the provider key is missing; it does not log candidate data.
- LinkedIn source: automated LinkedIn scraping is now disabled at the UI and API layers. Search/detail endpoints return `410 disabled_by_safety_policy` without contacting LinkedIn; the per-user preference endpoint rejects attempts to enable scraping, and the admin control endpoint cannot re-enable it. The UI presents an explicit account-restriction warning and decision button, but that choice only continues into manual/import-only mode. No password, cookie, session, browser profile, CAPTCHA bypass, proxy rotation or retry-after-denial is used. This is a risk-reduction measure, not a guarantee that an account cannot be restricted.
- `lib/linkedin-policy.js` contains a fail-closed policy and ten deterministic tests covering default-off, no authenticated scraping, no browser automation, no CAPTCHA bypass, no proxy rotation, no retry after access denial, and rejection of any scraper-enable choice.
- Private manual LinkedIn intake accepts only HTTPS individual LinkedIn job pages, does not fetch them, strips tracking query parameters, enforces input size/type limits, and stores records under per-user ownership. Users can link those records to their application tracker.
- Private manual LinkedIn intake accepts only HTTPS individual LinkedIn job pages, does not fetch them, strips tracking query parameters, enforces input size/type limits, and stores records under per-user ownership. Users can link those records to their application tracker.

## Submission adapter status
- `api/applications/submit.js` intentionally has no live adapters. It performs a fresh server-side package review, requires explicit approval, and records `needs_manual_action` instead of claiming a submission.
- Greenhouse's official Job Board API requires an employer-specific API key for its POST application endpoint; the key must be kept server-side. Greenhouse Harvest is an employer recruiting integration, not a universal candidate-side submission API. See [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html) and [Harvest API overview](https://support.greenhouse.io/hc/en-us/articles/360029266032-Harvest-API-overview).
- CareerPilot cannot submit to arbitrary employers' boards without employer-authorized credentials or a supported candidate-side workflow. The current managed browser session also closes after each request and has no supported file-input upload method. Do not enable a pretend generic adapter; keep manual handoff until a legitimate provider integration and sandbox test exist.

## Required gates before automatic submission
1. Source/license review and dependency audit for every borrowed component.
2. Two-account tests proving no cross-user profile/application/match/review access.
3. Browser URL SSRF tests: private IPs, localhost, unusual ports, embedded credentials, redirects to untrusted hosts, DNS rebinding and redirect chains.
4. Provider sandbox/test forms and controlled fixtures.
5. Idempotency and concurrency tests: duplicate clicks, retries after timeout, crash recovery, one submission per user/provider/job.
6. Evidence capture: provider, final destination, application reference, timestamp, confirmation evidence, and redacted screenshot where permitted.
7. No CAPTCHA solving, access-control bypass, proxy rotation or evasion. If blocked or challenged by CAPTCHA/MFA, pause for user action.
8. File uploads require a vetted platform capability and private storage. Until verified, required attachments are a manual-action gate.
9. Unknown screening questions, work authorization, salary, relocation and sponsorship must never be guessed.
10. Per-user rate limits, daily caps, circuit breakers, retry budgets, and a kill switch before unattended runs.
11. Minimize API responses and logs; never log credentials, cookies, prompts or full resumes.
12. CI must run unit tests, secret scanning, dependency audit with a lockfile, and integration/security tests before merge.

## Known limitations
- Form inspection is not form filling or submission.
- Source resume files can be stored privately as PDF, DOCX or TXT with ownership-checked download links; automatic text extraction and ATS upload are not implemented yet.
- ATS inspection now uses an allowlisted host plus provider-specific job-path validation, a redirect-manual preflight, and a post-navigation final-host check. The browser API still does not expose request interception, so a redirect/DNS time-of-check race is not fully eliminated; do not treat this as a complete SSRF guarantee or enable unattended ATS navigation until platform-level network/redirect controls exist.
- Alpine.js and Tailwind browser CDN scripts are vendored at pinned versions under `public/vendor/` to avoid runtime dependency on third-party script CDNs.
- Only allowlisted public ATS hosts are inspected.
- Browser file-upload support remains unverified.
- Platform cookie, encryption-at-rest, RLS and rate-limit guarantees need separate verification.