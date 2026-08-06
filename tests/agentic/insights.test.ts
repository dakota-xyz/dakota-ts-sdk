/**
 * Insights resource tests (ALPHA) — read-only advisory reporting.
 */

import { describe, it, expect } from 'vitest';

import { DakotaClient } from '../../src/client/client.js';
import { createRoutedFetch } from './helpers.js';

const CUSTOMER_ID = 'cust_1';

function makeClient(fetchImpl: typeof fetch) {
  return new DakotaClient({
    apiKey: 'test',
    baseURL: 'http://localhost',
    fetch: fetchImpl,
    retryPolicy: { maxAttempts: 1, initialBackoffMs: 1, maxBackoffMs: 1 },
  });
}

const REPORT = {
  customer_id: CUSTOMER_ID,
  generated_at: 1783075200,
  snapshot: {
    total_usd: '3100.25',
    upcoming: { days: 14, count: 3, totals: { USDC: '5200' } },
    open_scheduled_payments: 5,
    active_mandates: 2,
  },
  insights: [
    {
      kind: 'upcoming_payments',
      severity: 'info',
      message: '3 payment(s) scheduled in the next 14 days (5200 USDC).',
      detail: { count: 3, window_days: 14 },
      evidence: [{ type: 'scheduled_payment', id: 'sp_1' }],
    },
  ],
  suggestions: [],
};

describe('InsightsResource', () => {
  it('exposes the insights resource on the client', () => {
    const { fetch } = createRoutedFetch({});
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);
    expect(client.insights).toBeDefined();
    expect(typeof client.insights.get).toBe('function');
  });

  it('gets the insight report', async () => {
    const { fetch, requests } = createRoutedFetch({
      [`GET /customers/${CUSTOMER_ID}/insights`]: () => ({ status: 200, body: REPORT }),
    });
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);

    const report = await client.insights.get(CUSTOMER_ID);

    expect(report.customer_id).toBe(CUSTOMER_ID);
    expect(report.snapshot.open_scheduled_payments).toBe(5);
    expect(report.insights[0]?.kind).toBe('upcoming_payments');
    expect(report.insights[0]?.evidence[0]?.type).toBe('scheduled_payment');
    expect(requests[0]?.method).toBe('GET');
  });
});
