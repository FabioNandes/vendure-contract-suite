# Uma imagem, dois processos: o docker-compose.yml sobe o server com o CMD padrão e o worker
# com `node dist/index-worker.js`.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NODE_ENV=production faz o dashboard descobrir a URL da API a partir de quem o serve.
RUN NODE_ENV=production npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY static/email/templates ./static/email/templates
RUN mkdir -p static/assets static/email/test-emails && chown -R node:node static
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
