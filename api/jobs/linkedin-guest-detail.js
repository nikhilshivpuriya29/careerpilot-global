import { db } from 'hatchable';
import { enforceUserRateLimit } from '../../lib/rate-limits.js';
import { LINKEDIN_RISK_NOTICE_VERSION, parseLinkedInGuestDetailHtml } from '../../lib/linkedin-safety.js';

export const access = 'user';
export const methods = ['POST'];

export default async function(req, res) {
  const uid = String(req.user.id);
  const pref = await db.query('SELECT enabled,risk_acknowledged_at,risk_notice_version FROM linkedin_scraper_preferences WHERE user_id=$1', [uid]);
  const control = await db.query('SELECT enabled FROM linkedin_scraper_control WHERE id=1');
  const row = pref.rows[0];
  if (!row?.enabled || !row.risk_acknowledged_at || row.risk_notice_version !== LINKEDIN_RISK_NOTICE_VERSION || control.rows[0]?.enabled !== true) {
    return res.status(403).json({ ok:false, scraping_enabled:false, error:'Enable public LinkedIn guest search after both risk confirmations. CareerPilot has not contacted LinkedIn.' });
  }
  const id = String((req.body || {}).linkedin_job_id || (req.body || {}).id || '');
  if (!/^\d{6,15}$/.test(id)) return res.status(400).json({ ok:false, error:'A numeric LinkedIn job ID is required.' });
  const limited = await enforceUserRateLimit(db, uid, 'linkedin-guest-detail', 5);
  if (!limited.allowed) return res.status(429).json({ ok:false, error:'Job detail rate limit reached. Wait before retrying.', retry_after_seconds:limited.retryAfterSeconds });
  const daily = await db.query("UPDATE linkedin_scraper_preferences SET detail_count_today=CASE WHEN detail_day=CURRENT_DATE THEN detail_count_today+1 ELSE 1 END,detail_day=CURRENT_DATE,updated_at=now() WHERE user_id=$1 AND enabled=true AND (detail_day<>CURRENT_DATE OR detail_count_today<10) RETURNING detail_count_today", [uid]);
  if (!daily.rows.length) return res.status(429).json({ ok:false, error:'Daily job-detail limit reached.' });
  try {
    const response = await fetch('https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/'+id, { headers:{ 'User-Agent':'CareerPilotPublicJobSearch/1.0 (unauthenticated; user-initiated)', 'Accept':'text/html,application/xhtml+xml', 'Accept-Language':'en-US,en;q=0.8' }, redirect:'error', signal:AbortSignal.timeout(12000) });
    if ([401,403,429,999].includes(response.status)) {
      await db.query("UPDATE linkedin_scraper_preferences SET enabled=false,paused_reason=$2,paused_at=now(),updated_at=now() WHERE user_id=$1", [uid, 'LinkedIn denied or rate-limited access; paused automatically.']);
      return res.status(429).json({ ok:false, status:'paused_after_access_denial', scraping_enabled:false, error:'LinkedIn denied or rate-limited the request. CareerPilot has paused guest search and will not retry.' });
    }
    if (response.status===404) return res.status(404).json({ ok:false,error:'Job listing was not found or is no longer available.' });
    if (!response.ok) return res.status(502).json({ ok:false,error:'LinkedIn returned HTTP '+response.status+'. No automatic retry was attempted.' });
    const parsed = parseLinkedInGuestDetailHtml(await response.text());
    if (!parsed.ok) return res.status(422).json({ ok:false,error:parsed.error });
    return res.json({ ok:true, job:{ linkedin_job_id:id, ...parsed, url:'https://www.linkedin.com/jobs/view/'+id+'/' }, source:'linkedin_public_guest_jobs' });
  } catch {
    return res.status(502).json({ ok:false,error:'Could not retrieve job details. No retry was attempted.' });
  }
}