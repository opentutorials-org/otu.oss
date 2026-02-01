#!/bin/bash
# Kong 환경변수 치환 엔트리포인트
# kong.yml.template의 ${ANON_KEY}, ${SERVICE_ROLE_KEY}를 실제 값으로 교체

set -e

TEMPLATE="/var/lib/kong/kong.yml.template"
OUTPUT="/tmp/kong.yml"

# 템플릿 파일 존재 검증
if [ ! -f "$TEMPLATE" ]; then
    echo "[kong-entrypoint] ERROR: Template file not found: ${TEMPLATE}"
    exit 1
fi

# 인증 키 빈값 검증
if [ -z "$ANON_KEY" ]; then
    echo "[kong-entrypoint] ERROR: ANON_KEY is not set or empty"
    exit 1
fi

if [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "[kong-entrypoint] ERROR: SERVICE_ROLE_KEY is not set or empty"
    exit 1
fi

sed \
    -e "s|\${ANON_KEY}|${ANON_KEY}|g" \
    -e "s|\${SERVICE_ROLE_KEY}|${SERVICE_ROLE_KEY}|g" \
    "$TEMPLATE" > "$OUTPUT"
export KONG_DECLARATIVE_CONFIG="$OUTPUT"

exec /docker-entrypoint.sh kong docker-start
