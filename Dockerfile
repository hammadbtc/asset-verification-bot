FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3000 3001

# Start both services
CMD ["sh", "-c", "node web/server.js & node bot/index.js"]
