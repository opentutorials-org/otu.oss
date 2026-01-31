#!/bin/bash
# =============================================================================
# OTU — JWT Secret & API Key 생성
#
# 사용법: bash docker/generate-keys.sh
# 생성 결과를 docker/.env 파일에 복사하세요.
#
# 요구사항: openssl (Node.js 불필요)
# =============================================================================

set -e

# ---------------------------------------------------------------
# Base64url 인코딩 (순수 openssl, Node.js 불필요)
# ---------------------------------------------------------------
base64url_encode() {
    # stdin 또는 인자로 입력 받아 base64url 인코딩
    if [ -n "$1" ]; then
        printf '%s' "$1" | openssl base64 -A | tr '+/' '-_' | tr -d '='
    else
        openssl base64 -A | tr '+/' '-_' | tr -d '='
    fi
}

hmac_sha256_sign() {
    # $1: data, $2: secret → base64url encoded HMAC-SHA256
    printf '%s' "$1" | openssl dgst -sha256 -hmac "$2" -binary | base64url_encode
}

generate_jwt() {
    # $1: payload JSON, $2: secret
    local header
    header=$(base64url_encode '{"alg":"HS256","typ":"JWT"}')
    local payload
    payload=$(base64url_encode "$1")
    local signature
    signature=$(hmac_sha256_sign "${header}.${payload}" "$2")
    echo "${header}.${payload}.${signature}"
}

# ---------------------------------------------------------------
# 키 생성
# ---------------------------------------------------------------

# JWT Secret (32바이트 = 256비트)
JWT_SECRET=$(openssl rand -base64 32 | tr -d '\n')

# PostgreSQL 비밀번호
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '\n/+=')

# JWT Payload 생성
NOW=$(date +%s)
EXP=$((NOW + 315360000))  # 10년

# Supabase ANON_KEY
ANON_PAYLOAD=$(printf '{"role":"anon","iss":"supabase","iat":%d,"exp":%d}' "$NOW" "$EXP")
ANON_KEY=$(generate_jwt "$ANON_PAYLOAD" "$JWT_SECRET")

# Supabase SERVICE_ROLE_KEY
SERVICE_PAYLOAD=$(printf '{"role":"service_role","iss":"supabase","iat":%d,"exp":%d}' "$NOW" "$EXP")
SERVICE_ROLE_KEY=$(generate_jwt "$SERVICE_PAYLOAD" "$JWT_SECRET")

# ---------------------------------------------------------------
# 결과 출력
# ---------------------------------------------------------------
echo "=========================================="
echo " OTU — Generated Keys"
echo "=========================================="
echo ""
echo "아래 값을 docker/.env 파일에 복사하세요:"
echo ""
echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
echo "JWT_SECRET=${JWT_SECRET}"
echo "ANON_KEY=${ANON_KEY}"
echo "SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}"
echo ""
echo "=========================================="
