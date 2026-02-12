FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy app source
COPY . .

# Create imgs directory for uploads
RUN mkdir -p imgs

# Expose port
EXPOSE 8080

# Fly.io uses PORT=8080 by default
ENV PORT=8080

CMD ["node", "src/api.js"]
