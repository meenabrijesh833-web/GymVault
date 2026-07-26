import assert from 'node:assert/strict';
import axios from 'axios';
import { getIntentData, invalidateIntentData } from '../src/utils/intentDataCache.js';
import { canPrefetchPageData, getPaymentsLedgerData } from '../src/utils/pageDataPrefetch.js';

let loaderCalls = 0;
const loader = async () => {
  loaderCalls += 1;
  return { call: loaderCalls };
};

const [first, second] = await Promise.all([
  getIntentData('members:list:test', loader),
  getIntentData('members:list:test', loader),
]);
assert.equal(loaderCalls, 1);
assert.deepEqual(first, second);

const cached = await getIntentData('members:list:test', loader);
assert.equal(loaderCalls, 1);
assert.deepEqual(cached, first);

invalidateIntentData('members:');
const refreshed = await getIntentData('members:list:test', loader);
assert.equal(loaderCalls, 2);
assert.equal(refreshed.call, 2);

let rejectionCalls = 0;
await assert.rejects(getIntentData('members:error:test', async () => {
  rejectionCalls += 1;
  throw new Error('expected prefetch failure');
}));
const recovered = await getIntentData('members:error:test', async () => {
  rejectionCalls += 1;
  return 'recovered';
});
assert.equal(rejectionCalls, 2);
assert.equal(recovered, 'recovered');

invalidateIntentData();

const originalAxiosGet = axios.get;
let requestCalls = 0;
axios.get = async (_url, config) => {
  requestCalls += 1;
  return { data: { requestCalls, params: config.params } };
};

const baseRequest = {
  token: 'test-token',
  currentUser: { id: 11, gym_id: 22 },
  branchScopeValue: 'branch-1',
  page: 1,
  limit: 20,
  filter: 'All',
};
await Promise.all([
  getPaymentsLedgerData(baseRequest),
  getPaymentsLedgerData(baseRequest),
]);
assert.equal(requestCalls, 1);

await getPaymentsLedgerData({ ...baseRequest, branchScopeValue: 'branch-2' });
assert.equal(requestCalls, 2);

invalidateIntentData();
await getPaymentsLedgerData(baseRequest);
assert.equal(requestCalls, 3);
axios.get = originalAxiosGet;

const originalNavigator = globalThis.navigator;
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { connection: { saveData: true, effectiveType: '4g' } },
});
assert.equal(canPrefetchPageData(), false);
globalThis.navigator.connection.saveData = false;
globalThis.navigator.connection.effectiveType = '2g';
assert.equal(canPrefetchPageData(), false);
globalThis.navigator.connection.effectiveType = '4g';
assert.equal(canPrefetchPageData(), true);
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });

invalidateIntentData();
console.log('Intent data prefetch deduplication, branch isolation, invalidation, rejection recovery, and network guard checks passed.');