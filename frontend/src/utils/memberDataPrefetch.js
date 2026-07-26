import axios from 'axios';
import { getIntentData } from './intentDataCache';

const getSessionScope = (currentUser) => {
  const gymId = Number(currentUser?.gym_id);
  const userId = Number(currentUser?.id);
  return Number.isInteger(gymId) && Number.isInteger(userId) ? `${gymId}:${userId}` : '';
};

const buildKey = (kind, { currentUser, branchScopeValue = '', page = 1, limit = 30, search = '', status = 'ALL' }) => {
  const sessionScope = getSessionScope(currentUser);
  if (!sessionScope) return '';
  return [
    'members',
    kind,
    sessionScope,
    String(branchScopeValue || ''),
    String(page),
    String(limit),
    String(search || '').trim().toLowerCase(),
    String(status || 'ALL').trim().toUpperCase(),
  ].join(':');
};

export const getMembersListData = ({
  token,
  currentUser,
  branchScopeValue,
  page = 1,
  limit = 30,
  search = '',
  status = 'ALL',
  useIntentCache = false,
}) => {
  const loader = () => axios.get('/api/members', {
    headers: { 'x-auth-token': token },
    suppressGlobalErrorToast: true,
    params: {
      paginate: true,
      page,
      limit,
      search: search || undefined,
      status,
      branch_id: branchScopeValue,
    },
  });

  if (!useIntentCache) return loader();
  return getIntentData(buildKey('list', {
    currentUser,
    branchScopeValue,
    page,
    limit,
    search,
    status,
  }), loader);
};

export const getMembersSummaryData = ({
  token,
  currentUser,
  branchScopeValue,
  useIntentCache = false,
}) => {
  const loader = () => axios.get('/api/members/summary', {
    headers: { 'x-auth-token': token },
    suppressGlobalErrorToast: true,
    params: { branch_id: branchScopeValue },
  });

  if (!useIntentCache) return loader();
  return getIntentData(buildKey('summary', {
    currentUser,
    branchScopeValue,
  }), loader);
};

export const prefetchMembersEntryData = ({ token, currentUser, branchScopeValue }) => Promise.all([
  getMembersListData({
    token,
    currentUser,
    branchScopeValue,
    page: 1,
    limit: 30,
    search: '',
    status: 'ALL',
    useIntentCache: true,
  }),
  getMembersSummaryData({
    token,
    currentUser,
    branchScopeValue,
    useIntentCache: true,
  }),
]);