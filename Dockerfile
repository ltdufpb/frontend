# ============================
# 1) Dependencies Stage
# ============================
FROM node:18-alpine AS dependencies

# Atualizar pacotes para corrigir CVEs e instalar necessários
RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache jq

WORKDIR /app

# Copiar arquivos de dependências
COPY package.json package-lock.json ./

# Instalar dependências com cache otimizado (deterministic)
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ============================
# 2) Build Stage
# ============================
FROM dependencies AS build
COPY . .
ARG APP_VERSION
ENV APP_VERSION=0.0.0
ARG VITE_BASE_URL=/
ENV VITE_BASE_URL=${VITE_BASE_URL}
RUN npm run build-only
RUN echo "0.0.0" > dist/version.txt
RUN sh scripts/generate-config.sh

# ============================
# 3) Runtime Stage
# ============================
FROM nginx:alpine

# Atualizar pacotes para corrigir CVEs
RUN apk update && apk upgrade --no-cache

ARG VITE_BASE_URL=/
ENV VITE_BASE_URL=${VITE_BASE_URL}

# Copy dist to the correct subpath (/ → /usr/share/nginx/html/, /rectest/ → /usr/share/nginx/html/rectest/)
RUN mkdir -p /usr/share/nginx/html
COPY --from=build /app/dist/ /tmp/dist/
RUN if [ "$VITE_BASE_URL" = "/" ]; then \
      cp -a /tmp/dist/* /usr/share/nginx/html/; \
    else \
      mkdir -p "/usr/share/nginx/html${VITE_BASE_URL}" && \
      cp -a /tmp/dist/* "/usr/share/nginx/html${VITE_BASE_URL}"; \
    fi && rm -rf /tmp/dist

# Generate nginx.conf from base path
RUN rm -f /etc/nginx/conf.d/default.conf
COPY ./nginx.conf.template /etc/nginx/nginx.conf.template
RUN BASE_PATH="${VITE_BASE_URL}" && \
    sed "s|__BASE_PATH__|${BASE_PATH}|g" /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf && \
    rm /etc/nginx/nginx.conf.template

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
