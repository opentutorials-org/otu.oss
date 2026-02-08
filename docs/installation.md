# 설치 가이드

이 문서는 OTU AI 메모 애플리케이션을 로컬 환경에 설치하고 실행하는 방법을 설명합니다.

## 사전 요구사항

### 필수 소프트웨어

| 소프트웨어 | 버전         | 설치 링크                                         |
| ---------- | ------------ | ------------------------------------------------- |
| Node.js    | v20.5.0 이상 | [nodejs.org](https://nodejs.org/)                 |
| npm        | 10.8.1 이상  | Node.js와 함께 설치됨                             |
| Docker     | 최신 버전    | [docker.com](https://www.docker.com/get-started/) |
| Git        | 최신 버전    | [git-scm.com](https://git-scm.com/)               |

### 선택 소프트웨어

| 소프트웨어   | 용도                   |
| ------------ | ---------------------- |
| Supabase CLI | 로컬 데이터베이스 관리 |

## 설치 단계

### 1단계: 저장소 클론

```bash
git clone https://github.com/opentutorials-org/otu.oss.git
cd otu.oss
```

### 2단계: 의존성 설치

```bash
npm install
```

> **참고**: `postinstall` 스크립트가 자동으로 `patch-package`를 실행하여 필요한 패치를 적용합니다.

### 3단계: 환경 변수 설정

`.env.template` 파일을 복사하여 `.env.local` 파일을 생성합니다:

```bash
cp .env.template .env.local
```

`.env.local` 파일을 열어 필수 환경 변수를 설정합니다:

#### 필수 환경 변수

```bash
# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# 호스트 설정
NEXT_PUBLIC_HOST=http://localhost:3000
NEXT_PUBLIC_SOCIAL_LOGIN_REDIRECT_TO=http://localhost:3000
```

#### 선택 환경 변수

```bash
# AI 기능 (기본값: false)
# true로 설정하면 AI 채팅, 제목 자동 생성, 이미지 분석, 임베딩/RAG 기능이 활성화됩니다.
ENABLE_AI=false
OPENAI_API_KEY=sk-your-openai-api-key       # ENABLE_AI=true일 때 필요 (개발 환경)
# 프로덕션에서는 Vercel AI Gateway를 통해 AI 기능이 제공됩니다.

# Sentry 에러 모니터링 (선택 - 별도 설정 필요)
# 현재 코드베이스에서 Sentry SDK가 제거되었습니다.
# Sentry를 사용하려면 SDK를 별도로 설치하고 설정해야 합니다.
# NEXT_PUBLIC_ENABLE_SENTRY=false
# NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn

# 소셜 로그인 (기본값: false)
# OAuth 앱 설정이 완료된 경우에만 true로 설정하세요.
NEXT_PUBLIC_ENABLE_SOCIAL_LOGIN=false       # true: Google/GitHub/Apple 로그인 표시

# CRAG (Corrective RAG) 설정 (선택 - ENABLE_AI=true일 때 RAG 품질 개선)
# NEXT_PUBLIC_CRAG_ENABLED=true       # 클라이언트 CRAG 파이프라인 활성화 (기본값: false)
# CRAG_ENABLED=true                   # 서버 CRAG 파이프라인 활성화 (기본값: false)

# Langfuse 설정 (선택 - AI 트레이싱/메트릭 수집)
# LANGFUSE_ENABLED=true               # 키 미설정 시 자동 비활성화
# LANGFUSE_PUBLIC_KEY=pk-lf-your-public-key
# LANGFUSE_SECRET_KEY=sk-lf-your-secret-key
# LANGFUSE_HOST=https://cloud.langfuse.com

# 디버그 로깅 (기본값: 비활성화)
# 개발 중 특정 모듈의 로그를 보려면 활성화하세요.
# 예: DEBUG=sync (동기화), DEBUG=sync,chat (동기화+채팅), DEBUG=* (전체)
# DEBUG=

# 파일 업로드 (Uploadcare)
# 이미지 업로드 기능을 사용하려면 Uploadcare 계정이 필요합니다.
# https://uploadcare.com/ 에서 무료 계정을 생성할 수 있습니다.
NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY=your_uploadcare_public_key  # 클라이언트 업로드용
UPLOADCARE_PRIVATE_KEY=your_uploadcare_private_key            # 파일 관리용 (삭제 등)
```

### 4단계: Supabase 로컬 환경 설정

Docker가 실행 중인지 확인한 후 Supabase 로컬 인스턴스를 시작합니다.

> **참고**: Supabase CLI는 프로젝트의 `devDependencies`에 포함되어 있으므로, `npx`를 통해 바로 사용할 수 있습니다.

```bash
npx supabase start
```

> **중요**: Supabase 시작 후 출력되는 `anon key`와 `service_role key`를 `.env.local` 파일에 입력하세요.

마이그레이션을 적용하고 데이터베이스 타입을 생성합니다:

```bash
npm run db-sync
```

> **참고**: 이 명령어는 로컬 DB를 초기화하고, TypeScript 타입 정의 파일을 생성합니다.

### 5단계: 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 애플리케이션에 접속합니다.

## 추가 설정

### GitHub OAuth 설정 (선택)

GitHub 소셜 로그인을 사용하려면:

1. [GitHub OAuth 앱](https://github.com/settings/developers)에서 새 앱을 생성합니다.
2. **Authorization callback URL**을 `http://localhost:54321/auth/v1/callback`으로 설정합니다.
3. `.env.local`에 발급받은 Client ID와 Secret을 입력합니다:

```bash
SUPABASE_AUTH_GITHUB_CLIENT_ID=your_github_client_id
SUPABASE_AUTH_GITHUB_SECRET=your_github_secret
SUPABASE_AUTH_GITHUB_CALLBACK_URL_FOR_DEV=http://localhost:54321/auth/v1/callback
```

### 모바일 디바이스에서 테스트

로컬 네트워크의 모바일 기기에서 테스트하려면:

```bash
npm run dev:ip
```

프롬프트에 개발 머신의 IP 주소를 입력합니다.

> **참고**: Supabase Auth URL 설정에서 해당 IP를 화이트리스트에 추가해야 합니다.

### AI 기능 활성화

AI 기능을 사용하려면:

1. [OpenAI API](https://platform.openai.com/)에서 API 키를 발급받습니다.
2. `.env.local`을 업데이트합니다:

```bash
ENABLE_AI=true
OPENAI_API_KEY=sk-your-openai-api-key  # 개발 환경에서 필요
```

> **참고**: 프로덕션 환경에서는 Vercel AI Gateway를 통해 AI 기능(채팅, 제목 생성, 임베딩/RAG 등)이 제공됩니다.

## 문제 해결

### Supabase 시작 오류

Docker가 실행 중인지 확인하세요:

```bash
docker ps
```

기존 컨테이너를 정리하고 다시 시작합니다:

```bash
npx supabase stop
npx supabase start
```

### 포트 충돌

기본 포트(3000, 54321, 54322)가 이미 사용 중이라면 해당 프로세스를 종료하거나 다른 포트를 사용하세요.

### 의존성 설치 오류

Node.js 버전을 확인하세요:

```bash
node -v  # v20.5.0 이상이어야 함
```

`node_modules`를 삭제하고 다시 설치합니다:

```bash
rm -rf node_modules package-lock.json
npm install
```

## 다음 단계

- [기능 가이드](/docs/functionality.md) - 주요 기능 살펴보기
- [기여 가이드](/docs/CONTRIBUTING.md) - 프로젝트에 기여하기
- [CLAUDE.md](/CLAUDE.md) - AI 코딩 규칙 및 아키텍처 요약
