FROM registry.access.redhat.com/ubi9/ubi:latest

RUN dnf update -y \
 && dnf module enable nodejs:20 -y \
 && dnf install -y nodejs \
 && dnf clean all

WORKDIR /app

# 루트 의존성(express, redis, mariadb 등) + backend 의존성(socket.io 등)
COPY package*.json ./
COPY scripts ./scripts
COPY backend/package*.json ./backend/
RUN npm install --ignore-scripts \
 && npm install --ignore-scripts --prefix ./backend

COPY backend ./backend

WORKDIR /app/backend

EXPOSE 3000

CMD ["node", "bin/www"]
