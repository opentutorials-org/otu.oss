#!/bin/bash
# Kong 환경변수 치환 엔트리포인트
# kong.yml.template의 ${ANON_KEY}, ${SERVICE_ROLE_KEY}를 실제 값으로 교체

set -e

TEMPLATE="/var/lib/kong/kong.yml.template"
OUTPUT="/tmp/kong.yml"

if [ -f "$TEMPLATE" ]; then
    sed \
        -e "s|\${ANON_KEY}|${ANON_KEY}|g" \
        -e "s|\${SERVICE_ROLE_KEY}|${SERVICE_ROLE_KEY}|g" \
        "$TEMPLATE" > "$OUTPUT"
    export KONG_DECLARATIVE_CONFIG="$OUTPUT"
fi

exec /docker-entrypoint.sh kong docker-start
