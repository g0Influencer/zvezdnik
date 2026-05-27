# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS builder
WORKDIR /src
ENV CI=1
COPY package.json package-lock.json* bun.lock* ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=builder /src/dist /usr/share/nginx/html
# nginx.conf is provided by the prod compose via bind-mount
EXPOSE 80
