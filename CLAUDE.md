# CLAUDE.md

이 문서는 Claude Code (claude.ai/code)가 이 저장소의 코드를 작업할 때 참고하는 가이드입니다.

## 참고: Cursor Rules

Cursor IDE 사용 시에만 `.cursor/rules/*.mdc` 파일들을 추가로 참고하세요.

### 핵심 규칙 (from 01_general.mdc)

- **모든 답변은 한국어로 작성**
- **add, commit 작업** - 사용자 요청 시 Git 작업 수행 가능
- **Prettier 포맷팅 필수** - 코드 작성 후 반드시 `npm run prettier` 실행
- **변경사항 영향 분석**: 작업 후 영향받을 수 있는 기능을 나열하고 테스트 방법 제시 (중요도별로 "반드시", "가급적", "참고" 등급으로 구분)
- **문서화**: `/docs/functionality.md`, `/docs/` 참고 및 업데이트
- **로깅**: `/debug` 디렉토리의 debug.js 라이브러리 사용
- **다국어**: UI 텍스트는 항상 다국어 처리 확인

### 문서 최적화 원칙

문서는 **간결하고 중복 없이 최소한으로** 유지합니다:

- **문서 수 최소화**: 프로젝트 이해에 충분한 정도만 유지
- **중복 금지**: 같은 내용이 여러 문서에 존재하면 안 됨
- **코드 가까이**: 메커니즘 설명은 해당 코드 파일의 JSDoc/주석으로 작성
- **별도 문서가 필요한 경우**: 여러 파일에 걸친 아키텍처, 외부 배포 가이드, 기능 명세 등

**권장 문서 구조**:

```
프로젝트/
├── README.md              # 프로젝트 소개 + 빠른 시작
├── CLAUDE.md              # AI 코딩 규칙 + 아키텍처 요약
└── docs/
    ├── installation.md    # 설치 가이드 (외부 기여자 진입점)
    ├── deployment.md      # 프로덕션 배포 가이드
    ├── functionality.md   # 전체 기능 명세
    ├── CONTRIBUTING.md    # 기여 가이드 (오픈소스 표준)
    ├── CODE_OF_CONDUCT.md # 행동 강령 (오픈소스 표준)
    └── SECURITY.md        # 보안 정책 (오픈소스 표준)
```

**코드 주석으로 대체 불가한 문서** (독립 문서로 유지):

- 설치/배포 가이드 - 외부 사용자/기여자 진입점
- 기여 가이드, 행동 강령 - 오픈소스 커뮤니티 표준
- 기능 명세 - 여러 파일에 걸친 전체 기능 목록

**문서 작성/수정 시 체크리스트**:

1. 이 내용이 코드 주석으로 대체 가능한가? → 코드에 작성
2. 다른 문서에 이미 같은 내용이 있는가? → 한 곳으로 통합
3. 이 문서가 없으면 프로젝트 이해에 문제가 있는가? → 없으면 삭제 고려

### 절대 금지 작업

- `npx supabase db push` (데이터베이스 푸시)

---

## 프로젝트 개요

**OTU**는 웹과 모바일을 지원하는 Next.js 기반 AI 메모 애플리케이션입니다.

**현재 버전**: 0.5.201

### 개발 환경 요구사항

- **Node.js**: v20.5.0
- **npm**: 10.8.1
- **Next.js 설정 파일**: `next.config.js` (JavaScript 형식)

### 핵심 기술 스택

- Next.js 16.0.7 + React 19.1.0 + TypeScript 5.7.3
- Supabase (DB/Auth), WatermelonDB 0.28.0 (로컬 동기화)
- Jotai 2.11.3 (상태 관리), Material-UI 7.3.7 (UI)
- BlockNote 0.44.0 (에디터), OpenAI (AI 기능)
- React Router DOM 7.8.2 (홈 영역 내비게이션)
- Vercel AI Gateway (AI API 표준화)
- **Jest 30.0.4** (테스트 프레임워크) - ⚠️ Vitest 아님!

### 주요 명령어

