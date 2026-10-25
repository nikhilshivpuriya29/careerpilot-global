import { db } from 'hatchable';

export const access = 'admin';
export const methods = ['GET', 'PUT'];

export default async function(req, res) {
  if (req.method === 'GET') {
    const result = await db.query('SELECT id,enabled,kill_reason,updated_at FROM linkedin_scraper_control WHERE id=1');
    const row = result.rows[0];
    return res.json({ control:{ id:1, enabled:row?.enabled===true, kill_reason:row?.kill_reason||'', immutable:false, stored_updated_at:row?.updated_at||null } });
  }
  const body = req.body || {};
  if (typeof body.enabled !== 'boolean') return res.status(400).json({ error:'enabled must be a boolean.' });
  const reason = body.enabled ? '' : 'Paused by administrator emergency kill switch.';
  try {
    const updated = await db.query('UPDATE linkedin_scraper_control SET enabled=$1,kill_reason=$2,updated_at=now() WHERE id=1 RETURNING id,enabled,kill_reason,updated_at', [body.enabled, reason]);
    if (!updated.rows.length) return res.status(500).json({ ok:false, error:'Global LinkedIn control row is missing.' });
    if (!body.enabled) {
      await db.query("UPDATE linkedin_scraper_preferences SET enabled=false,paused_reason=$1,paused_at=now(),updated_at=now()", [reason]);
    }
    return res.json({ ok:true, enabled:updated.rows[0].enabled===true, message:body.enabled?'Global guest-search gate enabled. Each user must still complete both risk confirmations.':reason });
  } catch {
    return res.status(500).json({ ok:false, error:'Could not update the global LinkedIn control.' });
  }
}