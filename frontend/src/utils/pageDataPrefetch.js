import axios from 'axios';
import { getIntentData } from './intentDataCache.js';

const getSessionScope = (currentUser) => {
  const gymId = Number(currentUser?.gym_id);
  const userId = Number(currentUser?.id);
  return Number.isInteger(gymId) && Number.isInteger(userId) ? `${gymId}:${userId}` : '';
};

const normalizeParams = (params = {}) => Object.fromEntries(
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))
);

const buildRequestKey = ({ page, kind, currentUser, branchScopeValue, params }) => {
  const sessionScope = getSessionScope(currentUser);
  if (!sessionScope) return '';

  return [
    'page-entry',
    sessionScope,
    String(branchScopeValue || 'all').toLowerCase(),
    page,
    kind,
    JSON.stringify(normalizeParams(params)),
  ].join(':');
};

const getPageRequest = ({
  page,
  kind,
  token,
  currentUser,
  branchScopeValue,
  url,
  params,
  config = {},
  useIntentCache = true,
}) => {
  const normalizedParams = normalizeParams(params);
  const loader = () => axios.get(url, {
    ...config,
    headers: {
      ...(config.headers || {}),
      'x-auth-token': token,
    },
    params: normalizedParams,
  });

  if (!useIntentCache) return loader();
  return getIntentData(buildRequestKey({
    page,
    kind,
    currentUser,
    branchScopeValue,
    params: normalizedParams,
  }), loader);
};

export const canPrefetchPageData = () => {
  if (typeof navigator === 'undefined') return true;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) return true;
  return !connection.saveData && !['slow-2g', '2g'].includes(String(connection.effectiveType || '').toLowerCase());
};

export const getDashboardEntryData = ({
  token,
  currentUser,
  branchScopeValue,
  useIntentCache = true,
  timeoutMs = 12000,
}) => {
  const branchParams = branchScopeValue ? { branch_id: branchScopeValue } : {};
  const config = { timeout: timeoutMs, suppressGlobalErrorToast: true };
  const requests = [
    ['members', '/api/members', branchParams],
    ['plans', '/api/memberships/plans', branchParams],
    ['payment-stats', '/api/payments/stats', branchParams],
    ['payment-chart-30', '/api/payments/chart', { ...branchParams, days: 30 }],
    ['payment-chart-7', '/api/payments/chart', { ...branchParams, days: 7 }],
    ['attendance-summary', '/api/attendance/summary', branchParams],
    ['attendance-today', '/api/attendance/today', branchParams],
    ['setup-status', '/api/dashboard/setup-status', branchParams],
    ['churn-scores', '/api/notifications/campaign/churn-scores', { ...branchParams, limit: 30 }],
    ['campaign-logs', '/api/notifications/campaign/logs', { ...branchParams, limit: 50 }],
    ['lead-summary', '/api/leads/summary', branchParams],
    ['settings', '/api/settings', branchParams],
  ];

  return Promise.allSettled(requests.map(([kind, url, params]) => getPageRequest({
    page: 'dashboard',
    kind,
    token,
    currentUser,
    branchScopeValue,
    url,
    params,
    config,
    useIntentCache,
  })));
};

const getDefaultPaymentsFrom = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 30);
  return start.toISOString().slice(0, 10);
};

export const getPaymentsEntryData = ({
  token,
  currentUser,
  branchScopeValue,
  from,
  to,
  useIntentCache = true,
}) => {
  const branchParams = branchScopeValue ? { branch_id: branchScopeValue } : {};
  const dateParams = { from, to };
  const requests = [
    ['payments-compact', '/api/payments', { ...dateParams, compact: true, ...branchParams }],
    ['payment-stats', '/api/payments/stats', { ...dateParams, ...branchParams }],
    ['member-options', '/api/members/options', { limit: 20, ...branchParams }],
    ['plans', '/api/memberships/plans', branchParams],
  ];

  return Promise.all(requests.map(([kind, url, params]) => getPageRequest({
    page: 'payments',
    kind,
    token,
    currentUser,
    branchScopeValue,
    url,
    params,
    useIntentCache,
  })));
};

export const getPaymentsLedgerData = ({
  token,
  currentUser,
  branchScopeValue,
  page = 1,
  limit = 20,
  search,
  filter = 'All',
  from,
  to,
  useIntentCache = true,
}) => getPageRequest({
  page: 'payments',
  kind: 'ledger',
  token,
  currentUser,
  branchScopeValue,
  url: '/api/payments',
  params: {
    paginate: true,
    page,
    limit,
    search,
    filter,
    from,
    to,
    branch_id: branchScopeValue,
  },
  useIntentCache,
});

export const getPaymentsFinanceOverviewData = ({
  token,
  currentUser,
  branchScopeValue,
  period = '30d',
  from,
  to,
  useIntentCache = true,
}) => getPageRequest({
  page: 'payments',
  kind: 'finance-overview',
  token,
  currentUser,
  branchScopeValue,
  url: '/api/finance/overview',
  params: { period, from, to, branch_id: branchScopeValue },
  useIntentCache,
});

const getAttendanceData = ({ kind, url, token, currentUser, branchScopeValue, params, useIntentCache = true }) => getPageRequest({
  page: 'attendance',
  kind,
  token,
  currentUser,
  branchScopeValue,
  url,
  params: { branch_id: branchScopeValue, ...params },
  useIntentCache,
});

