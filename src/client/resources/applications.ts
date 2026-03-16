/**
 * Applications resource (Onboarding/KYB).
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type {
  Application,
  ApplicationSubmissionRequest,
  AssociatedIndividual,
  AssociatedIndividualRequest,
  ListParams,
} from '../types.js';

/**
 * Applications API resource for KYB onboarding.
 */
export class ApplicationsResource extends BaseResource {
  /**
   * List applications.
   *
   * @param params - Pagination parameters
   * @returns Async iterator of applications
   */
  list(params?: ListParams): PaginatedIterator<Application> {
    return this.paginate<Application>('/applications', params);
  }

  /**
   * Get an application by ID.
   *
   * @param applicationId - Application ID
   * @returns Application record
   */
  async get(applicationId: string): Promise<Application> {
    return this.transport.request<Application>({
      method: 'GET',
      path: `/applications/${applicationId}`,
    });
  }

  /**
   * Submit an application for review.
   *
   * @param applicationId - Application ID
   * @param data - Submission data
   * @returns Submitted application
   */
  async submit(applicationId: string, data?: ApplicationSubmissionRequest): Promise<Application> {
    return this.transport.request<Application>({
      method: 'POST',
      path: `/applications/${applicationId}/submissions`,
      body: data ?? {},
    });
  }

  /**
   * List associated individuals for an application.
   *
   * @param applicationId - Application ID
   * @param params - Pagination parameters
   * @returns Async iterator of individuals
   */
  listIndividuals(
    applicationId: string,
    params?: ListParams
  ): PaginatedIterator<AssociatedIndividual> {
    return this.paginate<AssociatedIndividual>(
      `/applications/${applicationId}/associated-individuals`,
      params
    );
  }

  /**
   * Add an associated individual to an application.
   *
   * @param applicationId - Application ID
   * @param data - Individual data
   * @returns Created individual
   */
  async addIndividual(
    applicationId: string,
    data: AssociatedIndividualRequest
  ): Promise<AssociatedIndividual> {
    return this.transport.request<AssociatedIndividual>({
      method: 'POST',
      path: `/applications/${applicationId}/associated-individuals`,
      body: data,
    });
  }

  /**
   * Get an associated individual.
   *
   * @param applicationId - Application ID
   * @param individualId - Individual ID
   * @returns Individual record
   */
  async getIndividual(applicationId: string, individualId: string): Promise<AssociatedIndividual> {
    return this.transport.request<AssociatedIndividual>({
      method: 'GET',
      path: `/applications/${applicationId}/associated-individuals/${individualId}`,
    });
  }

  /**
   * Update an associated individual.
   *
   * @param applicationId - Application ID
   * @param individualId - Individual ID
   * @param data - Update data
   * @returns Updated individual
   */
  async updateIndividual(
    applicationId: string,
    individualId: string,
    data: Partial<AssociatedIndividualRequest>
  ): Promise<AssociatedIndividual> {
    return this.transport.request<AssociatedIndividual>({
      method: 'PATCH',
      path: `/applications/${applicationId}/associated-individuals/${individualId}`,
      body: data,
    });
  }

  /**
   * Delete an associated individual.
   *
   * @param applicationId - Application ID
   * @param individualId - Individual ID
   */
  async deleteIndividual(applicationId: string, individualId: string): Promise<void> {
    await this.transport.request<void>({
      method: 'DELETE',
      path: `/applications/${applicationId}/associated-individuals/${individualId}`,
    });
  }

  /**
   * Update business details for an application.
   *
   * @param applicationId - Application ID
   * @param data - Business details
   * @returns Updated application
   */
  async updateBusinessDetails(
    applicationId: string,
    data: Record<string, unknown>
  ): Promise<Application> {
    return this.transport.request<Application>({
      method: 'PATCH',
      path: `/applications/${applicationId}/business-details`,
      body: data,
    });
  }

  /**
   * Get document upload URL for an application.
   *
   * @param applicationId - Application ID
   * @param data - Document metadata
   * @returns Upload URL and document ID
   */
  async getDocumentUploadUrl(
    applicationId: string,
    data: { document_type: string; file_name: string }
  ): Promise<{ upload_url: string; document_id: string }> {
    return this.transport.request<{ upload_url: string; document_id: string }>({
      method: 'POST',
      path: `/applications/${applicationId}/document-uploads`,
      body: data,
    });
  }
}
