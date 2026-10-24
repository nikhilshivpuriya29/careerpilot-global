import { db } from 'hatchable';
export const access = 'scheduler';
export const methods = ['POST'];

const COUNTRIES = ['IN','AU','CA','GB','NL','IE','DE','NZ','US','SG'];
const COUNTRY_NAMES = {IN:'India',AU:'Australia',CA:'Canada',GB:'United Kingdom',NL:'Netherlands',IE:'Ireland',DE:'Germany',NZ:'New Zealand',US:'United States',SG:'Singapore'};
const QUERIES = [
  'Salesforce DevOps OR Salesforce Developer OR OmniStudio OR Salesforce Platform Engineer'
];

function clean(value, max=12000) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0,max);
}
function salaryText(job) {
  const e = job.enrichment || {};
  if (e.salary_min == null && e.salary_max == null) return '';
  const currency = clean(e.salary_currency || '', 12);
  const period = clean(e.salary_period || '', 20);
  const fmt = n => Number(n).toLocaleString('en-US');
  const range = e.salary_min != null && e.salary_max != null
    ? fmt(e.salary_min)+'–'+fmt(e.salary_max)
    : fmt(e.salary_min ?? e.salary_max);
  return [currency, range, period ? '/'+period : ''].filter(Boolean).join(' ');
}
function visaEvidence(text) {
  const s = String(text || '').toLowerCase();
  if (/(visa sponsorship available|we sponsor (a |the )?visa|sponsorship (is )?available|will sponsor (a |the )?visa|visa sponsorship provided)/i.test(s)) return 'confirmed';
  if (/(visa sponsorship|work visa sponsorship|relocation assistance|skilled worker visa|immigration support|work permit support)/i.test(s)) return 'possible';
  return 'unknown';
}
async function fetchSearch(query, country) {
  const params = new URLSearchParams({q:query,limit:'3',offset:'0',countries:country,description_format:'text'});
  const response = await fetch('https://freehire.me/api/v1/agent/jobs/search?'+params.toString(), {
    headers:{'User-Agent':'CareerPilot/1.0 (personal job-search workflow)','Accept':'application/json'},
    signal:AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error('Freehire HTTP '+response.status);
  const payload = await response.json();
  if (!payload || !Array.isArray(payload.data)) throw new Error('Unexpected Freehire response shape');
  return payload.data;
}
export default async function(req,res) {
  const run = await db.query("INSERT INTO automation_runs(run_type,status,started_at) VALUES('freehire-discovery','running',now()) RETURNING id");
  const runId = run.rows[0].id;
  let found=0, upserted=0, failedSources=[];
  try {
    const tasks=[];
    for (const country of COUNTRIES) for (const query of QUERIES) tasks.push({country,query});
    // Keep traffic bounded and degrade gracefully if the best-effort public service is unavailable.
    for (let i=0;i<tasks.length;i+=4) {
      const batch=tasks.slice(i,i+4);
      const results=await Promise.all(batch.map(async task=>{
        try { return {task,jobs:await fetchSearch(task.query,task.country)}; }
        catch(e) { return {task,jobs:[],error:String(e.message||e)}; }
      }));
      for (const result of results) {
        if (result.error) { failedSources.push(result.task.country+':'+result.task.query+' ('+result.error+')'); continue; }
        for (const j of result.jobs) {
          const slug=clean(j.public_slug||j.id,300), title=clean(j.title,500), sourceUrl=clean(j.url,2000);
          if (!slug || !title || !sourceUrl || !/^https:\/\//i.test(sourceUrl)) continue;
          found++;
          const description=clean(j.description,12000);
          const company=clean(j.company,300);
          const location=clean(j.location||result.task.country,500);
          const evidence=visaEvidence(title+'\n'+description);
          const salary=salaryText(j);
          const meta={
            provider:'freehire',provider_id:slug,source:clean(j.source,100),
            company_slug:clean(j.company_slug,200),skills:Array.isArray(j.skills)?j.skills.slice(0,80):[],
            countries:Array.isArray(j.countries)?j.countries:[],regions:Array.isArray(j.regions)?j.regions:[],
            work_mode:clean(j.work_mode,40),posted_at:clean(j.posted_at,80),
            query:result.task.query,requested_country:result.task.country,
            enrichment:j.enrichment&&typeof j.enrichment==='object'?j.enrichment:{}
          };
          await db.query(
            "INSERT INTO job_leads(source_key,title,company,location,country,source_url,description,salary_text,visa_evidence,visa_notes,job_type,active,source_name,metadata,first_seen_at,last_seen_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,'FreeHire',$12::jsonb,now(),now()) ON CONFLICT(source_key) DO UPDATE SET title=EXCLUDED.title,company=EXCLUDED.company,location=EXCLUDED.location,country=EXCLUDED.country,source_url=EXCLUDED.source_url,description=EXCLUDED.description,salary_text=EXCLUDED.salary_text,visa_evidence=EXCLUDED.visa_evidence,visa_notes=EXCLUDED.visa_notes,job_type=EXCLUDED.job_type,active=true,metadata=EXCLUDED.metadata,last_seen_at=now()",
            ['freehire:'+slug,title,company,location,COUNTRY_NAMES[result.task.country]||result.task.country,sourceUrl,description,salary,evidence,
             evidence==='confirmed'?'Listing text contains explicit visa-sponsorship wording; verify directly with employer and official immigration sources.':evidence==='possible'?'Listing text contains a possible sponsorship or relocation signal; verify directly.':'No explicit sponsorship evidence detected; unknown does not mean sponsorship is unavailable.',
             clean((j.enrichment||{}).employment_type||j.work_mode||'',100),JSON.stringify(meta)]
          );
          upserted++;
        }
      }
    }
    const counts=await db.query("SELECT count(*)::int AS total,count(*) FILTER (WHERE active=true)::int AS active FROM job_leads");
    const status=failedSources.length?(upserted?'partial':'source_unavailable'):'completed';
    await db.query("UPDATE automation_runs SET status=$2,finished_at=now(),items_found=$3,items_scored=0,metadata=$4::jsonb,error_summary=$5 WHERE id=$1",
      [runId,status,found,JSON.stringify({upserted,activeJobs:counts.rows[0].active,provider:'FreeHire',countries:COUNTRIES,queries:QUERIES}),failedSources.slice(0,12).join('; ').slice(0,1500)]);
    return res.json({ok:upserted>0,status,found,upserted,activeJobs:counts.rows[0].active,failedRequests:failedSources.length,source:'FreeHire',message:upserted?'Imported source-linked technical vacancies. Sponsorship signals remain evidence to verify, not guarantees.':'No listings were imported. Check FreeHire availability and automation run history.'});
  } catch(e) {
    await db.query("UPDATE automation_runs SET status='failed',finished_at=now(),error_summary=$2 WHERE id=$1",[runId,clean(e.message||e,500)]);
    console.error('FreeHire discovery failed',{runId});
    return res.status(500).json({error:'FreeHire discovery failed. Check automation run history.'});
  }
}