/**
 * Client tests.
 */

import { describe, it, expect } from 'vitest';
import { DakotaClient } from '../../src/client/client.js';
import { Environment } from '../../src/client/environment.js';
import { ConfigurationError } from '../../src/client/errors.js';

describe('DakotaClient', () => {
  describe('constructor', () => {
    it('creates client with apiKey', () => {
      const client = new DakotaClient({ apiKey: 'test_key' });
      expect(client).toBeInstanceOf(DakotaClient);
    });

    it('creates client with applicationToken', () => {
      const client = new DakotaClient({ applicationToken: 'test_token' });
      expect(client).toBeInstanceOf(DakotaClient);
    });

    it('throws without credentials', () => {
      expect(() => new DakotaClient({})).toThrow(ConfigurationError);
    });

    it('defaults to Sandbox environment', () => {
      const client = new DakotaClient({ apiKey: 'test_key' });
      expect(client.baseURL).toBe('https://api.platform.sandbox.dakota.xyz');
    });

    it('uses Production environment when specified', () => {
      const client = new DakotaClient({
        apiKey: 'test_key',
        environment: Environment.Production,
      });
      expect(client.baseURL).toBe('https://api.platform.dakota.xyz');
    });

    it('uses custom baseURL when specified', () => {
      const client = new DakotaClient({
        apiKey: 'test_key',
        baseURL: 'https://custom.api.com',
      });
      expect(client.baseURL).toBe('https://custom.api.com');
    });
  });

  describe('resources', () => {
    it('exposes customers resource', () => {
      const client = new DakotaClient({ apiKey: 'test_key' });
      expect(client.customers).toBeDefined();
      expect(typeof client.customers.create).toBe('function');
      expect(typeof client.customers.list).toBe('function');
      expect(typeof client.customers.get).toBe('function');
    });

    it('exposes recipients resource', () => {
      const client = new DakotaClient({ apiKey: 'test_key' });
      expect(client.recipients).toBeDefined();
      expect(typeof client.recipients.create).toBe('function');
      expect(typeof client.recipients.list).toBe('function');
      expect(typeof client.recipients.get).toBe('function');
      expect(typeof client.recipients.update).toBe('function');
    });

    it('exposes destinations resource', () => {
      const client = new DakotaClient({ apiKey: 'test_key' });
      expect(client.destinations).toBeDefined();
      expect(typeof client.destinations.create).toBe('function');
      expect(typeof client.destinations.list).toBe('function');
    });

    it('exposes accounts resource', () => {
      const client = new DakotaClient({ apiKey: 'test_key' });
      expect(client.accounts).toBeDefined();
      expect(typeof client.accounts.create).toBe('function');
      expect(typeof client.accounts.list).toBe('function');
      expect(typeof client.accounts.get).toBe('function');
      expect(typeof client.accounts.update).toBe('function');
    });

    it('exposes transactions resource', () => {
      const client = new DakotaClient({ apiKey: 'test_key' });
      expect(client.transactions).toBeDefined();
      expect(typeof client.transactions.create).toBe('function');
      expect(typeof client.transactions.list).toBe('function');
      expect(typeof client.transactions.get).toBe('function');
      expect(typeof client.transactions.cancel).toBe('function');
    });

    it('exposes autoTransactions resource', () => {
      const client = new DakotaClient({ apiKey: 'test_key' });
      expect(client.autoTransactions).toBeDefined();
      expect(typeof client.autoTransactions.list).toBe('function');
      expect(typeof client.autoTransactions.get).toBe('function');
    });

    it('exposes wallets resource', () => {
      const client = new DakotaClient({ apiKey: 'test_key' });
      expect(client.wallets).toBeDefined();
      expect(typeof client.wallets.create).toBe('function');
      expect(typeof client.wallets.getBalances).toBe('function');
      expect(typeof client.wallets.createTransaction).toBe('function');
    });

    it('exposes events resource', () => {
      const client = new DakotaClient({ apiKey: 'test_key' });
      expect(client.events).toBeDefined();
      expect(typeof client.events.list).toBe('function');
      expect(typeof client.events.get).toBe('function');
    });

    it('exposes applications resource', () => {
      const client = new DakotaClient({ apiKey: 'test_key' });
      expect(client.applications).toBeDefined();
      expect(typeof client.applications.list).toBe('function');
      expect(typeof client.applications.get).toBe('function');
      expect(typeof client.applications.submit).toBe('function');
    });

    it('exposes policies resource', () => {
      const client = new DakotaClient({ apiKey: 'test_key' });
      expect(client.policies).toBeDefined();
      expect(typeof client.policies.create).toBe('function');
      expect(typeof client.policies.list).toBe('function');
      expect(typeof client.policies.get).toBe('function');
    });

    it('exposes signerGroups resource', () => {
      const client = new DakotaClient({ apiKey: 'test_key' });
      expect(client.signerGroups).toBeDefined();
      expect(typeof client.signerGroups.create).toBe('function');
      expect(typeof client.signerGroups.list).toBe('function');
    });

    it('exposes signers resource', () => {
      const client = new DakotaClient({ apiKey: 'test_key' });
      expect(client.signers).toBeDefined();
      expect(typeof client.signers.list).toBe('function');
    });

    it('exposes apiKeys resource', () => {
      const client = new DakotaClient({ apiKey: 'test_key' });
      expect(client.apiKeys).toBeDefined();
      expect(typeof client.apiKeys.create).toBe('function');
      expect(typeof client.apiKeys.list).toBe('function');
      expect(typeof client.apiKeys.delete).toBe('function');
    });

    it('exposes users resource', () => {
      const client = new DakotaClient({ apiKey: 'test_key' });
      expect(client.users).toBeDefined();
      expect(typeof client.users.create).toBe('function');
      expect(typeof client.users.list).toBe('function');
      expect(typeof client.users.get).toBe('function');
      expect(typeof client.users.update).toBe('function');
    });

    it('exposes webhooks resource', () => {
      const client = new DakotaClient({ apiKey: 'test_key' });
      expect(client.webhooks).toBeDefined();
      expect(typeof client.webhooks.createTarget).toBe('function');
      expect(typeof client.webhooks.listTargets).toBe('function');
    });

    it('exposes info resource', () => {
      const client = new DakotaClient({ apiKey: 'test_key' });
      expect(client.info).toBeDefined();
      expect(typeof client.info.getCountries).toBe('function');
      expect(typeof client.info.getNetworks).toBe('function');
    });

    it('exposes sandbox resource', () => {
      const client = new DakotaClient({ apiKey: 'test_key' });
      expect(client.sandbox).toBeDefined();
      expect(typeof client.sandbox.simulateInbound).toBe('function');
      expect(typeof client.sandbox.simulateOnboarding).toBe('function');
    });
  });
});