```bash
# 개발
npm run dev                  # 개발 서버
npm run dev:ip              # 모바일 테스트용

# 코드 품질 (Jest 사용, Vitest 아님!)
npm run test                # Jest 단위 테스트
npm run test:integration    # 통합 테스트 (로컬 Supabase 필요)
npm run type-check          # 타입 체킹
npm run prettier            # Prettier 포맷팅 적용

# 빌드/배포
npm run build
npm run deploy_preview      # 개발 환경 배포
npm run deploy              # 프로덕션 배포
```

## 아키텍처

### 디렉토리 구조

```
app/
├── (ui)/                    # UI 페이지 그룹
│   ├── (welcome)/           # 웰컴 페이지
│   ├── home/                # 메인 홈 (React Router DOM 사용)
│   ├── signin/              # 로그인
│   ├── signup/              # 회원가입
│   ├── login_callback/      # OAuth 콜백 처리
│   ├── faq/                 # FAQ 페이지
│   ├── error/               # 에러 페이지
│   ├── test/                # 테스트 페이지
│   └── ~fallback/           # 폴백 라우트
├── api/                     # API 라우트
│   ├── ai/                  # AI 엔드포인트
│   ├── sync/                # 데이터 동기화
│   ├── reminder/            # 알람 관리
│   ├── share/               # 페이지 공유
│   ├── setting/             # 설정 관리 (export, withdraw)
│   ├── check/               # 인증/버전 체크
│   ├── refresh_token_check/ # 토큰 갱신 체크
│   └── test/                # 테스트 엔드포인트
├── auth/                    # 인증 관련
└── share/                   # 페이지 공유 UI

src/
├── __tests__/         # 프로젝트 레벨 테스트 (통합/크로스 도메인)
├── components/
│   ├── Chat/          # AI 채팅
│   ├── common/        # 공유 컴포넌트 (버튼, 모달 등)
│   ├── home2/         # 홈 페이지 컴포넌트 (React Router 기반)
│   │   ├── editor/    # 페이지 에디터
│   │   ├── sections/  # 페이지/폴더/리마인더/검색 섹션
│   │   ├── shared/    # 공유 컴포넌트 (controls, displayType)
│   │   └── router/    # React Router 설정
│   ├── core/          # 핵심 컴포넌트 (Setting, fileUploader 등)
│   ├── GlobalInput/   # 빠른 메모 입력
│   ├── layout/        # 레이아웃 컴포넌트
│   ├── betaTest/      # 베타 테스트 대기 화면
│   ├── ErrorPage.tsx  # 에러 페이지 컴포넌트
│   └── LinguiClientProvider.tsx  # Lingui 클라이언트 프로바이더
│
├── hooks/             # 커스텀 React 훅 (useSync, useNavigation 등)
│
├── functions/         # 도메인별 비즈니스 로직
│   ├── ai/            # AI 서비스 (임베딩, 타이틀링)
│   ├── api/           # API 응답 헬퍼 (response, error)
│   ├── auth/          # 인증 관련 (requireLogin, checkSuperuser)
│   ├── env/           # 환경 탐지 (detectEnvironment, isMobile)
│   ├── folder/        # 폴더 CRUD
│   ├── media/         # 미디어 처리 (thumbnail, uploadcare)
│   ├── membership/    # 멤버십 등록/관리
│   ├── page/          # 페이지 관련
│   ├── sample/        # 샘플 데이터
│   ├── storage/       # 스토리지 관리 (clearStorage)
│   ├── sync/          # 동기화 트리거
│   ├── ui/            # UI 유틸 (toggleFullScreen)
│   ├── usage/         # 사용량 추적
│   ├── utils/         # 범용 유틸 (date, cookie, linkify)
│   ├── validation/    # 유효성 검사
│   └── constants.ts   # 전역 상수
│
├── fixtures/          # 테스트 픽스처/유틸리티 (테스트 케이스 데이터, HTTP 테스트 등)
├── utils/             # 클라이언트 유틸리티 (navigation, haptic 등)
├── lib/               # 라이브러리 설정 (jotai, lingui, database)
├── locales/           # 다국어 번역 파일 (PO 카탈로그)
├── messages/          # 메시지 정의
├── types/             # TypeScript 타입 정의
├── debug/             # 디버그 로거들
│
└── watermelondb/      # 로컬 DB
    ├── model/         # 모델 정의
    ├── control/       # DB 제어 로직
    ├── schema.ts      # 스키마 정의
    ├── sync.ts        # 동기화 로직 (40KB+)
    └── migrations.ts  # 마이그레이션
```

