import { LINKEDIN_AUTOMATION_POLICY } from '../../lib/linkedin-policy.js';

export const access = 'user';
export const methods = ['POST'];

export default async function(req, res) {
  return res.status(410).json({
    ok: false,
    status: 'disabled_by_safety_policy',
    mode: LINKEDIN_AUTOMATION_POLICY.mode,
    scraping_enabled: false,
    error: 'Automated LinkedIn detail fetching is disabled. CareerPilot did not contact LinkedIn.',
    alternatives: ['Open the listing yourself and paste the relevant job details into manual intake.'],
    retry: false
  });
}