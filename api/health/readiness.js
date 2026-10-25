import { ai, config, db } from 'hatchable';
import { isAiProviderConfigurationError } from '../../lib/ai-availability.js';
import { summarizeIntegrationReadiness } from '../../lib/integration-readiness.js';
import { enforceUserRateLimit } from '../../lib/rate-limits.js';

export const access = 'user';
export const methods = ['GET'];

export default async function(req, res) {
  const uid = String(req.user.id);
  const limit = await enforceUserRateLimit(db, uid, 'integration-readiness-check', 3);
  if (!limit.allowed) {
    return res.status(429).json({
      error: 'Readiness checks are limited to three per minute.',
      retry_after_seconds: limit.retryAfterSeconds
    });
  }

  let adzunaConfigured = false;
  try {
    const appId = await config.get('ADZUNA_APP_ID');
    const appKey = await config.get('ADZUNA_APP_KEY');
    adzunaConfigured = Boolean(String(appId || '').trim() && String(appKey || '').trim());
  } catch {}

  let aiStatus = 'not_checked';
  try {
    const result = await ai.generateText({
      model: 'sonnet',
      purpose: 'integration-readiness-probe',
      userId: uid,
      maxTokens: 12,
      system: 'Return exactly the single word READY. Do not include anything else.',
      prompt: 'Reply READY.'
    });
    aiStatus = String(result?.text || '').trim().toUpperCase() === 'READY' ? 'ready' : 'check_failed';
  } catch (error) {
    aiStatus = isAiProviderConfigurationError(error) ? 'needs_configuration' : 'check_failed';
  }

  return res.json({
    checked_at: new Date().toISOString(),
    ...summarizeIntegrationReadiness({ adzunaConfigured, aiStatus })
  });
}