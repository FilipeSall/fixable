FROM node:24-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/site/package.json apps/site/
RUN pnpm install --frozen-lockfile --filter api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter api deploy --prod /out

FROM node:24-slim
ENV NODE_ENV=production
ENV TRUST_PROXY=true
WORKDIR /app
COPY --from=build --chown=node:node /out ./
COPY --from=build --chown=node:node /repo/packages/shared ./packages/shared
RUN rm -rf node_modules/@fixable/shared && ln -s /app/packages/shared node_modules/@fixable/shared
USER node
EXPOSE 3333
CMD ["sh", "-c", "node src/db/migrate.ts && node src/server.ts"]
