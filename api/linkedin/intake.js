import { db } from 'hatchable';
import { validateManualLinkedInIntake } from '../../lib/linkedin-safety.js';
import { enforceUserRateLimit } from '../../lib/rate-limits.js';

export const access = 'user';
export const methods = ['GET', 'POST', 'DELETE'];

export default async function(req, res) {
  const uid = String(req.user.id);

  if (req.method === 'GET') {
    const rows = await db.query(
      'SELECT id, canonical_url, title, company, location, description, created_at, updated_at FROM linkedin_job_intakes WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',
      [uid]
    );
    return res.json({ items: rows.rows, source_mode: 'manual_user_directed', automated_scraping_enabled: false });
  }

  const limit = await enforceUserRateLimit(db, uid, 'linkedin-manual-intake', 10);
  if (!limit.allowed) return res.status(429).json({ error: 'LinkedIn manual intake limit reached. Retry in the next minute.', retry_after_seconds: limit.retryAfterSeconds });

  if (req.method === 'POST') {
    const validation = validateManualLinkedInIntake(req.body);
    if (!validation.ok) return res.status(400).json({ error: validation.error });
    const e = validation.entry;
    try {
      const saved = await db.query(
        'INSERT INTO linkedin_job_intakes(user_id,canonical_url,title,company,location,description) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,canonical_url) DO UPDATE SET title=EXCLUDED.title,company=EXCLUDED.company,location=EXCLUDED.location,description=EXCLUDED.description,updated_at=now() RETURNING id,canonical_url,title,company,location,description,created_at,updated_at',
        [uid, e.canonical_url, e.title, e.company, e.location, e.description]
      );
      return res.status(201).json({ ok: true, item: saved.rows[0], source_mode: 'manual_user_directed', message: 'Saved privately. CareerPilot did not open LinkedIn, scrape the page, or use your LinkedIn session.' });
    } catch (error) {
      console.error('LinkedIn manual intake save failed');
      return res.status(500).json({ error: 'Could not save this LinkedIn job. Please retry.' });
    }
  }

  const id = Number((req.body || {}).id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'A valid saved job id is required.' });
  const deleted = await db.query('DELETE FROM linkedin_job_intakes WHERE id=$1 AND user_id=$2 RETURNING id', [id, uid]);
  if (!deleted.rows.length) return res.status(404).json({ error: 'Saved job not found.' });
  return res.json({ ok: true });
}