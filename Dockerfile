# ============================
# 1) Dependencies Stage
# ============================
FROM node:18-alpine AS dependencies

# Atualizar pacotes para corrigir CVEs e instalar necessários
RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache jq

WORKDIR /app

# Copiar apenas arquivo de dependências primeiro
COPY package.json ./

# Instalar dependências com cache otimizado
RUN --mount=type=cache,target=/root/.npm \
    npm install

# ============================
# 2) Build Stage
# ============================
FROM dependencies AS build
COPY . .
ARG APP_VERSION
ENV APP_VERSION=0.0.0
RUN npm run build-only
RUN echo "0.0.0" > dist/version.txt
RUN sh scripts/generate-config.sh

# ============================
# 3) Runtime Stage
# ============================
FROM nginx:alpine

# Atualizar pacotes para corrigir CVEs
RUN apk update && apk upgrade --no-cache

COPY --from=build /app/dist/ /usr/share/nginx/html/rectest
RUN rm -f /etc/nginx/conf.d/default.conf
COPY ./nginx.conf /etc/nginx/nginx.conf

# Criar diretórios de cache e ajustar permissões
RUN mkdir -p /var/cache/nginx/client_temp /var/cache/nginx/proxy_temp \
    /var/cache/nginx/fastcgi_temp /var/cache/nginx/uwsgi_temp /var/cache/nginx/scgi_temp && \
    chown -R nginx:nginx /var/cache/nginx && \
    chmod -R 755 /var/cache/nginx && \
    touch /tmp/nginx.pid && \
    chown nginx:nginx /tmp/nginx.pid && \
    chown -R nginx:nginx /var/log/nginx

EXPOSE 8080
USER nginx
