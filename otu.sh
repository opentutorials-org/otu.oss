#!/bin/bash
# =============================================================================
# OTU — 셀프호스팅 CLI
#
# 사용법:
#   bash otu.sh install        대화형 설치 (키 생성 → 설정 → 실행)
#   bash otu.sh start          서비스 시작
#   bash otu.sh stop           서비스 중지
#   bash otu.sh restart        서비스 재시작
#   bash otu.sh status         서비스 상태 확인
#   bash otu.sh upgrade        최신 버전으로 업그레이드
#   bash otu.sh backup         데이터베이스 백업
#   bash otu.sh logs [서비스]  로그 확인
#   bash otu.sh help           도움말
# =============================================================================

set -e

# ---------------------------------------------------------------
# 경로 & 상수
# ---------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/docker/.env"
ENV_EXAMPLE="${SCRIPT_DIR}/docker/.env.example"

# docker-compose.prod.yml이 있으면 prod 모드 (pre-built 이미지)
if [ -f "${SCRIPT_DIR}/docker-compose.prod.yml" ] && [ ! -f "${SCRIPT_DIR}/Dockerfile" ]; then
    COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.prod.yml"
else
    COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
fi
COMPOSE="docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE}"

# ---------------------------------------------------------------
# 색상 출력
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
error()   { echo -e "${RED}✗${NC} $1"; }

# ---------------------------------------------------------------
# JWT 생성 (공통 라이브러리)
# ---------------------------------------------------------------
source "${SCRIPT_DIR}/docker/lib-jwt.sh"

# ---------------------------------------------------------------
# 사전 요구사항 확인
# ---------------------------------------------------------------
check_prerequisites() {
    local ok=true

    if ! command -v docker &> /dev/null; then
        error "Docker가 설치되어 있지 않습니다."
        echo "  설치: https://docs.docker.com/engine/install/"
        ok=false
    fi

    if ! docker compose version &> /dev/null 2>&1; then
        error "Docker Compose v2가 필요합니다."
        ok=false
    fi

    if ! command -v openssl &> /dev/null; then
        error "openssl이 설치되어 있지 않습니다."
        ok=false
    fi

    if [ "$ok" = false ]; then
        exit 1
    fi

    success "사전 요구사항 확인 완료 (Docker, Docker Compose, openssl)"
}

# ---------------------------------------------------------------
# env 파일 존재 확인
# ---------------------------------------------------------------
require_env() {
    if [ ! -f "$ENV_FILE" ]; then
        error "docker/.env 파일이 없습니다. 먼저 설치를 실행하세요:"
        echo "  bash otu.sh install"
        exit 1
    fi
}

