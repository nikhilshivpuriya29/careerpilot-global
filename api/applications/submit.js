import { db } from 'hatchable';
export const access='user';
export const methods=['POST'];
// No generic application-submission API exists across job boards.
// This endpoint never claims a submission occurred. Add a source-specific,
// authorized adapter before enabling automated submission for that provider.
const ADAPTERS = Object.freeze({});
export default async function(req,res){
 const uid=String(req.user.id),b=req.body||{},id=Number(b.application_id),approved=b.approved===true;
 if(!Number.isInteger(id)||id<1)return res.status(400).json({error:'Valid application_id required.'});
 if(!approved)return res.status(400).json({error:'Explicit approval is required before attempting submission.'});
 const q=await db.query('SELECT a.id,a.status,a.resume_version,a.cover_letter,a.application_url,a.notes,j.source_name,j.source_url,j.metadata FROM applications a LEFT JOIN job_leads j ON j.id=a.job_id WHERE a.id=$1 AND a.user_id=$2',[id,uid]);
 if(!q.rows.length)return res.status(404).json({error:'Application not found.'});
 const a=q.rows[0];
 if(!a.resume_version||!a.cover_letter)return res.status(409).json({error:'Prepare the application package first.'});
 let review=null;try{review=JSON.parse(String(a.notes||'{}')).independent_review||null}catch(e){}
 if(!review||review.verdict!=='ready')return res.status(409).json({error:'Independent AI review must be completed and pass with verdict ready before submission can be attempted.',review_status:review?.verdict||'not_reviewed'});
 const provider=String(a.source_name||'').toLowerCase();
 const adapter=ADAPTERS[provider];
 if(!adapter){
  const reason='No authorized submission adapter is configured for this job source. The application package is prepared, but no external submission was made.';
  await db.query("INSERT INTO submission_attempts(user_id,application_id,provider,status,reason) VALUES($1,$2,$3,'needs_manual_action',$4)",[uid,id,provider||'unknown',reason]);
  await db.query("UPDATE applications SET status='ready_to_apply',next_action='Open the source listing and complete the application manually',updated_at=now() WHERE id=$1 AND user_id=$2",[id,uid]);
  return res.status(409).json({status:'needs_manual_action',submitted:false,reason,url:a.application_url||a.source_url||''});
 }
 // Provider-specific adapter execution must be implemented and tested
 // against the provider's documented API before it is added to ADAPTERS.
 const reason='Submission adapter is registered but execution is disabled until provider-specific compliance and integration tests pass.';
 await db.query("INSERT INTO submission_attempts(user_id,application_id,provider,status,reason) VALUES($1,$2,$3,'blocked',$4)",[uid,id,provider,reason]);
 return res.status(409).json({status:'blocked',submitted:false,reason});
}