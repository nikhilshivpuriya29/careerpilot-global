export const access = 'admin';
export const methods = ['GET', 'PUT'];

const SAFETY_REASON = 'Automated LinkedIn scraping is disabled by CareerPilot safety policy.';

export default async function(req, res) {
  if (req.method === 'GET') {
    return res.json({ control: { id:1, enabled:false, kill_reason:SAFETY_REASON, immutable:true } });
  }
  const body = req.body || {};
  if (body.enabled === true) {
    return res.status(403).json({
      ok:false,
      enabled:false,
      immutable:true,
      error:'CareerPilot does not permit enabling automated LinkedIn scraping. An acknowledgement or administrator override cannot guarantee account safety or establish platform permission.'
    });
  }
  if (body.enabled !== false) return res.status(400).json({ error:'enabled must be a boolean.' });
  return res.json({ ok:true, enabled:false, immutable:true, message:SAFETY_REASON });
}