const DEFAULT_FRONTEND_URL = 'https://gymvault.tech';
const DEFAULT_BACKEND_URL = 'https://gymvault-earv.onrender.com';

const normalizeBaseUrl = (value, fallback) => String(value || fallback || '').trim().replace(/\/+$/, '');

const frontendBaseUrl = normalizeBaseUrl(process.env.SMOKE_FRONTEND_URL, DEFAULT_FRONTEND_URL);
const backendBaseUrl = normalizeBaseUrl(process.env.SMOKE_BACKEND_URL, DEFAULT_BACKEND_URL);
const frontendOrigin = new URL(frontendBaseUrl).origin;
const ownerToken = String(process.env.SMOKE_OWNER_TOKEN || '').trim();

const warnings = [];
const results = [];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pushResult = (status, label, detail) => {
  results.push({ status, label, detail });
  const prefix = status === 'pass' ? 'PASS' : status === 'warn' ? 'WARN' : 'FAIL';
  console.log(`${prefix} ${label}: ${detail}`);
};

const pushWarning = (label, detail) => {
  warnings.push({ label, detail });
  pushResult('warn', label, detail);
};

const readBody = async (response) => {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (_error) {
    return text;
  }
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertFiniteNumber = (value, label) => {
  assert(Number.isFinite(Number(value)), `${label} must be numeric`);
};

const headerIncludes = (response, headerName, expectedFragment) => {
  const value = String(response.headers.get(headerName) || '').toLowerCase();
  return value.includes(String(expectedFragment || '').toLowerCase());
};

const fetchWithRetry = async (url, options = {}, attempts = 3) => {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await delay(400 * attempt);
      }
    }
  }

  throw lastError || new Error(`Request failed for ${url}`);
};

const requestJson = async (url, options = {}) => {
  const response = await fetchWithRetry(url, options);
  const body = await readBody(response);
  return { response, body };
};

const runCheck = async (label, check) => {
  try {
    const detail = await check();
    pushResult('pass', label, detail);
  } catch (error) {
    pushResult('fail', label, error.message || 'Unknown failure');
  }
};

const runWarningCheck = async (label, check) => {
  try {
    const detail = await check();
    pushResult('pass', label, detail);
  } catch (error) {
    warnings.push({ label, detail: error.message || 'Unknown warning' });
    pushResult('warn', label, error.message || 'Unknown warning');
  }
};

const checkBackendHealth = async () => {
  const { response, body } = await requestJson(`${backendBaseUrl}/healthz`);
  assert(response.ok, `expected 200, got ${response.status}`);
  assert(body && body.status === 'ok', 'backend health did not report status=ok');
  assert(body.database === 'reachable', 'backend health did not report database=reachable');
  return `${response.status} ${body.service}`;
};

const checkFrontendRewriteHealth = async () => {
  const { response, body } = await requestJson(`${frontendBaseUrl}/api/auth/config`);
  assert(response.ok, `expected 200, got ${response.status}`);
  assert(body && typeof body.google_auth_enabled === 'boolean', 'frontend rewrite auth config did not return expected shape');
  assert(body && body.billing_catalog && typeof body.billing_catalog === 'object', 'frontend rewrite auth config is missing billing_catalog');
  return `${response.status} via frontend rewrite`;
};

const checkGoogleOAuthRedirect = async () => {
  const response = await fetchWithRetry(`${frontendBaseUrl}/api/auth/google`, {
    redirect: 'manual',
    headers: {
      origin: frontendOrigin,
    },
  });

  assert([302, 303].includes(response.status), `expected redirect status, got ${response.status}`);

  const location = String(response.headers.get('location') || '');
  assert(location, 'google auth redirect is missing location header');
  assert(
    location.includes('accounts.google.com') || location.includes('/login?auth_error=google_not_configured'),
    'google auth redirect points to an unexpected destination'
  );

  return location.includes('accounts.google.com') ? 'redirects to Google consent' : 'redirects to frontend fallback';
};

const checkFrontendShellHeaders = async () => {
  const response = await fetchWithRetry(`${frontendBaseUrl}/`);
  assert(response.ok, `expected 200, got ${response.status}`);
  assert(headerIncludes(response, 'cache-control', 'no-store'), 'frontend shell is missing no-store cache policy');
  return String(response.headers.get('cache-control') || '');
};

