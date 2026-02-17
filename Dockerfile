# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
RUN npm run build

# Stage 3: Migration dependencies (separate stage to keep runner lean)
FROM node:20-alpine AS migrate-deps
WORKDIR /migrate
RUN echo '{"name":"migrate","private":true}' > package.json && \
    npm install --no-package-lock drizzle-kit drizzle-orm postgres && \
    npm cache clean --force

# Stage 4: Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy migration tooling and files
COPY --from=migrate-deps /migrate/node_modules /migrate/node_modules
COPY --from=builder /app/drizzle /migrate/drizzle

# Create drizzle config for migrations (DATABASE_URL resolved at runtime)
RUN echo 'module.exports={out:"/migrate/drizzle",dialect:"postgresql",dbCredentials:{url:process.env.DATABASE_URL}}' \
    > /migrate/drizzle.config.js

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run migrations then start the app
CMD ["/entrypoint.sh"]
