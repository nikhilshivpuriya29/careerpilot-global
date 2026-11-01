import test from 'node:test';
import assert from 'node:assert/strict';
import { runAutomationGuardUnitTests, classifyProvider, validateApplicationUrl } from '../../lib/application-automation.js';
import { runFieldMappingUnitTests, mapApplicationFields } from '../../lib/application-field-mapping.js';
import { runApprovedFillUnitTests, buildApprovedFillPlan } from '../../lib/application-form-executor.js';
import { runAiAvailabilityUnitTests } from '../../lib/ai-availability.js';
import { runIntegrationReadinessUnitTests, summarizeIntegrationReadiness } from '../../lib/integration-readiness.js';
import { runRateLimitUnitTests, rateLimitDecision, isSupportedRateLimitAction } from '../../lib/rate-limits.js';

function assertSuite(suite) {
  assert.equal(suite.failed.length, 0, suite.failed.join(', '));
  assert.equal(suite.passed, suite.total);
}

test('application URL and provider allowlists', () => {
  assertSuite(runAutomationGuardUnitTests());
  assert.equal(classifyProvider('https://boards.greenhouse.io/acme/jobs/123').provider, 'greenhouse');
  assert.equal(classifyProvider('https://jobs.lever.co/acme/123').provider, 'lever');
  assert.equal(classifyProvider('http://boards.greenhouse.io/acme/jobs/1').ok, false);
  assert.equal(classifyProvider('https://boards.greenhouse.io.evil.test/acme/jobs/1').ok, false);
  assert.equal(validateApplicationUrl('https://127.0.0.1/acme/jobs/1').ok, false);
});

test('candidate field mapping never guesses sensitive answers', () => {
  assertSuite(runFieldMappingUnitTests());
  const mapped = mapApplicationFields([{label:'Do you need sponsorship?',name:'sponsorship',type:'text'}], {name:'Candidate'});
  assert.equal(mapped.fields[0].manual_action, true);
  assert.equal(mapped.fields[0].suggested_value, '');
});

test('approved form filling is explicit, bounded and identity-bound', () => {
  assertSuite(runApprovedFillUnitTests());
  const fields = [{index:0,label:'Full name',name:'full_name',type:'text',suggested_value:'Candidate',manual_action:false}];
  assert.equal(buildApprovedFillPlan(fields,[{index:0,name:'full_name',type:'text',label:'Full name'}]).ok,true);
  assert.equal(buildApprovedFillPlan(fields,[{index:0,name:'other',type:'text',label:'Full name'}]).ok,false);
  assert.equal(buildApprovedFillPlan(fields,[{index:0,name:'full_name',type:'text',label:'Full name'}]).plan[0].value,'Candidate');
});

test('AI configuration and readiness fail closed', () => {
  assertSuite(runAiAvailabilityUnitTests());
  assertSuite(runIntegrationReadinessUnitTests());
  assert.equal(summarizeIntegrationReadiness({adzunaConfigured:true,aiStatus:'unknown'}).core_integrations_ready,false);
});

test('rate limits reject unknown actions and enforce bounds', () => {
  assertSuite(runRateLimitUnitTests());
  assert.equal(isSupportedRateLimitAction('fill-approved-fields'),true);
  assert.equal(isSupportedRateLimitAction('admin-everything'),false);
  assert.equal(rateLimitDecision(101,100).allowed,false);
});
