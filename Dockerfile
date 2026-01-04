# syntax=docker.io/docker/dockerfile:1

# Use the official Node.js 22 image as a base.
FROM node:22-alpine AS base

# Install libc6-compat for better compatibility with Node.js packages on Alpine
RUN apk add --no-cache libc6-compat

# Set the working directory in the container.
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps

# Copy package.json and package-lock.json
COPY package.json package-lock.json* ./

# Update npm and install dependencies
# Using --loglevel=error to suppress deprecation warnings from transitive dependencies
RUN npm install -g npm@latest && \
    npm ci --prefer-offline --no-audit --loglevel=error

# Rebuild the source code only when needed
FROM base AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the source code
COPY . .

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Increase Node.js heap size for build
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Build the application with standalone output for better Cloud Run performance
RUN npm run build

# Production stage
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install security updates
RUN apk upgrade --no-cache

# Create a non-root user to run the application
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Set the user to run the application
USER nextjs

# Expose the port the app runs on
EXPOSE 3000

# Set environment variables for Next.js standalone mode
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
# server.js is created by next build from the standalone output
CMD ["node", "server.js"]
