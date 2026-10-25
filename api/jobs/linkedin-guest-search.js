import { db } from 'hatchable';
import { enforceUserRateLimit } from '../../lib/rate-limits.js';
import { LINKEDIN_RISK_NOTICE_VERSION, LINKEDIN_MAX_RESULTS, LINKEDIN_MAX_SEARCHES_PER_DAY, LINKEDIN_MIN_SEARCH_INTERVAL_SECONDS, validateLinkedInGuestSearch, parseLinkedInGuestSearchHtml } from '../../lib/linkedin-safety.js';

export const access = 'user';
export const methods = ['POST'];

export default async function(req, res) {
  const uid = String(req.user.id);
  const prefResult = await db.query('SELECT enabled,risk_acknowledged_at,risk_notice_version,search_day,search_count_today,last_search_at FROM linkedin_scraper_preferences WHERE user_id=$1', [uid]);
  const pref = prefResult.rows[0];
  const control = await db.query('SELECT enabled,kill_reason FROM linkedin_scraper_control WHERE id=1');
  if (!pref?.enabled || !pref.risk_acknowledged_at || pref.risk_notice_version !== LINKEDIN_RISK_NOTICE_VERSION || control.rows[0]?.enabled !== true) {
    return res.status(403).json({ ok:false, status:'consent_required_or_paused', scraping_enabled:false, error:'Enable public LinkedIn guest search in the UI after both risk confirmations. CareerPilot has not contacted LinkedIn.' });
  }
  const validation = validateLinkedInGuestSearch(req.body || {});
  if (!validation.ok) return res.status(400).json({ ok:false, error:validation.error });
  const limited = await enforceUserRateLimit(db, uid, 'linkedin-guest-search', 1);
  if (!limited.allowed) return res.status(429).json({ ok:false, error:'Search rate limit reached. Wait at least one minute before searching again.', retry_after_seconds:limited.retryAfterSeconds });
  const daily = await db.query("UPDATE linkedin_scraper_preferences SET search_count_today=CASE WHEN search_day=CURRENT_DATE THEN search_count_today+1 ELSE 1 END,search_day=CURRENT_DATE,last_search_at=now(),updated_at=now() WHERE user_id=$1 AND enabled=true AND (search_day<>CURRENT_DATE OR search_count_today<$2) AND (last_search_at IS NULL OR last_search_at < now() - ($3 || ' seconds')::interval) RETURNING search_count_today", [uid, LINKEDIN_MAX_SEARCHES_PER_DAY, LINKEDIN_MIN_SEARCH_INTERVAL_SECONDS]);
  if (!daily.rows.length) return res.status(429).json({ ok:false, error:'Daily search limit reached or searches are too close together. CareerPilot will not retry automatically.' });
  const params = new URLSearchParams({ keywords:validation.query, location:validation.location, f_TPR:'r'+(validation.postedDays*86400), start:'0' });
  const url = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?' + params.toString();
  try {
    const response = await fetch(url, { headers:{ 'User-Agent':'CareerPilotPublicJobSearch/1.0 (unauthenticated; user-initiated)', 'Accept':'text/html,application/xhtml+xml', 'Accept-Language':'en-US,en;q=0.8' }, redirect:'error', signal:AbortSignal.timeout(12000) });
    if (response.status === 429 || response.status === 403 || response.status === 401 || response.status === 999) {
      await db.query("UPDATE linkedin_scraper_preferences SET enabled=false,paused_reason=$2,paused_at=now(),updated_at=now() WHERE user_id=$1", [uid, 'LinkedIn denied or rate-limited access; paused automatically. Re-enable only after reviewing the risk notice.']);
      return res.status(429).json({ ok:false, status:'paused_after_access_denial', scraping_enabled:false, error:'LinkedIn denied or rate-limited the request. CareerPilot has paused guest search and will not retry. Use manual intake instead.' });
    }
    if (!response.ok) return res.status(502).json({ ok:false, error:'LinkedIn returned HTTP '+response.status+'. No automatic retry was attempted.' });
    const html = await response.text();
    const jobs = parseLinkedInGuestSearchHtml(html).slice(0, LINKEDIN_MAX_RESULTS);
    return res.json({ ok:true, source:'linkedin_public_guest_jobs', jobs, count:jobs.length, page:1, max_results:LINKEDIN_MAX_RESULTS, note:'Public guest results can be incomplete or stale. Verify every listing on LinkedIn before applying.' });
  } catch (error) {
    return res.status(502).json({ ok:false, error:'Could not retrieve public guest results. No retry was attempted; use manual intake or try later if access was not denied.' });
  }
}