export const getAttendanceOverviewBundleData = ({ token, currentUser, branchScopeValue, useIntentCache = true }) => Promise.all([
  getAttendanceData({ kind: 'overview', url: '/api/attendance/overview', token, currentUser, branchScopeValue, useIntentCache }),
  getAttendanceData({ kind: 'feed', url: '/api/attendance/feed', token, currentUser, branchScopeValue, params: { limit: 25 }, useIntentCache }),
  getAttendanceData({ kind: 'heatmap', url: '/api/attendance/heatmap', token, currentUser, branchScopeValue, params: { days: 84 }, useIntentCache }),
  getAttendanceData({ kind: 'mode', url: '/api/attendance/mode', token, currentUser, branchScopeValue, useIntentCache }),
]);

export const getAttendancePeakHoursData = ({ token, currentUser, branchScopeValue, days, today, useIntentCache = true }) => getAttendanceData({
  kind: 'peak-hours',
  url: '/api/attendance/peak-hours',
  token,
  currentUser,
  branchScopeValue,
  params: { days, today },
  useIntentCache,
});

export const getAttendanceRecordsData = ({ token, currentUser, branchScopeValue, page = 1, limit = 50, range = 'today', from, to, useIntentCache = true }) => getAttendanceData({
  kind: 'records',
  url: '/api/attendance/records',
  token,
  currentUser,
  branchScopeValue,
  params: { paginate: true, page, limit, range, from, to },
  useIntentCache,
});

export const getAttendanceInactiveData = ({ token, currentUser, branchScopeValue, days = 7, useIntentCache = true }) => getAttendanceData({
  kind: 'inactive',
  url: '/api/attendance/inactive',
  token,
  currentUser,
  branchScopeValue,
  params: { days },
  useIntentCache,
});

export const getAttendanceLeaderboardData = ({ token, currentUser, branchScopeValue, days = 30, limit = 6, useIntentCache = true }) => getAttendanceData({
  kind: 'leaderboard',
  url: '/api/attendance/leaderboard',
  token,
  currentUser,
  branchScopeValue,
  params: { days, limit },
  useIntentCache,
});

export const getInsightsOverviewData = ({ token, currentUser, branchScopeValue, range = '6M', useIntentCache = true }) => getPageRequest({
  page: 'insights',
  kind: 'overview',
  token,
  currentUser,
  branchScopeValue,
  url: '/api/insights/overview',
  params: { range, branch_id: branchScopeValue },
  useIntentCache,
});

export const getInsightsFranchiseData = ({ token, currentUser, range = '6M', useIntentCache = true }) => getPageRequest({
  page: 'insights',
  kind: 'franchise',
  token,
  currentUser,
  branchScopeValue: 'all',
  url: '/api/insights/franchise',
  params: { range },
  useIntentCache,
});

export const getSettingsEntryData = ({ token, currentUser, branchScopeValue, useIntentCache = true }) => getPageRequest({
  page: 'settings',
  kind: 'settings',
  token,
  currentUser,
  branchScopeValue,
  url: '/api/settings',
  config: { timeout: 12000 },
  useIntentCache,
});

export const getSettingsBillingConfigData = ({ token, currentUser, branchScopeValue, useIntentCache = true }) => getPageRequest({
  page: 'settings',
  kind: 'billing-config',
  token,
  currentUser,
  branchScopeValue,
  url: '/api/billing/config',
  useIntentCache,
});

export const prefetchPageEntryData = ({ page, token, currentUser, branchScopeValue }) => {
  if (page === 'Dashboard') {
    return getDashboardEntryData({ token, currentUser, branchScopeValue, useIntentCache: true });
  }
  if (page === 'Payments') {
    const from = getDefaultPaymentsFrom();
    return Promise.all([
      getPaymentsEntryData({ token, currentUser, branchScopeValue, from, useIntentCache: true }),
      getPaymentsLedgerData({ token, currentUser, branchScopeValue, from, useIntentCache: true }),
      getPaymentsFinanceOverviewData({ token, currentUser, branchScopeValue, period: '30d', from, useIntentCache: true }),
    ]);
  }
  if (page === 'Attendance') {
    return Promise.all([
      getAttendanceOverviewBundleData({ token, currentUser, branchScopeValue, useIntentCache: true }),
      getAttendancePeakHoursData({ token, currentUser, branchScopeValue, days: 7, useIntentCache: true }),
      getAttendanceRecordsData({ token, currentUser, branchScopeValue, useIntentCache: true }),
      getAttendanceInactiveData({ token, currentUser, branchScopeValue, useIntentCache: true }),
      getAttendanceLeaderboardData({ token, currentUser, branchScopeValue, useIntentCache: true }),
    ]);
  }
  if (page === 'Insights') {
    const currentPlan = String(currentUser?.saas_plan || currentUser?.current_plan || '').toLowerCase();
    const canViewFranchise = String(currentUser?.role || '').toUpperCase() === 'OWNER' && ['growth', 'pro'].includes(currentPlan);
    return Promise.all([
      getInsightsOverviewData({ token, currentUser, branchScopeValue, useIntentCache: true }),
      getAttendancePeakHoursData({ token, currentUser, branchScopeValue, days: 7, useIntentCache: true }),
      ...(canViewFranchise ? [getInsightsFranchiseData({ token, currentUser, useIntentCache: true })] : []),
    ]);
  }
  if (page === 'Settings') {
    return Promise.all([
      getSettingsEntryData({ token, currentUser, branchScopeValue, useIntentCache: true }),
      getSettingsBillingConfigData({ token, currentUser, branchScopeValue, useIntentCache: true }),
    ]);
  }
  return Promise.resolve([]);
};