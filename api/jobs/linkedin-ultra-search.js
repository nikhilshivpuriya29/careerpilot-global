import { db } from 'hatchable';
import { enforceUserRateLimit } from '../../lib/rate-limits.js';
import { LINKEDIN_RISK_NOTICE_VERSION, parseLinkedInGuestSearchHtml } from '../../lib/linkedin-safety.js';

export const access = 'user';
export const methods = ['POST'];

export default async function(req, res) {
  const uid = String(req.user.id);
  const prefResult = await db.query('SELECT enabled,risk_acknowledged_at,risk_notice_version FROM linkedin_scraper_preferences WHERE user_id=$1', [uid]);
  const pref = prefResult.rows[0];
  const control = await db.query('SELECT enabled FROM linkedin_scraper_control WHERE id=1');
  if (!pref?.enabled || !pref.risk_acknowledged_at || pref.risk_notice_version !== LINKEDIN_RISK_NOTICE_VERSION || control.rows[0]?.enabled !== true) {
    return res.status(403).json({ ok:false, error:'Enable LinkedIn public guest search after both risk confirmations first.' });
  }
  const body = req.body || {};
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  const location = typeof body.location === 'string' ? body.location.trim() : '';
  const age = body.postedDays == null || body.postedDays === 'all' ? null : Number(body.postedDays);
  const page = Number(body.page ?? 1);
  const workplace = String(body.workplace || 'all');
  if (!query || query.length > 120) return res.status(400).json({ ok:false,error:'Enter search keywords (up to 120 characters).' });
  if (!location || location.length > 120) return res.status(400).json({ ok:false,error:'Enter a location (up to 120 characters).' });
  if (age !== null && ![1,7,14,30].includes(age)) return res.status(400).json({ ok:false,error:'Posting age must be all, 1, 7, 14 or 30 days.' });
  if (!Number.isInteger(page) || page < 1 || page > 10) return res.status(400).json({ ok:false,error:'Page must be between 1 and 10.' });
  const workplaceCodes = { all:null, onsite:'1', remote:'2', hybrid:'3' };
  if (!(workplace in workplaceCodes)) return res.status(400).json({ ok:false,error:'Choose all, onsite, hybrid or remote.' });
  const limited = await enforceUserRateLimit(db, uid, 'linkedin-ultra-search', 1);
  if (!limited.allowed) return res.status(429).json({ ok:false,error:'Ultra search rate limit reached. Wait before trying again.',retry_after_seconds:limited.retryAfterSeconds });
  // Keep one request per explicit user action. Never retry after LinkedIn access denial/rate limiting.
  const params = new URLSearchParams({ keywords:query, location, start:String((page-1)*10) });
  if (age !== null) params.set('f_TPR','r'+(age*86400));
  if (workplaceCodes[workplace]) params.set('f_WT',workplaceCodes[workplace]);
  try {
    const response = await fetch('https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?'+params.toString(), {
      headers:{ 'User-Agent':'CareerPilotUltraPublicJobSearch/1.0 (unauthenticated; user-initiated)', 'Accept':'text/html,application/xhtml+xml', 'Accept-Language':'en-US,en;q=0.8' },
      redirect:'error', signal:AbortSignal.timeout(12000)
    });
    if ([401,403,429,999].includes(response.status)) {
      await db.query("UPDATE linkedin_scraper_preferences SET enabled=false,paused_reason=$2,paused_at=now(),updated_at=now() WHERE user_id=$1", [uid,'LinkedIn denied or rate-limited Ultra search; public guest search paused.']);
      return res.status(429).json({ ok:false,status:'paused_after_access_denial',error:'LinkedIn denied or rate-limited access. CareerPilot paused LinkedIn guest search and did not retry.' });
    }
    if (!response.ok) return res.status(502).json({ ok:false,error:'LinkedIn returned HTTP '+response.status+'. No automatic retry was attempted.' });
    const html = await response.text();
    const jobs = parseLinkedInGuestSearchHtml(html).slice(0,10);
    return res.json({ ok:true,source:'linkedin_public_guest_jobs',mode:'ultra',query,location,posted_days:age,workplace,page,page_size:10,jobs,count:jobs.length,has_more:jobs.length===10,note:'Results are public guest listings and may be incomplete or stale. Verify each listing directly. Access denial pauses the feature.' });
  } catch {
    return res.status(502).json({ ok:false,error:'Could not retrieve public guest results. No retry was attempted.' });
  }
}