# ---------------------------------------------------------------
# install — 대화형 설치
# ---------------------------------------------------------------
cmd_install() {
    echo ""
    echo -e "${BOLD}========================================${NC}"
    echo -e "${BOLD}  OTU 셀프호스팅 설치${NC}"
    echo -e "${BOLD}========================================${NC}"
    echo ""

    check_prerequisites

    # 기존 설정 확인
    if [ -f "$ENV_FILE" ]; then
        warn "docker/.env 파일이 이미 존재합니다."
        read -p "  기존 설정을 덮어쓸까요? (y/N): " overwrite
        if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
            info "기존 설정을 유지합니다. 'bash otu.sh start'로 서비스를 시작하세요."
            return
        fi
        echo ""
    fi

    # ---- 배포 유형 선택 ----
    echo "배포 유형을 선택하세요:"
    echo ""
    echo "  1) 로컬 테스트 (localhost, HTTP)"
    echo "  2) 도메인 배포 (커스텀 도메인, 자동 HTTPS)"
    echo ""
    read -p "선택 [1]: " deploy_type
    deploy_type=${deploy_type:-1}

    local domain="localhost"
    local api_domain="api.localhost"
    local site_url="http://localhost"
    local api_external_url="http://api.localhost"

    if [ "$deploy_type" = "2" ]; then
        echo ""
        read -p "앱 도메인 (예: otu.hyoda.kr): " domain
        if [ -z "$domain" ]; then
            error "도메인을 입력해야 합니다."
            exit 1
        fi
        read -p "API 도메인 [api.${domain}]: " api_domain
        api_domain=${api_domain:-"api.${domain}"}
        site_url="https://${domain}"
        api_external_url="https://${api_domain}"

        echo ""
        info "DNS A 레코드가 서버 IP를 가리키는지 확인하세요:"
        echo "  ${domain}       → [서버 IP]"
        echo "  ${api_domain}   → [서버 IP]"
        echo ""
        read -p "DNS 설정이 완료되었나요? (y/N): " dns_ok
        if [[ ! "$dns_ok" =~ ^[Yy]$ ]]; then
            warn "DNS 설정 후 다시 실행하세요."
            exit 0
        fi
    fi

    # ---- 보안 키 생성 ----
    echo ""
    info "보안 키 생성 중..."

    local jwt_secret postgres_password db_enc_key anon_key service_role_key
    jwt_secret=$(openssl rand -base64 32 | tr -d '\n')
    postgres_password=$(openssl rand -base64 24 | tr -d '\n/+=')
    db_enc_key=$(openssl rand -hex 8)  # AES-128 requires exactly 16 bytes

    local now exp
    now=$(date +%s)
    exp=$((now + 315360000))  # 10년

    anon_key=$(generate_jwt "$(printf '{"role":"anon","iss":"supabase","iat":%d,"exp":%d}' "$now" "$exp")" "$jwt_secret")
    service_role_key=$(generate_jwt "$(printf '{"role":"service_role","iss":"supabase","iat":%d,"exp":%d}' "$now" "$exp")" "$jwt_secret")

    success "보안 키 생성 완료"

    # ---- 선택 기능 ----
    local enable_ai="false"
    local openai_api_key=""

    echo ""
    read -p "AI 기능을 활성화할까요? (y/N): " ai_yn
    if [[ "$ai_yn" =~ ^[Yy]$ ]]; then
        enable_ai="true"
        read -p "  OpenAI API 키: " openai_api_key
        if [ -z "$openai_api_key" ]; then
            warn "API 키 없이는 AI 기능이 작동하지 않습니다."
            enable_ai="false"
        fi
    fi

    # ---- .env 파일 생성 ----
    info "docker/.env 파일 생성 중..."

    mkdir -p "${SCRIPT_DIR}/docker"
    cat > "$ENV_FILE" << ENVEOF
# =============================================================================
# OTU — Docker 셀프호스팅 환경변수 (자동 생성됨)
# 생성일: $(date '+%Y-%m-%d %H:%M:%S')
# =============================================================================

# 보안 키
POSTGRES_PASSWORD=${postgres_password}
JWT_SECRET=${jwt_secret}
ANON_KEY=${anon_key}
SERVICE_ROLE_KEY=${service_role_key}
DB_ENC_KEY=${db_enc_key}

# 도메인 설정
DOMAIN=${domain}
API_DOMAIN=${api_domain}
SITE_URL=${site_url}
API_EXTERNAL_URL=${api_external_url}

# AI 기능
ENABLE_AI=${enable_ai}
AI_PROVIDER=openai
OPENAI_API_KEY=${openai_api_key}

# 앱 호스트 URL
NEXT_PUBLIC_HOST=${site_url}

# 소셜 로그인 (필요 시 활성화)
ENABLE_GITHUB_AUTH=false
ENABLE_GOOGLE_AUTH=false
ENABLE_APPLE_AUTH=false
ENVEOF

    success "docker/.env 파일 생성 완료"

    # ---- Docker Compose 빌드 & 실행 ----
    echo ""
    # 소스 빌드 vs Pre-built 이미지 판별
    if [ -f "${SCRIPT_DIR}/Dockerfile" ]; then
        info "소스에서 Docker 이미지 빌드 및 서비스 시작 중..."
        info "(초기 빌드는 Next.js + DB 이미지 빌드로 인해 시간이 걸립니다)"
        BUILD_FLAG="--build"
    else
        info "Pre-built 이미지 다운로드 및 서비스 시작 중..."
        BUILD_FLAG=""
    fi
    echo ""

    $COMPOSE up -d $BUILD_FLAG

    echo ""
    success "OTU 서비스가 시작되었습니다!"
    echo ""
    echo -e "${BOLD}========================================${NC}"
    echo -e "  접속: ${GREEN}${site_url}${NC}"
    echo -e "${BOLD}========================================${NC}"
    echo ""
    info "서비스 상태: bash otu.sh status"
    info "로그 확인:   bash otu.sh logs"
    info "서비스 중지: bash otu.sh stop"
    echo ""
}

# ---------------------------------------------------------------
# start — 서비스 시작
# ---------------------------------------------------------------
cmd_start() {
    require_env
    info "서비스 시작 중..."
    $COMPOSE up -d
    success "서비스가 시작되었습니다."
    echo ""
    cmd_status
}

