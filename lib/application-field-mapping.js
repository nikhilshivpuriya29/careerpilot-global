const SENSITIVE = /citizen|citizenship|visa|sponsor|sponsorship|work authori[sz]ation|immigration|race|ethnic|gender|sex(ual)?|disab|veteran|military|criminal|conviction|background check|date of birth|birth date|marital|religion|national origin|legally eligible|right to work|relocat|salary expectation|expected salary|compensation|salary|pronoun|demographic|eeo|equal employment|self-identif|consent|declaration|attest/i;
const FILE = /file|resume|cv|cover letter|attachment|upload/i;
const CAPTCHA = /captcha|recaptcha|hcaptcha|verify you are human/i;
function clean(v, max=240) { return typeof v === 'string' ? v.trim().slice(0,max) : ''; }
function norm(v) { return clean(v,500).toLowerCase().replace(/[_-]+/g,' ').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim(); }
function hasAny(s, terms) { return terms.some(t => s.includes(t)); }
export function mapApplicationFields(fields, profile, accountEmail='') {
 const input = Array.isArray(fields) ? fields.slice(0,100) : [];
 const p = profile && typeof profile === 'object' && !Array.isArray(profile) ? profile : {};
 const result = input.map((raw, index) => {
  const f = raw && typeof raw === 'object' ? raw : {};
  const label = clean(f.label,240), name = clean(f.name,120), type = clean(f.type,30).toLowerCase();
  const key = norm(label+' '+name), isSensitive = SENSITIVE.test(key), isCaptcha = CAPTCHA.test(key), isFile = type==='file' || FILE.test(key);
  let value = '', source = '', confidence = 'none', reason = 'No reliable profile match; answer manually.';
  if (isCaptcha) reason = 'CAPTCHA or human-verification controls must be completed by the user.';
  else if (isFile) reason = 'File uploads are not automated; attach the reviewed document manually.';
  else if (isSensitive) reason = 'Sensitive or legal answer: never infer this from a profile or AI. Answer personally.';
  else if (type==='checkbox' || type==='radio') reason = 'Consent or selection control needs explicit user review.';
  else {
   const pick = (v, s, c='high') => { if(typeof v==='string' && v.trim()) { value=v.trim().slice(0,1000); source=s; confidence=c; reason='Suggested from saved candidate profile; verify before use.'; return true; } return false; };
   if (hasAny(key,['email','e mail'])) pick(accountEmail,'signed-in account email');
   else if (hasAny(key,['first name','given name'])) pick(clean(p.name).split(/\s+/)[0],'candidate profile');
   else if (hasAny(key,['last name','surname','family name'])) { const parts=clean(p.name).split(/\s+/); pick(parts.length>1?parts.slice(1).join(' '):'','candidate profile'); }
   else if (hasAny(key,['full name','your name','candidate name','legal name'])) pick(clean(p.name),'candidate profile');
   else if (hasAny(key,['current company','current employer','employer name'])) pick(clean(p.company),'candidate profile');
   else if (hasAny(key,['current title','job title','current role','professional headline'])) pick(clean(p.role||p.headline),'candidate profile');
   else if (hasAny(key,['linkedin','profile url','portfolio','personal website','github url'])) pick(clean(p[key.includes('linkedin')?'linkedin':key.includes('github')?'github':'portfolio']),'candidate profile','medium');
   else if (hasAny(key,['city','current location','location'])) pick(clean(p.currentLocation),'candidate profile','medium');
   else if (hasAny(key,['education','degree','university','college','school'])) pick(clean(p.education),'candidate profile','medium');
   else if (hasAny(key,['skills','technical skills'])) pick(clean(p.skills),'candidate profile','medium');
   else if (hasAny(key,['certification','certificate'])) pick(clean(p.certifications),'candidate profile','medium');
   else if (hasAny(key,['years of experience','professional experience','experience summary'])) pick(clean(p.experience),'candidate profile','low');
   else if (hasAny(key,['notice period','availability to start'])) pick(clean(p.notice_period||p.notice),'candidate profile','medium');
  }
  return {index,label,name,type,required:f.required===true,suggested_value:value,source,confidence,requires_confirmation:true,manual_action:!value,reason};
 });
 return {ok:true,fields:result,field_count:result.length,auto_fill_performed:false,submission_performed:false,manual_count:result.filter(x=>x.manual_action).length};
}
export function runFieldMappingUnitTests() {
 const p={name:'Nikhil Shivpuriya',company:'Gentrack',role:'Salesforce DevOps Engineer',education:'B.Tech Computer Science',skills:'Salesforce, Apex, LWC',certifications:'Salesforce Certified Administrator',currentLocation:'Indore',experience:'Salesforce DevOps'};
 const cases=[
  ['maps full name',mapApplicationFields([{label:'Full name',name:'name',type:'text'}],p).fields[0].suggested_value==='Nikhil Shivpuriya'],
  ['maps email only from account identity',mapApplicationFields([{label:'Email address',name:'email',type:'email'}],p,'candidate@example.test').fields[0].suggested_value==='candidate@example.test'],
  ['never guesses citizenship',mapApplicationFields([{label:'Are you a US citizen?',name:'citizen',type:'select'}],p).fields[0].manual_action],
  ['never guesses sponsorship',mapApplicationFields([{label:'Will you need sponsorship?',name:'sponsorship',type:'select'}],p).fields[0].manual_action],
  ['file uploads stay manual',mapApplicationFields([{label:'Resume upload',name:'resume',type:'file'}],p).fields[0].manual_action],
  ['CAPTCHA stays manual',mapApplicationFields([{label:'g-recaptcha-response',name:'captcha',type:'text'}],p).fields[0].manual_action],
  ['checkboxes require confirmation',mapApplicationFields([{label:'Agree to terms',name:'terms',type:'checkbox'}],p).fields[0].manual_action],
  ['every suggestion requires confirmation',mapApplicationFields([{label:'Full name',name:'name',type:'text'}],p).fields[0].requires_confirmation],
  ['field count is bounded',mapApplicationFields(Array.from({length:150},(_,i)=>({label:'field '+i,name:'f'+i,type:'text'})),p).field_count===100],
  ['does not mutate profile',p.name==='Nikhil Shivpuriya']
 ];
 return {passed:cases.filter(x=>x[1]).length,failed:cases.filter(x=>!x[1]).map(x=>x[0]),total:cases.length,results:cases.map(x=>({name:x[0],passed:x[1]}))};
}