const checkManifestHeaders = async () => {
  const response = await fetchWithRetry(`${frontendBaseUrl}/manifest.webmanifest`);
  assert(response.ok, `expected 200, got ${response.status}`);
  assert(headerIncludes(response, 'content-type', 'application/manifest+json'), 'manifest content-type is incorrect');
  return String(response.headers.get('content-type') || '');
};

const checkServiceWorker = async () => {
  const response = await fetchWithRetry(`${frontendBaseUrl}/sw.js`);
  assert(response.ok, `expected 200, got ${response.status}`);
  assert(headerIncludes(response, 'cache-control', 'must-revalidate'), 'service worker cache policy is incorrect');

  const text = String(await response.text() || '');
  const precacheMatch = text.match(/const PRECACHE_URLS = \[(?<body>[\s\S]*?)\];/);
  assert(precacheMatch?.groups?.body, 'could not inspect service worker precache list');
  const precacheBody = precacheMatch.groups.body;

  assert(!precacheBody.includes('/index.html'), 'service worker precache must not include index.html');
  assert(!precacheBody.includes('/assets/'), 'service worker precache must not include hashed asset bundles');

  return String(response.headers.get('cache-control') || '');
};

const checkInvalidLogin = async (baseUrl, label) => {
  const { response, body } = await requestJson(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: frontendOrigin,
    },
    body: JSON.stringify({
      email: 'nonexistent@gymvault.tech',
      password: 'DefinitelyWrong123!',
    }),
  });

  assert(response.status === 400, `${label} expected 400, got ${response.status}`);
  assert(body && body.message === 'Invalid email or password.', `${label} returned unexpected body`);
  return `${response.status} Invalid email or password.`;
};

const checkAnonymousBillingConfigProtection = async (baseUrl, label) => {
  const { response, body } = await requestJson(`${baseUrl}/api/billing/config`, {
    headers: {
      origin: frontendOrigin,
    },
  });

  assert(response.status === 401, `${label} expected 401, got ${response.status}`);
  assert(body && body.code === 'AUTH_MISSING', `${label} returned unexpected body`);

  return `${response.status} ${body.code}`;
};

