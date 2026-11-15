import test from 'node:test';
import assert from 'node:assert/strict';
import { extractVisaEvidence, runVisaEvidenceUnitTests } from '../../lib/visa-evidence.js';

test('visa evidence is traceable and never overstates verification', () => {
  const suite=runVisaEvidenceUnitTests();
  assert.equal(suite.failed.length,0,suite.failed.join(', '));
  const result=extractVisaEvidence({title:'Salesforce DevOps Engineer',description:'We will sponsor a work visa for the successful candidate.',sourceUrl:'https://jobs.example.test/role/1',provider:'Example Board'});
  assert.equal(result.status,'confirmed');
  assert.equal(result.verification_level,'explicit_listing_claim_unverified');
  assert.equal(result.evidence_url,'https://jobs.example.test/role/1');
  assert.match(result.notes,/not independent employer/i);
});
test('relocation wording does not become confirmed sponsorship', () => {
  assert.equal(extractVisaEvidence({description:'Relocation assistance provided.'}).status,'possible');
});
test('negative wording is never treated as a positive sponsorship claim', () => {
  assert.equal(extractVisaEvidence({description:'We do not sponsor visas.'}).status,'unknown');
});
