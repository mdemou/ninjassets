FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
# tsx is needed at runtime for Knex TypeScript migrations in entrypoint.sh
RUN npm ci --omit=dev && npm install tsx

COPY --from=builder /app/dist ./dist
COPY knexfile.cjs ./
COPY migrations ./migrations
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "start"]
