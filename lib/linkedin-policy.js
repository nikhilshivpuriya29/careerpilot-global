export const LINKEDIN_AUTOMATION_POLICY = Object.freeze({
  mode: 'manual_import_only',
  automatedScrapingEnabled: false,
  authenticatedScrapingEnabled: false,
  browserAutomationEnabled: false,
  captchaBypassEnabled: false,
  proxyRotationEnabled: false,
  retryAfterAccessDenial: false,
  reason: 'Automated LinkedIn scraping is disabled because no implementation can guarantee account safety or establish permission to scrape.'
});

export function getLinkedInSafeDecision(choice) {
  if (choice === 'safe_manual') {
    return { accepted: true, mode: 'manual_import_only', scrapingEnabled: false };
  }
  if (choice === 'enable_scraper') {
    return { accepted: false, mode: 'manual_import_only', scrapingEnabled: false, error: 'Automated LinkedIn scraping remains disabled. Use manual import or an authorized integration.' };
  }
  return { accepted: false, mode: 'manual_import_only', scrapingEnabled: false, error: 'Choose the safe manual-import mode.' };
}

export function runLinkedInPolicyUnitTests() {
  const safe = getLinkedInSafeDecision('safe_manual');
  const blocked = getLinkedInSafeDecision('enable_scraper');
  const unknown = getLinkedInSafeDecision('anything-else');
  const cases = [
    ['automated scraping defaults off', LINKEDIN_AUTOMATION_POLICY.automatedScrapingEnabled === false],
    ['authenticated scraping is disabled', LINKEDIN_AUTOMATION_POLICY.authenticatedScrapingEnabled === false],
    ['browser automation is disabled', LINKEDIN_AUTOMATION_POLICY.browserAutomationEnabled === false],
    ['CAPTCHA bypass is disabled', LINKEDIN_AUTOMATION_POLICY.captchaBypassEnabled === false],
    ['proxy rotation is disabled', LINKEDIN_AUTOMATION_POLICY.proxyRotationEnabled === false],
    ['access-denial retries are disabled', LINKEDIN_AUTOMATION_POLICY.retryAfterAccessDenial === false],
    ['safe choice enables only manual import', safe.accepted && safe.mode === 'manual_import_only' && safe.scrapingEnabled === false],
    ['scraper-enable choice is rejected', !blocked.accepted && blocked.scrapingEnabled === false],
    ['unknown choice fails closed', !unknown.accepted && unknown.scrapingEnabled === false],
    ['policy explains why scraper is disabled', LINKEDIN_AUTOMATION_POLICY.reason.includes('guarantee account safety')]
  ];
  return { passed: cases.filter(x => x[1]).length, failed: cases.filter(x => !x[1]).map(x => x[0]), total: cases.length, results: cases.map(x => ({ name:x[0], passed:x[1] })) };
}