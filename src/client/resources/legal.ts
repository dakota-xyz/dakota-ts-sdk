/**
 * Legal documents resource.
 */

import { BaseResource } from './base.js';
import type { LegalDocument } from '../types.js';

/**
 * Legal Documents API resource.
 *
 * The published terms a customer accepts during onboarding. **Unauthenticated**
 * — integrators need these before a customer relationship exists, so the
 * endpoints carry no credential and are safe to call from a signup page.
 */
export class LegalResource extends BaseResource {
  /**
   * List the revision of every legal document currently in force.
   *
   * An INDEX, not a bundle: each entry names a document and its in-force
   * revision, without the text. Fetch {@link get} for the one document you
   * are about to display — inlining every document would put the whole corpus
   * on every call.
   *
   * Not safe to cache indefinitely: it names whichever revision is in force
   * NOW, and that changes when a new one is published. A specific
   * `(key, version)` from {@link get} is a different matter — revisions are
   * immutable, so that text can be cached for as long as you like.
   *
   * @returns The in-force revision of each document, without its text
   *
   * @example
   * ```typescript
   * for (const doc of await client.legal.list()) {
   *   console.log(doc.key, doc.version, doc.title);
   * }
   * ```
   */
  async list(): Promise<LegalDocument[]> {
    const response = await this.transport.request<{ data: LegalDocument[] }>({
      method: 'GET',
      path: '/legal/documents',
    });
    return response.data ?? [];
  }

  /**
   * Get one legal document — the revision in force, or a specific one.
   *
   * Pass the `version` you displayed back as `legal_document_version` when
   * submitting an attestation, so the acceptance record names the exact text
   * the customer saw rather than whichever revision happened to be current
   * when the request arrived.
   *
   * @param documentKey - Document identifier, e.g. `'dakota_tos'`
   * @param version - A specific published revision. Omit for the one in force
   * @returns The requested revision, including its text
   *
   * @example
   * ```typescript
   * const tos = await client.legal.get('dakota_tos');
   * render(tos.content);
   *
   * await client.applications.submitAttestation(applicationId, {
   *   attestation_type: 'terms_of_service',
   *   legal_document_version: tos.version, // records what they actually saw
   *   // ...
   * });
   * ```
   */
  async get(documentKey: string, version?: string): Promise<LegalDocument> {
    return this.transport.request<LegalDocument>({
      method: 'GET',
      path: `/legal/documents/${documentKey}`,
      query: version !== undefined ? { version } : undefined,
    });
  }
}
