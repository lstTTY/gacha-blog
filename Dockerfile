FROM node:20-slim

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY . .

RUN node dump.js > gacha_dump.sql 2>/dev/null || true

EXPOSE 3000

CMD ["node", "server.js"]
