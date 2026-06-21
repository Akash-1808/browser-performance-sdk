FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ==== Stage 2: Production ====

FROM node:20-alpine
WORKDIR /app

# Install a simple static server that handles React Router 'Single Page App' fallback
RUN npm install -g serve

# Copy only the compiled dist folder from the build stage
COPY --from=build /app/dist ./dist

EXPOSE 80

# Run the server on port 80, the -s flag handles React Router correctly
CMD ["serve", "-s", "dist", "-l", "80"]