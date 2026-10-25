import { db } from 'hatchable';
export const access='user';
export const methods=['GET','POST','PUT','DELETE'];
const ALLOWED_STATUS=new Set(['saved','resume_ready','ready_to_apply','applied','recruiter_screen','interview','offer','rejected','on_hold']);
function txt(v,max,name){if(v==null)return '';if(typeof v!=='string'&&typeof v!=='number')throw new Error(name+' must be text.');const s=String(v).trim();if(s.length>max)throw new Error(name+' is too long.');return s;}
function dateOrNull(v){if(v==null||v==='')return null;if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/.test(v)||Number.isNaN(Date.parse(v)))throw new Error('next_action_at must be a valid ISO date or timestamp.');return new Date(v).toISOString();}
export default async function(req,res){
 const uid=String(req.user.id),b=req.body||{};
 if(req.method==='GET'){
  const r=await db.query('SELECT a.id,a.job_id,a.status,a.resume_version,a.cover_letter,a.application_url,a.applied_at,a.next_action,a.next_action_at,a.notes,a.created_at,a.updated_at,j.title,j.company,j.location,j.country,j.source_url FROM applications a LEFT JOIN job_leads j ON j.id=a.job_id WHERE a.user_id=$1 ORDER BY a.updated_at DESC LIMIT 200',[uid]);
  return res.json({applications:r.rows});
 }
 try{
  if(req.method==='POST'){
   const id=Number(b.job_id);
   if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'A valid job_id is required.'});
   const job=await db.query('SELECT id,source_url FROM job_leads WHERE id=$1 AND active=true',[id]);
   if(!job.rows.length)return res.status(404).json({error:'Job not found or inactive.'});
   const r=await db.query("INSERT INTO applications(user_id,job_id,status,application_url,notes) VALUES($1,$2,'saved',$3,$4) ON CONFLICT DO NOTHING RETURNING id,status,job_id,application_url",[uid,id,job.rows[0].source_url,txt(b.notes,2000,'notes')]);
   return res.status(201).json({application:r.rows[0]||null,ok:true});
  }
  const id=Number(b.id);
  if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'A valid application id is required.'});
  const own=await db.query('SELECT id FROM applications WHERE id=$1 AND user_id=$2',[id,uid]);
  if(!own.rows.length)return res.status(404).json({error:'Application not found.'});
  if(req.method==='DELETE'){await db.query('DELETE FROM applications WHERE id=$1 AND user_id=$2',[id,uid]);return res.json({ok:true});}
  const current=await db.query('SELECT status,resume_version,cover_letter,application_url,next_action,next_action_at,notes FROM applications WHERE id=$1 AND user_id=$2',[id,uid]);
  const old=current.rows[0];
  const status=b.status===undefined?old.status:txt(b.status,40,'status');
  if(!ALLOWED_STATUS.has(status))return res.status(400).json({error:'Unsupported application status.'});
  const resume=b.resume_version===undefined?old.resume_version:txt(b.resume_version,30000,'resume_version');
  const letter=b.cover_letter===undefined?old.cover_letter:txt(b.cover_letter,12000,'cover_letter');
  const url=b.application_url===undefined?old.application_url:txt(b.application_url,2000,'application_url');
  if(url && (!/^https:\/\//i.test(url)||/[\r\n]/.test(url)))return res.status(400).json({error:'Application URL must be HTTPS.'});
  const next=b.next_action===undefined?old.next_action:txt(b.next_action,500,'next_action');
  const nextAt=b.next_action_at===undefined?old.next_action_at:dateOrNull(b.next_action_at);
  const notes=b.notes===undefined?old.notes:txt(b.notes,5000,'notes');
  const packageChanged=resume!==old.resume_version||letter!==old.cover_letter;
  const r=await db.query("UPDATE applications SET status=$3,resume_version=$4,cover_letter=$5,application_url=$6,next_action=$7,next_action_at=$8,notes=$9,applied_at=CASE WHEN $3='applied' AND applied_at IS NULL THEN now() ELSE applied_at END,updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING id,status,updated_at",[id,uid,status,resume,letter,url,next,nextAt,notes]);
  if(packageChanged) await db.query('DELETE FROM application_reviews WHERE application_id=$1 AND user_id=$2',[id,uid]);
  return res.json({application:r.rows[0]});
 }catch(e){
  const message=e instanceof Error?e.message:'';
  const isValidation=/must be text|is too long|must be a valid ISO date|Unsupported application status|Application URL must be HTTPS|valid ISO date/i.test(message);
  if(isValidation)return res.status(400).json({error:message});
  console.error('application update failed');
  return res.status(500).json({error:'Could not update application. Please retry.'});
 }
}