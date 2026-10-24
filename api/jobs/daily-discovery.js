import { db, config } from 'hatchable';
export const access = 'scheduler';
export const methods = ['POST'];

const COUNTRIES = [
  { code:'in', name:'India' }, { code:'au', name:'Australia' },
  { code:'ca', name:'Canada' }, { code:'gb', name:'United Kingdom' },
  { code:'nl', name:'Netherlands' }, { code:'ie', name:'Ireland' },
  { code:'de', name:'Germany' }, { code:'nz', name:'New Zealand' },
  { code:'us', name:'United States' }, { code:'sg', name:'Singapore' }
];
const QUERIES = [
  'Salesforce DevOps',
  'Salesforce Developer OmniStudio',
  'Salesforce Platform Engineer'
];
function visaEvidence(text) {
  const s = String(text || '').toLowerCase();
  if (/(visa sponsorship available|we sponsor (a |the )?visa|sponsorship (is )?available|will sponsor (a |the )?visa|visa sponsorship provided)/i.test(s)) return 'confirmed';
  if (/(visa sponsorship|work visa sponsorship|relocation assistance|skilled worker visa|immigration support)/i.test(s)) return 'possible';
  return 'unknown';
}
function salaryText(j) {
  if (j.salary_min == null && j.salary_max == null) return '';
  const fmt = n => Math.round(Number(n)).toLocaleString('en-US');
  const currency = ({in:'INR',au:'AUD',ca:'CAD',gb:'GBP',nl:'EUR',ie:'EUR',de:'EUR',nz:'NZD',us:'USD',sg:'SGD'})[j.__country] || '';
  if (j.salary_min != null && j.salary_max != null) return currency+' '+fmt(j.salary_min)+'–'+fmt(j.salary_max);
  return currency+' '+fmt(j.salary_min ?? j.salary_max);
}
export default async function(req,res) {
  const run = await db.query("INSERT INTO automation_runs(run_type,status,started_at) VALUES('daily-discovery','running',now()) RETURNING id");
  const runId = run.rows[0].id;
  let found = 0, upserted = 0, failedSources = [];
  try {
    let appId, appKey;
    try {
      appId = await config.get('ADZUNA_APP_ID');
      appKey = await config.get('ADZUNA_APP_KEY');
    } catch (secretError) {
      await db.query("UPDATE automation_runs SET status='needs_credentials',finished_at=now(),error_summary=$2 WHERE id=$1",[runId,'Adzuna API credentials are missing or not yet configured in Hatchable Setup.']);
      return res.status(200).json({ok:false,status:'needs_credentials',required:['ADZUNA_APP_ID','ADZUNA_APP_KEY'],message:'Add Adzuna API credentials in Hatchable Setup to enable live job discovery.'});
    }
    if (!appId || !appKey) {
      await db.query("UPDATE automation_runs SET status='needs_credentials',finished_at=now(),error_summary=$2 WHERE id=$1",[runId,'Adzuna API credentials are not configured. Add ADZUNA_APP_ID and ADZUNA_APP_KEY in project Setup.']);
      return res.status(200).json({ok:false,status:'needs_credentials',required:['ADZUNA_APP_ID','ADZUNA_APP_KEY'],message:'Add Adzuna API credentials in Hatchable Setup to enable live job discovery.'});
    }
    const tasks = [];
    for (const country of COUNTRIES) for (const query of QUERIES) tasks.push({country,query});
    // Bounded concurrency avoids overloading a provider or exhausting the cron time budget.
    for (let i=0; i<tasks.length; i+=5) {
      const batch = tasks.slice(i,i+5);
      const results = await Promise.all(batch.map(async task => {
        const url = 'https://api.adzuna.com/v1/api/jobs/'+task.country.code+'/search/1?'+new URLSearchParams({
          app_id:String(appId),app_key:String(appKey),what:task.query,results_per_page:'15','content-type':'application/json',sort_by:'date'
        }).toString();
        try {
          const response = await fetch(url,{timeout_ms:12000});
          if (!response.ok) { failedSources.push(task.country.code+':'+task.query+' (HTTP '+response.status+')'); return []; }
          const data = await response.json();
          return (Array.isArray(data.results)?data.results:[]).map(j=>({...j,__country:task.country.code,__countryName:task.country.name,__query:task.query}));
        } catch(e) {
          failedSources.push(task.country.code+':'+task.query+' (request failed)');
          return [];
        }
      }));
      for (const group of results) for (const j of group) {
        if (!j.id || !j.redirect_url || !j.title) continue;
        found++;
        const key='adzuna:'+j.__country+':'+String(j.id);
        const description=String(j.description||'').slice(0,12000);
        const evidence=visaEvidence([j.title,description].join(' '));
        const loc=Array.isArray(j.location?.area)?j.location.area.join(', '):String(j.location?.display_name||j.__countryName);
        const salary=salaryText(j);
        const metadata={provider:'adzuna',provider_id:String(j.id),query:j.__query,contract_type:j.contract_type||'',category:j.category?.label||'',created:j.created||'',redirect_url:j.redirect_url};
        const saved=await db.query(
          "INSERT INTO job_leads(source_key,title,company,location,country,source_url,description,salary_text,visa_evidence,visa_notes,job_type,active,source_name,metadata,first_seen_at,last_seen_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,'Adzuna',$12::jsonb,now(),now()) ON CONFLICT(source_key) DO UPDATE SET title=EXCLUDED.title,company=EXCLUDED.company,location=EXCLUDED.location,country=EXCLUDED.country,source_url=EXCLUDED.source_url,description=EXCLUDED.description,salary_text=EXCLUDED.salary_text,visa_evidence=EXCLUDED.visa_evidence,visa_notes=EXCLUDED.visa_notes,job_type=EXCLUDED.job_type,active=true,metadata=EXCLUDED.metadata,last_seen_at=now() RETURNING id",
          [key,String(j.title).slice(0,500),String(j.company?.display_name||'').slice(0,300),loc.slice(0,500),j.__countryName,String(j.redirect_url).slice(0,2000),description,salary,evidence,evidence==='confirmed'?'Listing text explicitly mentions visa sponsorship; verify employer and current vacancy.':evidence==='possible'?'Listing text contains a sponsorship/relocation signal; verify directly.':'No explicit sponsorship evidence detected in retrieved listing text.',String(j.contract_type||'').slice(0,100),JSON.stringify(metadata)]
        );
        upserted += saved.rows.length?1:0;
      }
    }
    const count=await db.query('SELECT count(*)::int AS total,count(*) FILTER (WHERE active=true)::int AS active FROM job_leads');
    const status=failedSources.length?'partial':'completed';
    await db.query("UPDATE automation_runs SET status=$2,finished_at=now(),items_found=$3,items_scored=0,metadata=$4::jsonb,error_summary=$5 WHERE id=$1",[runId,status,found,JSON.stringify({upserted,activeJobs:count.rows[0].active,countries:COUNTRIES.map(c=>c.name),provider:'Adzuna'}),failedSources.slice(0,20).join('; ')]);
    return res.json({ok:true,status,found,upserted,activeJobs:count.rows[0].active,failedSources:failedSources.length,source:'Adzuna',message:'Listings imported with source URLs. Sponsorship signals are preliminary and require verification.'});
  } catch(e) {
    await db.query("UPDATE automation_runs SET status='failed',finished_at=now(),error_summary=$2 WHERE id=$1",[runId,String(e.message||e).slice(0,500)]);
    console.error('daily discovery failed',{runId});
    return res.status(500).json({error:'Discovery failed. Check run history and source credentials.'});
  }
}