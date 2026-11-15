# Local Runtime v1 — current delivery and boundaries

This milestone adds a repeatable local development/test foundation. It does **not** yet claim that the complete Hatchable application can run outside Hatchable.

## Delivered in this branch

- Node.js 22+ test harness using the built-in Node test runner; no app dependency bundle is needed for the pure domain tests.
- Cross-platform GitHub Actions matrix for Ubuntu, Windows and macOS.
- Disposable PostgreSQL 16 Docker Compose service, bound to localhost only, with a health check and persistent named volume.
- PostgreSQL RLS contract test using two synthetic users. It checks read isolation, prevents cross-user updates, and rejects forged owner IDs.
- Unit tests covering ATS URL allowlists, safe field mapping, explicit field approvals, stale form identity, AI configuration fail-closed behaviour, integration readiness and rate-limit rules.

## Run the local checks

Requirements: Git, Node.js 22+, Docker Desktop (Windows/macOS) or Docker Engine + Compose plugin (Linux).

1. Clone the repository and switch to this branch.
2. Copy '.env.example' to '.env' and replace 'POSTGRES_PASSWORD' with a long random local-only password.
3. Run 'npm test' to execute the portable domain/security tests.
4. Run 'docker compose up -d db' and wait until 'docker compose ps' reports the database healthy.
5. Run 'npm run test:isolation' to execute the disposable two-user PostgreSQL RLS fixture.
6. Stop the database with 'docker compose down'. Use 'docker compose down -v' only when the disposable local database contents should be permanently removed.

PowerShell:

```powershell
Copy-Item .env.example .env
npm test
docker compose up -d db
docker compose ps
npm run test:isolation
docker compose down
```

macOS/Linux:

```sh
cp .env.example .env
# Edit .env and set a strong local-only POSTGRES_PASSWORD
npm test
docker compose up -d db
docker compose ps
npm run test:isolation
docker compose down
```

## Important limitations

- The full API still imports the Hatchable 'hatchable' SDK and depends on Hatchable route dispatch, managed auth, database context, AI provider routing, secrets/config, storage, browser automation and cron. This branch does not silently replace those services with insecure stubs.
- Docker Compose currently provisions the local PostgreSQL test database; it is **not** a one-command launch of the full CareerPilot web application.
- The RLS SQL test proves PostgreSQL's policy mechanism on an isolated fixture. It is not proof that Hatchable's managed auth policies or every existing application query are correctly isolated. A full two-account endpoint test against a portable runtime remains required.
- Real AI calls need a provider key. Never add it to '.env.example', Git, browser code, or CI logs.
- Production data and candidate resumes must never be copied into this local test database.

## Next adapter work required for a full self-hosted runtime

1. Replace Hatchable's router/handler contract with a supported Node server adapter without changing business logic.
2. Implement secure session creation, cookie rotation, CSRF protections, logout/revocation and per-user authorization.
3. Map all existing 'db.query' operations to PostgreSQL with transaction and request-scoped identity context; apply real RLS policies to candidate-owned tables.
4. Provide secret-manager/config and AI provider adapters; keep all keys server-side.
5. Replace managed storage and browser services with explicitly configured object storage and Playwright/Chromium services, including SSRF controls.
6. Port scheduled discovery/scoring to a durable scheduler/queue with idempotency and bounded retries.
7. Run endpoint-level two-user tests across SELECT/INSERT/UPDATE/DELETE, joins, indirect IDs, downloads and background jobs before any self-hosted deployment is considered production-ready.

## ATS and job-source scope

- The new application executor is Greenhouse-only and fills only selected, server-derived, non-sensitive profile fields after a fresh independent review and explicit user approval.
- Uploads, CAPTCHA, legal/work-authorization, sponsorship, salary, demographic and consent answers, and final submission remain human-controlled.
- Lever, Ashby and Workable currently have URL classification/inspection foundations only; they are not enabled for automatic field filling or submission.
- Adzuna discovery now spans 18 countries; FreeHire currently spans ten. Further job-board integrations remain separate source-adapter tasks. Sponsorship signals retain an excerpt, source URL, provider and check timestamp. An explicit listing claim is marked as unverified listing evidence, not an independently verified visa guarantee; generic sponsorship/relocation wording stays possible and unclear/negative wording stays unknown.
