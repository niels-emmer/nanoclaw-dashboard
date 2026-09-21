FROM node:22.23.2 AS builder
WORKDIR /app

COPY frontend/package*.json ./
RUN npm install --include=optional \
    && npm install --no-save @rolldown/binding-linux-x64-gnu lightningcss-linux-x64-gnu

COPY frontend/ ./

ARG VITE_BACKEND_WS_URL
ENV VITE_BACKEND_WS_URL=${VITE_BACKEND_WS_URL}

ARG VITE_BACKUP_TOKEN
ENV VITE_BACKUP_TOKEN=${VITE_BACKUP_TOKEN}

RUN npm run build

FROM nginx:1.27-alpine AS runner
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
