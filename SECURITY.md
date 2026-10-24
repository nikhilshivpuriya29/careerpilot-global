# Security Policy

CareerPilot handles candidate resumes and job-application information. Treat all candidate data as sensitive.

## Required baseline

- Keep API keys, OAuth tokens, database credentials, and signing secrets in the hosting platform's secret manager.
- Never commit credentials, real resumes, production exports, cookies, session tokens, or personal application data.
- Do not put service-role or database-admin keys in browser code. Expose only a restricted public/anonymous key if the selected backend architecture requires one, and only with row-level security enabled.
- Enforce authentication server-side for every private route.
- Derive the user identity from the authenticated server session; never trust a client-supplied owner ID.
- Enforce record ownership on reads, updates, deletes, joins, and background tasks.
- Allowlist mutable fields, validate types and lengths, parameterize SQL, and validate URL schemes.
- Escape user-controlled content at rendering boundaries; avoid unsafe HTML insertion.
- Restrict upload types, size, content inspection, and storage permissions before enabling file uploads.
- Minimize API responses and avoid returning secrets or unnecessary candidate data.
- Require HTTPS and secure session-cookie attributes; review CSP and other security headers.
- Apply rate limiting and bot protection to authentication and abuse-prone endpoints.
- Encrypt sensitive data in transit and at rest; add application-level encryption when the threat model requires it.
- Run dependency, secret, and static-analysis checks in CI. Rotate and purge any exposed secret from Git history; deleting a file in a later commit does not invalidate an exposed credential.
- Verify row-level isolation using separate test users before production use.

## Current limitations

The project uses Hatchable's managed authentication and database runtime. Some controls depend on platform-level settings and must be verified in the Hatchable console. This repository's automated checks are useful guardrails, not proof of a full security audit.

Automated application submission is disabled unless a provider-specific adapter is explicitly implemented, permitted by that provider, and tested. Never represent a prepared package as a submitted application.

## Reporting

For a vulnerability, do not publish exploit details, real candidate data, or secrets in a public issue. Contact the repository owner privately and include the affected route/file, impact, and safe reproduction steps.
