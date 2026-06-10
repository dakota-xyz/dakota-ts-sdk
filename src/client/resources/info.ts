/**
 * Info resource for platform capabilities.
 */

import { BaseResource } from './base.js';
import type { Country } from '../types.js';

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
    // /capabilities/countries returns Country[] directly, not the
    // paginated { data, meta } envelope. Earlier versions read
    // response.data here and silently returned undefined.
    return this.transport.request<Country[]>({
      method: 'GET',
      path: '/capabilities/countries',
    });
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
  async getNetworks(): Promise<string[]> {
    // /capabilities/networks returns string[] (network IDs like
    // "ethereum-mainnet") directly, not the paginated { data, meta }
    // envelope. Earlier versions typed this as Network[] and read
    // response.data, which silently returned undefined.
    return this.transport.request<string[]>({
      method: 'GET',
      path: '/capabilities/networks',
    });
  }
}
