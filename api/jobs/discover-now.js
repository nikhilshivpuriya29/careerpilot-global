import { scheduler } from 'hatchable';
export const access='user';
export const methods=['POST'];
export default async function(req,res){
 try{
  await scheduler.now('/api/jobs/daily-discovery');
  res.status(202).json({ok:true,status:'queued',message:'Discovery queued. Refresh job results and run history in a moment.'});
 }catch(e){
  console.error('could not queue discovery');
  res.status(503).json({error:'Could not queue discovery right now. The scheduled daily run remains configured.'});
 }
}