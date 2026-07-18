FROM registry.access.redhat.com/ubi9/ubi:latest

RUN dnf -y install gcc gcc-c++ make python3 && \
    curl -fsSL https://rpm.nodesource.com/setup_24.x | bash - && \
    dnf install -y nodejs && \
    dnf clean all

WORKDIR /usr/src/gameroom

# 디렉토리 권한을 미리 확보하여 컨테이너 실행 시 권한 문제를 방지합니다.
RUN mkdir -p /usr/src/sandbox /usr/src/resultbox && \
    chmod -R 777 /usr/src/sandbox /usr/src/resultbox

COPY package*.json ./
RUN npm install

COPY . .

# 빌드 전용 컨테이너로 유지하고, 외부에서 podman exec로 컴파일 명령을 실행합니다.
CMD ["tail", "-f", "/dev/null"]