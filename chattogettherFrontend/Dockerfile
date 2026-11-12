# Stage 1: Build ứng dụng React với Node 20
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Phục vụ file tĩnh qua Nginx Alpine
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Cấu hình Nginx fallback cho Single Page Application (React Router)
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

