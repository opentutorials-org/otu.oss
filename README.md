# 📝 OTU

> AI 기반 스마트 메모 애플리케이션 - 생각을 기록하고, AI가 기억을 돕습니다

[English](README.en.md)

[![Version](https://img.shields.io/badge/version-0.5.201-blue.svg)](https://github.com/opentutorials-org/otu.oss)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)

**OTU**는 웹과 모바일을 지원하는 차세대 AI 메모 애플리케이션입니다. BlockNote 에디터와 OpenAI GPT-4o를 활용하여 자동 저장, AI 기반 제목 생성, 스마트 검색, 리마인더 시스템을 제공합니다.

## ✨ 주요 기능

- 🤖 **AI 통합 에디터**: BlockNote XL-AI 확장으로 텍스트 개선, 요약, 번역 등
- 💾 **자동 저장**: 3초 debounce로 연속 편집 중에도 안전하게 저장
- 🔍 **스마트 검색**: RAG 기반 문서 검색 및 AI 채팅
- 📁 **폴더 시스템**: 메모를 체계적으로 관리
- 🔔 **스마트 리마인더**: 지수적 알람 주기로 중요한 메모 복습
- 🌓 **3가지 테마**: 회색, 흰색, 검정 모드
- 🌐 **다국어 지원**: 한국어, 영어
- 🔄 **실시간 동기화**: WatermelonDB + Supabase

## 📑 목차

1. [🚀 빠른 시작](#-빠른-시작)
2. [⚙️ 시작하기](#️-시작하기)
    - [환경 요구사항](#환경-요구사항)
    - [핵심 기술 스택](#핵심-기술-스택)
    - [환경 변수 설정](#환경-변수-설정)
    - [개발 서버 실행](#개발-서버-실행)
3. [🏗️ 아키텍처](#️-아키텍처)
4. [🧪 테스트](#-테스트)
5. [🚀 배포](#-배포)
6. [📚 개발 가이드](#-개발-가이드)
7. [🤝 기여하기](#-기여하기)
8. [📄 추가 문서](#-추가-문서)

---

## 🚀 빠른 시작

### AI 에이전트와 함께 설치하기

Claude Code, Cursor, Windsurf 등 AI 코딩 에이전트를 사용한다면, 아래 프롬프트를 복사해서 붙여넣으세요:

```
다음 설치 가이드를 따라 OTU 프로젝트를 설치하고 설정해줘:
https://raw.githubusercontent.com/opentutorials-org/otu.oss/main/docs/installation.md
```

### 직접 설치하기

새로운 개발자를 위한 최소 설정 가이드입니다.

```bash
# 1. 저장소 클론
git clone https://github.com/opentutorials-org/otu.oss.git
cd otu.oss

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.template .env.local

# 4. 로컬 Supabase 시작
npx supabase start
```

Supabase가 시작되면 터미널에 다음과 같은 키 정보가 출력됩니다:

```
API URL: http://127.0.0.1:54321
anon key: eyJhbGci...
service_role key: eyJhbGci...
```

**`.env.local` 파일을 열어 출력된 키를 설정하세요:**

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<출력된 anon key>
SUPABASE_SERVICE_ROLE_KEY=<출력된 service_role key>
```

```bash
# 5. 데이터베이스 초기화
npm run db-sync

# 6. 개발 서버 시작
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 애플리케이션을 확인하세요.

> 💡 **팁**: 개발 환경에서는 `/login` 경로에서 이메일 로그인을 사용할 수 있습니다.

📖 **상세 설치 가이드**: [docs/installation.md](docs/installation.md) - 환경 변수, 문제 해결 등 자세한 내용

---

## ⚙️ 시작하기

### 환경 요구사항

- **Node.js**: v20.5.0 이상
- **npm**: 10.8.1 이상
- **Docker**: Supabase 로컬 개발용
- **Git**: 버전 관리

### 핵심 기술 스택

| 카테고리          | 기술 스택                                         |
| ----------------- | ------------------------------------------------- |
| **프론트엔드**    | Next.js 16, React 19, TypeScript 5.7              |
| **데이터베이스**  | Supabase (PostgreSQL), WatermelonDB               |
| **상태 관리**     | Jotai, React Query                                |
| **UI 라이브러리** | Material-UI, Tailwind CSS                         |
| **에디터**        | BlockNote 0.44.0 + XL-AI 확장                     |
| **AI 서비스**     | OpenAI GPT-4o, Vercel AI Gateway                  |
| **라우팅**        | React Router DOM (클라이언트), Next.js App Router |
| **테스트**        | Jest (⚠️ Vitest 사용 안함!)                       |
| **모니터링**      | Vercel Logs, Console Logging                      |

### 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 환경 변수를 설정하세요.

#### 필수 환경 변수

```bash
# Supabase (필수)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# 호스트 설정 (필수)
NEXT_PUBLIC_HOST=http://localhost:3000
```

#### AI 기능 설정

AI 채팅, 제목 자동 생성, RAG 검색 등의 AI 기능을 사용하려면 다음 환경 변수를 설정하세요.

```bash
# AI 기능 활성화 (기본값: false)
# true로 설정해야 AI 기능이 작동합니다
ENABLE_AI=true

# OpenAI API 키 (개발 환경에서 ENABLE_AI=true일 때 필수)
OPENAI_API_KEY=your_openai_api_key
# 프로덕션 환경에서는 Vercel AI Gateway를 통해 AI 및 임베딩 기능이 제공됩니다.
```

> ⚠️ **주의**: `ENABLE_AI=false`(기본값)일 경우, 앱은 정상 동작하지만 AI 관련 기능(채팅, 자동 제목 생성, 스마트 검색 등)은 비활성화됩니다.

#### 선택 환경 변수

```bash
# Uploadcare (이미지 업로드)
NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY=your_uploadcare_key

# 소셜 로그인 리디렉션
NEXT_PUBLIC_SOCIAL_LOGIN_REDIRECT_TO=http://localhost:3000
```

> 💡 **팁**: 개발 환경 설정에 대한 자세한 내용은 [개발환경 설정 문서](https://docs.google.com/document/d/1RfoB5Bm0ehCVIDumNtbqJ5Aps6J-BT3dCL4TZ2K7YjY/edit)를 참조하세요.

### 개발 서버 실행

```bash
# 기본 개발 서버 (Turbopack)
npm run dev

# IP 주소로 접근 (모바일 테스트)
npm run dev:ip

# 디버깅 모드
npm run dev:inspect

# 타입 체크와 함께 실행
npm run dev && npm run type-check
```

### 주요 npm 스크립트

#### 개발

```bash
npm run dev                 # 기본 개발 서버
npm run dev:ip             # 모바일 테스트용 (IP 지정)
npm run dev:inspect        # Node Inspector 활성화
```

#### 테스트

```bash
npm test                   # Jest 단위 테스트
npm run test:integration   # 통합 테스트 (로컬 Supabase 필요)
npm run type-check         # TypeScript 타입 체크
```

#### 빌드 & 배포

```bash
npm run build              # 프로덕션 빌드
npm run deploy_preview     # 개발 환경 배포 (Vercel)
npm run deploy             # 프로덕션 배포
```

#### 데이터베이스

```bash
npm run db-sync                    # 로컬 DB 초기화 및 타입 생성
npm run supabase-start             # Supabase 로컬 시작
npm run supabase-stop              # Supabase 로컬 중지
npm run supabase-generate-database-types  # 타입 정의 파일 생성
```

#### 개발 유틸리티

```bash
npm run dev:cron:usage           # 사용량 초기화 (개발)
```

### 브랜치 전략

Git Flow를 따릅니다:

- **`main`**: 프로덕션 배포 브랜치 (직접 작업 금지 ⛔)
- **`dev`**: 개발 브랜치 (일상적인 작업)
- **`feature/*`**: 기능 개발 브랜치 (독립적인 작업)

```bash
# 새 기능 개발 시작
git checkout dev
git pull origin dev
git checkout -b feature/my-new-feature

# 작업 완료 후 dev로 머지
git checkout dev
git merge feature/my-new-feature
git push origin dev
```

### 디버깅

#### VSCode 디버거

1. `.vscode.template` 복사 → `.vscode`로 이름 변경
2. "Debug Nextjs with Edge" 선택 후 실행
3. Edge 브라우저가 자동으로 열림
4. Next.js 준비 완료 후 브라우저 새로고침

#### 디버그 로그

[debug-js/debug](https://github.com/debug-js/debug) 라이브러리 사용:

```bash
# 서버: .env에 추가
DEBUG=sync,editor,chat

# 브라우저: 개발자 도구 콘솔에서
localStorage.debug = 'sync,editor,chat'
```

사용 가능한 네임스페이스:

- `sync` - 데이터 동기화
- `editor` - 에디터 관련
- `chat` - AI 채팅
- `auth` - 인증
- 기타: `src/debug/` 디렉토리 참고

#### 모바일 디버깅

1. 화면 좌측 상단 5번 연속 탭
2. Eruda 콘솔 활성화
3. 메뉴 > 설정에서 디버깅 정보 확인

---

## 🏗️ 아키텍처

### 디렉토리 구조

```
.
├── app/                      # Next.js App Router
│   ├── (ui)/                # UI 페이지 그룹
│   │   ├── home/           # 메인 홈 (React Router DOM)
│   │   ├── signin/         # 로그인
│   │   └── ...
│   ├── api/                # API 라우트
│   │   ├── ai/            # AI 엔드포인트
│   │   ├── sync/          # 데이터 동기화
│   │   ├── usage/         # 사용량 추적
│   │   ├── reminder/      # 알람 관리
│   │   └── ...
│   └── auth/              # 인증 관련
│
├── src/
│   ├── components/        # React 컴포넌트
│   │   ├── Chat/         # AI 채팅
│   │   ├── common/       # 공유 컴포넌트
│   │   ├── home2/        # 홈 (React Router 기반)
│   │   ├── layout/       # 레이아웃
│   │   └── ...
│   │
│   ├── functions/         # 유틸리티 함수
│   │   ├── ai/           # AI 서비스
│   │   ├── hooks/        # 커스텀 훅
│   │   └── usage/        # 사용량 추적
│   │
│   ├── watermelondb/      # 로컬 DB (오프라인 지원)
│   │   ├── model/        # 모델 정의
│   │   ├── control/      # DB 제어 로직
│   │   ├── schema.ts     # 스키마
│   │   ├── sync.ts       # 동기화 로직 (40KB+)
│   │   └── migrations.ts # 마이그레이션
│   │
│   └── debug/             # 디버그 로거들
│
├── supabase/              # Supabase 설정
│   ├── migrations/       # DB 마이그레이션
│   └── ...
│
└── messages/              # 다국어 지원
    ├── ko.json           # 한국어
    └── en.json           # 영어
```

### 핵심 아키텍처 패턴

#### 1. 데이터 계층

```
┌─────────────┐
│  Supabase   │  ← 서버 진실 소스
│  (PostgreSQL)│
└──────┬──────┘
       │ 양방향 동기화
       ↓
┌─────────────┐
│ WatermelonDB │  ← 로컬 캐시 + 오프라인
└──────┬──────┘
       │ 관찰 패턴
       ↓
┌─────────────┐
│   Jotai     │  ← UI 상태 관리
└──────┬──────┘
       │
       ↓
   React UI
```

**특징:**

- **증분 동기화**: `gt` 연산자로 중복 방지
- **동시성 제어**: 대기열 방식으로 race condition 방지 및 순차 처리
- **오프라인 우선**: 로컬 DB에서 즉시 응답

#### 2. 네비게이션

```
┌──────────────────┐
│  Next.js Router  │  ← 페이지 레벨 라우팅
└────────┬─────────┘
         │
    /home 영역
         │
         ↓
┌──────────────────┐
│ React Router DOM │  ← 클라이언트 라우팅
│   (SPA 모드)      │    (빠른 전환)
└──────────────────┘
```

**패턴:**

- URL이 단일 진실 소스 (Source of Truth)
- `useNavigate`, `useLocation`, `useParams` 사용
- 보호된 경로: 자동 로그인 리디렉션

#### 3. AI 통합

```
BlockNote 0.44.0 Editor
    ↓
  XL-AI Extension
    ↓
  Proxy API (/api/ai/proxy)
    ↓
  Vercel AI Gateway
    ↓
  OpenAI GPT-4o
```

**기능:**

- AI 포맷팅 툴바
- AI 슬래시 메뉴
- 이미지 AI 캡셔닝 (2단계 처리)
- 자동 제목 생성
- RAG 기반 문서 검색

---

## 🧪 테스트

### Jest 단위 테스트

프로젝트는 **Jest**를 테스트 프레임워크로 사용합니다. (⚠️ Vitest 아님!)

```bash
# 모든 테스트 실행
npm test

# 특정 테스트 파일 실행
npx jest path/to/test.test.ts

# watch 모드
npx jest --watch
```

#### 테스트 환경 설정

Jest는 파일 상단 주석으로 실행 환경을 자동 구분합니다:

**Node.js 환경 (API, 서버 로직)**

```typescript
/** @jest-environment node */
import { POST } from './route';
```

**jsdom 환경 (React 컴포넌트, DOM)**

```typescript
/** @jest-environment jsdom */
import { render } from '@testing-library/react';
```

#### 테스트 파일 규칙

- 테스트 파일명: `*.test.ts` 또는 `*.test.tsx`
- 위치: 테스트 대상 파일과 같은 디렉토리
- 예: `useReminderList.tsx` → `useReminderList.test.tsx`

### 통합 테스트 (DB 의존)

```bash
npm run test:integration
```

로컬 Supabase 실행이 필요한 테스트입니다:

- DB 동기화 테스트
- 알람 API 테스트
- 회원 탈퇴 API 테스트

### API 테스트

- `node test/api.js`로 원큐에 테스트 가능합니다.
- test/case.ts에 시나리오별 데이터가 담겨 있습니다.
- 테스트 유저를 변경하려면 test/case.ts의 target_user 변경하면 됩니다.

---

## 🚀 배포

### 개발 환경 배포

```bash
npm run deploy_preview
```

- 타겟: Vercel Preview 환경
- 브랜치: `dev`
- 배포 후 미리보기 URL 제공

### 프로덕션 배포

```bash
npm run deploy
```

**자동 처리:**

1. `main` 브랜치로 전환
2. `dev` 브랜치 머지
3. 버전 자동 업데이트 (`standard-version`)
4. Git 태그 생성 및 푸시
5. Vercel 프로덕션 배포

### 배포 체크리스트

- [ ] 모든 테스트 통과 확인 (`npm test`)
- [ ] 타입 체크 통과 (`npm run type-check`)
- [ ] 로컬 빌드 성공 (`npm run build`)
- [ ] 마이그레이션 파일 검토
- [ ] 환경 변수 업데이트 확인
- [ ] CHANGELOG.md 확인

---

## 📚 개발 가이드

### 핵심 개발 원칙

#### 1. React Router 네비게이션

홈 영역(`/home/*`)에서는 React Router DOM 사용:

```typescript
import { useNavigate, useParams } from 'react-router-dom';

function MyComponent() {
    const navigate = useNavigate();
    const { pageId } = useParams();

    // ✅ 올바른 방법
    navigate('/home/page/123');

    // ❌ 사용 금지
    router.push('/home/page/123');
}
```

#### 2. 상태 관리

```typescript
// ✅ 전역 상태: Jotai
import { atom, useAtom } from 'jotai';

// ✅ 로컬 상태: useState, useImmer
const [state, setState] = useImmer(initialState);

// ✅ 서버 상태: WatermelonDB (관찰 패턴)
const pages = useFoldersData();
```

#### 3. 다국어 처리

```typescript
// 클라이언트
import { useTranslations } from 'next-intl';
const t = useTranslations('namespace');

// 서버
const t = await getTranslations('namespace');
```

#### 4. 에러 처리

```typescript
try {
    await someAsyncOperation();
} catch (error) {
    console.error('Operation error:', error);
}
```

### 상세 문서

더 자세한 개발 가이드는 다음 문서를 참조하세요:

- **기능 목록**: [`/docs/meta-guides/functionality.md`](docs/meta-guides/functionality.md)
- **메커니즘 문서**: [`/docs/`](docs/) 디렉토리
- **CLAUDE.md**: AI 어시스턴트를 위한 프로젝트 가이드 (코딩 스타일 포함)

---

## 🤝 기여하기

### 기여 방법

1. **이슈 확인**: [GitHub Issues](https://github.com/opentutorials-org/otu.oss/issues)에서 작업할 이슈 선택
2. **브랜치 생성**: `feature/이슈번호-간단한설명` 형식
3. **개발**: 코딩 스타일 가이드 준수
4. **테스트**: 모든 테스트 통과 확인
5. **커밋**: Conventional Commits 형식 (한국어)
6. **Pull Request**: `dev` 브랜치로 PR 생성

### 커밋 메시지 규칙

```
feat: 새로운 기능 추가

변경 이유:
- 사용자가 요청한 기능입니다.

테스트 방법:
1. 개발 서버 시작
2. /home/page로 이동
3. 새 기능 버튼 클릭
```

형식:

- `feat`: 새로운 기능
- `fix`: 버그 수정
- `docs`: 문서 변경
- `style`: 코드 포맷팅
- `refactor`: 리팩토링
- `test`: 테스트 추가/수정
- `chore`: 빌드, 설정 변경

### 코드 리뷰 가이드

- PR은 최소 1명 이상의 승인 필요
- 모든 테스트 통과 필수
- 타입 체크 통과 필수
- 코딩 스타일 가이드 준수

## 📄 추가 문서

### 기본 설정 안내

- https://supabase.com/docs/guides/auth/server-side/creating-a-client?environment=server-component#creating-a-client

### Supabase Database 설정

- supabase.com에서 프로젝트를 생성하고 데이터베이스를 셋업하려면 아래와 같이 진행합니다.
- supabase.com에서 프로젝트설정을 기준으로 .env 파일을 설정합니다.
- supabase와 연결: `npx supabase link`
- supabase에서 데이터베이스를 생성합니다: `npx supabase db push`

### Client Component

```typescript
"use client";

import { createClient } from "@/supabase/utils/client"

export default function Page() {
  const supabase = createClient();
  return ...
}
```

### Server Component

```typescript
import { createClient } from "@/supabase/utils/server"
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = cookies()
  const supabase = await createClient();
  return ...
}
```

```typescript
let query = supabase.from('page').select('id, title').eq('user_id', user.id);
```

### Super Role DB Client

```typescript
import { createSuperClient } from '@/supabase/utils/super';
const superSupabase = createSuperClient();
// service role key를 사용해서 데이터를 가져올 때는 user값을 가져올 수 없기 때문에 createClient를 사용해야 합니다.
const user = await supabase.auth.getUser();
```

### Service Role RLS 설정

```sql
alter policy "Allow service role to insert"
on "public"."usage"
to service_role
with check (
  true
);
```

---

## API 및 서비스

### BlockNote 에디터

현재 프로젝트는 **BlockNote** 에디터를 사용합니다.

#### 주요 기능

- **AI 통합**: BlockNote 0.44.0 XL-AI 확장을 통한 AI 기능
    - AI 포맷팅 툴바
    - AI 슬래시 메뉴
    - Vercel AI Gateway를 통한 OpenAI GPT-4o 호출
- **다국어 지원**: 한국어/영어 에디터 UI
- **커스텀 슬래시 메뉴**: 카드 형태의 그리드 레이아웃
- **이미지 AI 캡셔닝**: 비용 효율적인 2단계 처리 (저해상도 → 고해상도)
- **실시간 자동저장**: 3초 debounce 적용

#### 스타일 커스터마이징

- BlockNote 스타일은 `app/blocknote.css`에서 관리합니다.
- 전역 CSS 변수를 통해 테마와 통합됩니다.

---

## 참고자료

### 훈련소

https://github.com/opentutorials-org/otu.ai/issues?q=is%3Aissue+label%3Atraining

#### Notification

- 난이도 : 쉬움
- 주요 개념 : jotai
- [바로가기](https://github.com/opentutorials-org/otu.ai/pull/10)
- 시작커밋 : #3888c98e16b5eb6c22771b4bda294880a032b46a

#### 카운터

- 난이도 : 중
- 주요 개념 : jotai, mui
- [바로가기](https://github.com/opentutorials-org/otu.ai/pull/11)
- 시작커밋 : #c17fafd2b508219a3e93274aeb64404e9cf7960e

### 실 서비스용 지출 대상

#### Supabase

- **ID:** 이고잉 개인 계정
- **Billing:** [Supabase Billing](https://supabase.com/dashboard/org/jsbhclayhnpqbpxkmewr/billing)
- **Usage:** [Supabase Usage](https://supabase.com/dashboard/org/jsbhclayhnpqbpxkmewr/usage)
- **Pricing:** $25

#### OpenAI

- **ID:** egoing opentutorials.org 계정
- **Usage:** [OpenAI Usage](https://platform.openai.com/account/usage)
- **Bill:** [OpenAI Billing](https://platform.openai.com/account/billing/overview)
- **API Key:** [OpenAI API Keys](https://platform.openai.com/account/api-keys)
- **Pricing:** [OpenAI Pricing](https://openai.com/pricing)

##### gpt-4-1106-preview & gpt-4-1106-vision-preview Pricing

| Context | Input | Output |
| ------- | ----- | ------ |
| 128K    | $0.01 | $0.03  |

##### GPT-3 Turbo Pricing

| Context | Input   | Output |
| ------- | ------- | ------ |
| 4K      | $0.0015 | $0.002 |
| 16K     | $0.003  | $0.004 |

#### Uploadcare

- **ID:** 이고잉 opentutorials.org 계정
- **Project:** otu.ai
- **결재 상태:** 현재 free version
- **Pricing:** $75

#### Cohere (레거시 - 더 이상 사용하지 않음)

> **참고:** 임베딩 기능은 Vercel AI Gateway로 마이그레이션되었습니다. Cohere API는 더 이상 사용되지 않습니다.

- **ID:** 이고잉 opentutorials.org 계정
- **Billing & Usage:** [Cohere Billing & Usage](https://dashboard.cohere.com/billing)
- **Pricing:** $0.0000001 / 1 token

### 개발환경 공유계정

#### Supabase

- **ID:** 각자 개설

#### OpenAI

- **ID:** 이고잉 개인 계정
- **Organization:** otu.ai-dev
- **api key:** 이고잉에게 문의

#### Uploadcare

- **ID:** 각자 개설

#### Cohere

- **ID:** 이고잉 개인 계정
- **api key:** 이고잉에게 문의

### 알게 된 것

- @supabase/ssr는 service role key를 지원하지 않습니다. 관리자 권한이 필요하다면 @supabase/supabase-js를 사용합니다.
- vercel의 cron은 deploy를 한 후에 일정 시간(관찰 결과 약 6분)동안 실행이 되지 않습니다.
- localStorage, cookie와 같이 브라우저에만 존재하는 api를 이용하는 코드는 useEffect 안에서만 사용해야 합니다.
- anon은 익명 role이기 때문에 로그인 된 사용자와 관련된 RLS를 지정하려면 authenicated role을 사용해야 합니다.

---

## 추가 문서

더 자세한 정보는 다음 문서들을 참조하세요:

### 핵심 문서

- **CLAUDE.md**: AI 어시스턴트를 위한 프로젝트 가이드 (코딩 스타일 포함)
- **기능 목록**: `/docs/meta-guides/functionality.md`
    - 사용자 관리 및 인증
    - 편집 기능 (BlockNote, AI 통합)
    - 폴더 시스템 및 검색
    - 알람/리마인더 시스템

### 메커니즘 문서

`/docs/` 디렉토리 (prefix 기반 분류):

- **[docs/README.md](docs/README.md)** - 📚 전체 문서 목차 및 가이드

**메타 문서 (meta-guides/)**:

- `functionality.md` - 전체 기능 명세

**도메인 시스템 (domain-\*)**:

- `domain-authentication/` - 인증 및 사용자 ID 관리 (2개 문서)
- `domain-reminders/` - 알람 시스템 (2개 문서)

**기능 (feature-\*)**:

- `feature-editor/` - 에디터 자동저장 및 임베딩 (1개 문서)
- `feature-chat/` - AI 채팅 RAG 및 임베딩 (2개 문서)

**핵심 메커니즘 (core-\*)**:

- `core-data/` - WatermelonDB 동기화, 샘플 데이터, 폴더 (3개 문서)
- `core-routing/` - React Router 네비게이션 (2개 문서)
- `core-ui/` - 테마, z-index, 반응형 레이아웃 (5개 문서)
- `core-architecture/` - 성능 최적화, HOC 패턴, 공유 (3개 문서)

**테스트 (test/)**:

- `test-status.md` - 전체 테스트 현황

> **참고**: docs/README.md에서 전체 문서 구조와 읽는 순서를 안내합니다.

...........
............
