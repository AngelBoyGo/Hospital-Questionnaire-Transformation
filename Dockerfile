# Railway-optimized Dockerfile for Hospital Sandbox Generator
FROM node:18-alpine

# Install system dependencies for Puppeteer and Railway
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dumb-init \
    wget

# Puppeteer config
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S hospital-sandbox -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy application code
COPY --chown=hospital-sandbox:nodejs . .

# Create necessary directories and set ownership
RUN mkdir -p /app/generated_docs /app/logs && \
    chown -R hospital-sandbox:nodejs /app/generated_docs /app/logs

# Switch to non-root user
USER hospital-sandbox

# Health check for Railway (using PORT environment variable)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

# Expose port (Railway will set PORT automatically)
EXPOSE 3000

# Set environment variables for Railway
ENV NODE_ENV=production
ENV REAL_DEPLOYMENT=true

# Start the application using dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]


