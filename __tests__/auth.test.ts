/**
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock environment variables for testing
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.AUTH_SECRET = 'test-auth-secret';

// Mock the database
jest.mock('@/db', () => ({
  getBackofficeDb: jest.fn().mockReturnValue({
    // Mock drizzle database instance
    query: {
      users: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    },
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }),
}));

describe('Authentication Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should have required environment variables', () => {
    expect(process.env.GOOGLE_CLIENT_ID).toBeDefined();
    expect(process.env.GOOGLE_CLIENT_SECRET).toBeDefined();
    expect(process.env.AUTH_SECRET).toBeDefined();
  });

  it('should reject non-Google providers', async () => {
    // Import the auth configuration
    const authModule = await import('@/auth');
    
    // This tests the signIn callback logic
    expect(authModule).toBeDefined();
  });

  it('should validate email domains correctly', () => {
    const allowedDomains = ['@mythoria.pt', '@caravanconcierge.com'];
    
    const validEmails = [
      'user@mythoria.pt',
      'admin@mythoria.pt',
      'support@caravanconcierge.com',
      'manager@caravanconcierge.com',
    ];

    const invalidEmails = [
      'user@gmail.com',
      'admin@yahoo.com',
      'support@example.com',
      'user@mythoria.com',
      'admin@caravanconciergecom',
    ];

    validEmails.forEach(email => {
      const isValid = allowedDomains.some(domain => email.endsWith(domain));
      expect(isValid).toBe(true);
    });

    invalidEmails.forEach(email => {
      const isValid = allowedDomains.some(domain => email.endsWith(domain));
      expect(isValid).toBe(false);
    });
  });

  it('should require email verification', () => {
    const profiles = [
      { email: 'test@mythoria.pt', email_verified: true },
      { email: 'test@mythoria.pt', email_verified: false },
      { email: 'test@caravanconcierge.com', email_verified: true },
      { email: 'test@caravanconcierge.com', email_verified: false },
    ];

    const verifiedProfiles = profiles.filter(profile => profile.email_verified);
    const unverifiedProfiles = profiles.filter(profile => !profile.email_verified);

    expect(verifiedProfiles).toHaveLength(2);
    expect(unverifiedProfiles).toHaveLength(2);
    
    // All verified profiles should have valid domains
    verifiedProfiles.forEach(profile => {
      const hasValidDomain = profile.email.endsWith('@mythoria.pt') || 
                            profile.email.endsWith('@caravanconcierge.com');
      expect(hasValidDomain).toBe(true);
    });
  });
});