### 주요 패턴

#### 상태 관리

- **Jotai**: 전역 상태 (`src/lib/jotai.ts`)
    - 채팅 상태 관리 (`chatOpenState`, `chatState`)
    - AI 응답 및 참조 데이터 관리
    - 다양한 UI 상태 atom들
- **WatermelonDB**: 로컬 데이터 + 오프라인 동기화
    - 복잡한 동기화 로직 (`src/watermelondb/sync.ts` - 40KB+)
    - 동시 동기화 처리 (`src/watermelondb/sync.concurrent.test.ts`)
- **Supabase**: 서버 데이터 + 실시간

#### 페이지 내비게이션

- **홈 영역 (`/home/*`)**: React Router DOM 기반
    - `react-router-dom`의 `useNavigate`, `useLocation`, `useParams` 사용
    - URL을 단일 진실 소스(Source of Truth)로 사용
    - 클라이언트 사이드 라우팅으로 빠른 페이지 전환
- **레거시 페이지**: Next.js App Router 기반
    - 점진적으로 React Router로 마이그레이션 중
- **보호된 경로**: 비로그인 시 `/signin?redirectTo=[원래경로]`로 리디렉션

#### 인증

- Supabase Auth (Google, GitHub, Apple, Email)
- 유틸리티: `@/supabase/utils/client`, `@/supabase/utils/server`

#### 국제화

- LinguiJS (한국어/영어)
- `src/locales/` 디렉토리 (PO 카탈로그)
- 클라이언트/RSC: `import { useLingui } from '@lingui/react/macro'` → `const { t } = useLingui()` → `` t`텍스트` ``
- API 라우트: `import { getServerI18n } from '@/i18n-server'` → ``i18n._(msg`텍스트`)``

## 코드 스타일

### Prettier 포맷팅 (필수)

⚠️ **중요**: 이 프로젝트는 Prettier 포맷팅을 엄격하게 준수합니다.

**작업 전 반드시 확인**:

```bash
npm run prettier    # 모든 파일 포맷팅 적용
```

**Prettier 설정** (`.prettierrc`):

- `printWidth: 100` - 한 줄 최대 100자
- `tabWidth: 4` - 들여쓰기 4칸
- `useTabs: false` - 스페이스 사용
- `semi: true` - 세미콜론 필수
- `singleQuote: true` - 싱글 쿼트 사용
- `trailingComma: 'es5'` - ES5 호환 trailing comma
- `arrowParens: 'always'` - 화살표 함수 괄호 항상 사용

**작업 규칙**:

1. 코드 작성 후 `npm run prettier` 실행
2. 커밋 전 포맷팅 확인
3. IDE에 Prettier 플러그인 설정 권장 (저장 시 자동 포맷팅)

### 컴포넌트

```typescript
function ComponentName(): JSX.Element {
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = (): void => {
        // 구현
    };

    return <Box sx={{ padding: 2 }}>{/* 콘텐츠 */}</Box>;
}
```

### 에러 핸들링

```typescript
try {
    await someAsyncOperation();
} catch (error) {
    console.error('Operation error:', error);
}
```

### API 응답

```typescript
// 성공
return successResponse({
    status: 200,
    message: '성공',
    data: result,
});

// 에러
return errorResponse(
    {
        status: 500,
        errorCode: 'ERROR_CODE',
        message: '에러 메시지',
    },
    error
);
```

### 디버깅

- debug.js 라이브러리 사용 (`src/debug/` 디렉토리)
- 클라이언트: `localStorage.debug = 'category'`
- 서버: `DEBUG='category'`

### 테스트

