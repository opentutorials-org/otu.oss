#!/bin/bash
set -e

echo "=========================================="
echo " OTU — Starting application..."
echo "=========================================="

# ---------------------------------------------------------------------------
# 1. DB 연결 대기
# ---------------------------------------------------------------------------
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${POSTGRES_USER:-supabase_admin}"
DB_NAME="${POSTGRES_DB:-postgres}"

echo "[entrypoint] Waiting for database at ${DB_HOST}:${DB_PORT}..."

MAX_RETRIES=60
RETRY_COUNT=0
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -q 2>/dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
        echo "[entrypoint] ERROR: Database not ready after ${MAX_RETRIES} seconds. Exiting."
        exit 1
    fi
    sleep 1
done

echo "[entrypoint] Database is ready."

# ---------------------------------------------------------------------------
# 2. 멱등 마이그레이션 실행
# ---------------------------------------------------------------------------
MIGRATIONS_DIR="./supabase/migrations"
PGPASSWORD="${POSTGRES_PASSWORD}"
export PGPASSWORD

# schema_migrations 테이블이 없으면 생성 (Supabase CLI 호환)
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -q <<'EOSQL'
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
    version text PRIMARY KEY,
    statements text[],
    name text
);
EOSQL

if [ -d "$MIGRATIONS_DIR" ]; then
    MIGRATION_COUNT=$(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l)
    echo "[entrypoint] Found ${MIGRATION_COUNT} migration files."

    APPLIED=0
    SKIPPED=0

    for f in "$MIGRATIONS_DIR"/*.sql; do
        [ -f "$f" ] || continue
        FILENAME=$(basename "$f")
        # 타임스탬프 추출 (예: 20230807174141_remote_commit.sql → 20230807174141)
        VERSION="${FILENAME%%_*}"

        # 이미 적용된 마이그레이션 건너뛰기
        ALREADY=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
            "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '${VERSION}'" 2>/dev/null || echo "")

        if [ "$ALREADY" = "1" ]; then
            SKIPPED=$((SKIPPED + 1))
            continue
        fi

        echo "[entrypoint] Applying migration: ${FILENAME}"
        if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            -v ON_ERROR_STOP=1 -f "$f" > /dev/null 2>&1; then
            # 성공 시 기록
            psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -q -c \
                "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('${VERSION}', '${FILENAME}') ON CONFLICT DO NOTHING;"
            APPLIED=$((APPLIED + 1))
        else
            echo "[entrypoint] WARNING: Migration ${FILENAME} failed. Continuing..."
        fi
    done

    echo "[entrypoint] Migrations complete: ${APPLIED} applied, ${SKIPPED} skipped."
fi

# ---------------------------------------------------------------------------
# 3. Seed 데이터 (최초 1회)
# ---------------------------------------------------------------------------
SEED_FILE="./supabase/seed.sql"
SEED_MARKER_TABLE="supabase_migrations.seed_applied"

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -q -c \
    "CREATE TABLE IF NOT EXISTS ${SEED_MARKER_TABLE} (applied_at timestamptz DEFAULT now());" 2>/dev/null

SEED_APPLIED=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT 1 FROM ${SEED_MARKER_TABLE} LIMIT 1" 2>/dev/null || echo "")

if [ -f "$SEED_FILE" ] && [ "$SEED_APPLIED" != "1" ]; then
    echo "[entrypoint] Applying seed data..."
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$SEED_FILE" > /dev/null 2>&1; then
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -q -c \
            "INSERT INTO ${SEED_MARKER_TABLE} DEFAULT VALUES;"
        echo "[entrypoint] Seed data applied."
    else
        echo "[entrypoint] WARNING: Seed application had errors."
    fi
else
    echo "[entrypoint] Seed data already applied or not found. Skipping."
fi

unset PGPASSWORD

# ---------------------------------------------------------------------------
# 4. NEXT_PUBLIC_* 런타임 환경변수 치환
#    Pre-built 이미지는 플레이스홀더로 빌드되므로 실제 값으로 교체
# ---------------------------------------------------------------------------
replace_env_placeholder() {
    local placeholder="$1" value="$2"
    if [ -n "$value" ] && [ "$value" != "$placeholder" ]; then
        # .next/standalone 및 .next/static 내 JS 파일에서 치환
        find /app/.next -name '*.js' -exec sed -i "s|${placeholder}|${value}|g" {} + 2>/dev/null || true
        echo "[entrypoint] Replaced ${placeholder} → (set)"
    fi
}

if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    replace_env_placeholder "__NEXT_PUBLIC_SUPABASE_URL__" "$NEXT_PUBLIC_SUPABASE_URL"
fi
if [ -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    replace_env_placeholder "__NEXT_PUBLIC_SUPABASE_ANON_KEY__" "$NEXT_PUBLIC_SUPABASE_ANON_KEY"
fi
if [ -n "$NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY" ]; then
    replace_env_placeholder "__NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY__" "$NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY"
fi

# ---------------------------------------------------------------------------
# 5. Next.js 서버 시작
# ---------------------------------------------------------------------------
echo "[entrypoint] Starting Next.js server..."
exec node server.js
