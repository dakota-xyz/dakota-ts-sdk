/**
 * Multi-turn agent chat tests — port of go-sdk/client/agentic_chat_test.go.
 *
 * The conversation hides the stateless multi-turn plumbing: it resends the
 * full alternating transcript each turn, records the agent's reply,
 * surfaces proposals when they arrive, and can be resumed from a
 * persisted transcript.
 */

import { describe, it, expect } from 'vitest';

import { DakotaClient } from '../../src/client/client.js';
import { createRoutedFetch, type RecordedRequest } from './helpers.js';

const AGENT_ID = 'agt_1';
const PROPOSALS_PATH = `/payment-agents/${AGENT_ID}/proposals`;

function makeClient(fetchImpl: typeof fetch) {
  return new DakotaClient({
    apiKey: 'test',
    baseURL: 'http://localhost',
    fetch: fetchImpl,
    // The retry policy defaults to multiple attempts with 100ms backoff —
    // shorten to keep tests fast.
    retryPolicy: { maxAttempts: 1, initialBackoffMs: 1, maxBackoffMs: 1 },
  });
}

describe('AgentConversation.send', () => {
  it('resends the FULL alternating transcript on every turn, and can be resumed', async () => {
    let turn = 0;
    const { fetch, requests } = createRoutedFetch({
      [`POST ${PROPOSALS_PATH}`]: () => {
        const t = turn++;
        if (t === 0) {
          return { status: 200, body: { reply: 'Which network and how much?' } };
        }
        return {
          status: 200,
          body: {
            reply: 'Drafted — review below.',
            proposals: [{ summary: 'Pay Alice 10 USDC', actions: [] }],
          },
        };
      },
    });
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);
    const conv = client.newAgentConversation(AGENT_ID);

    // Turn 1: clarifying question, no proposals.
    const t1 = await conv.send('pay alice');
    expect(t1.reply).toBe('Which network and how much?');
    expect(t1.hasProposals).toBe(false);
    expect(messagesOf(requests[0])).toEqual([{ role: 'user', content: 'pay alice' }]);

    // Turn 2: SDK resends the FULL alternating transcript; proposals arrive.
    const t2 = await conv.send('base-sepolia, 10 USDC');
    expect(t2.hasProposals).toBe(true);
    expect(t2.proposals).toHaveLength(1);
    expect(messagesOf(requests[1])).toEqual([
      { role: 'user', content: 'pay alice' },
      { role: 'assistant', content: 'Which network and how much?' },
      { role: 'user', content: 'base-sepolia, 10 USDC' },
    ]);

    // The caller can persist the transcript (user, assistant, user, assistant).
    expect(conv.messages()).toHaveLength(4);

    // Resume from a stored transcript and continue.
    const resumed = client.resumeAgentConversation(AGENT_ID, conv.messages());
    await resumed.send('thanks');
    expect(messagesOf(requests[2])).toHaveLength(5);
  });

  it('resends the timezone on EVERY turn (the endpoint is stateless), and omits it when unset', async () => {
    const { fetch, requests } = createRoutedFetch({
      [`POST ${PROPOSALS_PATH}`]: () => ({ status: 200, body: { reply: 'ok' } }),
    });
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);

    const zoned = client.newAgentConversation(AGENT_ID, { timezone: 'America/Los_Angeles' });
    await zoned.send('pay alice tomorrow');
    await zoned.send('make it friday');
    expect(timezoneOf(requests[0])).toBe('America/Los_Angeles');
    expect(timezoneOf(requests[1])).toBe('America/Los_Angeles');

    // A resumed conversation carries the transcript, not the zone — so the
    // caller must pass it again, and does.
    const resumed = client.resumeAgentConversation(AGENT_ID, zoned.messages(), {
      timezone: 'Europe/Berlin',
    });
    await resumed.send('and one on monday');
    expect(timezoneOf(requests[2])).toBe('Europe/Berlin');

    // Unset means UTC resolution server-side — the key must be absent, not
    // sent as an empty string.
    const plain = client.newAgentConversation(AGENT_ID);
    await plain.send('pay alice');
    expect(timezoneOf(requests[3])).toBeUndefined();
  });

  it('forwards its timeout to every turn, and leaves the endpoint default alone when unset', async () => {
    const { fetch } = createRoutedFetch({
      [`POST ${PROPOSALS_PATH}`]: () => ({ status: 200, body: { reply: 'ok' } }),
    });
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);
    const seen: (number | undefined)[] = [];
    const real = client.paymentAgents.createProposals.bind(client.paymentAgents);
    client.paymentAgents.createProposals = ((id, data, options) => {
      seen.push(options?.timeout);
      return real(id, data, options);
    }) as typeof client.paymentAgents.createProposals;

    const slow = client.newAgentConversation(AGENT_ID, { timeout: 240_000 });
    await slow.send('pay these nine vendors every friday');
    await slow.send('and add a tenth');
    expect(seen).toEqual([240_000, 240_000]);

    // Unset means the endpoint's own long default applies — the conversation
    // must not pin it to the client's ordinary deadline.
    const plain = client.newAgentConversation(AGENT_ID);
    await plain.send('pay alice');
    expect(seen[2]).toBeUndefined();
  });

  it('surfaces blockers ALONGSIDE proposals — they are not alternatives', async () => {
    const { fetch } = createRoutedFetch({
      [`POST ${PROPOSALS_PATH}`]: () => ({
        status: 200,
        body: {
          reply: 'I can add Priya, but your limit will not reach her.',
          proposals: [{ summary: 'Create payee Priya', actions: [] }],
          blockers: [
            {
              code: 'mandate_does_not_cover_payee',
              mandate_id: 'mandate_1',
              payee_name: 'Priya',
              detail: 'the limit does not target this payee',
            },
          ],
        },
      }),
    });
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);

    const turn = await client.newAgentConversation(AGENT_ID).send('pay priya 10 usdc');

    // The whole point: a blocked turn can still carry work to accept first.
    expect(turn.hasProposals).toBe(true);
    expect(turn.proposals).toHaveLength(1);
    expect(turn.hasBlockers).toBe(true);
    expect(turn.blockers[0]?.code).toBe('mandate_does_not_cover_payee');
    expect(turn.blockers[0]?.payee_name).toBe('Priya');
  });

  it('reports no blockers as an empty array, not undefined', async () => {
    const { fetch } = createRoutedFetch({
      [`POST ${PROPOSALS_PATH}`]: () => ({ status: 200, body: { reply: 'ok' } }),
    });
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);

    const turn = await client.newAgentConversation(AGENT_ID).send('hi');

    expect(turn.blockers).toEqual([]);
    expect(turn.hasBlockers).toBe(false);
  });

  it('never sends client_policy — the platform resolves it from the registration', async () => {
    const { fetch, requests } = createRoutedFetch({
      [`POST ${PROPOSALS_PATH}`]: () => ({ status: 200, body: { reply: 'ok' } }),
    });
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);

    const conv = client.newAgentConversation(AGENT_ID);
    await conv.send('pay alice');
    await conv.send('and bob');

    // The field is gone from the request body upstream. Sending it anyway
    // would be ignored, so a caller who believed it worked would get the
    // platform's default vocabulary with nothing reporting the fallback.
    expect(policyOf(requests[0])).toBeUndefined();
    expect(policyOf(requests[1])).toBeUndefined();
  });

  it('a rejected_input turn leaves the transcript untouched and is never re-sent', async () => {
    let turn = 0;
    const { fetch, requests } = createRoutedFetch({
      [`POST ${PROPOSALS_PATH}`]: () => {
        const t = turn++;
        // NOTE: 200 with a populated body — that is what makes this a trap.
        if (t === 0) return { status: 200, body: { reply: 'Got it.', conversation_status: 'ok' } };
        if (t === 1)
          return {
            status: 200,
            body: {
              reply: 'Too many payees — resend with one.',
              conversation_status: 'rejected_input',
            },
          };
        return { status: 200, body: { reply: 'Sure.', conversation_status: 'ok' } };
      },
    });
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);
    const conv = client.newAgentConversation(AGENT_ID);

    await conv.send('pay alice');
    const before = conv.messages();
    expect(before).toHaveLength(2);

    // The caller still gets the reply and the status...
    const rejected = await conv.send('pay these 400 payees');
    expect(rejected.conversationStatus).toBe('rejected_input');
    expect(rejected.reply).toBe('Too many payees — resend with one.');

    // ...but the transcript is identical to before it: neither the refused
    // user turn nor a synthetic assistant turn survives.
    expect(conv.messages()).toEqual(before);

    // And the next turn must not re-transmit the refused message.
    await conv.send('pay bob');
    expect(messagesOf(requests[2])).toEqual([
      { role: 'user', content: 'pay alice' },
      { role: 'assistant', content: 'Got it.' },
      { role: 'user', content: 'pay bob' },
    ]);
  });

  it('keeps warned and blocked turns — only rejected_input is dropped', async () => {
    for (const status of ['ok', 'warned', 'blocked']) {
      const { fetch } = createRoutedFetch({
        [`POST ${PROPOSALS_PATH}`]: () => ({
          status: 200,
          body: { reply: 'noted', conversation_status: status },
        }),
      });
      const client = makeClient(fetch as unknown as typeof globalThis.fetch);
      const conv = client.newAgentConversation(AGENT_ID);

      await conv.send('hello');

      // These turns happened; dropping them would break the alternating
      // transcript the platform requires.
      expect(conv.messages()).toEqual([
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'noted' },
      ]);
    }
  });

  it('rolls back the optimistic user turn on error (retry does not duplicate)', async () => {
    const { fetch } = createRoutedFetch({
      [`POST ${PROPOSALS_PATH}`]: () => ({
        status: 502,
        body: { detail: 'upstream down' },
      }),
    });
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);
    const conv = client.newAgentConversation(AGENT_ID);

    await expect(conv.send('pay alice')).rejects.toThrow();
    expect(conv.messages()).toEqual([]);
  });

  it('attachments ride only on their turn: reach the wire, never persist, never re-send', async () => {
    const { fetch, requests } = createRoutedFetch({
      [`POST ${PROPOSALS_PATH}`]: () => ({ status: 200, body: { reply: 'ok' } }),
    });
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);
    const conv = client.newAgentConversation(AGENT_ID);

    const wantBase64 = Buffer.from('HelloInvoice').toString('base64');

    // Turn 1 carries a document attachment.
    await conv.sendWithAttachments('here is the invoice', [
      {
        mediaType: 'application/pdf',
        data: new TextEncoder().encode('HelloInvoice'),
        filename: 'invoice.pdf',
      },
    ]);
    const firstBody = JSON.stringify(requests[0]?.body ?? {});
    expect(firstBody).toContain(wantBase64);

    // The attachment must NOT be persisted in the transcript.
    for (const m of conv.messages()) {
      expect(m.attachments ?? []).toHaveLength(0);
    }

    // Turn 2 carries no attachment and must NOT re-send turn 1's document.
    await conv.send('any update?');
    const secondBody = JSON.stringify(requests[1]?.body ?? {});
    expect(secondBody).not.toContain(wantBase64);
  });
});

function policyOf(req: RecordedRequest | undefined): unknown {
  if (!req || !req.body || typeof req.body !== 'object') return undefined;
  return (req.body as { client_policy?: unknown }).client_policy;
}

function timezoneOf(req: RecordedRequest | undefined): string | undefined {
  if (!req || !req.body || typeof req.body !== 'object') return undefined;
  return (req.body as { timezone?: string }).timezone;
}

function messagesOf(req: RecordedRequest | undefined): { role: string; content: string }[] {
  if (!req || !req.body || typeof req.body !== 'object') return [];
  const messages = (req.body as { messages?: { role: string; content: string }[] }).messages ?? [];
  return messages.map(({ role, content }) => ({ role, content }));
}
