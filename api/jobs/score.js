import { ai, db } from 'hatchable';
export const access='user';
export const methods=['POST'];
export default async function(req,res){
 const uid=String(req.user.id), b=req.body||{}, id=Number(b.job_id);
 if(!Number.isInteger(id)||id<1)return res.status(400).json({error:'Valid job_id required.'});
 const [pr,jr]=await Promise.all([
  db.query('SELECT profile_json,resume_text,work_auth,preferred_countries,target_salary,notice_period FROM candidate_profiles WHERE user_id=$1',[uid]),
  db.query('SELECT id,title,company,location,country,description,salary_text,visa_evidence,visa_notes FROM job_leads WHERE id=$1 AND active=true',[id])
 ]);
 if(!pr.rows.length)return res.status(400).json({error:'Save candidate profile and source resume first.'});
 if(!jr.rows.length)return res.status(404).json({error:'Active job not found.'});
 const p=pr.rows[0],j=jr.rows[0];
 const prompt='Score this job for the candidate. Return JSON only: fit_score integer 0-100, visa_score integer 0-100, salary_score integer 0-100, match_reasons string array, risk_flags string array, next_action string. Do not assume visa sponsorship or PR eligibility. If evidence is unknown, flag it. Distinguish job listing text from verified facts. Candidate profile: '+JSON.stringify(p.profile_json)+'; source resume: '+String(p.resume_text).slice(0,10000)+'; work authorization: '+p.work_auth+'; target salary: '+p.target_salary+'; notice: '+p.notice_period+'. Job: '+JSON.stringify(j);
 const out=await ai.generateText({model:'sonnet',purpose:'job-fit-scoring',userId:uid,maxTokens:1400,system:'Careful job analyst. Never invent evidence. Output valid JSON only.',prompt});
 if(out.finishReason==='length')return res.status(502).json({error:'Scoring output truncated.'});
 let d;try{d=JSON.parse(out.text.replace(/^\s*```json\s*/i,'').replace(/\s*```\s*$/,''))}catch(e){return res.status(502).json({error:'Could not parse scoring output.'})}
 const fit=Math.max(0,Math.min(100,Number(d.fit_score)||0)),visa=Math.max(0,Math.min(100,Number(d.visa_score)||0)),salary=Math.max(0,Math.min(100,Number(d.salary_score)||0));
 const saved=await db.query('INSERT INTO job_matches(user_id,job_id,fit_score,visa_score,salary_score,match_reasons,risk_flags) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) ON CONFLICT(user_id,job_id) DO UPDATE SET fit_score=EXCLUDED.fit_score,visa_score=EXCLUDED.visa_score,salary_score=EXCLUDED.salary_score,match_reasons=EXCLUDED.match_reasons,risk_flags=EXCLUDED.risk_flags,created_at=now() RETURNING id,fit_score,visa_score,salary_score,match_reasons,risk_flags',[uid,id,fit,visa,salary,JSON.stringify(Array.isArray(d.match_reasons)?d.match_reasons:[]),JSON.stringify(Array.isArray(d.risk_flags)?d.risk_flags:[])]);
 res.json({score:saved.rows[0],next_action:String(d.next_action||'Verify the listing and sponsorship details.')});
}