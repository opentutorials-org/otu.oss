# OTU 셀프호스팅 가이드

Docker Compose를 사용하여 OTU 전체 스택(Next.js + Supabase)을 셀프호스팅하는 방법을 안내합니다.

## 사전 요구사항

- **Docker**: 24.0 이상 + Docker Compose v2
- **시스템**: 2GB+ RAM (권장 4GB+), 10GB+ 디스크
- **openssl**: 키 생성용 (대부분의 Linux/macOS에 기본 설치)
- **도메인**: 커스텀 도메인 사용 시 2개 DNS 레코드 필요

## 아키텍처

```
┌─────────────┐     ┌──────────────┐
│   Client     │────▶│    Caddy     │ :80/:443
│  (Browser)   │     │ (HTTPS 자동)  │
└─────────────┘     └───┬──────┬───┘
                        │      │
                 DOMAIN │      │ API_DOMAIN
                        ▼      ▼
                 ┌────────┐  ┌──────────┐
                 │OTU App │  │   Kong   │
                 │Next.js │  │(API GW)  │
                 └────┬───┘  └──┬───┬───┘
                      │         │   │
                      │    ┌────┘   └─────┬──────────┐
                      │    ▼              ▼          ▼
                      │ ┌──────────┐ ┌──────────┐ ┌──────────┐
                      │ │  GoTrue  │ │PostgREST │ │ Realtime │
                      │ │  (Auth)  │ │  (REST)  │ │(WebSocket)│
                      │ └────┬─────┘ └────┬─────┘ └────┬─────┘
                      │      │             │             │
                      │      └──────┬──────┘             │
                      │             │    ┌───────────────┘
                      └─────────────┼────┘
                                    ▼
                      ┌──────────────────────────┐
                      │       PostgreSQL          │
                      │    + pgvector + pgroonga   │
                      └─────────────┬──────────────┘
                                    │
                              ┌─────┘
                              ▼
                      ┌──────────────┐
                      │   Storage    │
                      │ (파일 저장소) │
                      └──────────────┘
```

---

## CLI 명령어 (`otu.sh`)

모든 작업은 `otu.sh` CLI를 통해 수행합니다:

| 명령어                      | 설명                                       |
| --------------------------- | ------------------------------------------ |
| `bash otu.sh install`       | 대화형 설치 (키 생성 → 설정 → 빌드 → 실행) |
| `bash otu.sh start`         | 서비스 시작                                |
| `bash otu.sh stop`          | 서비스 중지                                |
| `bash otu.sh restart`       | 서비스 재시작                              |
| `bash otu.sh status`        | 서비스 상태 확인                           |
| `bash otu.sh upgrade`       | 최신 버전으로 업그레이드                   |
| `bash otu.sh backup`        | 데이터베이스 백업                          |
| `bash otu.sh logs [서비스]` | 로그 확인                                  |

---

## 빠른 시작 (로컬 테스트)

```bash
git clone https://github.com/opentutorials-org/otu.oss.git
cd otu.oss
bash otu.sh install
```

`install` 명령어가 대화형으로 안내합니다:

1. 사전 요구사항 자동 확인 (Docker, openssl)
2. 배포 유형 선택 → "로컬 테스트" 선택
3. 보안 키 자동 생성
4. AI 기능 설정 (선택)
5. Docker 이미지 빌드 및 서비스 시작

완료 후 접속: **http://localhost**

---

## 도메인 배포 (프로덕션)

커스텀 도메인으로 HTTPS 배포하는 방법입니다. Caddy가 Let's Encrypt 인증서를 자동 발급합니다.

### 1. DNS 설정

두 도메인 모두 서버 IP로 A 레코드를 설정합니다:

```
A   otu.hyoda.kr       → [서버 IP]
A   api.otu.hyoda.kr   → [서버 IP]
```

### 2. 서버 준비 (예: AWS Lightsail)

