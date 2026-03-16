/**
 * Configuration tests.
 */

import { describe, it, expect } from 'vitest';
import { resolveConfig, AuthMode, DEFAULT_RETRY_POLICY } from '../../src/client/config.js';
import { Environment } from '../../src/client/environment.js';
import { ConfigurationError } from '../../src/client/errors.js';

describe('Config', () => {
  describe('resolveConfig', () => {
    it('requires apiKey or applicationToken', () => {
      expect(() => resolveConfig({})).toThrow(ConfigurationError);
      expect(() => resolveConfig({})).toThrow('API key or application token is required');
    });

    it('accepts apiKey alone', () => {
      const config = resolveConfig({ apiKey: 'test_key' });
      expect(config.apiKey).toBe('test_key');
      expect(config.applicationToken).toBeNull();
    });

    it('accepts applicationToken alone', () => {
      const config = resolveConfig({ applicationToken: 'test_token' });
      expect(config.apiKey).toBeNull();
      expect(config.applicationToken).toBe('test_token');
    });

    it('accepts both apiKey and applicationToken', () => {
      const config = resolveConfig({
        apiKey: 'test_key',
        applicationToken: 'test_token',
      });
      expect(config.apiKey).toBe('test_key');
      expect(config.applicationToken).toBe('test_token');
    });

    it('requires apiKey when AuthMode is APIKey', () => {
      expect(() =>
        resolveConfig({
          applicationToken: 'test_token',
          authMode: AuthMode.APIKey,
        })
      ).toThrow('API key is required when using AuthMode.APIKey');
    });

    it('requires applicationToken when AuthMode is ApplicationToken', () => {
      expect(() =>
        resolveConfig({
          apiKey: 'test_key',
          authMode: AuthMode.ApplicationToken,
        })
      ).toThrow('Application token is required when using AuthMode.ApplicationToken');
    });

    it('defaults to Sandbox environment', () => {
      const config = resolveConfig({ apiKey: 'test_key' });
      expect(config.baseURL).toBe('https://api.platform.sandbox.dakota.xyz');
    });

    it('uses Production environment when specified', () => {
      const config = resolveConfig({
        apiKey: 'test_key',
        environment: Environment.Production,
      });
      expect(config.baseURL).toBe('https://api.platform.dakota.xyz');
    });

    it('uses custom baseURL when specified', () => {
      const config = resolveConfig({
        apiKey: 'test_key',
        baseURL: 'https://custom.api.com',
      });
      expect(config.baseURL).toBe('https://custom.api.com');
    });

    it('removes trailing slash from baseURL', () => {
      const config = resolveConfig({
        apiKey: 'test_key',
        baseURL: 'https://custom.api.com/',
      });
      expect(config.baseURL).toBe('https://custom.api.com');
    });

    it('validates baseURL is a valid URL', () => {
      expect(() =>
        resolveConfig({
          apiKey: 'test_key',
          baseURL: 'not-a-url',
        })
      ).toThrow('Invalid base URL');
    });

    it('defaults timeout to 15000ms', () => {
      const config = resolveConfig({ apiKey: 'test_key' });
      expect(config.timeout).toBe(15000);
    });

    it('accepts custom timeout', () => {
      const config = resolveConfig({
        apiKey: 'test_key',
        timeout: 30000,
      });
      expect(config.timeout).toBe(30000);
    });

    it('validates timeout is positive', () => {
      expect(() =>
        resolveConfig({
          apiKey: 'test_key',
          timeout: 0,
        })
      ).toThrow('Timeout must be greater than zero');

      expect(() =>
        resolveConfig({
          apiKey: 'test_key',
          timeout: -1000,
        })
      ).toThrow('Timeout must be greater than zero');
    });

    it('uses default retry policy', () => {
      const config = resolveConfig({ apiKey: 'test_key' });
      expect(config.retryPolicy).toEqual(DEFAULT_RETRY_POLICY);
    });

    it('accepts partial retry policy', () => {
      const config = resolveConfig({
        apiKey: 'test_key',
        retryPolicy: { maxAttempts: 5 },
      });
      expect(config.retryPolicy.maxAttempts).toBe(5);
      expect(config.retryPolicy.initialBackoffMs).toBe(DEFAULT_RETRY_POLICY.initialBackoffMs);
    });

    it('validates retry maxAttempts is positive', () => {
      expect(() =>
        resolveConfig({
          apiKey: 'test_key',
          retryPolicy: { maxAttempts: 0 },
        })
      ).toThrow('Retry max attempts must be greater than zero');
    });

    it('validates retry initialBackoffMs is positive', () => {
      expect(() =>
        resolveConfig({
          apiKey: 'test_key',
          retryPolicy: { initialBackoffMs: 0 },
        })
      ).toThrow('Retry initial backoff must be greater than zero');
    });

    it('validates retry maxBackoffMs is positive', () => {
      expect(() =>
        resolveConfig({
          apiKey: 'test_key',
          retryPolicy: { maxBackoffMs: 0 },
        })
      ).toThrow('Retry max backoff must be greater than zero');
    });

    it('validates maxBackoffMs >= initialBackoffMs', () => {
      expect(() =>
        resolveConfig({
          apiKey: 'test_key',
          retryPolicy: { initialBackoffMs: 1000, maxBackoffMs: 500 },
        })
      ).toThrow('Retry max backoff must be >= initial backoff');
    });

    it('defaults automaticIdempotency to true', () => {
      const config = resolveConfig({ apiKey: 'test_key' });
      expect(config.automaticIdempotency).toBe(true);
    });

    it('accepts automaticIdempotency = false', () => {
      const config = resolveConfig({
        apiKey: 'test_key',
        automaticIdempotency: false,
      });
      expect(config.automaticIdempotency).toBe(false);
    });

    it('provides default idempotencyKeyGenerator', () => {
      const config = resolveConfig({ apiKey: 'test_key' });
      const key = config.idempotencyKeyGenerator();
      expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('accepts custom idempotencyKeyGenerator', () => {
      const customGenerator = () => 'custom-key';
      const config = resolveConfig({
        apiKey: 'test_key',
        idempotencyKeyGenerator: customGenerator,
      });
      expect(config.idempotencyKeyGenerator()).toBe('custom-key');
    });

    it('defaults authMode to Auto', () => {
      const config = resolveConfig({ apiKey: 'test_key' });
      expect(config.authMode).toBe(AuthMode.Auto);
    });
  });
});
