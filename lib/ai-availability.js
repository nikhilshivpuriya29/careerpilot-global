export function isAiProviderConfigurationError(error) {
  const message = String(error?.message || error || '');
  return /no anthropic.{0,80}api key|provider.{0,30}key.{0,30}(missing|required|not configured)|AI.{0,30}(not configured|configuration required)/i.test(message);
}

export function runAiAvailabilityUnitTests() {
  const cases = [
    ['recognizes missing Anthropic key', isAiProviderConfigurationError(new Error('this project has no Anthropic (Claude) API key'))],
    ['recognizes missing provider key', isAiProviderConfigurationError('Provider key is missing')],
    ['recognizes AI configuration required', isAiProviderConfigurationError('AI configuration required before use')],
    ['does not classify transient timeout as configuration', !isAiProviderConfigurationError(new Error('request timed out'))],
    ['does not classify malformed JSON as configuration', !isAiProviderConfigurationError('Unexpected token in JSON')],
    ['does not treat empty error as configuration', !isAiProviderConfigurationError('')]
  ];
  return { passed: cases.filter(x => x[1]).length, failed: cases.filter(x => !x[1]).map(x => x[0]), total: cases.length, results: cases.map(x => ({ name: x[0], passed: x[1] })) };
}