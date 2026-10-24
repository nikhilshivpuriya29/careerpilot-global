import { db } from 'hatchable';
export const access = 'user';
export const methods = ['GET','PUT'];

const MAX_RESUME = 30000;
const MAX_PROFILE_JSON = 12000;
const ALLOWED_AUTH = new Set(['', 'unknown', 'authorized', 'needs_sponsorship', 'student', 'other']);
const COUNTRY_RE = /^[A-Za-z .'-]{2,80}$/;
function text(value, max, field) {
  if (value == null) return '';
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error(field + ' must be text.');
  const out = String(value).trim();
  if (out.length > max) throw new Error(field + ' exceeds the maximum length of ' + max + ' characters.');
  return out;
}
export default async function(req,res) {
 const uid=String(req.user.id);
 if(req.method==='GET'){
  const r=await db.query('SELECT profile_json, resume_text, work_auth, preferred_countries, target_salary, notice_period, updated_at FROM candidate_profiles WHERE user_id=$1',[uid]);
  return res.json({profile:r.rows[0]||null});
 }
 try {
  const b=req.body||{};
  if (!b || typeof b !== 'object' || Array.isArray(b)) return res.status(400).json({error:'A JSON object is required.'});
  const profile=(b.profile&&typeof b.profile==='object'&&!Array.isArray(b.profile))?b.profile:{};
  const safeProfile={};
  for (const key of ['target_roles','locations','seniority','skills','certifications','industries','remote_preference','salary_currency','salary_period','work_preferences']) {
    if (profile[key] == null) continue;
    const val=profile[key];
    if (Array.isArray(val)) safeProfile[key]=val.slice(0,40).map(x=>text(x,200,key));
    else if (typeof val==='string'||typeof val==='number'||typeof val==='boolean') safeProfile[key]=text(val,1000,key);
    else return res.status(400).json({error:'Unsupported profile field type: '+key});
  }
  const countries=Array.isArray(b.preferred_countries)?[...new Set(b.preferred_countries.slice(0,40).map(x=>text(x,80,'preferred_countries')).filter(Boolean))]:[];
  if(countries.some(c=>!COUNTRY_RE.test(c))) return res.status(400).json({error:'Preferred countries contain an invalid value.'});
  const resume=text(b.resume_text,MAX_RESUME,'resume_text');
  const workAuth=text(b.work_auth,100,'work_auth');
  if(!ALLOWED_AUTH.has(workAuth.toLowerCase())) return res.status(400).json({error:'Unsupported work authorization selection.'});
  const salary=text(b.target_salary,120,'target_salary');
  const notice=text(b.notice_period,120,'notice_period');
  if(JSON.stringify(safeProfile).length>MAX_PROFILE_JSON) return res.status(400).json({error:'Profile data is too large.'});
  const r=await db.query('INSERT INTO candidate_profiles(user_id,profile_json,resume_text,work_auth,preferred_countries,target_salary,notice_period,updated_at) VALUES($1,$2::jsonb,$3,$4,$5::jsonb,$6,$7,now()) ON CONFLICT(user_id) DO UPDATE SET profile_json=EXCLUDED.profile_json,resume_text=EXCLUDED.resume_text,work_auth=EXCLUDED.work_auth,preferred_countries=EXCLUDED.preferred_countries,target_salary=EXCLUDED.target_salary,notice_period=EXCLUDED.notice_period,updated_at=now() RETURNING profile_json,resume_text,work_auth,preferred_countries,target_salary,notice_period,updated_at',[uid,JSON.stringify(safeProfile),resume,workAuth,JSON.stringify(countries),salary,notice]);
  return res.json({profile:r.rows[0]});
 } catch(e) {
  return res.status(400).json({error:e instanceof Error?e.message:'Invalid profile input.'});
 }
}