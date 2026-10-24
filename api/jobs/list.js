import { db } from 'hatchable';
export const access='user';
export const methods=['GET'];
export default async function(req,res){
 const uid=String(req.user.id);
 const q=String(req.query.q||'').trim().slice(0,120);
 const country=String(req.query.country||'').trim().slice(0,80);
 const visa=String(req.query.visa||'all').slice(0,20);
 const limit=Math.max(1,Math.min(60,Number(req.query.limit)||30));
 const r=await db.query(`SELECT j.id,j.title,j.company,j.location,j.country,j.source_url,j.description,j.salary_text,j.visa_evidence,j.visa_notes,j.job_type,j.source_name,j.last_seen_at,COALESCE(m.fit_score,0) AS fit_score,COALESCE(m.visa_score,0) AS visa_score,m.match_reasons,m.risk_flags FROM job_leads j LEFT JOIN job_matches m ON m.job_id=j.id AND m.user_id=$1 WHERE j.active=true AND ($2='' OR (j.title||' '||j.company||' '||j.description) ILIKE '%'||$2||'%') AND ($3='' OR j.country ILIKE '%'||$3||'%') AND ($4='all' OR ($4='sponsor' AND j.visa_evidence='confirmed') OR ($4='possible' AND j.visa_evidence IN ('confirmed','possible')) OR ($4='pr' AND j.visa_notes ILIKE '%permanent residence%')) ORDER BY COALESCE(m.fit_score,0) DESC,j.last_seen_at DESC LIMIT $5`,[uid,q,country,visa,limit]);
 const saved=await db.query('SELECT id,job_id,status,application_url,next_action,next_action_at,updated_at FROM applications WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 200',[uid]);
 res.json({jobs:r.rows,applications:saved.rows});
}