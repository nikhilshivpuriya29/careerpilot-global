import { ai, db } from 'hatchable';
import { isAiProviderConfigurationError } from '../../lib/ai-availability.js';
export const access='scheduler';
export const methods=['POST'];
export default async function(req,res){
 const users=await db.query('SELECT user_id,profile_json,work_auth,target_salary,notice_period FROM candidate_profiles ORDER BY updated_at DESC LIMIT 100');
 let scored=0,skipped=0,errors=0;
 for(const p of users.rows){
  const jobs=await db.query("SELECT j.id,j.title,j.company,j.location,j.country,j.description,j.salary_text,j.visa_evidence,j.visa_notes,j.job_type FROM job_leads j WHERE j.active=true AND j.last_seen_at>now()-interval '10 days' AND NOT EXISTS (SELECT 1 FROM job_matches m WHERE m.user_id=$1 AND m.job_id=j.id) ORDER BY j.last_seen_at DESC LIMIT 5",[p.user_id]);
  for(const j of jobs.rows){
   try{
    const prompt='Return JSON only with fit_score integer 0-100, visa_score integer 0-100, salary_score integer 0-100, match_reasons string array, risk_flags string array. Score relevance against this candidate profile. Use only supplied evidence. Do not assume sponsorship, visa eligibility or PR. Penalize unknown requirements and mark uncertainty. Candidate profile: '+JSON.stringify(p.profile_json)+'; work authorization: '+p.work_auth+'; target compensation: '+p.target_salary+'; notice period: '+p.notice_period+'. Job: '+JSON.stringify(j);
    const out=await ai.generateText({model:'sonnet',purpose:'job-fit-scoring',userId:p.user_id,maxTokens:1200,system:'Precise job-fit analyst. Never invent evidence. Output valid JSON only.',prompt});
    let d;try{d=JSON.parse(out.text.replace(/^\s*```json\s*/i,'').replace(/\s*```\s*$/,''))}catch(e){errors++;continue}
    const clamp=x=>Math.max(0,Math.min(100,Number(x)||0));
    await db.query('INSERT INTO job_matches(user_id,job_id,fit_score,visa_score,salary_score,match_reasons,risk_flags) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) ON CONFLICT(user_id,job_id) DO NOTHING',[p.user_id,j.id,clamp(d.fit_score),clamp(d.visa_score),clamp(d.salary_score),JSON.stringify(Array.isArray(d.match_reasons)?d.match_reasons:[]),JSON.stringify(Array.isArray(d.risk_flags)?d.risk_flags:[])]);
    scored++;
   }catch(e){
    if(isAiProviderConfigurationError(e)){
     return res.status(503).json({ok:false,status:'needs_ai_configuration',users:users.rows.length,scored,skipped,errors,remainingWorkWillBePickedUpOnNextRun:true,message:'Job discovery succeeded, but match scoring is paused until the Hatchable AI provider is configured. No candidate data was logged.'});
    }
    errors++;
   }
  }
  skipped+=Math.max(0,5-jobs.rows.length);
 }
 res.json({ok:true,users:users.rows.length,scored,skipped,errors,remainingWorkWillBePickedUpOnNextRun:true});
}