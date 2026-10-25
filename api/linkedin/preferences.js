import { db } from 'hatchable';
import { LINKEDIN_RISK_NOTICE_VERSION } from '../../lib/linkedin-safety.js';

export const access = 'user';
export const methods = ['GET', 'PUT'];

export default async function(req, res) {
  const uid = String(req.user.id);
  const controlResult = await db.query('SELECT enabled,kill_reason FROM linkedin_scraper_control WHERE id=1');
  const globalEnabled = controlResult.rows[0]?.enabled === true;
  if (req.method === 'GET') {
    const result = await db.query('SELECT enabled,risk_acknowledged_at,risk_notice_version,paused_reason,paused_at,search_count_today,search_day,detail_count_today,detail_day,last_search_at FROM linkedin_scraper_preferences WHERE user_id=$1', [uid]);
    const row = result.rows[0] || {};
    const acknowledged = !!row.risk_acknowledged_at && row.risk_notice_version === LINKEDIN_RISK_NOTICE_VERSION;
    return res.json({
      enabled: row.enabled === true && acknowledged && globalEnabled,
      acknowledged,
      acknowledgement_version: row.risk_notice_version || '',
      global_enabled: globalEnabled,
      global_kill_reason: globalEnabled ? '' : (controlResult.rows[0]?.kill_reason || 'LinkedIn guest search is paused globally.'),
      paused_reason: row.paused_reason || '',
      searches_today: row.search_count_today || 0,
      details_today: row.detail_count_today || 0,
      daily_search_limit: 5,
      daily_detail_limit: 10,
      mode: row.enabled && acknowledged && globalEnabled ? 'public_guest_search' : 'manual_import_only',
      scraping_enabled: row.enabled === true && acknowledged && globalEnabled
    });
  }

  const body = req.body || {};
  if (body.enabled === false) {
    await db.query("INSERT INTO linkedin_scraper_preferences(user_id,enabled,risk_acknowledged_at,risk_notice_version,paused_reason,paused_at,updated_at) VALUES($1,false,NULL,'','Disabled by user.',now(),now()) ON CONFLICT(user_id) DO UPDATE SET enabled=false,risk_acknowledged_at=NULL,risk_notice_version='',paused_reason='Disabled by user.',paused_at=now(),updated_at=now()", [uid]);
    return res.json({ ok:true, enabled:false, scraping_enabled:false, mode:'manual_import_only', message:'LinkedIn guest search is off for this account.' });
  }
  if (body.enabled !== true || body.confirmation_one !== true || body.confirmation_two !== true) {
    return res.status(400).json({
      ok:false, enabled:false, scraping_enabled:false,
      error:'Two separate confirmations are required before enabling LinkedIn public guest search.',
      required_confirmations:['I understand automated access may violate LinkedIn terms and may lead to rate limits or account restrictions.','I choose to proceed with unauthenticated public guest search, understand there is no account-safety guarantee, and will stop if access is denied.']
    });
  }
  if (!globalEnabled) return res.status(503).json({ ok:false, enabled:false, scraping_enabled:false, error:controlResult.rows[0]?.kill_reason || 'LinkedIn guest search is paused globally.' });
  await db.query("INSERT INTO linkedin_scraper_preferences(user_id,enabled,risk_acknowledged_at,risk_notice_version,paused_reason,paused_at,updated_at) VALUES($1,true,now(),$2,'',NULL,now()) ON CONFLICT(user_id) DO UPDATE SET enabled=true,risk_acknowledged_at=now(),risk_notice_version=$2,paused_reason='',paused_at=NULL,updated_at=now()", [uid, LINKEDIN_RISK_NOTICE_VERSION]);
  return res.json({ ok:true, enabled:true, scraping_enabled:true, mode:'public_guest_search', message:'LinkedIn public guest search enabled for this account. Use low volume and stop if access is denied.' });
}