- **테스트 프레임워크**: Jest (⚠️ Vitest 아님!)
- **테스트 파일 위치**: `__tests__/` 디렉토리로 통일 (#55)
    - 각 도메인/기능 디렉토리의 `__tests__/` 하위에 테스트 파일 위치
    - 예시:
        - `src/watermelondb/__tests__/sync.test.ts`
        - `app/api/sync/__tests__/sync-database.test.ts`
        - `src/hooks/__tests__/useReminderList.test.tsx`
        - `src/functions/media/__tests__/thumbnail.test.ts`
- **테스트 작성 시**:
    - `@jest-environment node` 주석 사용 (서버 환경)
    - `@/debug/test`의 `testLogger` 사용
    - import 경로: `__tests__/` 이동 시 상대 경로 조정 필요 (`./ → ../`)

### 버그 수정 규칙 (필수)

- **수정 전 반드시 실패하는 테스트를 먼저 작성**하여 버그를 재현할 것
- **수정 완료 주장 전 반드시 테스트를 실행**하여 검증할 것. 테스트를 안 돌렸으면 수정 완료가 아님
- **git history를 먼저 확인**하여 regression 여부를 판단할 것 (`git log`, `git diff`)
- E2E 테스트 실행 전 **올바른 앱이 올바른 포트에서 실행 중인지 확인**할 것
- 테스트를 **절대 skip 처리하지 말 것**. 실행이 안 되면 원인을 보고하고 지시를 요청할 것

## 중요 개발 노트

### 브랜치 전략

- `main`: 프로덕션 (직접 개발 금지)
- `dev`: 개발 브랜치
- `feature/*`: 기능 브랜치

### 데이터베이스

- 자동 컬럼 수정 마이그레이션 사용 금지 (데이터 손실 위험)
- 커밋 전 마이그레이션 파일 검토 필수
- 로컬 DB 확인: `docker exec -i supabase_db_new-opentutorials psql -U postgres -d postgres -c "명령어"`

### 환경 변수

```bash
# 필수
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI 설정 (선택)
ENABLE_AI=false                 # AI 기능 활성화 여부 (true: 활성화, false: 비활성화, 기본값 false)
OPENAI_API_KEY=                 # ENABLE_AI=true일 때 필요 (개발 환경)
# 프로덕션에서는 Vercel AI Gateway를 통해 AI 및 임베딩 기능이 제공됩니다.

# 디버그 설정 (선택)
# DEBUG=                        # 기본값 비활성화 (예: sync, chat, editor, alarm, * 전체)
```

### 주요 고려사항

- AI 사용량 추적 및 할당량 관리
- 모든 UI 텍스트는 다국어 처리

## 아키텍처 특징

### WatermelonDB 동기화

- **복잡한 동기화 시스템**: `src/watermelondb/sync.ts` (40KB+)
- **동시 동기화 처리**: 대기열 방식으로 race condition 방지 및 순차 처리
- **증분 동기화**: `gt` (초과) 연산자로 중복 방지
- **라우트 진입 동기화**: 특정 페이지 진입 시 자동 동기화 트리거

### React Router 아키텍처

- **home2 섹션**: React Router DOM 기반 아키텍처 (마이그레이션 완료)
    - URL 기반 상태 관리 (atom 의존성 제거)
    - Lazy Loading 및 코드 스플리팅
    - 섹션별 독립적인 라우팅 (page, folder, reminder, search)
    - 에디터 컴포넌트: `home2/editor/`
    - 공유 컴포넌트: `home2/shared/` (controls, displayType)

### 성능 최적화

- **HOC 패턴**: 모달/다이얼로그 공통 로직 추상화
- **Code Splitting**: Next.js dynamic import + React Router lazy
- **Debounced 함수 통합**: 중복 작업 제거 (예: HTML 변환 한 번만 수행, 모바일 메인 스레드 블로킹 방지)
- **배치 처리**: PostgreSQL 함수로 다중 업데이트 최적화
- **Vercel Speed Insights**: 실제 사용자 성능 모니터링

## 추가 문서 참조

프로젝트에 대한 더 자세한 정보는 다음 문서들을 참고하세요:

- **기능 목록**: `/docs/functionality.md` - 사용자 관리, 편집, 폴더, 알람 등 전체 기능 명세

메커니즘 문서들은 해당 코드 파일 상단 주석으로 통합되었습니다:

- 동기화: `src/watermelondb/sync.ts`
- 폴더: `src/watermelondb/model/Folder.ts`
- 테마: `app/RootLayoutProvider.tsx`
- 자동저장: `src/components/home2/editor/hooks/useAutoSave.ts`
- RAG 검색: `app/api/ai/similaritySearch/route.tsx`
- 리마인더: `app/api/reminder/register-by-page/route.ts`
