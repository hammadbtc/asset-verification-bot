FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3000 3001

CMD ["npm", "run", "dev"]
