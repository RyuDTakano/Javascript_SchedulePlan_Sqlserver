# Use official Node.js LTS image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files if present (for backend)
COPY package*.json ./

# Install dependencies if backend exists
RUN if [ -f package.json ]; then npm install; fi

# Copy all source code
COPY . .

# Expose backend port (adjust if needed)
EXPOSE 3001

# Default command: run backend if server.js exists, else serve static frontend
CMD if [ -f server.js ]; then node server.js; else npx serve -s .; fi
