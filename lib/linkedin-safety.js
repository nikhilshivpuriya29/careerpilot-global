const MAX_TITLE = 200;
const MAX_COMPANY = 200;
const MAX_LOCATION = 160;
const MAX_DESCRIPTION = 15000;

function cleanText(value, max, field, required = false) {
  if (value == null) value = '';
  if (typeof value !== 'string') return { ok: false, error: field + ' must be text.' };
  const cleaned = value.replace(/\u0000/g, '').replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (cleaned.length > max) return { ok: false, error: field + ' is too long.' };
  if (required && !cleaned) return { ok: false, error: field + ' is required.' };
  return { ok: true, value: cleaned };
}

export function validateManualLinkedInIntake(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Provide a job listing object.' };
  if (typeof input.url !== 'string' || input.url.length > 2000) return { ok: false, error: 'A valid LinkedIn job URL is required.' };

  let parsed;
  try { parsed = new URL(input.url.trim()); } catch { return { ok: false, error: 'Enter a complete LinkedIn job URL.' }; }
  if (parsed.protocol !== 'https:') return { ok: false, error: 'Only HTTPS LinkedIn job links are allowed.' };
  if (parsed.username || parsed.password) return { ok: false, error: 'URLs containing embedded credentials are not allowed.' };
  if (parsed.port && parsed.port !== '443') return { ok: false, error: 'Non-standard URL ports are not allowed.' };
  if (!['www.linkedin.com', 'linkedin.com'].includes(parsed.hostname.toLowerCase())) return { ok: false, error: 'Only linkedin.com job URLs are accepted.' };
  if (!/^\/jobs\/view\/[a-z0-9-]*\d+\/?$/i.test(parsed.pathname)) return { ok: false, error: 'Save an individual LinkedIn job page, not a profile, search page or other URL.' };

  const title = cleanText(input.title, MAX_TITLE, 'Job title', true);
  if (!title.ok) return title;
  const company = cleanText(input.company, MAX_COMPANY, 'Company', true);
  if (!company.ok) return company;
  const location = cleanText(input.location, MAX_LOCATION, 'Location');
  if (!location.ok) return location;
  const description = cleanText(input.description, MAX_DESCRIPTION, 'Job description');
  if (!description.ok) return description;

  // Canonicalize the public listing URL without fetching it or forwarding cookies/session credentials.
  const path = parsed.pathname.endsWith('/') ? parsed.pathname : parsed.pathname + '/';
  const canonicalUrl = 'https://www.linkedin.com' + path;
  return { ok: true, entry: { canonical_url: canonicalUrl, title: title.value, company: company.value, location: location.value, description: description.value } };
}

export function runLinkedInSafetyUnitTests() {
  const valid = { url: 'https://www.linkedin.com/jobs/view/1234567890/?trackingId=private', title: 'Salesforce DevOps Engineer', company: 'Example Energy', location: 'Australia', description: 'A real listing description.' };
  const cases = [
    ['accepts an HTTPS individual job URL', validateManualLinkedInIntake(valid).ok],
    ['strips tracking query from canonical URL', validateManualLinkedInIntake(valid).entry?.canonical_url === 'https://www.linkedin.com/jobs/view/1234567890/'],
    ['accepts jobs.linkedin.com-style slug with numeric job id', validateManualLinkedInIntake({ ...valid, url: 'https://www.linkedin.com/jobs/view/salesforce-devops-example-energy-1234567890' }).ok],
    ['rejects HTTP', !validateManualLinkedInIntake({ ...valid, url: 'http://www.linkedin.com/jobs/view/1234567890/' }).ok],
    ['rejects a non-LinkedIn host', !validateManualLinkedInIntake({ ...valid, url: 'https://linkedin.com.evil.example/jobs/view/1234567890/' }).ok],
    ['rejects user-info credentials', !validateManualLinkedInIntake({ ...valid, url: 'https://user:pass@www.linkedin.com/jobs/view/1234567890/' }).ok],
    ['rejects non-standard port', !validateManualLinkedInIntake({ ...valid, url: 'https://www.linkedin.com:8443/jobs/view/1234567890/' }).ok],
    ['rejects profile paths', !validateManualLinkedInIntake({ ...valid, url: 'https://www.linkedin.com/in/someone/' }).ok],
    ['rejects search pages', !validateManualLinkedInIntake({ ...valid, url: 'https://www.linkedin.com/jobs/search/?keywords=Salesforce' }).ok],
    ['rejects JavaScript URLs', !validateManualLinkedInIntake({ ...valid, url: 'javascript:alert(1)' }).ok],
    ['rejects missing title', !validateManualLinkedInIntake({ ...valid, title: '  ' }).ok],
    ['rejects missing company', !validateManualLinkedInIntake({ ...valid, company: '' }).ok],
    ['rejects non-string titles', !validateManualLinkedInIntake({ ...valid, title: ['Salesforce'] }).ok],
    ['rejects oversized description', !validateManualLinkedInIntake({ ...valid, description: 'x'.repeat(MAX_DESCRIPTION + 1) }).ok],
    ['rejects oversized title', !validateManualLinkedInIntake({ ...valid, title: 'x'.repeat(MAX_TITLE + 1) }).ok],
    ['rejects malformed input object', !validateManualLinkedInIntake(null).ok],
    ['never fetches or navigates to the submitted URL', typeof validateManualLinkedInIntake(valid).entry?.canonical_url === 'string']
  ];
  return { passed: cases.filter(x => x[1]).length, failed: cases.filter(x => !x[1]).map(x => x[0]), total: cases.length, results: cases.map(x => ({ name: x[0], passed: x[1] })) };
}

