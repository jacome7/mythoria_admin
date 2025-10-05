import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable standalone output for better Docker performance
  output: 'standalone',

  // Environment variables for client-side use
  env: {
    NEXT_PUBLIC_WEBAPP_URL: process.env.WEBAPP_URL || 'http://localhost:3000',
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

  // Experimental optimizations
  experimental: {
    // Enable optimizations - expanded for better tree shaking
    optimizePackageImports: ['react-icons', 'drizzle-orm', 'zod'],
  },

  // Turbopack configuration (moved from experimental.turbo)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
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

  // Webpack configuration
  webpack: (config) => {
    // Ignore source maps warnings for better build performance
    config.ignoreWarnings = [{ module: /node_modules/ }];

    return config;
  },
};

export default nextConfig;
