# OTU

> AI 기반 스마트 메모 애플리케이션 - 생각을 기록하고, AI가 기억을 돕습니다

[![Version](https://img.shields.io/badge/version-0.5.201-blue.svg)](https://github.com/opentutorials-org/otu.oss)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)

## 이 프로젝트는

**OTU**는 [otu.ai](https://otu.ai) 서비스의 오픈소스 버전입니다. 이 저장소를 포크하면 **나만의 AI 메모 서비스를 직접 운영**할 수 있습니다.

이 프로젝트가 궁금하다면, 먼저 [otu.ai](https://otu.ai)를 사용해보세요. 설치 없이 바로 체험할 수 있습니다.

### 주요 기능

- **AI 통합 에디터**: 텍스트 개선, 요약, 번역
- **스마트 검색**: RAG 기반 문서 검색 및 AI 채팅
- **자동 저장**: 편집 중에도 안전하게 저장
- **폴더**: 메모를 체계적으로 관리
- **실시간 동기화**: 웹과 모바일 간 데이터 동기화
- **다국어 지원**: 한국어, 영어

## 사용하는 서비스

OTU를 직접 운영하려면 아래 외부 서비스들의 계정이 필요합니다.

| 서비스                                | 역할                              | 필수 여부 |
| ------------------------------------- | --------------------------------- | --------- |
| [Vercel](https://vercel.com)          | 호스팅 및 배포                    | 필수      |
| [Supabase](https://supabase.com)      | 데이터베이스, 인증, 실시간 동기화 | 필수      |
| [Uploadcare](https://uploadcare.com)  | 이미지 업로드                     | 선택      |
| [OpenAI](https://platform.openai.com) | AI 채팅, 제목 생성, 검색          | 선택      |

## 설치 방법

### A. 운영: 나만의 서비스 배포하기

Vercel Deploy Button을 사용하면 몇 번의 클릭으로 자신만의 OTU를 배포할 수 있습니다.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fopentutorials-org%2Fotu.oss&project-name=otu&repository-name=otu&integration-ids=oac_VqOgBHqhEoFTPzGkPd7L0iH6&external-id=https%3A%2F%2Fgithub.com%2Fopentutorials-org%2Fotu.oss%2Ftree%2Fmain)

**배포 과정:**

1. 위 버튼을 클릭합니다
2. GitHub 저장소가 자동으로 포크됩니다
3. Supabase Integration이 연결되면 데이터베이스가 자동 설정됩니다
4. 배포가 완료되면 나만의 OTU가 실행됩니다

> **참고**: Supabase Integration이 환경변수를 자동 설정하지 못하는 경우가 있습니다 ([알려진 이슈](https://github.com/supabase/supabase/issues/18172)). 이 경우 Vercel Dashboard > Project > Settings > Environment Variables에서 Supabase 키를 수동으로 입력하세요. 필요한 값은 Supabase Dashboard > Project Settings > API에서 확인할 수 있습니다.

**배포 후 선택 설정:**

이미지 업로드와 AI 기능을 사용하려면 각 서비스에서 API 키를 발급받아 Vercel 환경변수에 추가해야 합니다. Vercel Dashboard > Project > Settings > Environment Variables에서 입력합니다.

<details>
<summary><strong>이미지 업로드 (Uploadcare)</strong></summary>

1. [Uploadcare](https://uploadcare.com)에 가입합니다
2. 대시보드에서 프로젝트를 생성합니다
3. **API Keys** 페이지에서 Public Key와 Secret Key를 복사합니다
4. Vercel 환경변수에 추가합니다:
    - `NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY` = Public Key
    - `UPLOADCARE_PRIVATE_KEY` = Secret Key
5. Vercel에서 재배포합니다 (Deployments > Redeploy)

</details>

<details>
<summary><strong>AI 기능 (OpenAI)</strong></summary>

1. [OpenAI Platform](https://platform.openai.com)에 가입합니다
2. **API Keys** 페이지에서 새 키를 생성합니다
3. Vercel 환경변수에 추가합니다:
    - `OPENAI_API_KEY` = 발급받은 API 키 (`sk-...`)
4. Vercel에서 재배포합니다 (Deployments > Redeploy)

> AI 기능: 채팅, 제목 자동 생성, 이미지 분석, RAG 기반 스마트 검색

</details>

### B. 개발: 로컬 환경 설정하기

코드를 수정하거나 기여하려면 로컬 개발 환경을 설정합니다.

**요구사항**: Node.js v20.5.0+, Docker

#### AI 에이전트로 설치하기

Claude Code, Cursor, Windsurf 등을 사용한다면:

```
다음 설치 가이드를 따라 OTU 프로젝트를 설치하고 설정해줘:
https://raw.githubusercontent.com/opentutorials-org/otu.oss/main/docs/installation.md
```

#### 직접 설치하기

```bash
# 1. 저장소 클론
git clone https://github.com/opentutorials-org/otu.oss.git
cd otu.oss

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.template .env.local

# 4. 로컬 Supabase 시작 (Docker 필요)
npx supabase start
```

Supabase가 시작되면 출력되는 키를 `.env.local`에 입력합니다:

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

[http://localhost:3000](http://localhost:3000)에서 확인합니다. `/signin`에서 이메일 로그인을 사용할 수 있습니다.

**상세 설정** (OAuth, 모바일 테스트, AI 기능 등): [docs/installation.md](docs/installation.md)

## 주요 명령어

```bash
npm run dev              # 개발 서버
npm run build            # 프로덕션 빌드
npm test                 # Jest 단위 테스트
npm run test:e2e         # Playwright E2E 테스트
npm run db-sync          # 로컬 DB 초기화 및 타입 생성
npm run prettier         # 코드 포맷팅
npm run type-check       # TypeScript 타입 체크
```

## 기여하기

프로젝트에 기여하는 방법은 [기여 가이드](docs/CONTRIBUTING.md)를 참고하세요.

- **브랜치 전략**: `main`에서 직접 작업하지 않고, `feature/*` 브랜치에서 작업 후 PR을 생성합니다.

## 라이선스

[MIT License](LICENSE) - 누구나 자유롭게 사용, 수정, 배포할 수 있습니다.
