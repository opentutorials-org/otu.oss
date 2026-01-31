# 배포 가이드

이 문서는 OTU 애플리케이션을 Vercel과 Supabase를 사용하여 프로덕션 환경에 배포하는 방법을 설명합니다.

## 목차

1. [사전 준비](#사전-준비)
2. [Supabase 설정](#supabase-설정)
3. [Vercel 배포](#vercel-배포)
4. [환경 변수 설정](#환경-변수-설정)
5. [배포 후 확인사항](#배포-후-확인사항)

---

## 사전 준비

### 필요한 계정

| 서비스     | 용도                           | 가격                           |
| ---------- | ------------------------------ | ------------------------------ |
| Vercel     | 웹 애플리케이션 호스팅         | 무료 (Hobby) / $20/월 (Pro)    |
| Supabase   | PostgreSQL 데이터베이스 + 인증 | 무료 (Free) / $25/월 (Pro)     |
| OpenAI     | AI 기능 (선택)                 | 사용량 기반                    |
| Uploadcare | 이미지 업로드 (선택)           | 무료 (Free) / $75/월 (Premium) |

### 로컬 환경 확인

배포 전 로컬에서 빌드가 성공하는지 확인하세요:

```bash
npm run build
```

---

## Supabase 설정

### 1단계: Supabase 프로젝트 생성

1. [Supabase Dashboard](https://supabase.com/dashboard)에 접속합니다.
2. **New Project** 버튼을 클릭합니다.
3. 프로젝트 정보를 입력합니다:
    - **Name**: 프로젝트 이름 (예: `otu-production`)
    - **Database Password**: 강력한 비밀번호 생성 (저장해 두세요)
    - **Region**: 사용자에게 가장 가까운 지역 선택 (한국: `Northeast Asia (Seoul)`)
4. **Create new project** 버튼을 클릭하고 프로젝트가 생성될 때까지 기다립니다 (약 2분 소요).

[스크린샷 필요: Supabase 프로젝트 생성 화면]

### 2단계: 데이터베이스 스키마 설정

#### Supabase CLI를 사용한 마이그레이션 적용

로컬에서 Supabase CLI를 사용하여 마이그레이션을 원격 데이터베이스에 적용합니다.

```bash
# 원격 프로젝트 연결
npx supabase link

# 프로젝트 참조 ID 입력 (Project Settings > General에서 확인)
# 예: abcdefghijklmnop

# 마이그레이션 적용
npx supabase db push
```

> **경고**: `npx supabase db push`는 마이그레이션 파일을 원격 데이터베이스에 적용합니다. 실행 전 마이그레이션 파일을 반드시 검토하세요.

#### 필요한 PostgreSQL 확장

마이그레이션을 통해 다음 확장이 자동으로 활성화됩니다:

- `vector` - 벡터 임베딩 저장 및 검색
- `pgroonga` - 전문 검색 (한국어 지원)
- `uuid-ossp` - UUID 생성
- `moddatetime` - 자동 타임스탬프 업데이트

### 3단계: 인증 설정

#### 이메일 인증 설정

1. Supabase Dashboard에서 **Authentication** > **Providers**로 이동합니다.
2. **Email** 제공자가 기본으로 활성화되어 있습니다.
3. **Confirm email** 옵션을 설정합니다:
    - 프로덕션: **활성화** (이메일 확인 필수)
    - 개발: **비활성화** (빠른 테스트용)

[스크린샷 필요: Supabase 이메일 인증 설정 화면]

#### GitHub OAuth 설정 (선택)

1. [GitHub Developer Settings](https://github.com/settings/developers)에서 새 OAuth 앱을 생성합니다.
2. 다음 정보를 입력합니다:
    - **Application name**: `OTU` (또는 원하는 이름)
    - **Homepage URL**: `https://your-domain.com`
    - **Authorization callback URL**: `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`
3. 생성 후 **Client ID**와 **Client Secret**을 저장합니다.
4. Supabase Dashboard에서 **Authentication** > **Providers** > **GitHub**로 이동합니다.
5. **Enable GitHub provider**를 활성화하고 Client ID와 Secret을 입력합니다.

[스크린샷 필요: GitHub OAuth 앱 생성 화면]

#### Google OAuth 설정 (선택)

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials)에서 새 OAuth 2.0 클라이언트를 생성합니다.
2. **승인된 리디렉션 URI**에 다음을 추가합니다:
    - `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`
3. Supabase Dashboard에서 **Authentication** > **Providers** > **Google**로 이동하여 설정합니다.

#### Apple OAuth 설정 (선택)

1. [Apple Developer](https://developer.apple.com/)에서 Services ID를 생성합니다.
2. Supabase Dashboard에서 **Authentication** > **Providers** > **Apple**로 이동하여 설정합니다.

### 4단계: URL 설정

1. Supabase Dashboard에서 **Authentication** > **URL Configuration**으로 이동합니다.
2. 다음을 설정합니다:
    - **Site URL**: `https://your-domain.com` (배포된 앱의 URL)
    - **Redirect URLs**:
        - `https://your-domain.com`
        - `https://your-domain.com/**` (모든 경로 허용)

[스크린샷 필요: Supabase URL 설정 화면]

### 5단계: Row Level Security (RLS) 정책

마이그레이션을 통해 RLS 정책이 자동으로 설정됩니다. 주요 테이블의 보안 정책:

| 테이블      | 정책                    |
| ----------- | ----------------------- |
| `page`      | 소유자만 CRUD 가능      |
| `folder`    | 소유자만 CRUD 가능      |
| `documents` | 소유자만 읽기/쓰기 가능 |
| `alarm`     | 소유자만 CRUD 가능      |
| `user_info` | 소유자만 읽기/수정 가능 |

> **참고**: RLS가 활성화되어 있어도 `service_role` 키를 사용하면 모든 데이터에 접근할 수 있습니다. 서버 측 API에서만 `service_role` 키를 사용하세요.

### 6단계: API 키 확인

Supabase Dashboard에서 **Project Settings** > **API**로 이동하여 다음 키를 확인합니다:

- **Project URL**: `https://<your-project-ref>.supabase.co`
- **anon/public key**: 클라이언트에서 사용 (공개 가능)
- **service_role key**: 서버에서만 사용 (**절대 노출 금지**)

[스크린샷 필요: Supabase API 키 확인 화면]

---

## Vercel 배포

### 1단계: Vercel 계정 생성 및 프로젝트 연결

#### 방법 A: GitHub 저장소에서 배포 (권장)

1. [Vercel](https://vercel.com)에 로그인합니다.
2. **Add New** > **Project**를 클릭합니다.
3. GitHub 저장소 목록에서 `otu.oss` (또는 포크한 저장소)를 선택합니다.
4. **Import**를 클릭합니다.

[스크린샷 필요: Vercel 프로젝트 임포트 화면]

#### 방법 B: Vercel CLI 사용

```bash
# Vercel CLI 설치 (전역)
npm install -g vercel

# 로그인
vercel login

# 프로젝트 연결 및 배포
vercel
```

### 2단계: 빌드 설정

Vercel이 자동으로 Next.js 프로젝트를 감지하지만, 다음 설정을 확인하세요:

| 설정             | 값              |
| ---------------- | --------------- |
| Framework Preset | Next.js         |
| Build Command    | `npm run build` |
| Output Directory | `.next`         |
| Install Command  | `npm install`   |
| Node.js Version  | 20.x            |

### 3단계: 환경 변수 설정

Vercel Dashboard에서 **Settings** > **Environment Variables**로 이동하여 다음 환경 변수를 설정합니다:

#### 필수 환경 변수

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# 호스트 설정
NEXT_PUBLIC_HOST=https://your-domain.com
NEXT_PUBLIC_SOCIAL_LOGIN_REDIRECT_TO=https://your-domain.com
```

#### AI 기능 환경 변수 (선택)

```bash
# AI 기능 활성화
ENABLE_AI=true

# OpenAI API (개발 환경에서 필요)
OPENAI_API_KEY=sk-<your-openai-key>
# 프로덕션에서는 Vercel AI Gateway를 통해 AI 및 임베딩 기능이 제공됩니다.
```

#### Sentry 환경 변수 (선택 - 별도 설정 필요)

> **참고**: 현재 코드베이스에서 Sentry SDK가 제거되었습니다. Sentry를 사용하려면 SDK를 별도로 설치하고 설정해야 합니다.

```bash
# Sentry 에러 모니터링 (SDK 설치 후 사용 가능)
# NEXT_PUBLIC_ENABLE_SENTRY=true
# NEXT_PUBLIC_SENTRY_DSN=<your-sentry-dsn>
# SENTRY_AUTH_TOKEN=<your-sentry-auth-token>
# NEXT_PUBLIC_SENTRY_PROJECT=<your-sentry-project-name>
```

#### 이미지 업로드 환경 변수 (선택)

```bash
# Uploadcare
NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY=<your-public-key>
UPLOADCARE_PRIVATE_KEY=<your-private-key>
```

[스크린샷 필요: Vercel 환경 변수 설정 화면]

### 4단계: 배포 실행

1. 환경 변수 설정 후 **Deploy**를 클릭합니다.
2. 빌드 로그를 확인하며 배포가 완료될 때까지 기다립니다 (약 3-5분 소요).
3. 배포가 완료되면 제공된 URL (예: `https://your-project.vercel.app`)에서 앱을 확인합니다.

### 5단계: 커스텀 도메인 설정 (선택)

1. Vercel Dashboard에서 **Settings** > **Domains**로 이동합니다.
2. **Add**를 클릭하고 도메인을 입력합니다 (예: `otu.ai`).
3. DNS 설정을 안내에 따라 구성합니다:
    - **A 레코드**: `76.76.21.21`
    - **CNAME 레코드**: `cname.vercel-dns.com`
4. SSL 인증서가 자동으로 발급됩니다.

[스크린샷 필요: Vercel 도메인 설정 화면]

---

## 환경 변수 설정

### 전체 환경 변수 목록

| 변수명                                 | 필수              | 설명                                             |
| -------------------------------------- | ----------------- | ------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | O                 | Supabase 프로젝트 URL                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`        | O                 | Supabase 공개 키                                 |
| `SUPABASE_SERVICE_ROLE_KEY`            | O                 | Supabase 서비스 역할 키 (서버 전용)              |
| `NEXT_PUBLIC_HOST`                     | O                 | 배포된 앱의 URL                                  |
| `NEXT_PUBLIC_SOCIAL_LOGIN_REDIRECT_TO` | O                 | 소셜 로그인 후 리디렉션 URL                      |
| `ENABLE_AI`                            | -                 | AI 기능 활성화 (`true`/`false`, 기본값: `false`) |
| `OPENAI_API_KEY`                       | AI 사용 시 (개발) | OpenAI API 키 (프로덕션은 Gateway 사용)          |
| `NEXT_PUBLIC_ENABLE_SENTRY`            | -                 | Sentry 활성화 (SDK 별도 설치 필요)               |
| `NEXT_PUBLIC_SENTRY_DSN`               | -                 | Sentry DSN (SDK 별도 설치 필요)                  |
| `SENTRY_AUTH_TOKEN`                    | -                 | Sentry 인증 토큰 (SDK 별도 설치 필요)            |
| `NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY`    | 이미지 업로드 시  | Uploadcare 공개 키                               |
| `UPLOADCARE_PRIVATE_KEY`               | 이미지 삭제 시    | Uploadcare 비공개 키                             |
| `NEXT_PUBLIC_PWA_DISABLED`             | -                 | PWA 비활성화 (`true`/`false`, 기본값: `true`)    |

### 환경별 설정 권장 사항

| 환경       | ENABLE_AI | EMAIL_LOGIN | PWA               |
| ---------- | --------- | ----------- | ----------------- |
| 로컬 개발  | `false`   | `true`      | `true` (비활성화) |
| Preview    | `true`    | `false`     | `true` (비활성화) |
| Production | `true`    | `false`     | `false` (활성화)  |

---

## 배포 후 확인사항

### 기능 체크리스트

배포 후 다음 기능들이 정상 작동하는지 확인하세요:

- [ ] 회원가입 및 로그인 (이메일/소셜)
- [ ] 페이지 생성, 수정, 삭제
- [ ] 폴더 생성 및 페이지 이동
- [ ] 데이터 동기화 (여러 기기에서 확인)
- [ ] 이미지 업로드 (Uploadcare 설정 시)
- [ ] AI 채팅 (ENABLE_AI=true 설정 시)
- [ ] 리마인더 알람
- [ ] PWA 설치 (모바일)

### 모니터링 설정

#### Vercel Analytics

Vercel Dashboard의 **Analytics** 탭에서 다음을 확인할 수 있습니다:

- 페이지 뷰 및 방문자 수
- Web Vitals (LCP, FID, CLS)
- 함수 실행 시간

### 문제 해결

#### 빌드 실패

1. 로컬에서 `npm run build`가 성공하는지 확인합니다.
2. Node.js 버전이 20.x인지 확인합니다.
3. 환경 변수가 모두 설정되었는지 확인합니다.

#### 인증 오류

1. Supabase URL Configuration의 Site URL과 Redirect URLs를 확인합니다.
2. OAuth 제공자의 Callback URL이 올바른지 확인합니다.
3. `NEXT_PUBLIC_SOCIAL_LOGIN_REDIRECT_TO` 값을 확인합니다.

#### 데이터베이스 연결 오류

1. Supabase 프로젝트가 활성 상태인지 확인합니다.
2. API 키가 올바른지 확인합니다.
3. RLS 정책이 올바르게 설정되었는지 확인합니다.

---

## 참고 자료

- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [프로젝트 설치 가이드](./installation.md)
- [기능 명세](./meta-guides/functionality.md)
