#!/bin/bash
# =============================================================================
# OTU — 원격 원클릭 설치 스크립트
#
# 사용법:
#   curl -fsSL https://raw.githubusercontent.com/opentutorials-org/otu.oss/main/install-remote.sh | bash
#
# 이 스크립트가 수행하는 작업:
#   1. Docker + Docker Compose 설치 (없는 경우)
#   2. 필요한 설정 파일 다운로드
#   3. 대화형 설정 (도메인, 보안 키 생성)
#   4. 서비스 시작
#
# 요구사항: curl, openssl (대부분의 Linux 서버에 기본 설치)
#
# 참고: sudo로 실행할 경우 $HOME이 root의 홈(/root)으로 변경될 수 있습니다.
#       특정 디렉토리에 설치하려면 OTU_INSTALL_DIR 환경변수를 설정하세요.
#       예) OTU_INSTALL_DIR=/home/ubuntu/otu curl -fsSL ... | bash
# =============================================================================

set -e

# ---------------------------------------------------------------
# 설정
# ---------------------------------------------------------------
REPO_OWNER="${OTU_REPO_OWNER:-opentutorials-org}"
REPO_NAME="${OTU_REPO_NAME:-otu.oss}"
REPO_BRANCH="${OTU_BRANCH:-main}"
INSTALL_DIR="${OTU_INSTALL_DIR:-$HOME/otu}"
RAW_BASE="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}"

# ---------------------------------------------------------------
# 색상
# ---------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${BLUE}▸${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn()    { echo -e "${YELLOW}!${NC} $1"; }
error()   { echo -e "${RED}✗${NC} $1"; exit 1; }

# ---------------------------------------------------------------
# 0. 시스템 확인
# ---------------------------------------------------------------
echo ""
echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}  OTU 원클릭 설치${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""

# root 확인
if [ "$(id -u)" -eq 0 ]; then
    SUDO=""
else
    SUDO="sudo"
fi

# OS 감지
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_ID="$ID"
    info "OS: ${PRETTY_NAME:-$ID}"
else
    OS_ID="unknown"
    info "OS: $(uname -s)"
fi

# ---------------------------------------------------------------
# 1. Docker 설치 (없는 경우)
# ---------------------------------------------------------------
install_docker() {
    info "Docker 설치 중..."

    if [ "$OS_ID" = "ubuntu" ] || [ "$OS_ID" = "debian" ]; then
        # Docker 공식 설치 스크립트 사용
        curl -fsSL https://get.docker.com | $SUDO sh

        # 현재 사용자를 docker 그룹에 추가
        if [ -n "$SUDO" ]; then
            $SUDO usermod -aG docker "$USER"
        fi

        success "Docker 설치 완료"
        warn "docker 그룹 적용을 위해 'newgrp docker' 또는 재로그인이 필요할 수 있습니다."

        # 현재 세션에서 docker 그룹 활성화 시도
        if ! docker info &>/dev/null 2>&1; then
            if command -v newgrp &>/dev/null; then
                # newgrp는 서브쉘을 생성하므로 스크립트를 다시 실행
                warn "Docker 그룹을 활성화하기 위해 스크립트를 재실행합니다..."
                exec sg docker "$0"
            fi
        fi
    elif [ "$OS_ID" = "amzn" ] || [ "$OS_ID" = "centos" ] || [ "$OS_ID" = "rhel" ]; then
        $SUDO yum install -y docker
        $SUDO systemctl start docker
        $SUDO systemctl enable docker
        $SUDO usermod -aG docker "$USER"
        success "Docker 설치 완료"
    else
        error "지원하지 않는 OS입니다. Docker를 수동 설치 후 다시 실행하세요: https://docs.docker.com/engine/install/"
    fi
}

if ! command -v docker &>/dev/null; then
    install_docker
else
    success "Docker 확인 완료: $(docker --version | head -1)"
fi

# Docker Compose v2 확인
if ! docker compose version &>/dev/null 2>&1; then
    error "Docker Compose v2가 필요합니다. Docker를 최신 버전으로 업데이트하세요."
fi
success "Docker Compose 확인 완료"

# openssl 확인
if ! command -v openssl &>/dev/null; then
    info "openssl 설치 중..."
    $SUDO apt-get update -qq && $SUDO apt-get install -y -qq openssl
fi

# ---------------------------------------------------------------
# 2. 설치 디렉토리 생성 및 파일 다운로드
# ---------------------------------------------------------------
echo ""
info "설치 디렉토리: ${INSTALL_DIR}"

if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/docker/.env" ]; then
    warn "기존 설치가 발견되었습니다: ${INSTALL_DIR}"
    read -p "  기존 설치를 덮어쓸까요? (데이터는 보존됩니다) (y/N): " overwrite
    if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
        info "기존 설치를 유지합니다."
        echo "  시작: cd ${INSTALL_DIR} && bash otu.sh start"
        exit 0
    fi
fi

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

info "설정 파일 다운로드 중..."

# 필요한 디렉토리 생성
mkdir -p docker/caddy docker/kong docker/volumes/db/init

# 파일 다운로드 함수
download() {
    local path="$1"
    curl -fsSL "${RAW_BASE}/${path}" -o "${INSTALL_DIR}/${path}"
}

# 핵심 파일 다운로드
download "docker-compose.prod.yml"
download "otu.sh"
download "docker/caddy/Caddyfile"
download "docker/kong/kong.yml"
download "docker/.env.example"
download "docker/generate-keys.sh"
download "docker/lib-jwt.sh"
download "docker/volumes/db/init/00-init-extensions.sql"

# docker-compose.prod.yml을 기본 compose 파일로 사용
cp docker-compose.prod.yml docker-compose.yml

# 실행 권한 부여
chmod +x otu.sh docker/generate-keys.sh

success "파일 다운로드 완료"

# ---------------------------------------------------------------
# 3. otu.sh install 실행
# ---------------------------------------------------------------
echo ""
info "대화형 설치를 시작합니다..."
echo ""

bash otu.sh install
