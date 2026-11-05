FROM docker.io/library/debian:bookworm-slim
ENV LANG=C.UTF-8 LC_ALL=C.UTF-8
RUN apt-get update && apt-get install -y --no-install-recommends python3 g++ openjdk-17-jdk-headless coreutils \
    && rm -rf /var/lib/apt/lists/*
COPY backend/src/infra/docker/worker/run-code.sh /usr/local/bin/run-code
RUN chmod 755 /usr/local/bin/run-code
USER 65534:65534
WORKDIR /work
ENTRYPOINT ["/usr/local/bin/run-code"]
