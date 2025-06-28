# Use the official Node.js 22 image as a base.
FROM node:22.12-alpine AS builder

# Set the working directory in the container.
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Update npm and install dependencies
RUN npm install -g npm@latest && \
    npm ci --prefer-offline --no-audit

# Copy the source code
COPY . .

# Build the application with standalone output for better Cloud Run performance
RUN npm run build

# Production stage
FROM node:22.12-alpine AS runner

# Set the working directory in the container.
WORKDIR /app

# Install security updates
RUN apk upgrade --no-cache

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install only production dependencies
RUN npm install -g npm@latest && \
    npm ci --only=production --prefer-offline --no-audit && \
    npm cache clean --force

# Create a non-root user to run the application
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the built application from the builder stage
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Set the user to run the application
USER nextjs

# Expose the port the app runs on
EXPOSE 3000

# Set environment variables
ENV PORT=3000
ENV NODE_ENV=production

# Start the application
CMD ["node", "server.js"]