```bash
# Ubuntu 22.04 LTS, 4GB RAM 이상 권장
sudo apt update && sudo apt upgrade -y

# Docker 설치
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 재로그인 후 확인
docker compose version
```

**방화벽 설정** (Lightsail 네트워킹):

| 포트 | 프로토콜 | 용도                    |
| ---- | -------- | ----------------------- |
| 22   | TCP      | SSH                     |
| 80   | TCP      | HTTP → HTTPS 리다이렉트 |
| 443  | TCP+UDP  | HTTPS + HTTP/3          |

> 54321, 54322, 3000 포트는 **열지 않습니다**. 모든 트래픽은 Caddy를 통합니다.

### 3. 설치

```bash
git clone https://github.com/opentutorials-org/otu.oss.git
cd otu.oss
bash otu.sh install
```

"도메인 배포"를 선택하고 도메인을 입력합니다:

```
배포 유형을 선택하세요:
  1) 로컬 테스트 (localhost, HTTP)
  2) 도메인 배포 (커스텀 도메인, 자동 HTTPS)

선택 [1]: 2
앱 도메인 (예: otu.hyoda.kr): otu.hyoda.kr
API 도메인 [api.otu.hyoda.kr]: (엔터)
```

- 보안 키가 자동 생성됩니다
- Docker 이미지를 빌드하고 서비스를 시작합니다
- Caddy가 Let's Encrypt 인증서를 자동 발급합니다

### 4. 확인

```bash
bash otu.sh status
```

접속: `https://otu.hyoda.kr`

---

## 원클릭 설치 (사전 빌드 이미지)

소스 빌드 없이 GHCR 사전 빌드 이미지를 사용하여 설치합니다. 서버에 소스 코드가 필요 없으며, 필요한 설정 파일만 자동으로 다운로드됩니다.

```bash
curl -fsSL https://raw.githubusercontent.com/opentutorials-org/otu.oss/main/install-remote.sh | bash
```

이 스크립트가 수행하는 작업:

1. Docker + Docker Compose 설치 (없는 경우)
2. 필요한 설정 파일 다운로드 (`docker-compose.prod.yml`, `otu.sh`, Caddy/Kong 설정 등)
3. `otu.sh install` 실행 — 대화형으로 도메인, 보안 키, AI 설정 안내
4. 서비스 시작

설치 디렉토리는 기본값 `$HOME/otu`이며, `OTU_INSTALL_DIR` 환경변수로 변경 가능합니다.

---

## 수동 설정 (docker compose 직접 사용)

CLI 대신 직접 설정하려면:

```bash
# 키 생성
bash docker/generate-keys.sh

# 환경변수 설정
cp docker/.env.example docker/.env
# docker/.env 편집하여 키 + 도메인 입력

# 실행
docker compose --env-file docker/.env up -d --build
```

---

## 환경변수 레퍼런스

### 필수

| 변수                | 설명                                        |
| ------------------- | ------------------------------------------- |
| `POSTGRES_PASSWORD` | PostgreSQL 비밀번호                         |
| `JWT_SECRET`        | JWT 서명 시크릿 (32자 이상)                 |
| `ANON_KEY`          | Supabase Anonymous Key                      |
| `SERVICE_ROLE_KEY`  | Supabase Service Role Key                   |
| `DOMAIN`            | 앱 도메인 (기본: `localhost`)               |
| `API_DOMAIN`        | API 도메인 (기본: `api.localhost`)          |
| `SITE_URL`          | 앱 전체 URL (기본: `http://localhost`)      |
| `API_EXTERNAL_URL`  | API 전체 URL (기본: `http://api.localhost`) |

### AI 기능

| 변수              | 설명                                       | 기본값   |
| ----------------- | ------------------------------------------ | -------- |
| `ENABLE_AI`       | AI 기능 활성화                             | `false`  |
| `AI_PROVIDER`     | AI 제공자 (`openai` \| `gateway`)          | `openai` |
| `OPENAI_API_KEY`  | OpenAI API 키 (AI_PROVIDER=openai 시 필수) | —        |
| `TEXT_MODEL_NAME` | 텍스트 생성 모델                           | `gpt-4o` |

