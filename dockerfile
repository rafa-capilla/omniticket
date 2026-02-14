# Use Node.js 22 as the base image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package.json only first (for better caching)
COPY package.json ./

# Install all dependencies including devDependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Expose port
EXPOSE 5173

# Command to run the application
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
