/**
 * Simple API Key service for basic authentication
 * Currently uses environment variables for key storage
 */

export interface ApiKeyInfo {
  isValid: boolean;
  source: string;
  permissions?: string[];
}

export class ApiKeyService {
  private static instance: ApiKeyService;

  static getInstance(): ApiKeyService {
    if (!ApiKeyService.instance) {
      ApiKeyService.instance = new ApiKeyService();
    }
    return ApiKeyService.instance;
  }

  /**
   * Validate an API key against environment configuration
   */
  validateApiKey(apiKey: string): ApiKeyInfo {
    const validApiKey = process.env.ADMIN_API_KEY;

    if (!validApiKey) {
      console.error('ADMIN_API_KEY not configured in environment');
      return {
        isValid: false,
        source: 'environment_error',
      };
    }

    if (apiKey === validApiKey) {
      return {
        isValid: true,
        source: 'environment',
        permissions: ['tickets:read', 'tickets:create', 'tickets:update'], // Basic permissions
      };
    }

    return {
      isValid: false,
      source: 'invalid_key',
    };
  }

  /**
   * Get API key from environment (for internal use)
   */
  getApiKey(): string | undefined {
    return process.env.ADMIN_API_KEY;
  }

  /**
   * Check if API key authentication is properly configured
   */
  isConfigured(): boolean {
    return !!process.env.ADMIN_API_KEY;
  }
}

export const apiKeyService = ApiKeyService.getInstance();
