FROM registry.access.redhat.com/ubi9/ubi:latest

RUN dnf update -y && dnf install -y \
    gcc \
    gcc-c++ \
    make \
    python3 \
    python3-pip \
    java-21-openjdk-devel \
    nss \
    atk \
    at-spi2-atk \
    libXcomposite \
    libXrandr \
    libXdamage \
    libxshmfence \
    glib2 \
    pango \
    alsa-lib \
    fontconfig \
    && dnf clean all

RUN dnf module enable nodejs:20 -y && dnf install -y nodejs && dnf clean all

WORKDIR /app

RUN mkdir -p /app/src/infra/mountpoint/sandbox /app/src/infra/mountpoint/resultbox /app/sandbox /app/resultbox

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false

RUN npm install -g --ignore-scripts htmlhint stylelint cheerio puppeteer pixelmatch

COPY package*.json ./
RUN npm install --only=production --ignore-scripts

COPY . .

RUN useradd -m runner && chown -R runner:runner /app
USER runner

EXPOSE 8080

CMD ["node", "bin/www"]