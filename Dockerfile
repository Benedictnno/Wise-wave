# Dockerfile for WiseMove Connect Backend
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only for optimized size)
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose port (as defined in server.js)
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
