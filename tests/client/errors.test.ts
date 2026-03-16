/**
 * Error handling tests.
 */

import { describe, it, expect } from 'vitest';
import { APIError, TransportError, ConfigurationError } from '../../src/client/errors.js';

describe('Errors', () => {
  describe('APIError', () => {
    it('creates error with all properties', () => {
      const error = new APIError(404, 'not-found', 'Customer not found', {
        details: { id: 'cust_123' },
        requestId: 'req_abc',
        rawBody: '{"error": "not found"}',
      });

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('not-found');
      expect(error.message).toBe('Customer not found');
      expect(error.details).toEqual({ id: 'cust_123' });
      expect(error.requestId).toBe('req_abc');
      expect(error.rawBody).toBe('{"error": "not found"}');
      expect(error.retryable).toBe(false);
    });

    it('identifies retryable status codes', () => {
      expect(new APIError(429, 'rate_limit', 'Too many requests').retryable).toBe(true);
      expect(new APIError(500, 'internal', 'Internal error').retryable).toBe(true);
      expect(new APIError(502, 'bad_gateway', 'Bad gateway').retryable).toBe(true);
      expect(new APIError(503, 'unavailable', 'Service unavailable').retryable).toBe(true);
      expect(new APIError(504, 'timeout', 'Gateway timeout').retryable).toBe(true);
    });

    it('identifies non-retryable status codes', () => {
      expect(new APIError(400, 'bad_request', 'Bad request').retryable).toBe(false);
      expect(new APIError(401, 'unauthorized', 'Unauthorized').retryable).toBe(false);
      expect(new APIError(403, 'forbidden', 'Forbidden').retryable).toBe(false);
      expect(new APIError(404, 'not_found', 'Not found').retryable).toBe(false);
      expect(new APIError(422, 'unprocessable', 'Unprocessable').retryable).toBe(false);
    });

    it('formats error message with code', () => {
      const error = new APIError(404, 'not-found', 'Customer not found');
      expect(error.toString()).toBe('APIError [404 not-found]: Customer not found');
    });

    it('formats error message without code', () => {
      const error = new APIError(500, '', 'Internal error');
      expect(error.toString()).toBe('APIError [500]: Internal error');
    });

    it('is instanceof Error', () => {
      const error = new APIError(404, 'not-found', 'Not found');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(APIError);
    });

    describe('fromResponse', () => {
      it('parses ProblemDetails format', async () => {
        const response = new Response(
          JSON.stringify({
            type: 'https://docs.dakota.xyz/api-reference/errors#not-found',
            title: 'Not Found',
            detail: 'Customer not found',
            status: 404,
          }),
          {
            status: 404,
            headers: {
              'content-type': 'application/problem+json',
              'x-request-id': 'req_123',
            },
          }
        );

        const error = await APIError.fromResponse(response);
        expect(error.statusCode).toBe(404);
        expect(error.code).toBe('not-found');
        expect(error.message).toBe('Not Found: Customer not found');
        expect(error.requestId).toBe('req_123');
      });

      it('parses legacy format', async () => {
        const response = new Response(
          JSON.stringify({
            code: 'invalid_request',
            message: 'Invalid customer ID',
            details: { field: 'customer_id' },
          }),
          {
            status: 400,
            headers: { 'content-type': 'application/json' },
          }
        );

        const error = await APIError.fromResponse(response);
        expect(error.statusCode).toBe(400);
        expect(error.code).toBe('invalid_request');
        expect(error.message).toBe('Invalid customer ID');
      });

      it('handles empty response body', async () => {
        const response = new Response(null, { status: 500, statusText: 'Internal Server Error' });

        const error = await APIError.fromResponse(response);
        expect(error.statusCode).toBe(500);
        expect(error.code).toBe('http_500');
        // Response.statusText may be empty in some environments
        expect(error.message).toMatch(/Internal Server Error|Unknown error/);
      });

      it('handles invalid JSON', async () => {
        const response = new Response('not json', { status: 500 });

        const error = await APIError.fromResponse(response);
        expect(error.statusCode).toBe(500);
        expect(error.code).toBe('http_500');
      });
    });
  });

  describe('TransportError', () => {
    it('creates error with message', () => {
      const error = new TransportError('Network error');
      expect(error.message).toBe('Network error');
      expect(error.cause).toBeUndefined();
    });

    it('creates error with cause', () => {
      const cause = new Error('Connection refused');
      const error = new TransportError('Network error', cause);
      expect(error.message).toBe('Network error');
      expect(error.cause).toBe(cause);
    });

    it('formats error with cause', () => {
      const cause = new Error('Connection refused');
      const error = new TransportError('Network error', cause);
      expect(error.toString()).toBe(
        'TransportError: Network error (caused by: Connection refused)'
      );
    });

    it('formats error without cause', () => {
      const error = new TransportError('Network error');
      expect(error.toString()).toBe('TransportError: Network error');
    });

    it('is instanceof Error', () => {
      const error = new TransportError('Network error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TransportError);
    });
  });

  describe('ConfigurationError', () => {
    it('creates error with message', () => {
      const error = new ConfigurationError('Invalid API key');
      expect(error.message).toBe('Invalid API key');
      expect(error.name).toBe('ConfigurationError');
    });

    it('is instanceof Error', () => {
      const error = new ConfigurationError('Invalid config');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ConfigurationError);
    });
  });
});