const checkDirectBackendCorsHeaders = async () => {
  const response = await fetchWithRetry(`${backendBaseUrl}/api/auth/login`, {
    method: 'OPTIONS',
    headers: {
      origin: frontendOrigin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  });

  assert(response.ok, `expected 200, got ${response.status}`);

  const allowOrigin = String(response.headers.get('access-control-allow-origin') || '');
  const allowCredentials = String(response.headers.get('access-control-allow-credentials') || '');

  assert(allowOrigin === frontendOrigin, `expected access-control-allow-origin=${frontendOrigin || '(empty)'}, got ${allowOrigin || '(empty)'}`);
  assert(allowCredentials.toLowerCase() === 'true', 'direct backend preflight is missing access-control-allow-credentials=true');

  return `${allowOrigin} credentials=${allowCredentials}`;
};

const requestOwnerJson = async (pathname) => {
  assert(ownerToken, 'SMOKE_OWNER_TOKEN is required for owner authenticated checks');

  return requestJson(`${frontendBaseUrl}${pathname}`, {
    headers: {
      origin: frontendOrigin,
      'x-auth-token': ownerToken,
      authorization: `Bearer ${ownerToken}`,
    },
  });
};

const checkOwnerBillingConfig = async () => {
  const { response, body } = await requestOwnerJson('/api/billing/config');
  assert(response.ok, `expected 200, got ${response.status}`);
  assert(String(body?.razorpay_key_id || '').trim(), 'owner billing config did not include a Razorpay key id');
  return `${response.status} billing gateway configured`;
};

const checkOwnerDashboardStats = async () => {
  const { response, body } = await requestOwnerJson('/api/dashboard/stats');
  assert(response.ok, `expected 200, got ${response.status}`);
  assert(body && typeof body.is_active === 'boolean', 'dashboard stats did not return expected shape');

  if (body.is_active) {
    assertFiniteNumber(body.active_members, 'dashboard active_members');
    assertFiniteNumber(body.total_earnings, 'dashboard total_earnings');
    assertFiniteNumber(body.monthly_revenue, 'dashboard monthly_revenue');
    assertFiniteNumber(body.today_checkins, 'dashboard today_checkins');
  }

  return `${response.status} active=${body.is_active}`;
};

const checkOwnerSetupStatus = async () => {
  const { response, body } = await requestOwnerJson('/api/dashboard/setup-status');
  assert(response.ok, `expected 200, got ${response.status}`);
  assertFiniteNumber(body?.progress, 'setup progress');
  assert(body && typeof body.steps === 'object' && body.steps !== null, 'setup status did not include steps');
  assert(body && typeof body.recommended === 'object' && body.recommended !== null, 'setup status did not include recommended flags');
  return `${response.status} progress=${body.progress}`;
};

const checkOwnerIntegrations = async () => {
  const { response, body } = await requestOwnerJson('/api/settings/integrations');
  assert(response.ok, `expected 200, got ${response.status}`);
  assert(body && typeof body.gateway_connected === 'boolean', 'integrations payload is missing gateway_connected');
  assert(body && body.member_payments && typeof body.member_payments === 'object', 'integrations payload is missing member_payments');
  assert(Array.isArray(body?.templates), 'integrations payload is missing templates array');
  assert(typeof body.member_payments.has_razorpay_secret === 'boolean', 'integrations payload is missing payment secret flag');
  return `${response.status} payments=${body.member_payments.onboarding_status || 'unknown'} templates=${body.templates.length}`;
};

const checkOwnerSupportOverview = async () => {
  const { response, body } = await requestOwnerJson('/api/support/overview');
  assert(response.ok, `expected 200, got ${response.status}`);
  assert(body && typeof body.contact === 'object' && body.contact !== null, 'support overview is missing contact section');
  assert(body && typeof body.about === 'object' && body.about !== null, 'support overview is missing about section');
  return `${response.status} support overview loaded`;
};

const main = async () => {
  console.log(`Frontend base: ${frontendBaseUrl}`);
  console.log(`Backend base: ${backendBaseUrl}`);

  await runCheck('Backend health', checkBackendHealth);
  await runCheck('Frontend rewrite health', checkFrontendRewriteHealth);
  await runCheck('Google OAuth redirect', checkGoogleOAuthRedirect);
  await runCheck('Frontend shell headers', checkFrontendShellHeaders);
  await runCheck('Manifest headers', checkManifestHeaders);
  await runCheck('Service worker policy', checkServiceWorker);
  await runCheck('Frontend invalid login', () => checkInvalidLogin(frontendBaseUrl, 'frontend invalid login'));
  await runCheck('Backend invalid login', () => checkInvalidLogin(backendBaseUrl, 'backend invalid login'));
  await runCheck('Frontend billing config auth guard', () => checkAnonymousBillingConfigProtection(frontendBaseUrl, 'frontend billing config auth guard'));
  await runCheck('Backend billing config auth guard', () => checkAnonymousBillingConfigProtection(backendBaseUrl, 'backend billing config auth guard'));
  await runWarningCheck('Direct backend CORS headers', checkDirectBackendCorsHeaders);

  if (!ownerToken) {
    pushWarning('Owner authenticated audit', 'Skipped: set SMOKE_OWNER_TOKEN to enable read-only owner route checks.');
  } else {
    await runCheck('Owner billing config', checkOwnerBillingConfig);
    await runCheck('Owner dashboard stats', checkOwnerDashboardStats);
    await runCheck('Owner setup status', checkOwnerSetupStatus);
    await runCheck('Owner integrations', checkOwnerIntegrations);
    await runCheck('Owner support overview', checkOwnerSupportOverview);
  }

  const failures = results.filter((entry) => entry.status === 'fail');

  console.log(`\nSummary: ${results.filter((entry) => entry.status === 'pass').length} passed, ${warnings.length} warnings, ${failures.length} failed.`);

  if (warnings.length > 0) {
    console.log('Warnings indicate non-blocking deployment hygiene issues that should be reviewed.');
  }

  if (failures.length > 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(`FATAL ${error.message || error}`);
  process.exitCode = 1;
});