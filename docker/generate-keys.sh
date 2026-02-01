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
# JWT 생성 (공통 라이브러리)
# ---------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib-jwt.sh"

# ---------------------------------------------------------------
# 키 생성
# ---------------------------------------------------------------

# JWT Secret (32바이트 = 256비트)
JWT_SECRET=$(openssl rand -base64 32 | tr -d '\n')

# PostgreSQL 비밀번호
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '\n/+=')

# Realtime DB 암호화 키
DB_ENC_KEY=$(openssl rand -hex 8)  # AES-128 requires exactly 16 bytes

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
echo "DB_ENC_KEY=${DB_ENC_KEY}"
echo ""
echo "=========================================="
