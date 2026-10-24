import { db } from 'hatchable';
export const access='user';
export const methods=['GET'];
export default async function(req,res){
 const uid=String(req.user.id);
 const r=await db.query("SELECT id,run_type,status,started_at,finished_at,items_found,items_scored,items_notified,error_summary,metadata,created_at FROM automation_runs WHERE user_id=$1 OR user_id='system' ORDER BY created_at DESC LIMIT 30",[uid]);
 res.json({runs:r.rows});
}