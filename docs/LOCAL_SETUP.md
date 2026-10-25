# Local Development and Self-Hosting Guide

> **Important platform limitation:** CareerPilot currently targets Hatchable's server runtime and its `hatchable` SDK. It is **not yet a generic Node.js/Express application**. A checkout can be inspected and edited on any OS, but running the full app outside Hatchable requires replacing/adapting platform-specific auth, database, AI, secret/config, and scheduled-job APIs. Do not assume `npm install && npm start` works.

## 1. What you need

- Git
- A current Node.js LTS release (for editing, linting or any future compatibility port)
- A GitHub account and access to this repository
- For a real deployment: a Hatchable account/project with database and auth enabled
- Optional integration credentials: Adzuna App ID and App Key
- AI provider configured in Hatchable AI settings (the project declares Anthropic)

Do not put secrets in source files, frontend JavaScript, commits, screenshots, issue reports or logs.

## 2. Get the code

### macOS, Linux, Windows PowerShell, or Windows Terminal

Install Git for your OS, then run:

```sh
git clone https://github.com/nikhilshivpuriya29/careerpilot-global.git
cd careerpilot-global
git switch main
git pull --ff-only
```

To inspect the feature branch while it is under review:

```sh
git fetch origin
git switch feat/ultra-linkedin-scraper
git pull --ff-only origin feat/ultra-linkedin-scraper
```

On Windows, these commands work in PowerShell when Git is installed. Git Bash can also be used. If `git switch` is unavailable, update Git or use `git checkout` with the branch name.

## 3. Inspect before running

This project is built for Hatchable, not a conventional Node server. Check the repository's `hatchable.toml`, route files under `api/`, static assets under `public/`, and schema files under `migrations/`. The `hatchable` package imports and platform route conventions are provided by the host runtime; there may be no `package.json`, Express entry point, local migration runner, or standalone server command.

Useful cross-platform checks:

```sh
git status --short
git log -5 --oneline
git diff main...HEAD --stat
git grep -n -E 'API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE KEY' -- ':!*.md'
```

The last command is a **manual review aid**, not a secret scanner; review false positives and use a dedicated secret scanner before publishing. Never paste discovered secret values into chat or issues.

## 4. Deploy to your own Hatchable project

1. Sign in to Hatchable and create a separate project for testing. Do not experiment against the production database.
2. Import/connect the GitHub repository using the current Hatchable import workflow, or transfer the reviewed files using Hatchable's supported project workflow. The exact import UI may change; follow Hatchable's current product instructions.
3. Ensure authentication is enabled and the email provider is configured. Confirm the database tables/policies described in `hatchable.toml` are supported by your project.
4. Review and apply the SQL migrations in ascending order using the platform-supported migration mechanism. Do not run them against an existing production database without a backup and a migration plan. Migration 0009 enables the global LinkedIn feature gate, so review it carefully before applying.
5. Configure `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` through Hatchable's secret/configuration UI if Adzuna search is required. Use the AI settings to configure the Anthropic provider. Never add credentials to `public/` or commit them.
6. Configure the scheduled routes declared in `hatchable.toml` if the platform does not import them automatically.
7. Run the platform's dry-run/deploy validation. Resolve all hard errors and investigate warnings; do not treat a successful deployment as a security audit.
8. Deploy to a staging project first. Verify sign-in, profile ownership, job discovery, AI scoring, resume tailoring, document upload/download, application tracking, and scheduled runs using test data.
9. Configure production secrets independently in production. Do not copy a development database, private files, or test users into production.
10. Set visibility deliberately. A private Hatchable project may show a sign-in wall to visitors even if its website URL is known. Public visibility is a separate product setting and should only be enabled after reviewing the data and access model.

## 5. Can it run on another cloud provider?

Not as a verified, one-click deployment today. AWS, Azure, GCP, Fly.io, Render, Railway, Docker and a local Node server do not automatically provide the Hatchable SDK, auth, database APIs, AI provider configuration, scheduled route runtime, or its table access policies. A port would need, at minimum:

- A Node-compatible server/router for every `api/` route and cron job
- Replacements for imports from `hatchable` (database, auth, config/secrets, AI)
- A supported PostgreSQL instance and reviewed migrations/row-level ownership policies
- Secure sessions, authorization and CSRF protection appropriate to the chosen framework
- Secret-manager integration and production TLS
- A scheduler for discovery and scoring jobs
- Object storage and authorization for candidate documents, if supported by the deployment
- Tests for each endpoint and each access tier, plus two-user data-isolation tests
- A staging deployment and backup/restore plan

Do not merely replace the database URL and assume the app is portable. Keep routes private until authentication, ownership, upload/download and secret-handling tests pass.

## 6. Operating-system notes

- **Windows 10/11:** use Git for Windows + PowerShell or Git Bash. Use forward slashes in repository paths. If a shell script is added in future, check CRLF/LF handling and executable bits.
- **macOS:** install Git using Xcode Command Line Tools or a trusted package manager. Keep credentials in the host secret manager/keychain, not shell history.
- **Linux:** install Git from the distribution package manager. Run services as a non-root user if you later port the app. Configure firewall, TLS and log redaction.
- **All OSes:** browser-only Hatchable deployment avoids local server setup, but does not remove the need to configure secrets, database policies, authentication and scheduled jobs.

## 7. Known blockers and status

- **Generic local execution:** unsupported/unverified; platform SDK and runtime dependencies need an adapter/port.
- **Other-cloud deployment:** not a drop-in deploy; see section 5.
- **Adzuna:** requires `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`.
- **AI:** project requires an Anthropic provider through Hatchable AI settings.
- **LinkedIn:** guest search is a separately gated, risk-bearing feature. Verify the exact code and policy in the branch before enabling it; do not use credentials, session cookies, CAPTCHA bypass, stealth or proxy rotation. Stop if LinkedIn blocks requests. Do not assume this feature is authorized by LinkedIn.
- **Application submission:** manual handoff only unless a reviewed, supported adapter is explicitly implemented. Never claim a submission succeeded without verifiable confirmation.
- **Security:** the security plan lists additional integration and ownership tests. A passing smoke test is not a security certification.
- **Current validator warning:** the host's deploy linter reports that `api/applications/prepare.js` queries a missing `linkedin` table. Inspection shows the route joins `linkedin_job_intakes` (the table declared in this project), so this appears to be a substring-based false positive. Confirm against the current host validator/runtime before ignoring it; do not create an unrelated `linkedin` table just to silence the warning.

## 8. Safe contribution workflow

1. Create a branch from the current default branch.
2. Make one logical change at a time.
3. Review `git diff --check` and `git diff`.
4. Run platform dry-run validation and endpoint tests in a non-production project.
5. Search for secrets and private data before committing.
6. Open a pull request with tests, known limitations and migration impact.
7. Merge only after reviewing the diff and confirming no credentials or production data are included.
