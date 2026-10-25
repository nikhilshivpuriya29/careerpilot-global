import { LINKEDIN_RISK_NOTICE_VERSION } from './linkedin-safety.js';

export const LINKEDIN_AUTOMATION_POLICY = Object.freeze({
  mode: 'public_guest_search_opt_in',
  automatedScrapingEnabled: false,
  authenticatedScrapingEnabled: false,
  browserAutomationEnabled: false,
  captchaBypassEnabled: false,
  proxyRotationEnabled: false,
  retryAfterAccessDenial: false,
  reason: 'Public guest search is disabled by default and can be enabled only after two explicit user confirmations.'
});

export function getLinkedInSafeDecision(choice, confirmationOne = false, confirmationTwo = false) {
  if (choice === 'safe_manual') return { accepted:true, mode:'manual_import_only', scrapingEnabled:false };
  if (choice === 'enable_scraper' && confirmationOne === true && confirmationTwo === true) {
    return { accepted:true, mode:'public_guest_search', scrapingEnabled:true, noticeVersion:LINKEDIN_RISK_NOTICE_VERSION };
  }
  if (choice === 'enable_scraper') return { accepted:false, mode:'manual_import_only', scrapingEnabled:false, error:'Two separate risk confirmations are required.' };
  return { accepted:false, mode:'manual_import_only', scrapingEnabled:false, error:'Choose manual import or complete both public guest-search confirmations.' };
}

export function runLinkedInPolicyUnitTests() {
  const safe = getLinkedInSafeDecision('safe_manual');
  const blocked = getLinkedInSafeDecision('enable_scraper', true, false);
  const enabled = getLinkedInSafeDecision('enable_scraper', true, true);
  const unknown = getLinkedInSafeDecision('anything-else', true, true);
  const cases = [
    ['guest scraping is off by default', LINKEDIN_AUTOMATION_POLICY.automatedScrapingEnabled === false],
    ['authenticated scraping is disabled', LINKEDIN_AUTOMATION_POLICY.authenticatedScrapingEnabled === false],
    ['browser automation is disabled', LINKEDIN_AUTOMATION_POLICY.browserAutomationEnabled === false],
    ['CAPTCHA bypass is disabled', LINKEDIN_AUTOMATION_POLICY.captchaBypassEnabled === false],
    ['proxy rotation is disabled', LINKEDIN_AUTOMATION_POLICY.proxyRotationEnabled === false],
    ['access-denial retries are disabled', LINKEDIN_AUTOMATION_POLICY.retryAfterAccessDenial === false],
    ['manual choice stays manual', safe.accepted && safe.mode === 'manual_import_only' && !safe.scrapingEnabled],
    ['one confirmation cannot enable guest search', !blocked.accepted && !blocked.scrapingEnabled],
    ['two confirmations permit guest-search opt-in', enabled.accepted && enabled.mode === 'public_guest_search' && enabled.scrapingEnabled],
    ['unknown choice fails closed', !unknown.accepted && !unknown.scrapingEnabled],
    ['policy explains opt-in default', LINKEDIN_AUTOMATION_POLICY.reason.includes('two explicit user confirmations')]
  ];
  return { passed:cases.filter(x=>x[1]).length, failed:cases.filter(x=>!x[1]).map(x=>x[0]), total:cases.length, results:cases.map(x=>({name:x[0],passed:x[1]})) };
}