# ---------------------------------------------------------------
# stop — 서비스 중지
# ---------------------------------------------------------------
cmd_stop() {
    require_env
    info "서비스 중지 중..."
    $COMPOSE down
    success "모든 서비스가 중지되었습니다."
}

# ---------------------------------------------------------------
# restart — 서비스 재시작
# ---------------------------------------------------------------
cmd_restart() {
    require_env
    info "서비스 재시작 중..."
    $COMPOSE restart
    success "서비스가 재시작되었습니다."
}

# ---------------------------------------------------------------
# status — 서비스 상태 확인
# ---------------------------------------------------------------
cmd_status() {
    require_env
    echo ""
    $COMPOSE ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    echo ""

    # SITE_URL 읽기
    local site_url
    site_url=$(grep '^SITE_URL=' "$ENV_FILE" 2>/dev/null | cut -d'=' -f2-)
    if [ -n "$site_url" ]; then
        info "접속 URL: ${site_url}"
    fi
}

# ---------------------------------------------------------------
# upgrade — 최신 버전으로 업그레이드
# ---------------------------------------------------------------
cmd_upgrade() {
    require_env
    echo ""

    if [ -d "${SCRIPT_DIR}/.git" ]; then
        info "최신 소스 코드 가져오는 중..."
        git -C "$SCRIPT_DIR" pull
        echo ""
        info "이미지 재빌드 및 서비스 업데이트 중..."
        $COMPOSE up -d --build
    else
        info "최신 이미지 다운로드 중..."
        $COMPOSE pull
        echo ""
        info "서비스 업데이트 중..."
        $COMPOSE up -d
    fi

    echo ""
    success "업그레이드가 완료되었습니다."
    echo ""
    cmd_status
}

# ---------------------------------------------------------------
# backup — 데이터베이스 백업
# ---------------------------------------------------------------
cmd_backup() {
    require_env
    local backup_dir="${SCRIPT_DIR}/backups"
    local backup_file="otu-backup-$(date +%F-%H%M%S).sql.gz"

    mkdir -p "$backup_dir"

    info "데이터베이스 백업 중..."
    $COMPOSE exec -T db pg_dump -U supabase_admin postgres | gzip > "${backup_dir}/${backup_file}"

    success "백업 완료: backups/${backup_file}"
    echo ""

    # 백업 목록 표시
    local count
    count=$(ls -1 "${backup_dir}"/otu-backup-*.sql.gz 2>/dev/null | wc -l | tr -d ' ')
    info "총 백업 파일: ${count}개 (backups/ 디렉토리)"
}

# ---------------------------------------------------------------
# logs — 로그 확인
# ---------------------------------------------------------------
cmd_logs() {
    require_env
    local service="${1:-}"

    if [ -n "$service" ]; then
        $COMPOSE logs -f --tail=100 "$service"
    else
        $COMPOSE logs -f --tail=50
    fi
}

# ---------------------------------------------------------------
# help — 도움말
# ---------------------------------------------------------------
cmd_help() {
    echo ""
    echo -e "${BOLD}OTU 셀프호스팅 CLI${NC}"
    echo ""
    echo "사용법: bash otu.sh <명령어> [옵션]"
    echo ""
    echo "명령어:"
    echo "  install          대화형 설치 (키 생성 → 설정 → 빌드 → 실행)"
    echo "  start            서비스 시작"
    echo "  stop             서비스 중지"
    echo "  restart          서비스 재시작"
    echo "  status           서비스 상태 확인"
    echo "  upgrade          최신 버전으로 업그레이드 (git pull + rebuild)"
    echo "  backup           데이터베이스 백업 (backups/ 디렉토리)"
    echo "  logs [서비스]    로그 확인 (서비스: app, db, caddy, kong, auth, ...)"
    echo "  help             이 도움말 표시"
    echo ""
    echo "예시:"
    echo "  bash otu.sh install          # 처음 설치"
    echo "  bash otu.sh logs app         # Next.js 앱 로그만 확인"
    echo "  bash otu.sh backup           # DB 백업 생성"
    echo ""
}

# ---------------------------------------------------------------
# 메인 라우터
# ---------------------------------------------------------------
case "${1:-help}" in
    install)  cmd_install ;;
    start)    cmd_start ;;
    stop)     cmd_stop ;;
    restart)  cmd_restart ;;
    status)   cmd_status ;;
    upgrade)  cmd_upgrade ;;
    backup)   cmd_backup ;;
    logs)     shift; cmd_logs "$@" ;;
    help|--help|-h)  cmd_help ;;
    *)
        error "알 수 없는 명령어: $1"
        cmd_help
        exit 1
        ;;
esac
