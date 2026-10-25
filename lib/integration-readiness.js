const AI_STATES = new Set(['ready', 'needs_configuration', 'check_failed', 'not_checked']);

export function summarizeIntegrationReadiness({ adzunaConfigured = false, aiStatus = 'not_checked' } = {}) {
  const safeAiStatus = AI_STATES.has(aiStatus) ? aiStatus : 'check_failed';
  return {
    core_integrations_ready: adzunaConfigured === true && safeAiStatus === 'ready',
    integrations: {
      adzuna: {
        status: adzunaConfigured === true ? 'configured' : 'needs_configuration',
        required_secrets: adzunaConfigured === true ? [] : ['ADZUNA_APP_ID', 'ADZUNA_APP_KEY']
      },
      ai: {
        status: safeAiStatus,
        required_for: ['job relevance scoring', 'resume tailoring', 'application review']
      },
      linkedin: {
        status: 'manual_import_only',
        automated_scraping_enabled: false
      },
      application_submission: {
        status: 'manual_handoff_only',
        automatic_submission_enabled: false
      }
    },
    note: 'This checks core configuration only. It is not a full production-readiness or security certification.'
  };
}

export function runIntegrationReadinessUnitTests() {
  const ready = summarizeIntegrationReadiness({ adzunaConfigured: true, aiStatus: 'ready' });
  const adzunaMissing = summarizeIntegrationReadiness({ adzunaConfigured: false, aiStatus: 'ready' });
  const aiMissing = summarizeIntegrationReadiness({ adzunaConfigured: true, aiStatus: 'needs_configuration' });
  const unknown = summarizeIntegrationReadiness({ adzunaConfigured: true, aiStatus: 'token-or-secret-value' });
  const cases = [
    ['marks configured core integrations ready', ready.core_integrations_ready],
    ['lists Adzuna secret names only when missing', JSON.stringify(adzunaMissing.integrations.adzuna.required_secrets) === '["ADZUNA_APP_ID","ADZUNA_APP_KEY"]'],
    ['never emits secret values', !JSON.stringify(adzunaMissing).includes('token-or-secret-value')],
    ['marks missing AI configuration not ready', !aiMissing.core_integrations_ready && aiMissing.integrations.ai.status === 'needs_configuration'],
    ['keeps LinkedIn automation disabled', aiMissing.integrations.linkedin.automated_scraping_enabled === false],
    ['keeps automatic submission disabled', aiMissing.integrations.application_submission.automatic_submission_enabled === false],
    ['unknown AI status fails closed', unknown.integrations.ai.status === 'check_failed' && !unknown.core_integrations_ready],
    ['warns that readiness is not a security certification', ready.note.includes('not a full production-readiness')]
  ];
  return { passed: cases.filter(x => x[1]).length, failed: cases.filter(x => !x[1]).map(x => x[0]), total: cases.length, results: cases.map(x => ({ name:x[0], passed:x[1] })) };
}