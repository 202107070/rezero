FROM registry.access.redhat.com/ubi9/ubi:latest

RUN dnf update -y && \
    dnf module enable nodejs:20 -y && \
    dnf install -y nodejs && \
    dnf clean all

WORKDIR /usr/src/gameroom

RUN mkdir -p /usr/src/gameroom

COPY package*.json ./
RUN npm install --only=production --ignore-scripts

COPY . .

RUN chown -R 1001:0 /usr/src/gameroom
USER 1001

ENV DB_HOST=db \
    DB_PORT=3306 \
    REDIS_HOST=valkey \
    REDIS_PORT=6379

EXPOSE 4000

CMD ["node", "bin/www"]