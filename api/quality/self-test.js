import { runAutomationGuardUnitTests } from '../../lib/application-automation.js';
import { runFieldMappingUnitTests } from '../../lib/application-field-mapping.js';
import { runDocumentUploadUnitTests } from '../../lib/document-upload.js';
import { runAiAvailabilityUnitTests } from '../../lib/ai-availability.js';
import { runLinkedInSafetyUnitTests, runLinkedInGuestScraperUnitTests } from '../../lib/linkedin-safety.js';
import { runRateLimitUnitTests } from '../../lib/rate-limits.js';
import { runLinkedInPolicyUnitTests } from '../../lib/linkedin-policy.js';
import { runIntegrationReadinessUnitTests } from '../../lib/integration-readiness.js';
export const access='admin';
export const methods=['GET'];
export default async function(req,res) {
 const suites=[{name:'automation-guardrails',...runAutomationGuardUnitTests()},{name:'field-mapping-safety',...runFieldMappingUnitTests()},{name:'private-document-validation',...runDocumentUploadUnitTests()},{name:'ai-availability-classification',...runAiAvailabilityUnitTests()},{name:'integration-readiness-summary',...runIntegrationReadinessUnitTests()},{name:'linkedin-account-safety',...runLinkedInSafetyUnitTests()},{name:'linkedin-guest-parser-validation',...runLinkedInGuestScraperUnitTests()},{name:'linkedin-automation-policy',...runLinkedInPolicyUnitTests()},{name:'rate-limit-policy',...runRateLimitUnitTests()}];
 const results=suites.flatMap(s=>s.results.map(r=>({...r,suite:s.name})));
 const failed=results.filter(r=>!r.passed);
 return res.status(failed.length?500:200).json({ok:failed.length===0,suite:'careerpilot-automation-security',passed:results.length-failed.length,failed:failed.map(x=>x.suite+': '+x.name),total:results.length,suites:suites.map(({name,passed,total,failed})=>({name,passed,total,failed})),results,note:'Deterministic unit tests only; not a full penetration test or proof of cross-account isolation.'});
}