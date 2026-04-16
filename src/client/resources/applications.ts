/**
 * Applications resource (Onboarding/KYB).
 */

import { BaseResource } from './base.js';
import { PaginatedIterator } from '../pagination.js';
import type {
  Application,
  ApplicationDocumentUploadRequest,
  ApplicationDocumentUploadUrlRequest,
  ApplicationSubmissionRequest,
  AssociatedIndividual,
  AssociatedIndividualRequest,
  AttestationSubmitRequest,
  BusinessApplicationCreateRequest,
  BusinessDetailsResponse,
  DocumentUploadResponse,
  DocumentUploadUrlResponse,
  EDDRequest,
  EDDWithApplicationID,
  IndividualDetailsResponse,
  IndividualDocumentUploadRequest,
  IndividualDocumentUploadUrlRequest,
  IndividualRequest,
  ListParams,
  RequestOptions,
  UploadedDocumentMetadata,
} from '../types.js';

/** Parameters for listing application documents */
export interface DocumentListParams extends ListParams {
  category?: 'business' | 'identity' | 'edd';
  document_type?: string;
}

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
  async submit(
    applicationId: string,
    data?: ApplicationSubmissionRequest,
    options?: RequestOptions
  ): Promise<Application> {
    return this.transport.request<Application>({
      method: 'POST',
      path: `/applications/${applicationId}/submissions`,
      body: data ?? {},
      idempotencyKey: options?.idempotencyKey,
    });
  }

  // ==========================================================================
  // Business Details
  // ==========================================================================

  /**
   * Update business details for an application.
   *
   * Uses PUT (full replace) per the OpenAPI spec.
   *
   * @param applicationId - Application ID
   * @param data - Business details (full BusinessApplicationCreateRequest)
   * @returns Updated business details with application context
   */
  async updateBusinessDetails(
    applicationId: string,
    data: BusinessApplicationCreateRequest,
    options?: RequestOptions
  ): Promise<BusinessDetailsResponse> {
    return this.transport.request<BusinessDetailsResponse>({
      method: 'PUT',
      path: `/applications/${applicationId}/business-details`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  // ==========================================================================
  // Individual Details (non-business applications)
  // ==========================================================================

  /**
   * Update individual details for a non-business application.
   *
   * Uses PUT (full replace) per the OpenAPI spec. Only callable when the
   * application status is 'pending'.
   *
   * @param applicationId - Application ID
   * @param data - Individual details (full IndividualRequest)
   * @returns Updated individual details with application context
   */
  async updateIndividualDetails(
    applicationId: string,
    data: IndividualRequest,
    options?: RequestOptions
  ): Promise<IndividualDetailsResponse> {
    return this.transport.request<IndividualDetailsResponse>({
      method: 'PUT',
      path: `/applications/${applicationId}/individual-details`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  // ==========================================================================
  // Associated Individuals
  // ==========================================================================

  /**
   * Add an associated individual to an application.
   *
   * @param applicationId - Application ID
   * @param data - Individual data
   * @returns Created individual
   */
  async addIndividual(
    applicationId: string,
    data: AssociatedIndividualRequest,
    options?: RequestOptions
  ): Promise<AssociatedIndividual> {
    return this.transport.request<AssociatedIndividual>({
      method: 'POST',
      path: `/applications/${applicationId}/associated-individuals`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  /**
   * Update an associated individual.
   *
   * Uses PUT (full replace) per the OpenAPI spec.
   *
   * @param applicationId - Application ID
   * @param individualId - Individual ID
   * @param data - Full individual data (replaces existing)
   * @returns Updated individual
   */
  async updateIndividual(
    applicationId: string,
    individualId: string,
    data: AssociatedIndividualRequest,
    options?: RequestOptions
  ): Promise<AssociatedIndividual> {
    return this.transport.request<AssociatedIndividual>({
      method: 'PUT',
      path: `/applications/${applicationId}/associated-individuals/${individualId}`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
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

  // ==========================================================================
  // Attestations
  // ==========================================================================

  /**
   * Submit an attestation for an application.
   *
   * @param applicationId - Application ID
   * @param data - Attestation data (type, timestamp, applicant_id)
   */
  async submitAttestation(
    applicationId: string,
    data: AttestationSubmitRequest,
    options?: RequestOptions
  ): Promise<void> {
    await this.transport.request<void>({
      method: 'POST',
      path: `/applications/${applicationId}/attestations`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  // ==========================================================================
  // Enhanced Due Diligence (EDD)
  // ==========================================================================

  /**
   * Get the EDD record for an application.
   *
   * @param applicationId - Application ID
   * @returns EDD record with application context
   */
  async getEDD(applicationId: string): Promise<EDDWithApplicationID> {
    return this.transport.request<EDDWithApplicationID>({
      method: 'GET',
      path: `/applications/${applicationId}/edd`,
    });
  }

  /**
   * Create or update the EDD record for an application.
   *
   * This endpoint is idempotent (uses PUT).
   *
   * @param applicationId - Application ID
   * @param data - EDD data
   * @returns Updated EDD record with application context
   */
  async createOrUpdateEDD(
    applicationId: string,
    data: EDDRequest,
    options?: RequestOptions
  ): Promise<EDDWithApplicationID> {
    return this.transport.request<EDDWithApplicationID>({
      method: 'PUT',
      path: `/applications/${applicationId}/edd`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  // ==========================================================================
  // Application Documents
  // ==========================================================================

  /**
   * Upload an application document using base64-encoded content.
   *
   * For files larger than 20MB, use {@link getDocumentUploadUrl} and upload
   * directly to cloud storage, then call {@link verifyDocument}.
   *
   * @param applicationId - Application ID
   * @param data - Document data including base64 content
   * @returns Document upload response with document_id
   */
  async createDocument(
    applicationId: string,
    data: ApplicationDocumentUploadRequest,
    options?: RequestOptions
  ): Promise<DocumentUploadResponse> {
    return this.transport.request<DocumentUploadResponse>({
      method: 'POST',
      path: `/applications/${applicationId}/documents`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  /**
   * List documents for an application.
   *
   * Supports filtering by category and document type.
   *
   * @param applicationId - Application ID
   * @param params - Pagination and filter parameters
   * @returns Paginated iterator of document metadata
   */
  listDocuments(
    applicationId: string,
    params?: DocumentListParams
  ): PaginatedIterator<UploadedDocumentMetadata> {
    return this.paginate<UploadedDocumentMetadata>(
      `/applications/${applicationId}/documents`,
      params
    );
  }

  /**
   * Download/get a document by ID.
   *
   * @param applicationId - Application ID
   * @param documentId - Document ID
   * @returns Document content (binary)
   */
  async getDocument(applicationId: string, documentId: string): Promise<unknown> {
    return this.transport.request<unknown>({
      method: 'GET',
      path: `/applications/${applicationId}/documents/${documentId}`,
    });
  }

  /**
   * Delete a document from a pending application.
   *
   * Only documents from applications in 'pending' status can be deleted.
   *
   * @param applicationId - Application ID
   * @param documentId - Document ID
   */
  async deleteDocument(applicationId: string, documentId: string): Promise<void> {
    await this.transport.request<void>({
      method: 'DELETE',
      path: `/applications/${applicationId}/documents/${documentId}`,
    });
  }

  /**
   * Verify a document uploaded via presigned URL.
   *
   * After uploading a file to the presigned URL from {@link getDocumentUploadUrl},
   * call this endpoint to register and verify the upload.
   *
   * @param applicationId - Application ID
   * @param documentId - The upload_id from the presigned URL response
   * @returns Document upload response with document_id
   */
  async verifyDocument(
    applicationId: string,
    documentId: string,
    _data?: Record<string, unknown>,
    options?: RequestOptions
  ): Promise<DocumentUploadResponse> {
    return this.transport.request<DocumentUploadResponse>({
      method: 'POST',
      path: `/applications/${applicationId}/documents/${documentId}/verifications`,
      body: _data ?? {},
      idempotencyKey: options?.idempotencyKey,
    });
  }

  /**
   * Get a presigned upload URL for an application document.
   *
   * Use this for files larger than 20MB. Upload the file directly to the
   * returned URL, then call {@link verifyDocument} to register it.
   *
   * @param applicationId - Application ID
   * @param data - Document metadata
   * @returns Upload URL and upload ID
   */
  async getDocumentUploadUrl(
    applicationId: string,
    data: ApplicationDocumentUploadUrlRequest,
    options?: RequestOptions
  ): Promise<DocumentUploadUrlResponse> {
    return this.transport.request<DocumentUploadUrlResponse>({
      method: 'POST',
      path: `/applications/${applicationId}/document-uploads`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  // ==========================================================================
  // Individual Documents
  // ==========================================================================

  /**
   * Upload a document for an associated individual using base64-encoded content.
   *
   * Supports identity documents (passport, driver's license, residence permit)
   * and EDD documents (bank statement, etc.). For files larger than 10MB, use
   * {@link getIndividualDocumentUploadUrl} instead.
   *
   * @param applicationId - Application ID
   * @param individualId - Individual ID
   * @param data - Document data including base64 content
   * @returns Document upload response with document_id
   */
  async uploadIndividualDocument(
    applicationId: string,
    individualId: string,
    data: IndividualDocumentUploadRequest,
    options?: RequestOptions
  ): Promise<DocumentUploadResponse> {
    return this.transport.request<DocumentUploadResponse>({
      method: 'POST',
      path: `/applications/${applicationId}/associated-individuals/${individualId}/documents`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }

  /**
   * Get a presigned upload URL for an individual document.
   *
   * Use this for files larger than 10MB. Upload the file directly to the
   * returned URL.
   *
   * @param applicationId - Application ID
   * @param individualId - Individual ID
   * @param data - Document metadata
   * @returns Upload URL and upload ID
   */
  async getIndividualDocumentUploadUrl(
    applicationId: string,
    individualId: string,
    data: IndividualDocumentUploadUrlRequest,
    options?: RequestOptions
  ): Promise<DocumentUploadUrlResponse> {
    return this.transport.request<DocumentUploadUrlResponse>({
      method: 'POST',
      path: `/applications/${applicationId}/associated-individuals/${individualId}/document-uploads`,
      body: data,
      idempotencyKey: options?.idempotencyKey,
    });
  }
}