### 소셜 로그인

| 변수                                        | 설명                                      |
| ------------------------------------------- | ----------------------------------------- |
| `NEXT_PUBLIC_ENABLE_SOCIAL_LOGIN`           | 소셜 로그인 버튼 UI 표시 (`true`/`false`) |
| `ENABLE_GITHUB_AUTH`                        | GitHub 로그인 활성화                      |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth 앱 정보                      |
| `ENABLE_GOOGLE_AUTH`                        | Google 로그인 활성화                      |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth 정보                         |
| `ENABLE_APPLE_AUTH`                         | Apple 로그인 활성화                       |
| `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET`   | Apple OAuth 정보                          |

OAuth Callback URL: `https://<API_DOMAIN>/auth/v1/callback`

### 고급 설정

| 변수                       | 설명                                | 기본값  |
| -------------------------- | ----------------------------------- | ------- |
| `DB_EXTERNAL_PORT`         | 외부에서 PostgreSQL에 접근할 포트   | `54322` |
| `DISABLE_SIGNUP`           | 회원가입 비활성화                   | `false` |
| `ADDITIONAL_REDIRECT_URLS` | 추가 OAuth 리디렉션 URL (쉼표 구분) | —       |

### 이메일 (SMTP)

| 변수                      | 설명                  | 기본값 |
| ------------------------- | --------------------- | ------ |
| `MAILER_AUTOCONFIRM`      | 이메일 인증 자동 승인 | `true` |
| `SMTP_HOST`               | SMTP 서버 주소        | —      |
| `SMTP_PORT`               | SMTP 포트             | `587`  |
| `SMTP_USER` / `SMTP_PASS` | SMTP 인증 정보        | —      |

---

## 운영

### 업그레이드

```bash
bash otu.sh upgrade
```

내부적으로 `git pull` + `docker compose up -d --build`를 수행합니다.
마이그레이션은 앱 시작 시 자동 적용됩니다 (멱등성 보장).

### 백업

```bash
# 수동 백업
bash otu.sh backup
# → backups/otu-backup-2026-01-31-153000.sql.gz 생성

# 자동 백업 (cron)
crontab -e
0 3 * * * cd ~/otu.oss && bash otu.sh backup
```

### 복원

```bash
gunzip -c backups/otu-backup-2026-01-31-153000.sql.gz | \
  docker compose --env-file docker/.env exec -T db psql -U supabase_admin postgres
```

---

## 트러블슈팅

### 서비스 상태 확인

```bash
bash otu.sh status
bash otu.sh logs caddy    # Caddy 로그
bash otu.sh logs app      # Next.js 앱 로그
bash otu.sh logs auth     # 인증 서비스 로그
```

### HTTPS 인증서가 발급되지 않는 경우

1. DNS가 서버 IP를 가리키는지 확인: `dig otu.hyoda.kr +short`
2. 80/443 포트가 방화벽에서 열려 있는지 확인
3. Caddy 로그 확인: `bash otu.sh logs caddy`

### 마이그레이션 오류

```bash
docker compose --env-file docker/.env exec db psql -U supabase_admin -d postgres \
  -c "SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;"
```

### 전체 초기화 (데이터 삭제)

```bash
bash otu.sh stop
docker compose --env-file docker/.env down -v
bash otu.sh install
```

---

## 서버 권장 스펙

| 항목   | 최소             | 권장             |
| ------ | ---------------- | ---------------- |
| RAM    | 2GB (swap 필수)  | 4GB              |
| CPU    | 1 vCPU           | 2 vCPU           |
| 디스크 | 10GB             | 20GB+            |
| OS     | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

AWS Lightsail 기준: $24/월 플랜 (4GB RAM, 2 vCPU, 80GB SSD) 권장
