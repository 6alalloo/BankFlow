FROM node:18-alpine

WORKDIR /app

# Install system dependencies for Prisma
RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Expose port
EXPOSE 4000

# Default command (can be overridden in docker-compose)
CMD ["npm", "run", "dev"]
