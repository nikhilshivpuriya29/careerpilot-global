const ALLOWED_TYPES = new Set(['text','email','tel','url','textarea']);
const SENSITIVE = /citizen|citizenship|visa|sponsor|sponsorship|work authori[sz]ation|immigration|race|ethnic|gender|sex(ual)?|disab|veteran|military|criminal|conviction|background check|date of birth|birth date|marital|religion|national origin|legally eligible|right to work|relocat|salary|compensation|pronoun|demographic|eeo|equal employment|self-identif|consent|declaration|attest|password|captcha/i;
export function buildApprovedFillPlan(mappedFields, approvedIndices) {
  if (!Array.isArray(mappedFields) || !Array.isArray(approvedIndices) || approvedIndices.length > 50) return { ok:false, error:'Select up to 50 suggested fields.' };
  const selected = approvedIndices.map(item => typeof item === 'number' ? { index:item } : item);
  const indices = selected.map(item => item?.index);
  if (indices.some(i => !Number.isSafeInteger(i) || i < 0 || i >= 100) || new Set(indices).size !== indices.length) return { ok:false, error:'Approved field selection is invalid.' };
  const byIndex = new Map(mappedFields.map(f => [f.index, f]));
  const plan = [];
  for (const approval of selected) {
    const index = approval.index;
    const f = byIndex.get(index);
    if (approval.name !== undefined && (String(approval.name) !== String(f?.name || '') || String(approval.type) !== String(f?.type || '') || String(approval.label) !== String(f?.label || ''))) return { ok:false, error:'The inspected form changed. Refresh the form and approve the current fields again.' };
    if (!f || f.manual_action || !String(f.suggested_value || '').trim()) return { ok:false, error:'One or more selected fields have no verified profile suggestion.' };
    const type = String(f.type || '').toLowerCase();
    const key = String(f.label || '') + ' ' + String(f.name || '');
    if (!ALLOWED_TYPES.has(type) || SENSITIVE.test(key) || /\\b(file|upload|resume|cv|cover letter)\\b/i.test(key)) return { ok:false, error:'A selected field requires manual handling and cannot be filled.' };
    plan.push({ index, name:String(f.name || '').slice(0,160), type, label:String(f.label || '').slice(0,160), value:String(f.suggested_value).slice(0,1000) });
  }
  return { ok:true, plan };
}
export function runApprovedFillUnitTests() {
  const fields = [
    {index:0,label:'Full name',name:'full_name',type:'text',suggested_value:'Candidate',manual_action:false},
    {index:1,label:'Email',name:'email',type:'email',suggested_value:'candidate@example.test',manual_action:false},
    {index:2,label:'US citizenship',name:'citizen',type:'text',suggested_value:'No',manual_action:false},
    {index:3,label:'Resume upload',name:'resume',type:'file',suggested_value:'',manual_action:true},
    {index:4,label:'Agree to terms',name:'terms',type:'checkbox',suggested_value:'',manual_action:true},
    {index:5,label:'LinkedIn profile',name:'linkedin',type:'url',suggested_value:'https://example.test/in/candidate',manual_action:false}
  ];
  const good=buildApprovedFillPlan(fields,[0,1,5].map(index=>({index,name:fields[index].name,type:fields[index].type,label:fields[index].label})));
  const cases=[
    ['allows only explicitly approved safe suggestions',good.ok&&good.plan.length===3],
    ['rejects sensitive legal fields',!buildApprovedFillPlan(fields,[2]).ok],
    ['rejects file uploads',!buildApprovedFillPlan(fields,[3]).ok],
    ['rejects checkboxes and consent controls',!buildApprovedFillPlan(fields,[4]).ok],
    ['rejects duplicate indices',!buildApprovedFillPlan(fields,[0,0]).ok],
    ['rejects out-of-range indices',!buildApprovedFillPlan(fields,[99]).ok],
    ['rejects empty selections',buildApprovedFillPlan(fields,[]).ok&&buildApprovedFillPlan(fields,[]).plan.length===0],
    ['rejects stale field identity after a form changes',!buildApprovedFillPlan(fields,[{index:0,name:'company',type:'text',label:'Company'}]).ok],
    ['does not mutate source mappings',fields[0].suggested_value==='Candidate']
  ];
  return {passed:cases.filter(x=>x[1]).length,failed:cases.filter(x=>!x[1]).map(x=>x[0]),total:cases.length,results:cases.map(x=>({name:x[0],passed:x[1]}))};
}