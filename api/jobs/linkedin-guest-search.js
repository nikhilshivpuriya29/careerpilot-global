import { LINKEDIN_AUTOMATION_POLICY } from '../../lib/linkedin-policy.js';

export const access = 'user';
export const methods = ['POST'];

export default async function(req, res) {
  return res.status(410).json({
    ok: false,
    status: 'disabled_by_safety_policy',
    mode: LINKEDIN_AUTOMATION_POLICY.mode,
    scraping_enabled: false,
    error: 'Automated LinkedIn scraping is disabled to reduce the risk of account restrictions. CareerPilot did not contact LinkedIn.',
    alternatives: ['Open LinkedIn yourself and paste a job link and details into manual intake.', 'Use an official or explicitly authorized integration where eligible.'],
    retry: false
  });
}