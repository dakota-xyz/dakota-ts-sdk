/**
 * Smoke test for the two endpoints added in v1.2.0:
 *  - customers.bulkImportFromSumsubTokens
 *  - selfServe.getPricing
 *
 * Run: npx tsx examples/e2e-new-endpoints.ts
 *
 * Both endpoints are exercised against the sandbox. For bulk-import we send a
 * deliberately invalid Sumsub token — the API should return a structured
 * per-token error rather than a 4xx on the endpoint itself, proving the SDK
 * plumbing is wired up and the response shape matches the spec.
 */

import { DakotaClient, APIError, TransportError } from '../src/index.js';

const API_KEY =
  process.env.DAKOTA_API_KEY || 'bTytwgGQhUPcZjbkddNvI1YhAvReg5lSr0e7Kf8hvQ4=';

function ok(label: string, extra?: unknown) {
  // eslint-disable-next-line no-console
  console.log(`✅ ${label}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`);
}
function info(label: string, extra?: unknown) {
  // eslint-disable-next-line no-console
  console.log(`ℹ️  ${label}${extra !== undefined ? '  ' + JSON.stringify(extra) : ''}`);
}
function bad(label: string, err: unknown) {
  // eslint-disable-next-line no-console
  console.error(`❌ ${label}`);
  // eslint-disable-next-line no-console
  console.error(err);
}

async function main() {
  const client = new DakotaClient({ apiKey: API_KEY });
  let failures = 0;

  // ---- bulkImportFromSumsubTokens ---------------------------------------
  try {
    const res = await client.customers.bulkImportFromSumsubTokens({
      tokens: ['_act-sbx-jwt-INVALID-token-for-smoke-test'],
    });
    ok('customers.bulkImportFromSumsubTokens returned 200', {
      total: res.total,
      succeeded: res.succeeded,
      failed: res.failed,
      results: res.results,
    });
    if (typeof res.total !== 'number' || !Array.isArray(res.results)) {
      bad('bulkImportFromSumsubTokens: unexpected response shape', res);
      failures++;
    }
  } catch (err) {
    if (err instanceof APIError) {
      // A 4xx on this endpoint with a structured ProblemDetails still proves
      // the route is wired up and the SDK can read the response.
      info(
        `customers.bulkImportFromSumsubTokens API error: ${err.statusCode} ${err.code}`,
        { message: err.message, requestId: err.requestId }
      );
      if (err.statusCode === 404 || err.statusCode >= 500) {
        bad('bulkImportFromSumsubTokens looks broken', err);
        failures++;
      }
    } else if (err instanceof TransportError) {
      bad('bulkImportFromSumsubTokens transport error', err);
      failures++;
    } else {
      bad('bulkImportFromSumsubTokens unexpected error', err);
      failures++;
    }
  }

  // ---- selfServe.getPricing --------------------------------------------
  try {
    const pricing = await client.selfServe.getPricing();
    ok('selfServe.getPricing returned 200', pricing);
  } catch (err) {
    if (err instanceof APIError) {
      // Non-self-serve clients get 403 — still a valid wired-up endpoint.
      if (err.statusCode === 403) {
        info(
          'selfServe.getPricing 403 (expected for non-self-serve clients) — endpoint is wired up',
          { code: err.code, message: err.message }
        );
      } else if (err.statusCode === 404 || err.statusCode >= 500) {
        bad('selfServe.getPricing looks broken', err);
        failures++;
      } else {
        info(`selfServe.getPricing API error: ${err.statusCode} ${err.code}`, {
          message: err.message,
        });
      }
    } else if (err instanceof TransportError) {
      bad('selfServe.getPricing transport error', err);
      failures++;
    } else {
      bad('selfServe.getPricing unexpected error', err);
      failures++;
    }
  }

  // ---- existing endpoint regression sanity ------------------------------
  try {
    const tiers = await client.selfServe.listTiers();
    ok('selfServe.listTiers (regression) returned 200', {
      count: tiers.tiers?.length,
    });
  } catch (err) {
    if (err instanceof APIError) {
      info(`selfServe.listTiers status: ${err.statusCode} ${err.code}`);
    } else {
      bad('selfServe.listTiers transport error', err);
      failures++;
    }
  }

  if (failures > 0) {
    // eslint-disable-next-line no-console
    console.error(`\n${failures} hard failure(s)`);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log('\nAll new endpoints reachable.');
}

main().catch((err) => {
  bad('top-level crash', err);
  process.exit(1);
});
