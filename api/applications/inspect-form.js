import { browser, db } from 'hatchable';
import { classifyProvider, summarizeFormFields } from '../../lib/application-automation.js';
import { enforceUserRateLimit } from '../../lib/rate-limits.js';
export const access='user';
export const methods=['POST'];
export default async function(req,res) {
 const uid=String(req.user.id),id=Number((req.body||{}).application_id);
 if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'A valid application_id is required.'});
 const limit=await enforceUserRateLimit(db,uid,'inspect-form',8);if(!limit.allowed)return res.status(429).json({error:'ATS inspection rate limit reached. Retry in the next minute.',retry_after_seconds:limit.retryAfterSeconds});
 const q=await db.query('SELECT a.id,a.status,a.application_url,j.source_url,j.title,j.company FROM applications a LEFT JOIN job_leads j ON j.id=a.job_id WHERE a.id=$1 AND a.user_id=$2',[id,uid]);
 if(!q.rows.length)return res.status(404).json({error:'Application not found.'});
 const app=q.rows[0],provider=classifyProvider(app.application_url||app.source_url);
 if(!provider.ok)return res.status(422).json({error:provider.error,automation:'unsupported'});
 try {
  // A redirect-free HEAD/GET preflight reduces SSRF risk before Chromium is allowed to navigate.
  // Fail closed when the provider redirects or rejects the probe; managed Chromium has no request-interception API.
  const preflight=await fetch(provider.url,{method:'GET',redirect:'manual',headers:{Range:'bytes=0-0'}});
  const preflightLocation=preflight.headers.get('location');
  const redirectStatus=preflight.status>=300&&preflight.status<400;
  if(redirectStatus||preflightLocation){try{await preflight.body?.cancel()}catch{}return res.status(422).json({error:'The ATS URL redirects. Open the source listing manually; automated inspection is blocked for safety.',automation:'manual_action_required'});}
  if(!preflight.ok){try{await preflight.body?.cancel()}catch{}return res.status(422).json({error:'The ATS URL could not pass the safe preflight check. Open the source listing manually.',automation:'manual_action_required'});}
  try{await preflight.body?.cancel()}catch{}
  const inspected=await browser.session(async page=>{
   await page.goto(provider.url,{waitUntil:'domcontentloaded'});
   const landedUrl=await page.url();
   const landedProvider=classifyProvider(landedUrl);
   if(!landedProvider.ok||landedProvider.provider!==provider.provider) throw new Error('Redirected outside the supported ATS host allowlist');
   return await page.evaluate(()=>({title:document.title||'',fields:Array.from(document.querySelectorAll('input,select,textarea')).slice(0,100).map(el=>{const labels=Array.from(el.labels||[]).map(l=>l.innerText||l.textContent||'').join(' '),parent=el.closest('label')?.innerText||'',name=el.getAttribute('name')||el.id||'',type=(el.getAttribute('type')||el.tagName||'').toLowerCase();return {label:labels||parent||el.getAttribute('aria-label')||el.getAttribute('placeholder')||name,name,type,required:el.required===true||el.getAttribute('aria-required')==='true',options:el.tagName==='SELECT'?Array.from(el.options||[]).slice(0,30).map(o=>o.textContent||''):[]}}),bodyText:(document.body?.innerText||'').slice(0,12000),hasCaptcha:!!document.querySelector('iframe[src*="captcha"],[class*="captcha"],[id*="captcha"]')}));
  });
  const summary=summarizeFormFields(inspected.fields),captcha=summary.hasCaptcha||inspected.hasCaptcha||/captcha|verify you are human/i.test(inspected.bodyText||'');
  return res.json({ok:true,application_id:id,provider:provider.provider,page_title:String(inspected.title||'').slice(0,200),fields:summary.fields,field_count:summary.fields.length,has_more_fields:summary.fields.length>=100,has_file_upload:summary.hasFileUpload,captcha_detected:captcha,automation_status:(captcha||summary.hasFileUpload)?'human_action_required':'inspection_only',message:'Inspection only: no fields were filled, no files uploaded, and no application was submitted.'});
 }catch(e){console.error('application form inspection failed');return res.status(502).json({error:'Could not inspect this application form. No application was submitted.',automation:'manual_action_required'});}
}