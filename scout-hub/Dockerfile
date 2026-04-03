FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production

CMD ["npx", "tsx", "src/cli.ts", "api", "--host", "0.0.0.0", "--port", "18080"]
