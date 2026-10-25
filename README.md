# CareerPilot — Global Salesforce Jobs

CareerPilot is an AI-assisted global job-search workflow for discovering role-relevant vacancies, evaluating fit, preparing fact-grounded application packages, independently reviewing drafts, and tracking applications.

**Live app:** https://careerpilot-global.hatchable.site

## Current capabilities

- Scheduled job discovery through FreeHire and optional Adzuna credentials.
- Global Salesforce-related role searches across India, Australia, Canada, the United Kingdom, Netherlands, Ireland, Germany, New Zealand, the United States, and Singapore.
- Source-linked listings with preliminary salary and visa-evidence signals. These signals are not guarantees; verify directly with employers and official immigration sources.
- AI match scoring and application package preparation from a candidate-provided source resume.
- Independent review for unsupported claims, ATS readability, and job alignment.
- Application tracking and an audit trail for attempted submissions.
- Submission safeguards: no provider-specific adapter is enabled by default; an application is never reported as submitted unless a verified integration actually submits it.

## Repository contents

- `api/`: server-side routes and scheduled discovery jobs.
- `public/`: frontend assets.
- `migrations/`: database schema migrations.
- `hatchable.toml`: authentication, ownership policies, server-side secret names, and scheduled jobs.

This code targets Hatchable's runtime and is not a generic standalone Node.js app. Deploy through the associated Hatchable project.

## Configuration

Add credentials through the hosting platform's secret/configuration UI only:

- `ADZUNA_APP_ID`
- `ADZUNA_APP_KEY`

Never commit real credentials, candidate resumes, application data, production database URLs, cookies, or tokens. `.env.example` contains placeholder names only.

## Security

Read [SECURITY.md](SECURITY.md) before contributing. Security features are a work in progress and this repository does not claim a completed independent security audit. In particular, verify row-level isolation across two test accounts, session-cookie settings, encryption guarantees, upload restrictions, rate limits, security headers, and production dependency scanning before treating this as production-hardened.

## Responsible use

- Respect job-board terms, robots policies, and provider APIs.
- Do not automate a site's application process unless the integration is permitted and tested.
- Never fabricate skills, experience, education, work authorization, or sponsorship.
- Review every application package before submitting it.


## Guides

- [Complete user guide](docs/USER_GUIDE.md) — app navigation, job discovery, fit scores, LinkedIn options, resume tailoring, application tracking, integrations, privacy, and troubleshooting.
- [Local setup and self-hosting guide](docs/LOCAL_SETUP.md) — clone instructions for Windows, macOS and Linux; Hatchable deployment steps; required configuration; portability blockers for other cloud providers.

## Deployment and portability notes

The current application targets Hatchable's runtime and SDK. It is not yet a generic Node.js app that can be run with `npm start` or deployed unchanged to AWS, Azure, GCP, Docker, or another host. The guides describe the exact boundary and the work needed to port it. Do not assume a local standalone run is supported until a platform adapter and its tests exist.

The LinkedIn public guest-search modes are gated and can be disabled by user preferences or the global control. They may be subject to third-party platform terms and blocking; manual job intake remains an alternative. Application submission defaults to manual handoff unless a reviewed integration verifies submission.
