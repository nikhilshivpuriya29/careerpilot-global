import { browser, db } from 'hatchable';
import { classifyProvider, summarizeFormFields } from '../../lib/application-automation.js';
import { mapApplicationFields } from '../../lib/application-field-mapping.js';
import { buildApprovedFillPlan } from '../../lib/application-form-executor.js';
import { enforceUserRateLimit } from '../../lib/rate-limits.js';
export const access='user';
export const methods=['POST'];
export default async function(req,res) {
 const uid=String(req.user.id), body=req.body||{}, id=Number(body.application_id);
 if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'A valid application_id is required.'});
 if(body.confirm_fill!==true)return res.status(400).json({error:'Explicit confirmation is required before filling approved fields.'});
 if(!Array.isArray(body.approved_fields)||body.approved_fields.length>50)return res.status(400).json({error:'Select up to 50 approved fields.'});
 const limit=await enforceUserRateLimit(db,uid,'fill-approved-fields',3);
 if(!limit.allowed)return res.status(429).json({error:'ATS form fill rate limit reached. Retry in the next minute.',retry_after_seconds:limit.retryAfterSeconds});
 const q=await db.query("SELECT a.id,a.status,a.application_url,COALESCE(j.source_url,l.canonical_url) AS source_url,COALESCE(j.title,l.title) AS title FROM applications a LEFT JOIN job_leads j ON j.id=a.job_id LEFT JOIN linkedin_job_intakes l ON l.id=a.linkedin_intake_id AND l.user_id=a.user_id WHERE a.id=$1 AND a.user_id=$2",[id,uid]);
 if(!q.rows.length)return res.status(404).json({error:'Application not found.'});
 if(q.rows[0].status!=='ready_to_apply')return res.status(409).json({error:'Prepare and review the application package before filling any fields.'});
 const review=await db.query("SELECT review_json FROM application_reviews WHERE application_id=$1 AND user_id=$2",[id,uid]);
 if(!review.rows.length||review.rows[0].review_json?.verdict!=='ready')return res.status(409).json({error:'A current independent review with a ready verdict is required before field filling.'});
 const profile=await db.query('SELECT profile_json,notice_period FROM candidate_profiles WHERE user_id=$1',[uid]);
 if(!profile.rows.length)return res.status(409).json({error:'Save a verified candidate profile before field filling.'});
 const source=q.rows[0].application_url||q.rows[0].source_url, provider=classifyProvider(source);
 if(!provider.ok)return res.status(422).json({error:provider.error});
 if(provider.provider!=='greenhouse')return res.status(422).json({error:'The first browser executor release supports Greenhouse only.'});
 const preflight=await fetch(provider.url,{method:'GET',redirect:'manual',headers:{Range:'bytes=0-0'}});
 const redirect=preflight.status>=300&&preflight.status<400||!!preflight.headers.get('location');
 try{await preflight.body?.cancel()}catch{}
 if(redirect||!preflight.ok)return res.status(422).json({error:'The Greenhouse URL failed a redirect-free preflight. No form fields were filled.'});
 try {
  const result=await browser.session(async page=>{
   await page.goto(provider.url,{waitUntil:'domcontentloaded'});
   const landed=classifyProvider(await page.url());
   if(!landed.ok||landed.provider!=='greenhouse')throw new Error('The application page redirected outside the Greenhouse allowlist.');
   const inspected=await page.evaluate(()=>({
    title:document.title||'',
    hasCaptcha:!!document.querySelector('iframe[src*="captcha"],[class*="captcha"],[id*="captcha"]')||/captcha|verify you are human/i.test(document.body?.innerText||''),
    fields:Array.from(document.querySelectorAll('input,select,textarea')).slice(0,100).map(el=>{
     const labels=Array.from(el.labels||[]).map(l=>l.innerText||l.textContent||'').join(' ');
     const parent=el.closest('label')?.innerText||'';
     const name=el.getAttribute('name')||el.id||'';
     const type=(el.getAttribute('type')||el.tagName||'').toLowerCase();
     return {label:labels||parent||el.getAttribute('aria-label')||el.getAttribute('placeholder')||name,name,type,required:el.required===true||el.getAttribute('aria-required')==='true',options:[]};
    }),
    hasFileUpload:!!document.querySelector('input[type="file"]')
   }));
   const mapped=mapApplicationFields(inspected.fields,{...(profile.rows[0].profile_json||{}),notice_period:profile.rows[0].notice_period},String(req.user.email||''));
   const selection=buildApprovedFillPlan(mapped.fields,body.approved_fields);
   if(!selection.ok) return {error:selection.error};
   if(!selection.plan.length)return {error:'No fields were selected.'};
   const filled=await page.evaluate(items=>{
    const elements=Array.from(document.querySelectorAll('input,select,textarea')).slice(0,100);
    const results=[];
    for(const item of items){
     const el=elements[item.index];
     if(!el||String(el.name||el.id||'')!==item.name||String((el.getAttribute('type')||el.tagName||'').toLowerCase())!==item.type){results.push({index:item.index,filled:false});continue;}
     if(el.disabled||el.readOnly||el.type==='password'||el.type==='file'||el.type==='checkbox'||el.type==='radio'||el.tagName==='SELECT'){results.push({index:item.index,filled:false});continue;}
     const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value')?.set;
     if(setter)setter.call(el,item.value);else el.value=item.value;
     el.dispatchEvent(new Event('input',{bubbles:true}));
     el.dispatchEvent(new Event('change',{bubbles:true}));
     results.push({index:item.index,filled:el.value===item.value});
    }
    return results;
   },selection.plan);
   return {filled,hasCaptcha:inspected.hasCaptcha,hasFileUpload:inspected.hasFileUpload,fieldCount:inspected.fields.length,provider:'greenhouse'};
  });
  if(result.error)return res.status(422).json({error:result.error});
  const succeeded=(result.filled||[]).filter(x=>x.filled).length;
  const failed=(result.filled||[]).filter(x=>!x.filled).length;
  return res.json({ok:true,application_id:id,provider:'greenhouse',filled_count:succeeded,skipped_count:failed,has_captcha:result.hasCaptcha,has_file_upload:result.hasFileUpload,human_action_required:!!result.hasCaptcha||!!result.hasFileUpload||failed>0,submitted:false,message:'Only the selected, server-derived profile suggestions were filled. Review every field, complete uploads or human verification yourself, and submit manually. CareerPilot did not click Submit.'});
 } catch(e) {
  console.error('approved Greenhouse form fill failed');
  return res.status(502).json({error:'Could not safely fill the approved Greenhouse fields. No application was submitted.'});
 }
}