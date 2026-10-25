import { db } from 'hatchable';
import { classifyProvider } from '../../lib/application-automation.js';
import { mapApplicationFields } from '../../lib/application-field-mapping.js';
import { enforceUserRateLimit } from '../../lib/rate-limits.js';
export const access='user';
export const methods=['POST'];
export default async function(req,res) {
 const uid=String(req.user.id), body=req.body||{}, id=Number(body.application_id);
 if(!Number.isSafeInteger(id)||id<1) return res.status(400).json({error:'A valid application_id is required.'});
 const limit=await enforceUserRateLimit(db,uid,'map-fields',20);if(!limit.allowed)return res.status(429).json({error:'Field mapping rate limit reached. Retry in the next minute.',retry_after_seconds:limit.retryAfterSeconds});
 if(!Array.isArray(body.fields)||body.fields.length>100) return res.status(400).json({error:'Provide no more than 100 inspected fields.'});
 const q=await db.query('SELECT a.id,a.application_url,j.source_url FROM applications a LEFT JOIN job_leads j ON j.id=a.job_id WHERE a.id=$1 AND a.user_id=$2',[id,uid]);
 if(!q.rows.length) return res.status(404).json({error:'Application not found.'});
 const provider=classifyProvider(q.rows[0].application_url||q.rows[0].source_url);
 if(!provider.ok) return res.status(422).json({error:'This application source is not supported for field mapping.'});
 const profile=await db.query('SELECT profile_json,notice_period FROM candidate_profiles WHERE user_id=$1',[uid]);
 if(!profile.rows.length) return res.status(409).json({error:'Save a candidate profile before mapping fields.'});
 const row=profile.rows[0], profileJson=row.profile_json&&typeof row.profile_json==='object'&&!Array.isArray(row.profile_json)?row.profile_json:{};
 const mapped=mapApplicationFields(body.fields, {...profileJson,notice_period:row.notice_period}, String(req.user.email||''));
 return res.json({ok:true,application_id:id,provider:provider.provider,...mapped,message:'Suggestions only. Nothing was typed into the ATS, no files were uploaded, and no application was submitted.'});
}