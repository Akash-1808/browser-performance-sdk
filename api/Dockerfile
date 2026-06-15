FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY src/ ./src/

EXPOSE 3000

ENV NODE_ENV=production

CMD [ "npx", "tsx", "src/server.ts" ]


