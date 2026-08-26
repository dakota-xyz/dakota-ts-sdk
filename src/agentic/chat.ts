/**
 * Multi-turn agent chat. The platform's proposals endpoint is STATELESS —
 * it holds no session and must be sent the whole transcript on every turn.
 * `AgentConversation` hides that bookkeeping so a caller just sends user
 * messages and reads the agent's clarifying questions / final proposals.
 *
 * Agentic payments is an alpha surface (x-alpha, flag-gated on the platform)
 * and may change without a major-version bump.
 */

import type { DakotaClient } from '../client/client.js';
import type { AgenticBlocker, AgenticProposal, AgenticProposalsResult } from '../client/types.js';

/**
 * MIME types the platform accepts for a document attachment.
 */
export type AttachmentMediaType =
  | 'application/pdf'
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/gif';

/**
 * An input artifact on a user turn for the agent to read — today a document
 * (a PDF or image, e.g. an invoice to draft a payment from). `data` is the
 * RAW document bytes; the SDK base64-encodes them on the wire.
 */
export interface Attachment {
  mediaType: AttachmentMediaType;
  /** raw document bytes (not base64) */
  data: Uint8Array;
  /** optional, for display/audit */
  filename?: string;
}

/**
 * One turn of an agent conversation.
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /**
   * Input artifacts attached to this turn for the agent to investigate.
   * Attachments ride only on the turn they are passed; they are NOT
   * persisted in the transcript.
   */
  attachments?: Attachment[];
}

/**
 * The agent's response to one user message.
 */
export interface ConversationTurn {
  /**
   * The agent's conversational text — a clarifying question or a
   * confirmation. May be empty when only proposals are returned.
   */
  reply: string;
  /**
   * The reviewable action series, present once the agent reaches high
   * confidence. Accept it via the instructions flow.
   */
  proposals: AgenticProposal[];
  /** Whether the agent drafted proposals this turn. */
  hasProposals: boolean;
  /**
   * Machine-actionable reasons the turn could not complete — for YOUR
   * application, not the customer. `reply` says the same thing in prose,
   * which software cannot branch on: "extend the limit to cover Priya",
   * "I need her bank details" and "that rail is not supported" all arrive
   * as some text.
   *
   * These ACCOMPANY proposals rather than replacing them, and routinely do.
   * The common case is a payee who does not exist yet: the turn proposes
   * creating them AND reports that the limit will not reach them, because
   * you have to do both, in that order — accept the proposal so the payee
   * has an id, then amend the limit to include it. Never treat proposals
   * and blockers as alternatives.
   *
   * Empty when nothing blocked the turn. Always switch on `code` and ignore
   * codes you do not know; new ones are added over time.
   */
  blockers: AgenticBlocker[];
  /** Whether the turn reported any blocker. */
  hasBlockers: boolean;
  /**
   * The boundary screen's verdict for this turn:
   *
   * - `"ok"` — normal payments turn.
   * - `"warned"` — off-topic; the customer was warned but may continue.
   * - `"blocked"` — the chat is terminated; stop serving it and offer a fresh
   *   conversation.
   * - `"rejected_input"` — this message was refused WHOLESALE (e.g. more
   *   payees than one conversation supports). `reply` explains what to
   *   resend; the conversation continues unaffected, and the SDK has already
   *   dropped the refused message from the transcript for you.
   *
   * Empty when the platform sent none. Treat it as an OPEN set — new values
   * may be added.
   */
  conversationStatus: string;
}

/**
 * The boundary screen's verdict for a message refused wholesale. Its contract
 * is that the message must NOT be added to the conversation history — see
 * {@link ConversationTurn.conversationStatus}.
 */
const REJECTED_INPUT = 'rejected_input';

/** Options for an {@link AgentConversation}. */
export interface AgentConversationOptions {
  /**
   * The customer's IANA timezone (e.g. `'America/Los_Angeles'`).
   *
   * When set, the agent resolves every relative date ("tomorrow", "Friday")
   * and clock time ("10 am") in THIS zone: a date without a time is drafted
   * for 10:00 local, and a time without a date means its next local
   * occurrence. Left unset, times resolve as UTC and the agent says so when a
   * specific clock time matters.
   *
   * The conversation resends it on every turn, since the endpoint is
   * stateless. Note the zone's UTC offset is captured at drafting time, so a
   * DST transition before a far-future fire date shifts it by the DST delta.
   */
  timezone?: string;

  /**
   * Deadline (ms) for each turn of this conversation.
   *
   * Turns default to {@link AGENTIC_MODEL_TIMEOUT_MS}, which is sized for a
   * multi-payee drafting turn. Set this when your own turns are longer (a
   * very large payee list) or shorter (you would rather show the customer a
   * failure than keep them waiting).
   *
   * Required if the client was built with an explicit `timeout`: that
   * choice wins over the endpoint default, so a client configured with a
   * short global deadline will cut turns off unless you raise it here.
   */
  timeout?: number;
}

/**
 * A stateful, multi-turn proposals chat with one agent.
 *
 * Keeps the running transcript, appends each user message and the agent's
 * reply, and resends the whole transcript on every {@link send} — so
 * callers never deal with the stateless endpoint's "send all history each
 * time" contract.
 *
 * For a stateless backend (one HTTP request per chat message), persist
 * {@link messages} between requests and rebuild with
 * {@link DakotaClient.resumeAgentConversation}.
 */
