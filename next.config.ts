import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for better Docker performance
  output: 'standalone',
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
      }
    ],
  },
  
  // Experimental optimizations
  experimental: {
    // Enable optimizations - expanded for better tree shaking
    optimizePackageImports: [
      'react-icons',
      'drizzle-orm',
      'zod'
    ],
    // Enable faster builds
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
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
    config.ignoreWarnings = [
      { module: /node_modules/ },
    ];
    
    return config;
  },
};

export default nextConfig;
