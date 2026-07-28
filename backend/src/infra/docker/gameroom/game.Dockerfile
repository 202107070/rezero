FROM registry.access.redhat.com/ubi9/ubi-minimal:latest

RUN microdnf update -y && microdnf install -y \
    nodejs \
    npm \
    && microdnf clean all

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN chown -R 1001:0 /app
USER 1001

EXPOSE 3000

CMD ["node", "app.js"]