export class AgentConversation {
  private readonly client: DakotaClient;
  private readonly paymentAgentId: string;
  private readonly timezone?: string;
  private readonly timeout?: number;
  private history: ChatMessage[] = [];

  constructor(
    client: DakotaClient,
    paymentAgentId: string,
    history?: ChatMessage[],
    options?: AgentConversationOptions
  ) {
    this.client = client;
    this.paymentAgentId = paymentAgentId;
    this.timezone = options?.timezone;
    this.timeout = options?.timeout;
    if (history && history.length > 0) {
      this.history = history.map(cloneMessage);
    }
  }

  /**
   * Adds the user's message to the transcript, asks the agent, records the
   * agent's reply, and returns the turn. When `hasProposals` is true the
   * agent has drafted a reviewable action series; otherwise `reply` holds
   * its next question.
   *
   * On error the optimistic user turn is rolled back, so the caller may
   * retry the same call without duplicating it.
   */
  async send(userMessage: string): Promise<ConversationTurn> {
    return this.sendWithAttachments(userMessage);
  }

  /**
   * {@link send} with documents (e.g. an invoice PDF) attached to the user
   * turn for the agent to read and draft payments from. Same turn semantics
   * and rollback-on-error behavior as `send`. Attachments ride only on the
   * turn they are passed; the stateless transcript keeps the agent's text
   * reply, so a follow-up turn relies on that summary rather than re-sending
   * the document.
   */
  async sendWithAttachments(
    userMessage: string,
    attachments?: Attachment[]
  ): Promise<ConversationTurn> {
    const hasAttachments = attachments !== undefined && attachments.length > 0;
    this.history.push({
      role: 'user',
      content: userMessage,
      ...(hasAttachments ? { attachments } : {}),
    });

    const messages = this.history.map(serializeMessage);

    // Attachments ride only on THIS request: they are serialized into
    // `messages` above, then dropped from the stored transcript so they are
    // neither persisted via messages() / resumeAgentConversation nor
    // re-sent on later turns.
    if (hasAttachments) {
      const last = this.history[this.history.length - 1];
      if (last) {
        delete last.attachments;
      }
    }

    let result: AgenticProposalsResult;
    try {
      result = await this.client.paymentAgents.createProposals(
        this.paymentAgentId,
        {
          messages,
          // Resent on EVERY turn — the endpoint is stateless, so a zone given
          // once would be forgotten on the next one.
          ...(this.timezone ? { timezone: this.timezone } : {}),
        },
        this.timeout !== undefined ? { timeout: this.timeout } : undefined
      );
    } catch (err) {
      // Roll back the optimistic user turn so a retry does not duplicate it.
      this.history.pop();
      throw err;
    }

    const turn: ConversationTurn = {
      reply: result.reply ?? '',
      proposals: result.proposals ? [...result.proposals] : [],
      hasProposals: !!result.proposals && result.proposals.length > 0,
      blockers: result.blockers ? [...result.blockers] : [],
      hasBlockers: !!result.blockers && result.blockers.length > 0,
      conversationStatus: result.conversation_status ?? '',
    };

    // `rejected_input`: the server refused this message WHOLESALE and told us
    // not to keep it. Roll the optimistic user turn back and record no
    // assistant turn, so the transcript is identical to before this send. The
    // conversation itself continues unaffected — the caller still gets the
    // turn, whose `reply` explains what to resend.
    //
    // Without this the refused message stays in the transcript and is
    // re-transmitted on every later turn — the exact message the server asked
    // the client to drop — corrupting the conversation from here on. And
    // `messages()` returns a copy, so a caller could not repair it either.
    if (turn.conversationStatus === REJECTED_INPUT) {
      this.history.pop();
      return turn;
    }

    // Record an assistant turn so the transcript keeps alternating — the
    // platform (and the underlying model) reject two consecutive user
    // turns. Fall back to a placeholder when the agent returned only
    // proposals with no reply text.
    let assistant = turn.reply;
    if (!assistant) {
      assistant = turn.hasProposals ? '(drafted proposals for your review)' : '(no reply)';
    }
    this.history.push({ role: 'assistant', content: assistant });

    return turn;
  }

  /**
   * A copy of the full transcript so far. Persist this between requests in
   * a stateless backend and rebuild with
   * {@link DakotaClient.resumeAgentConversation}.
   */
  messages(): ChatMessage[] {
    return this.history.map(cloneMessage);
  }
}

function cloneMessage(m: ChatMessage): ChatMessage {
  const out: ChatMessage = { role: m.role, content: m.content };
  if (m.attachments && m.attachments.length > 0) {
    out.attachments = m.attachments.map((a) => ({ ...a }));
  }
  return out;
}

function serializeMessage(m: ChatMessage): {
  role: 'user' | 'assistant';
  content: string;
  attachments?: {
    type: 'document';
    document: {
      media_type: AttachmentMediaType;
      data: string;
      filename?: string;
    };
  }[];
} {
  const out: ReturnType<typeof serializeMessage> = { role: m.role, content: m.content };
  if (m.attachments && m.attachments.length > 0) {
    out.attachments = m.attachments.map((a) => {
      const document: {
        media_type: AttachmentMediaType;
        data: string;
        filename?: string;
      } = {
        media_type: a.mediaType,
        data: Buffer.from(a.data).toString('base64'),
      };
      if (a.filename) {
        document.filename = a.filename;
      }
      return { type: 'document' as const, document };
    });
  }
  return out;
}
