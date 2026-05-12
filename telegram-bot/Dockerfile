FROM node:22-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm install

COPY . .

RUN mkdir -p /app/data

ENV PORT=3000
EXPOSE ${PORT}

CMD ["node", "src/index.js"]
