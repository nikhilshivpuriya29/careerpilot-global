import { getLinkedInSafeDecision } from '../../lib/linkedin-policy.js';

export const access = 'user';
export const methods = ['GET', 'PUT'];

export default async function(req, res) {
  if (req.method === 'GET') {
    return res.json({
      enabled: false,
      acknowledged: false,
      global_enabled: false,
      global_kill_reason: 'Automated LinkedIn scraping is disabled by CareerPilot safety policy.',
      paused_reason: 'Automated LinkedIn scraping is disabled. Use manual import or an authorized integration.',
      searches_today: 0,
      details_today: 0,
      daily_search_limit: 0,
      daily_detail_limit: 0,
      mode: 'manual_import_only',
      scraping_enabled: false
    });
  }

  const body = req.body || {};
  const decision = getLinkedInSafeDecision(body.choice || (body.enabled === false ? 'safe_manual' : body.enabled === true ? 'enable_scraper' : ''));
  if (decision.accepted) {
    return res.json({
      ok: true,
      enabled: false,
      scraping_enabled: false,
      mode: decision.mode,
      message: 'Safe mode selected. LinkedIn scraping remains disabled; manual import and permitted integrations remain available.'
    });
  }
  return res.status(403).json({
    ok: false,
    enabled: false,
    scraping_enabled: false,
    mode: 'manual_import_only',
    error: decision.error,
    message: 'Acknowledging a warning cannot make unauthorized scraping permitted or guarantee account safety.'
  });
}