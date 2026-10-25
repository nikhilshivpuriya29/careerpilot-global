import { scheduler, db } from 'hatchable';
import { enforceUserRateLimit } from '../../lib/rate-limits.js';
export const access='user';
export const methods=['POST'];
export default async function(req,res){
 const limit=await enforceUserRateLimit(db,String(req.user.id),'job-discovery',2);if(!limit.allowed)return res.status(429).json({error:'Job discovery rate limit reached. Retry in the next minute.',retry_after_seconds:limit.retryAfterSeconds});
 try{
  await scheduler.now('/api/jobs/daily-discovery');
  res.status(202).json({ok:true,status:'queued',message:'Discovery queued. Refresh job results and run history in a moment.'});
 }catch(e){
  console.error('could not queue discovery');
  res.status(503).json({error:'Could not queue discovery right now. The scheduled daily run remains configured.'});
 }
}