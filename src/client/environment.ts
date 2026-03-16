/**
 * Environment configuration for Dakota Platform API.
 */
export enum Environment {
  /** Sandbox environment for testing - no real money moves */
  Sandbox = 'sandbox',
  /** Production environment - real transactions with real money */
  Production = 'production',
  /** Development environment (internal use) */
  Development = 'development',
  /** Local environment (internal use) */
  Local = 'local',
}

const ENVIRONMENT_URLS: Record<Environment, string> = {
  [Environment.Sandbox]: 'https://api.platform.sandbox.dakota.xyz',
  [Environment.Production]: 'https://api.platform.dakota.xyz',
  [Environment.Development]: 'https://api.platform.development.dakota.xyz',
  [Environment.Local]: 'http://localhost:6464',
};

/**
 * Get the base URL for a given environment.
 */
export function getEnvironmentURL(env: Environment): string {
  const url = ENVIRONMENT_URLS[env];
  if (!url) {
    throw new Error(`Unknown environment: ${env}`);
  }
  return url;
}
