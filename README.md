# OTU

> AI 기반 스마트 메모 애플리케이션 - 생각을 기록하고, AI가 기억을 돕습니다

[![Version](https://img.shields.io/badge/version-0.5.201-blue.svg)](https://github.com/opentutorials-org/otu.oss)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)

**OTU**는 웹과 모바일을 지원하는 차세대 AI 메모 애플리케이션입니다. BlockNote 에디터와 OpenAI GPT-4o를 활용하여 자동 저장, AI 기반 제목 생성, 스마트 검색, 리마인더 시스템을 제공합니다.

## 주요 기능

- **AI 통합 에디터**: BlockNote XL-AI 확장으로 텍스트 개선, 요약, 번역 등
- **자동 저장**: 3초 debounce로 연속 편집 중에도 안전하게 저장
- **스마트 검색**: RAG 기반 문서 검색 및 AI 채팅
- **폴더 시스템**: 메모를 체계적으로 관리
- **스마트 리마인더**: 지수적 알람 주기로 중요한 메모 복습
- **3가지 테마**: 회색, 흰색, 검정 모드
- **다국어 지원**: 한국어, 영어
- **실시간 동기화**: WatermelonDB + Supabase

## 빠른 시작

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

`.env.local` 파일을 열어 출력된 키를 설정하세요:

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

> **팁**: 개발 환경에서는 `/signin` 경로에서 이메일 로그인을 사용할 수 있습니다.

**상세 설치 가이드**: OAuth 설정, 모바일 테스트, AI 기능 활성화 등은 [docs/installation.md](docs/installation.md) 참조

## 환경 요구사항

- **Node.js**: v20.5.0 이상
- **npm**: 10.8.1 이상
- **Docker**: Supabase 로컬 개발용

## 핵심 기술 스택

| 카테고리          | 기술 스택                            |
| ----------------- | ------------------------------------ |
| **프론트엔드**    | Next.js 16, React 19, TypeScript 5.7 |
| **데이터베이스**  | Supabase (PostgreSQL), WatermelonDB  |
| **상태 관리**     | Jotai, React Query                   |
| **UI 라이브러리** | Material-UI, Tailwind CSS            |
| **에디터**        | BlockNote 0.44.0 + XL-AI 확장        |
| **AI 서비스**     | OpenAI GPT-4o, Vercel AI Gateway     |
| **테스트**        | Jest (Vitest 사용 안함)              |

## 주요 명령어

```bash
# 개발
npm run dev                 # 기본 개발 서버
npm run dev:ip             # 모바일 테스트용

# 테스트
npm test                   # Jest 단위 테스트
npm run test:integration   # 통합 테스트 (로컬 Supabase 필요)
npm run type-check         # TypeScript 타입 체크

# 빌드 & 배포
npm run build              # 프로덕션 빌드
npm run deploy_preview     # 개발 환경 배포
npm run deploy             # 프로덕션 배포

# 데이터베이스
npm run db-sync            # 로컬 DB 초기화 및 타입 생성
```

## 환경 변수

### 필수

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_HOST=http://localhost:3000
```

### AI 기능 (선택)

```bash
ENABLE_AI=true                    # AI 기능 활성화 (기본값: false)
OPENAI_API_KEY=your_openai_key    # 개발 환경에서 필요
```

> `ENABLE_AI=false`(기본값)일 경우, 앱은 정상 동작하지만 AI 관련 기능은 비활성화됩니다.

## 브랜치 전략

- **`main`**: 프로덕션 배포 브랜치 (직접 작업 금지)
- **`dev`**: 개발 브랜치
- **`feature/*`**: 기능 개발 브랜치

## 디렉토리 구조

```
app/
├── (ui)/               # UI 페이지 그룹 (home, signin 등)
├── api/                # API 라우트 (ai, sync, reminder 등)
└── auth/               # 인증 관련

src/
├── components/         # React 컴포넌트
├── functions/          # 유틸리티 함수
├── watermelondb/       # 로컬 DB (오프라인 지원)
└── debug/              # 디버그 로거들

supabase/               # Supabase 설정 및 마이그레이션
locales/                # 다국어 지원 (LinguiJS)
```

## 기여하기

1. **이슈 확인**: [GitHub Issues](https://github.com/opentutorials-org/otu.oss/issues)에서 작업할 이슈 선택
2. **브랜치 생성**: `feature/이슈번호-간단한설명` 형식
3. **개발**: 코딩 스타일 가이드 준수 (CLAUDE.md 참고)
4. **테스트**: 모든 테스트 통과 확인
5. **커밋**: Conventional Commits 형식 (한국어)
6. **Pull Request**: `dev` 브랜치로 PR 생성

### 커밋 메시지 형식

- `feat`: 새로운 기능
- `fix`: 버그 수정
- `docs`: 문서 변경
- `refactor`: 리팩토링
- `test`: 테스트 추가/수정
- `chore`: 빌드, 설정 변경

## 문서 구조

```
프로젝트/
├── README.md                  # 프로젝트 소개 + 빠른 시작 (이 문서)
├── CLAUDE.md                  # AI 코딩 규칙 + 아키텍처 요약
└── docs/
    ├── installation.md        # 상세 설치 가이드
    ├── functionality.md       # 전체 기능 명세
    ├── CONTRIBUTING.md        # 기여 가이드
    ├── CODE_OF_CONDUCT.md     # 행동 강령
    └── SECURITY.md            # 보안 정책
```

## 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.
