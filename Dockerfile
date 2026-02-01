# =============================================================================
# OTU Docker 빌드 — 3단계 멀티스테이지
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: deps — 의존성 설치
# ---------------------------------------------------------------------------
FROM node:20-alpine3.21 AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
# patches 디렉토리가 있으면 복사 (postinstall에서 patch-package 실행)
COPY patches* ./patches/
RUN npm ci

# ---------------------------------------------------------------------------
# Stage 2: builder — Next.js 빌드
# ---------------------------------------------------------------------------
FROM node:20-alpine3.21 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 셀프호스팅: Vercel 전용 모듈(@vercel/flags, @vercel/functions)을 no-op stub으로 교체
# 소스 코드의 static import는 upstream과 동일하게 유지하면서,
# Docker 빌드 시에만 JS 구현을 빈 함수로 대체합니다.
# 타입 선언(.d.ts)은 npm ci로 설치된 원본을 유지하여 TypeScript 빌드를 보장합니다.
RUN cp docker/stubs/@vercel/flags/dist/index.js node_modules/@vercel/flags/dist/index.js && \
    cp docker/stubs/@vercel/flags/dist/index.cjs node_modules/@vercel/flags/dist/index.cjs && \
    cp docker/stubs/@vercel/functions/index.js node_modules/@vercel/functions/index.js

# 빌드 시점 환경변수 (NEXT_PUBLIC_* 은 빌드 시 인라인됨)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY
ARG NEXT_PUBLIC_HOST

ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY=${NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY}
ENV NEXT_PUBLIC_HOST=${NEXT_PUBLIC_HOST}

# Telemetry 비활성화
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3: runner — 프로덕션 실행
# ---------------------------------------------------------------------------
FROM node:20-alpine3.21 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# PostgreSQL 클라이언트 (마이그레이션용)
RUN apk add --no-cache postgresql-client bash

# standalone 출력 복사
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 마이그레이션 파일 복사
COPY --chown=nextjs:nodejs supabase/migrations ./supabase/migrations
COPY --chown=nextjs:nodejs supabase/seed.sql ./supabase/seed.sql

# 엔트리포인트 복사
COPY --chown=nextjs:nodejs docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/check/version || exit 1

ENTRYPOINT ["./entrypoint.sh"]
