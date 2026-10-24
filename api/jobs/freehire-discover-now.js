import { scheduler } from 'hatchable';
export const access='user';
export const methods=['POST'];
export default async function(req,res) {
  try {
    await scheduler.now('/api/jobs/freehire-discovery');
    return res.status(202).json({ok:true,status:'queued',message:'FreeHire discovery queued. Refresh jobs and automation history in a moment.'});
  } catch(e) {
    console.error('could not queue FreeHire discovery');
    return res.status(503).json({error:'Could not queue FreeHire discovery. The scheduled daily run remains configured.'});
  }
}