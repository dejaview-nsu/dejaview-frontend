FROM node:22.18.0-bookworm-slim AS build

WORKDIR /app

ENV HUSKY=0

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .

ARG VITE_API_BASE_URL=/api/v1
RUN pnpm build

FROM nginx:stable-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 5173
