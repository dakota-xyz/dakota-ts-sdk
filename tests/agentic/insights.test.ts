/**
 * Insights resource tests (BETA) — read-only advisory reporting.
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

  describe('client-level portfolio report', () => {
    const CLIENT_REPORT = {
      generated_at: 1788337300,
      window_days: 14,
      snapshot: {
        customers: { total: 42, scanned: 42, with_activity: 17, with_critical: 2 },
        total_usd: '1284500.00',
        upcoming: { days: 14, count: 31, totals: { USDC: '412600' } },
        open_scheduled_payments: 44,
        active_mandates: 57,
        metrics: [
          {
            key: 'executed_volume',
            label: 'Executed volume',
            asset: 'USDC',
            value: '861200',
            previous: '702300',
            change_pct: '22.6',
          },
          { key: 'failed_payments', label: 'Payments failed', value: '9', previous: '3' },
        ],
      },
      series: {
        bucket: 'day',
        from: 1787097600,
        to: 1789516800,
        metrics: {
          failed_payments: [{ t: 1787097600, v: '0' }],
          'executed_volume.USDC': [{ t: 1787097600, v: '41200' }],
        },
      },
      facets: {
        kinds: ['payment_failures_clustered', 'recipient_dormant'],
        severities: ['info', 'warn'],
        responsibilities: ['compliance', 'payment_ops'],
        assets: ['USDC'],
      },
      insights: [
        {
          kind: 'payment_failures_clustered',
          severity: 'warn',
          responsibility: 'payment_ops',
          message: '7 payments across 2 customers failed with mandate_denied.',
          detail: { count: 7, customer_ids: ['cust_a', 'cust_b'] },
          evidence: [{ type: 'scheduled_payment', id: 'sp_1' }],
        },
        {
          kind: 'recipient_dormant',
          severity: 'info',
          responsibility: 'compliance',
          customer_id: 'cust_a',
          message: 'Recipient "Northwind Ltd" has not been paid in 123 days.',
          detail: { recipient_id: 'rcp_1', days_since_last_use: 123 },
          evidence: [{ type: 'recipient', id: 'rcp_1' }],
        },
      ],
      suggestions: [],
      customers: [
        {
          customer_id: 'cust_a',
          name: 'Acme Robotics',
          total_usd: '84200.00',
          open_scheduled_payments: 6,
          active_mandates: 4,
          upcoming: { days: 14, count: 5, totals: { USDC: '9400' } },
          item_counts: { critical: 1, warn: 1, info: 1 },
          last_activity_at: 1788310000,
        },
      ],
    };

    it('gets the whole-book report with no filters', async () => {
      const { fetch, requests } = createRoutedFetch({
        'GET /insights': () => ({ status: 200, body: CLIENT_REPORT }),
      });
      const client = makeClient(fetch as unknown as typeof globalThis.fetch);

      const report = await client.insights.getClientReport();

      expect(requests[0]?.method).toBe('GET');
      expect(requests[0]?.query).toEqual({});
      expect(report.snapshot.customers.scanned).toBe(42);
      expect(report.snapshot.metrics[0]?.change_pct).toBe('22.6');
      // Omitted when `previous` is zero — never coerced to a number.
      expect(report.snapshot.metrics[1]?.change_pct).toBeUndefined();
      expect(report.series.metrics['executed_volume.USDC']?.[0]?.v).toBe('41200');
      expect(report.customers[0]?.item_counts.critical).toBe(1);
    });

    it('cross-customer aggregates carry no customer_id; attributed items do', async () => {
      const { fetch } = createRoutedFetch({
        'GET /insights': () => ({ status: 200, body: CLIENT_REPORT }),
      });
      const client = makeClient(fetch as unknown as typeof globalThis.fetch);

      const report = await client.insights.getClientReport();

      expect(report.insights[0]?.customer_id).toBeUndefined();
      expect(report.insights[0]?.responsibility).toBe('payment_ops');
      expect(report.insights[1]?.customer_id).toBe('cust_a');
    });

    it('passes every filter through as a query parameter, comma-separated lists intact', async () => {
      const { fetch, requests } = createRoutedFetch({
        'GET /insights': () => ({ status: 200, body: CLIENT_REPORT }),
      });
      const client = makeClient(fetch as unknown as typeof globalThis.fetch);

      await client.insights.getClientReport({
        customer_id: 'cust_a',
        wallet_id: 'wal_1',
        kind: 'volume_anomaly,recipient_dormant',
        severity: 'critical,warn',
        responsibility: 'payment_ops',
        window_days: 30,
      });

      expect(requests[0]?.query).toEqual({
        customer_id: 'cust_a',
        wallet_id: 'wal_1',
        kind: 'volume_anomaly,recipient_dormant',
        severity: 'critical,warn',
        responsibility: 'payment_ops',
        window_days: '30',
      });
    });

    it('a 404 means agentic payments are off, or the customer filter is unknown', async () => {
      const { fetch } = createRoutedFetch({
        'GET /insights': () => ({
          status: 404,
          body: {
            type: 'https://docs.dakota.xyz/api-reference/errors#not-found',
            title: 'Not Found',
            status: 404,
            detail: 'agentic payments are not enabled',
          },
        }),
      });
      const client = makeClient(fetch as unknown as typeof globalThis.fetch);

      await expect(client.insights.getClientReport({ customer_id: 'nope' })).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});
