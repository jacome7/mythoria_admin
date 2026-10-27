import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable standalone output for better Docker performance
  output: 'standalone',

  // Environment variables for client-side use
  env: {
    NEXT_PUBLIC_ADMIN_URL: process.env.ADMIN_URL || 'http://localhost:3001',
    NEXT_PUBLIC_STORY_GENERATION_WORKFLOW_URL:
      process.env.STORY_GENERATION_WORKFLOW_URL || 'http://localhost:8080',
    NEXT_PUBLIC_NOTIFICATION_ENGINE_URL:
      process.env.NOTIFICATION_ENGINE_URL || 'http://localhost:8081',
  },

  // Image configuration to allow external images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Allow all HTTPS hostnames
      },
      {
        protocol: 'http',
        hostname: '**', // Allow all HTTP hostnames (for local development)
      },
    ],
  },

  // Keep gRPC-based Google Cloud clients out of the bundle (resolved from node_modules at runtime)
  serverExternalPackages: [
    '@google-cloud/pubsub',
    '@google-cloud/storage',
    '@google-cloud/workflows',
    'google-gax',
    '@grpc/grpc-js',
    '@grpc/proto-loader',
  ],

  // Email templates are read from disk at runtime; include them in the standalone trace
  outputFileTracingIncludes: {
    '/api/email-campaigns/[id]/generate-assets': ['./src/templates/email/**/*'],
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
