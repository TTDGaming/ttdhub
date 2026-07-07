# Image Playwright chính chủ: đã có Chromium + mọi thư viện hệ thống cần thiết
FROM mcr.microsoft.com/playwright:v1.56.1-noble

WORKDIR /app

COPY server/package.json server/package-lock.json* ./server/
RUN npm install --prefix server --omit=dev

COPY web/package.json web/package-lock.json* ./web/
RUN npm install --prefix web

COPY server ./server
COPY web ./web
RUN npm run build --prefix web && rm -rf web/node_modules

ENV PORT=3689 \
    MSHUB_DATA_DIR=/app/data

EXPOSE 3689
VOLUME ["/app/data"]

CMD ["node", "server/src/index.js"]
