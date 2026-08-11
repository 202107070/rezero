FROM registry.access.redhat.com/ubi9/ubi-minimal:latest

RUN microdnf update -y && microdnf install -y \
    nodejs \
    npm \
    && microdnf clean all

WORKDIR /usr/src/gameroom

RUN mkdir -p /usr/src/gameroom

COPY package*.json ./
RUN npm install --only=production

COPY . .

RUN chown -R 1001:0 /usr/src/gameroom
USER 1001

ENV DB_HOST=db \
    DB_PORT=3306 \
    REDIS_HOST=valkey \
    REDIS_PORT=6379

EXPOSE 4000

CMD ["node", "server.js"]