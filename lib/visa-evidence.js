const MAX_TEXT = 14000;
const POSITIVE = [
  /visa sponsorship (?:is )?(?:available|provided|offered)/i,
  /we (?:can|will|are able to) sponsor (?:a |the )?(?:work )?visa/i,
  /will sponsor (?:a |the )?(?:work )?visa/i,
  /sponsorship (?:is )?(?:available|provided|offered)/i,
  /employer-sponsored (?:work )?visa/i
];
const NEGATIVE = [
  /(?:we |the employer )?(?:do not|don't|cannot|can't|will not|won't) sponsor (?:a |the )?(?:work )?visa/i,
  /no visa sponsorship/i,
  /sponsorship (?:is )?not available/i,
  /unable to provide visa sponsorship/i
];
const POSSIBLE = [
  /visa sponsorship/i,
  /work permit support/i,
  /immigration support/i,
  /relocation assistance/i,
  /relocation support/i,
  /skilled worker visa/i
];
function excerpt(text, match) {
  const start=Math.max(0,match.index-100), end=Math.min(text.length,match.index+match[0].length+120);
  return text.slice(start,end).replace(/\s+/g,' ').trim().slice(0,280);
}
export function extractVisaEvidence({title='',description='',sourceUrl='',provider='',checkedAt=new Date().toISOString()}={}) {
  const text=(String(title)+'\n'+String(description)).replace(/\u0000/g,' ').slice(0,MAX_TEXT);
  let status='unknown', match=null, reason='No direct sponsorship statement was found in the retrieved listing text.';
  for(const pattern of NEGATIVE){match=pattern.exec(text);if(match){status='unknown';reason='The listing text appears to state that sponsorship is unavailable; confirm with the employer before ruling the role out.';break}}
  if(!match)for(const pattern of POSITIVE){match=pattern.exec(text);if(match){status='confirmed';reason='The listing contains an explicit sponsorship claim. This is listing evidence only, not independent employer or immigration-authority verification.';break}}
  if(!match)for(const pattern of POSSIBLE){match=pattern.exec(text);if(match){status='possible';reason='The listing contains a sponsorship, work-permit or relocation signal, but does not explicitly confirm employer sponsorship.';break}}
  return {
    status,
    notes:reason,
    evidence:match?excerpt(text,match):'',
    evidence_url:String(sourceUrl||'').slice(0,2000),
    source_provider:String(provider||'').slice(0,80),
    source_type:'public_job_listing_text',
    verification_level:status==='confirmed'?'explicit_listing_claim_unverified':'unverified',
    checked_at:String(checkedAt||'').slice(0,40)
  };
}
export function runVisaEvidenceUnitTests(){
 const cases=[
  ['explicit employer sponsorship is confirmed',extractVisaEvidence({description:'We will sponsor a work visa for the successful candidate.'}).status==='confirmed'],
  ['negative sponsorship statement is not classified as positive',extractVisaEvidence({description:'We do not sponsor a visa for this role.'}).status==='unknown'],
  ['generic sponsorship mention remains possible',extractVisaEvidence({description:'Visa sponsorship may be discussed during recruitment.'}).status==='possible'],
  ['relocation alone is not confirmation',extractVisaEvidence({description:'Relocation assistance is available.'}).status==='possible'],
  ['no evidence remains unknown',extractVisaEvidence({description:'Salesforce Developer role.'}).status==='unknown'],
  ['evidence excerpt is bounded',extractVisaEvidence({description:'Visa sponsorship available. '+'x'.repeat(1000)}).evidence.length<=280],
  ['source URL is retained',extractVisaEvidence({description:'Visa sponsorship available.',sourceUrl:'https://jobs.example.test/1'}).evidence_url==='https://jobs.example.test/1'],
  ['explicit claim is marked unverified',extractVisaEvidence({description:'Visa sponsorship available.'}).verification_level==='explicit_listing_claim_unverified']
 ];
 return {passed:cases.filter(x=>x[1]).length,failed:cases.filter(x=>!x[1]).map(x=>x[0]),total:cases.length,results:cases.map(x=>({name:x[0],passed:x[1]}))};
}