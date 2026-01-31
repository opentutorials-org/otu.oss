#!/bin/bash
# =============================================================================
# OTU — JWT 생성 공통 라이브러리 (순수 bash + openssl)
#
# 사용법: source docker/lib-jwt.sh
# =============================================================================

base64url_encode() {
    if [ -n "$1" ]; then
        printf '%s' "$1" | openssl base64 -A | tr '+/' '-_' | tr -d '='
    else
        openssl base64 -A | tr '+/' '-_' | tr -d '='
    fi
}

hmac_sha256_sign() {
    printf '%s' "$1" | openssl dgst -sha256 -hmac "$2" -binary | base64url_encode
}

generate_jwt() {
    local payload_json="$1" secret="$2"
    local header payload signature
    header=$(base64url_encode '{"alg":"HS256","typ":"JWT"}')
    payload=$(base64url_encode "$payload_json")
    signature=$(hmac_sha256_sign "${header}.${payload}" "$secret")
    echo "${header}.${payload}.${signature}"
}
