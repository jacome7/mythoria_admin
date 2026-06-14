// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import React from 'react';

class TestHeaders {
  private values = new Map<string, string>();

  constructor(init?: Record<string, string>) {
    Object.entries(init ?? {}).forEach(([key, value]) => this.set(key, value));
  }

  get(key: string) {
    return this.values.get(key.toLowerCase()) ?? null;
  }

  set(key: string, value: string) {
    this.values.set(key.toLowerCase(), value);
  }
}

class TestRequest {
  url: string;
  headers: TestHeaders;
  method: string;
  private body: unknown;

  constructor(
    url: string,
    init: { headers?: Record<string, string>; method?: string; body?: unknown } = {},
  ) {
    this.url = url;
    this.headers = new TestHeaders(init.headers);
    this.method = init.method ?? 'GET';
    this.body = init.body;
  }

  async json() {
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
  }
}

class TestResponse {
  status: number;
  headers: TestHeaders;
  body: unknown;
  ok: boolean;

  constructor(body?: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
    this.status = init.status ?? 200;
    this.headers = new TestHeaders(init.headers);
    this.body = body;
    this.ok = this.status >= 200 && this.status < 300;
  }

  static json(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
    return new TestResponse(JSON.stringify(body), {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  }

  async text() {
    return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
  }

  async json() {
    const text = await this.text();
    return text ? JSON.parse(text) : null;
  }
}

Object.assign(globalThis, {
  Headers: globalThis.Headers ?? TestHeaders,
  Request: globalThis.Request ?? TestRequest,
  Response: globalThis.Response ?? TestResponse,
});

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}));

// Mock Next.js Link component
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return React.createElement('a', { href, ...props }, children);
  };
});

// Mock Next.js Image component
jest.mock('next/image', () => {
  return function MockImage({ src, alt, ...props }: any) {
    return React.createElement('img', { src, alt, ...props });
  };
});

// Mock next-auth
jest.mock('next-auth', () => {
  return jest.fn(() => ({
    handlers: {
      GET: jest.fn(),
      POST: jest.fn(),
    },
    auth: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  }));
});

// Mock next-auth providers
jest.mock('next-auth/providers/google', () => {
  return jest.fn(() => ({
    id: 'google',
    name: 'Google',
    type: 'oauth',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
  }));
});

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
  signOut: jest.fn(),
  useSession: jest.fn(() => ({
    data: null,
    status: 'unauthenticated',
  })),
  SessionProvider: ({ children }: any) => children,
}));
