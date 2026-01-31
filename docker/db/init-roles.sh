#!/bin/bash
# Supabase 역할 비밀번호 설정
# supabase/postgres 이미지가 역할을 생성하지만 비밀번호를 설정하지 않음
# docker-entrypoint-initdb.d에서 실행됨

set -e

# POSTGRES_PASSWORD가 설정되어 있어야 함
if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "WARNING: POSTGRES_PASSWORD not set, skipping role password setup"
    exit 0
fi

echo "[otu-init] Setting passwords for Supabase roles..."

psql -v ON_ERROR_STOP=1 \
    --username "${POSTGRES_USER:-supabase_admin}" \
    --dbname "${POSTGRES_DB:-postgres}" \
    -v password="$POSTGRES_PASSWORD" <<-'EOSQL'
    -- PostgREST 연결용
    ALTER USER authenticator WITH PASSWORD :'password';

    -- GoTrue (Auth) 연결용
    ALTER USER supabase_auth_admin WITH PASSWORD :'password';
    GRANT ALL PRIVILEGES ON SCHEMA auth TO supabase_auth_admin;
    ALTER USER supabase_auth_admin SET search_path = 'auth';

    -- Storage 연결용
    ALTER USER supabase_storage_admin WITH PASSWORD :'password';

    -- supabase_admin 비밀번호 설정
    ALTER USER supabase_admin WITH PASSWORD :'password';

    -- 필요한 추가 권한
    ALTER USER supabase_auth_admin WITH CREATEROLE CREATEDB;
    GRANT ALL ON DATABASE postgres TO supabase_auth_admin;
EOSQL

echo "[otu-init] Role passwords set successfully."
