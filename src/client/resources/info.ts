/**
 * Info resource for platform capabilities.
 */

import { BaseResource } from './base.js';
import type { Country, Network } from '../types.js';

/**
 * Info API resource for platform capabilities.
 */
export class InfoResource extends BaseResource {
  /**
   * Get supported countries.
   *
   * @returns Array of supported countries
   *
   * @example
   * ```typescript
   * const countries = await client.info.getCountries();
   * ```
   */
  async getCountries(): Promise<Country[]> {
    const response = await this.transport.request<{ data: Country[] }>({
      method: 'GET',
      path: '/capabilities/countries',
    });
    return response.data;
  }

  /**
   * Get supported networks.
   *
   * @returns Array of supported networks
   *
   * @example
   * ```typescript
   * const networks = await client.info.getNetworks();
   * for (const network of networks) {
   *   console.log(network.id, network.name);
   * }
   * ```
   */
  async getNetworks(): Promise<Network[]> {
    const response = await this.transport.request<{ data: Network[] }>({
      method: 'GET',
      path: '/capabilities/networks',
    });
    return response.data;
  }
}
