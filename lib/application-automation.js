export const PROVIDERS = Object.freeze({greenhouse:['boards.greenhouse.io','job-boards.greenhouse.io','boards.eu.greenhouse.io'],lever:['jobs.lever.co'],ashby:['jobs.ashbyhq.com'],workable:['apply.workable.com']});
export function validateApplicationUrl(rawUrl) {
 if(typeof rawUrl!=='string'||rawUrl.length>2048)return {ok:false,error:'A valid HTTPS application URL is required.'};
 let url;try{url=new URL(rawUrl)}catch{return {ok:false,error:'Application URL is invalid.'}}
 if(url.protocol!=='https:')return {ok:false,error:'Only HTTPS application URLs are allowed.'};
 if(url.username||url.password)return {ok:false,error:'URLs containing embedded credentials are blocked.'};
 if(url.port&&url.port!=='443')return {ok:false,error:'Non-standard ports are blocked.'};
 const host=url.hostname.toLowerCase().replace(/\.$/,'');
 if(!host||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)||/^172\.(1[6-9]|2\d|3[01])\./.test(host)||host==='::1'||host.startsWith('['))return {ok:false,error:'Private or local network destinations are blocked.'};
 url.hash='';return {ok:true,url:url.toString(),hostname:host};
}
export function classifyProvider(rawUrl) {
 const checked=validateApplicationUrl(rawUrl);if(!checked.ok)return {ok:false,error:checked.error};
 let url;try{url=new URL(checked.url)}catch{return {ok:false,error:'Application URL is invalid.'}}
 for(const [provider,hosts] of Object.entries(PROVIDERS)) {
  if(!hosts.includes(checked.hostname))continue;
  const path=url.pathname;
  const validPath=provider==='greenhouse'?/^\/[a-z0-9._-]+\/jobs\/[0-9]+(?:\/.*)?$/i.test(path):provider==='lever'?/^\/[a-z0-9._-]+\/[a-z0-9._-]+(?:\/.*)?$/i.test(path):provider==='ashby'?/^\/[a-z0-9._-]+\/[a-z0-9._-]+(?:\/.*)?$/i.test(path):/^\/[a-z0-9._-]+\/(?:j|jobs)\/[a-z0-9._-]+(?:\/.*)?$/i.test(path);
  if(!validPath)return {ok:false,error:'The URL is not a recognized public job/application path for this provider.'};
  return {ok:true,provider,url:checked.url,hostname:checked.hostname};
 }
 return {ok:false,error:'This job board is not yet supported for browser automation. Use the source link manually.'};
}
export function summarizeFormFields(fields) {
 if(!Array.isArray(fields))return {ok:false,error:'Form inspection returned an invalid result.'};
 const safe=fields.slice(0,100).map(f=>({label:String(f?.label||f?.name||f?.type||'Unlabelled field').replace(/[\u0000-\u001f]/g,' ').slice(0,160),name:String(f?.name||'').slice(0,160),type:String(f?.type||'unknown').slice(0,40),required:f?.required===true,options:Array.isArray(f?.options)?f.options.slice(0,30).map(x=>String(x).slice(0,120)):[]}));
 const hasFileUpload=safe.some(f=>f.type==='file'),fileUploadRequired=safe.some(f=>f.type==='file'&&f.required),hasCaptcha=safe.some(f=>/captcha|recaptcha|hcaptcha/i.test(f.name+' '+f.label));
 return {ok:true,fields:safe,hasFileUpload,fileUploadRequired,hasCaptcha,requiresHumanStep:hasFileUpload||hasCaptcha};
}
export function runAutomationGuardUnitTests() {
 const cases=[
 ['Greenhouse host supported',classifyProvider('https://boards.greenhouse.io/acme/jobs/123').provider==='greenhouse'],
 ['Lever host supported',classifyProvider('https://jobs.lever.co/acme/123').provider==='lever'],
 ['Provider root path rejected',classifyProvider('https://boards.greenhouse.io/').ok===false],
 ['Unrecognized Greenhouse path rejected',classifyProvider('https://boards.greenhouse.io/acme/login').ok===false],
 ['Unknown host rejected',classifyProvider('https://example.com/apply').ok===false],
 ['Lookalike provider domain rejected',classifyProvider('https://boards.greenhouse.io.evil.example/apply').ok===false],
 ['Subdomain suffix spoof rejected',classifyProvider('https://evil.jobs.lever.co.example/apply').ok===false],
 ['HTTP rejected',validateApplicationUrl('http://boards.greenhouse.io/acme').ok===false],
 ['Embedded credentials rejected',validateApplicationUrl('https://user:pass@boards.greenhouse.io/acme').ok===false],
 ['Localhost blocked',validateApplicationUrl('https://localhost/admin').ok===false],
 ['Private IPv4 blocked',validateApplicationUrl('https://192.168.1.1/apply').ok===false],
 ['Non-standard port blocked',validateApplicationUrl('https://boards.greenhouse.io:8443/acme').ok===false],
 ['Invalid URL rejected',validateApplicationUrl('not a url').ok===false],
 ['File upload flagged',summarizeFormFields([{name:'resume',type:'file',required:true}]).requiresHumanStep===true],
 ['Captcha flagged',summarizeFormFields([{name:'g-recaptcha-response',type:'text'}]).requiresHumanStep===true],
 ['Field output bounded',summarizeFormFields(Array.from({length:150},(_,i)=>({name:'f'+i,type:'text'}))).fields.length===100]
 ];
 return {passed:cases.filter(x=>x[1]).length,failed:cases.filter(x=>!x[1]).map(x=>x[0]),total:cases.length,results:cases.map(x=>({name:x[0],passed:x[1]}))};
}