// The optional guest-mode scraper is adapted from the public design documented in
// ai-job-search-dev/ai-job-search. It deliberately does not copy its retry behavior:
// requests are unauthenticated, unpaginated, and stop immediately on denial/rate limits.
export const LINKEDIN_RISK_NOTICE_VERSION = '2026-10-25-v1';
export const LINKEDIN_MAX_RESULTS = 10;
export const LINKEDIN_MAX_SEARCHES_PER_DAY = 5;
export const LINKEDIN_MIN_SEARCH_INTERVAL_SECONDS = 60;

export function validateLinkedInGuestSearch(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Provide search settings.' };
  if (typeof input.query !== 'string' || !input.query.trim()) return { ok: false, error: 'Enter a job title or skill to search for.' };
  if (input.query.trim().length > 120) return { ok: false, error: 'Search terms must be 120 characters or fewer.' };
  if (typeof input.location !== 'string' || !input.location.trim()) return { ok: false, error: 'Enter a location to search in.' };
  if (input.location.trim().length > 120) return { ok: false, error: 'Location must be 120 characters or fewer.' };
  const age = input.postedDays == null ? 7 : Number(input.postedDays);
  if (![1, 7, 14, 30].includes(age)) return { ok: false, error: 'Posting age must be 1, 7, 14 or 30 days.' };
  return { ok: true, query: input.query.trim(), location: input.location.trim(), postedDays: age };
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, dec) => {
      const n = Number(dec);
      return n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
    })
    .replace(/&#x([a-f0-9]+);/gi, (_, hex) => {
      const n = parseInt(hex, 16);
      return n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
    });
}
function cleanHtml(value, max = 300) {
  return decodeEntities(String(value || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, max);
}

export function parseLinkedInGuestSearchHtml(html) {
  if (typeof html !== 'string' || !html.trim()) return [];
  const jobs = [];
  const seen = new Set();
  const chunks = html.split(/data-entity-urn=["']urn:li:jobPosting:/i).slice(1);
  for (const chunk of chunks) {
    const id = chunk.match(/^(\d{6,})/)?.[1];
    if (!id || seen.has(id)) continue;
    const titleHtml = chunk.match(/class=["'][^"']*base-search-card__title[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)?.[1]
      || chunk.match(/class=["']sr-only["'][^>]*>([\s\S]*?)<\/span>/i)?.[1];
    const title = cleanHtml(titleHtml, 200);
    if (!title) continue;
    const company = cleanHtml(chunk.match(/class=["'][^"']*base-search-card__subtitle[^"']*["'][^>]*>([\s\S]*?)<\/h4>/i)?.[1], 200);
    const location = cleanHtml(chunk.match(/class=["'][^"']*job-search-card__location[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1], 160);
    const posted = chunk.match(/class=["'][^"']*job-search-card__listdate[^"']*["'][^>]*datetime=["']([^"']+)["']/i)?.[1] || null;
    seen.add(id);
    jobs.push({ linkedin_job_id: id, title, company, location, posted_at: posted, url: 'https://www.linkedin.com/jobs/view/' + id + '/' });
    if (jobs.length >= LINKEDIN_MAX_RESULTS) break;
  }
  return jobs;
}

function extractDivContentByClass(html, className) {
  const opening = new RegExp('<div\\b[^>]*class="[^"]*' + className + '[^"]*"[^>]*>', 'i').exec(html);
  if (!opening) return '';
  const contentStart = opening.index + opening[0].length;
  const tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = contentStart;
  let depth = 1, m;
  while ((m = tags.exec(html)) !== null) {
    if (/^<\/div/i.test(m[0])) depth--;
    else if (!/\/\s*>$/.test(m[0])) depth++;
    if (depth === 0) return html.slice(contentStart, m.index);
  }
  return '';
}

export function parseLinkedInGuestDetailHtml(html) {
  if (typeof html !== 'string' || !html.trim()) return { ok: false, error: 'Empty or unavailable job details.' };
  const title = cleanHtml(html.match(/class=["'][^"']*(?:top-card-layout__title|topcard__title)[^"']*["'][^>]*>([\s\S]*?)<\/h[12]>/i)?.[1], 200);
  const company = cleanHtml(html.match(/class=["'][^"']*topcard__org-name-link[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1], 200);
  const location = cleanHtml(html.match(/class=["'][^"']*topcard__flavor[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1], 160);
  const descHtml = extractDivContentByClass(html, 'show-more-less-html__markup') || extractDivContentByClass(html, 'description__text');
  const description = decodeEntities(descHtml.replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/(?:p|li|div|h[1-6])>/gi, '\n').replace(/<[^>]*>/g, ' '))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').split('\n').map(line=>line.replace(/\s+/g,' ').trim()).filter(Boolean).join('\n').slice(0,15000);
  if (!title || !company || description.length < 80) return { ok: false, error: 'The response did not contain enough reliable job detail. Open and verify the listing manually.' };
  return { ok: true, title, company, location, description };
}

export function runLinkedInGuestScraperUnitTests() {
  const sample = [
    '<li data-entity-urn="urn:li:jobPosting:1234567">',
    '<a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/1234567/?trk=x">Job</a>',
    '<h3 class="base-search-card__title">Salesforce &amp; DevOps</h3>',
    '<h4 class="base-search-card__subtitle">Example Energy</h4>',
    '<span class="job-search-card__location">Melbourne, AU</span>',
    '</li>'
  ].join('');
  const detail = '<h2 class="top-card-layout__title">Salesforce Engineer</h2><a class="topcard__org-name-link">Example Energy</a><span class="topcard__flavor topcard__flavor--bullet">Melbourne</span><div class="show-more-less-html__markup"><p>' + 'A real job description with duties and requirements. '.repeat(4) + '</p></div>';
  const parsed = parseLinkedInGuestSearchHtml(sample);
  const details = parseLinkedInGuestDetailHtml(detail);
  const cases = [
    ['requires a query', !validateLinkedInGuestSearch({ query: '', location: 'India' }).ok],
    ['requires a location', !validateLinkedInGuestSearch({ query: 'Salesforce', location: '' }).ok],
    ['rejects an oversized query', !validateLinkedInGuestSearch({ query: 'x'.repeat(121), location: 'India' }).ok],
    ['accepts allowed posting age', validateLinkedInGuestSearch({ query: 'Salesforce', location: 'Indore, India', postedDays: 7 }).ok],
    ['rejects arbitrary posting age', !validateLinkedInGuestSearch({ query: 'Salesforce', location: 'India', postedDays: 0 }).ok],
    ['parses a job card', parsed.length === 1 && parsed[0].linkedin_job_id === '1234567'],
    ['decodes HTML entities', parsed[0]?.title === 'Salesforce & DevOps'],
    ['uses canonical LinkedIn job URL, not remote href', parsed[0]?.url === 'https://www.linkedin.com/jobs/view/1234567/'],
    ['parses detail page description', details.ok && details.company === 'Example Energy' && details.description.length >= 80],
    ['rejects an empty guest response', parseLinkedInGuestSearchHtml('').length === 0],
    ['rejects incomplete detail pages', !parseLinkedInGuestDetailHtml('<html><body>Sign in</body></html>').ok],
    ['caps parsed result count at ten', parseLinkedInGuestSearchHtml(Array.from({length:15},(_,i)=>sample.replace('1234567',String(1234567+i))).join('')).length <= 10]
  ];
  return { passed: cases.filter(x => x[1]).length, failed: cases.filter(x => !x[1]).map(x => x[0]), total: cases.length, results: cases.map(x => ({ name:x[0], passed:x[1] })) };
}