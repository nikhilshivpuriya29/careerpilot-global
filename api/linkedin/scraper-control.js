import { db } from 'hatchable';

export const access = 'admin';
export const methods = ['GET', 'PUT'];

const SAFETY_REASON = 'Automated LinkedIn scraping is disabled by CareerPilot safety policy.';

export default async function(req, res) {
  if (req.method === 'GET') {
    const result = await db.query('SELECT id,enabled,kill_reason,updated_at FROM linkedin_scraper_control WHERE id=1');
    const row = result.rows[0];
    return res.json({
      control: {
        id: 1,
        enabled: false,
        persisted_enabled: row?.enabled === true,
        kill_reason: SAFETY_REASON,
        immutable: true,
        stored_updated_at: row?.updated_at || null
      }
    });
  }

  const body = req.body || {};
  if (body.enabled === true) {
    return res.status(403).json({
      ok: false,
      enabled: false,
      immutable: true,
      error: 'CareerPilot does not permit enabling automated LinkedIn scraping. An acknowledgement or administrator override cannot guarantee account safety or establish platform permission.'
    });
  }
  if (body.enabled !== false) return res.status(400).json({ error: 'enabled must be a boolean.' });

  try {
    const updated = await db.query(
      "UPDATE linkedin_scraper_control SET enabled=false,kill_reason=$1,updated_at=now() WHERE id=1 RETURNING id,enabled,kill_reason,updated_at",
      [SAFETY_REASON]
    );
    if (!updated.rows.length) {
      return res.status(500).json({ ok:false, enabled:false, error:'The persisted safety control could not be updated. Automated endpoints remain blocked at the API layer.' });
    }
    try {
      await db.query(
        "UPDATE linkedin_scraper_preferences SET enabled=false,risk_acknowledged_at=NULL,risk_notice_version='',paused_reason=$1,paused_at=now(),updated_at=now()",
        [SAFETY_REASON]
      );
    } catch {
      // User preference RLS may prevent a global sweep; the endpoint-level policy remains fail-closed.
    }
    return res.json({ ok:true, enabled:false, immutable:true, persisted_enabled:updated.rows[0].enabled === true, message:SAFETY_REASON });
  } catch {
    return res.status(500).json({ ok:false, enabled:false, error:'The persisted safety control could not be updated. Automated endpoints remain blocked at the API layer.' });
  }
}