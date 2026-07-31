# Valkey 바이너리를 UBI에서 빌드해 game-server 이미지에 함께 설치합니다.
FROM registry.access.redhat.com/ubi9/ubi:latest AS valkey-build

ARG VALKEY_VERSION=8.1.9

RUN dnf install -y gcc make tar gzip which && dnf clean all

RUN curl -fsSL "https://github.com/valkey-io/valkey/archive/refs/tags/${VALKEY_VERSION}.tar.gz" \
    | tar -xz -C /tmp \
 && make -C "/tmp/valkey-${VALKEY_VERSION}" -j"$(nproc)" \
 && make -C "/tmp/valkey-${VALKEY_VERSION}" install PREFIX=/opt/valkey USE_REDIS_SYMLINKS=no \
 && rm -rf "/tmp/valkey-${VALKEY_VERSION}"

FROM registry.access.redhat.com/ubi9/ubi:latest

RUN dnf update -y \
 && dnf module enable nodejs:20 -y \
 && dnf install -y nodejs \
 && dnf clean all

COPY --from=valkey-build /opt/valkey/bin/valkey-server /usr/local/bin/valkey-server
COPY --from=valkey-build /opt/valkey/bin/valkey-cli /usr/local/bin/valkey-cli

WORKDIR /app

COPY package*.json ./
# backend/package.json 의 preinstall은 저장소 루트 전용이라 컨테이너 빌드에서는 건너뜁니다.
RUN npm install --ignore-scripts

COPY . .

COPY src/infra/docker/gameroom/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p /data

ENV REDIS_HOST=127.0.0.1 \
    REDIS_PORT=6379 \
    VALKEY_DIR=/data

EXPOSE 3000 6379

CMD ["docker-entrypoint.sh"]
