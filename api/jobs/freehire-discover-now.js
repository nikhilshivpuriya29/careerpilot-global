import { scheduler, db } from 'hatchable';
import { enforceUserRateLimit } from '../../lib/rate-limits.js';
export const access='user';
export const methods=['POST'];
export default async function(req,res) {
  const limit=await enforceUserRateLimit(db,String(req.user.id),'job-discovery',2);if(!limit.allowed)return res.status(429).json({error:'Job discovery rate limit reached. Retry in the next minute.',retry_after_seconds:limit.retryAfterSeconds});
  try {
    await scheduler.now('/api/jobs/freehire-discovery');
    return res.status(202).json({ok:true,status:'queued',message:'FreeHire discovery queued. Refresh jobs and automation history in a moment.'});
  } catch(e) {
    console.error('could not queue FreeHire discovery');
    return res.status(503).json({error:'Could not queue FreeHire discovery. The scheduled daily run remains configured.'});
  }
}