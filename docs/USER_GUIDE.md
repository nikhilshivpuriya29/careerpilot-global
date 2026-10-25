# CareerPilot — Complete User Guide

## 1. Purpose

CareerPilot is a Salesforce-focused job-search workspace for discovering opportunities, evaluating fit, preparing application materials, reviewing drafts, and tracking applications. It is a decision-support tool, not a guarantee of interviews, sponsorship, immigration eligibility, or offers.

## 2. Open and sign in

1. Open the live URL in the repository README.
2. Sign in with the configured authentication provider. A private Hatchable project may show a platform sign-in/visibility wall.
3. Use an individual account; never share accounts because resumes, documents and application records can contain personal data.
4. If sign-in fails, ask the project owner to verify auth configuration and visibility.

## 3. Set up My profile

Complete the available fields accurately: headline and current role, work history, notice period, target compensation, education, current/preferred locations, Salesforce skills and certifications, work authorization, mobility preferences and constraints. Save and review before AI workflows. Never invent employers, dates, certifications, skills, visa status or achievement metrics to improve a score.

## 4. Overview

The Overview summarizes job leads, tracked applications, compensation target and career focus. Recommended search lanes are starting points, not verified vacancies. Some cards link to job-board searches instead of an individual listing. Open the source to verify the employer, posting date, requirements, salary and status.

The integration-readiness check reports configuration only. It is not a security audit or a guarantee that every integration works.

## 5. Job discovery

1. Open **Job discovery**.
2. Choose a recommended lane or search keywords such as Salesforce DevOps Engineer, Salesforce Platform Developer, OmniStudio Developer or Salesforce AI/Automation Engineer.
3. Select the available location and filters.
4. Inspect the source and evidence attached to each result.
5. Open the original listing and confirm it is still active.
6. Save relevant roles and track your application using the available controls.

Salary, match, visa and sponsorship signals are preliminary. Verify sponsorship directly with the employer and immigration rules through official government sources.

### Fit scores

A fit score is an estimate based on your profile and the job description. It is not an employer decision and may be wrong if either input is incomplete. Read the match explanation and mandatory requirements yourself; a high score does not prove eligibility.

## 6. LinkedIn options

Manual intake and separately gated public guest-search options may be available depending on the deployed version and project configuration.

- **Manual intake:** open LinkedIn yourself and paste the job URL and relevant details into the manual intake form.
- **Guest search:** if enabled, read the risk notice and decide whether to opt in. Public pages can change or block automated requests; results are not guaranteed.
- **Ultra LinkedIn Scraper:** if present in the deployed build, use its keyword, location, posting-age, workplace and page controls. Job details are limited to the fields returned by the source.
- HTTP 401, 403, 429 or 999 responses may pause the feature. Do not evade blocks or restrictions. Do not provide login cookies/passwords, bypass CAPTCHAs, or use stealth/proxy rotation.
- The feature does not establish permission from LinkedIn to automate access. Review the current terms and use only methods you are authorized to use.

The deployed app and GitHub branch may differ until changes are merged and deployed. Confirm the release you are using.

## 7. Resume Studio and AI

1. Upload or provide your source resume through the supported document workflow.
2. Select the target role and supply its job description.
3. Generate a tailored resume or cover letter.
4. Verify every statement against your real experience and source resume.
5. Correct unsupported claims, dates, skills, metrics, job titles and certifications.
6. Download or copy the final draft using the UI controls.

AI output is a draft, not a verified record. Keep a master resume and never submit invented credentials or metrics. AI scoring, tailoring and review require the hosting project's configured AI provider. Never put provider API keys in browser code.

## 8. Application tracker

Use the Application tracker to record stages, notes, dates and next actions supported by the UI. Keep statuses truthful. A prepared application is not the same as a submitted application.

The default workflow is manual handoff. Unless a supported submission adapter is explicitly configured and returns verifiable acceptance, open the employer's official application page and submit manually. Handle CAPTCHAs, access challenges, attestations and other human-only steps yourself. Never infer success just because a browser opened or a form was prepared.

## 9. Documents and privacy

- Upload only files needed for the workflow and never share resume links publicly.
- Review access controls before making a project public.
- Remove unnecessary copies using supported controls.
- Avoid storing identity documents, passwords, payment details or unrelated sensitive records.
- When reporting a document problem, do not attach a resume to a public issue.
- Project owners should test file ownership and private storage with two separate accounts.

## 10. Integrations and scheduled jobs

Scheduled discovery/scoring jobs are declared in `hatchable.toml` and depend on the host scheduler. Adzuna requires `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` set securely by the project owner. AI tasks require the configured Anthropic provider. If a source is not configured, unavailable results do not mean there are no jobs.

Troubleshooting:
1. Run the integration-readiness check.
2. Record status/error text without exposing secrets.
3. Ask the owner to check host logs and secret configuration.
4. Check scheduled-run history.
5. Retest in staging before changing production.

## 11. A practical Salesforce search workflow

Search separately for Salesforce DevOps/Release Engineer, Platform Developer, OmniStudio and Salesforce AI/Automation roles. Tailor materials only to roles that match real experience. Track notice period, compensation, location, work authorization and sponsorship independently. Verify every listing at its source, prioritize fit over volume, and record the next action for each opportunity.

## 12. Troubleshooting

- **App won't open / sign-in wall:** check the live URL, project visibility, auth provider and deployment status.
- **No jobs:** verify search terms, source connectivity and Adzuna credentials; a starter lane is not a live vacancy.
- **AI unavailable:** the owner must configure the AI provider through hosting settings.
- **LinkedIn results missing or feature paused:** source markup may have changed or access may be blocked. Use manual intake and do not retry aggressively.
- **Resume output is inaccurate:** correct the profile/source resume and review the next draft manually.
- **Submission status unclear:** verify in the employer ATS or confirmation email.
- **Document access issue:** owner should check ownership policies and private storage permissions.

## 13. Responsible use

Users remain responsible for truthful applications, platform terms, privacy and immigration checks. Do not upload another person's resume without permission, expose secrets, or circumvent access controls.
