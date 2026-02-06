# Contributing to OTU

OTU 프로젝트에 기여해 주셔서 감사합니다! 이 문서는 기여 과정을 안내합니다.

## 목차

1. [행동 강령](#행동-강령)
2. [처음 기여하시나요?](#처음-기여하시나요)
3. [시작하기](#시작하기)
4. [개발 환경 설정](#개발-환경-설정)
5. [기여 워크플로우](#기여-워크플로우)
6. [코딩 스타일](#코딩-스타일)
7. [커밋 메시지 규칙](#커밋-메시지-규칙)
8. [Pull Request 가이드](#pull-request-가이드)
9. [이슈 보고](#이슈-보고)

## 행동 강령

이 프로젝트는 [행동 강령](CODE_OF_CONDUCT.md)을 따릅니다. 프로젝트에 참여함으로써 이 규칙을 준수하는 것에 동의하는 것으로 간주됩니다.

## 처음 기여하시나요?

오픈소스에 처음 기여하시는 분들을 환영합니다! 아래 가이드를 따라 첫 번째 기여를 시작해 보세요.

### 시작하기 좋은 이슈

처음 기여하시는 분들은 다음과 같은 이슈를 추천합니다:

- **`good first issue` 라벨**: [Good First Issues](https://github.com/opentutorials-org/otu.oss/labels/good%20first%20issue)에서 초보자에게 적합한 이슈를 찾을 수 있습니다
- **문서 개선**: 오타 수정, 번역 개선, 설명 보완
- **코드 정리**: 사용하지 않는 코드 제거, 간단한 리팩토링
- **테스트 추가**: 기존 기능에 대한 테스트 코드 작성

### 첫 기여 단계별 가이드

#### 1단계: 저장소 Fork

GitHub에서 이 저장소의 오른쪽 상단 "Fork" 버튼을 클릭하여 자신의 계정에 복사합니다.

#### 2단계: 로컬 환경 설정

```bash
# 포크한 저장소 클론
git clone https://github.com/YOUR_USERNAME/otu.oss.git
cd otu.oss

# 원본 저장소를 upstream으로 추가
git remote add upstream https://github.com/opentutorials-org/otu.oss.git

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.template .env.local
```

> **참고**: AI 기능 없이도 대부분의 작업이 가능합니다. `.env.local`에서 `ENABLE_AI=false`로 설정하세요.

#### 3단계: 이슈 선택 및 할당

1. [Good First Issues](https://github.com/opentutorials-org/otu.oss/labels/good%20first%20issue)에서 작업할 이슈를 선택합니다
2. 이슈에 댓글로 "이 이슈를 작업하고 싶습니다"라고 남깁니다
3. 메인테이너가 이슈를 할당해 드립니다

#### 4단계: 브랜치 생성 및 코드 작성

```bash
# 최신 dev 브랜치로 업데이트
git checkout dev
git pull upstream dev

# 새 브랜치 생성
git checkout -b feature/이슈번호-간단한설명

# 코드 작성 후 테스트
npm test
npm run type-check

# 포맷팅 적용 (필수!)
npm run prettier
```

#### 5단계: PR 제출

```bash
# 변경사항 커밋
git add .
git commit -m "feat: 이슈 제목에 맞는 커밋 메시지"

# 포크한 저장소에 푸시
git push origin feature/이슈번호-간단한설명
```

GitHub에서 "Compare & pull request" 버튼을 클릭하여 PR을 생성합니다.

### 도움이 필요하신가요?

- 이슈 댓글로 질문하세요
- [GitHub Discussions](https://github.com/opentutorials-org/otu.oss/discussions)에서 질문하세요
- 작업 중 막히는 부분이 있으면 언제든지 PR을 열고 "WIP" (Work In Progress)라고 표시한 뒤 도움을 요청하세요

## 시작하기

### 기여할 수 있는 방법

- **버그 리포트**: 버그를 발견하면 이슈를 등록해 주세요
- **기능 제안**: 새로운 기능 아이디어를 공유해 주세요
- **코드 기여**: 버그 수정이나 새로운 기능 개발에 참여해 주세요
- **문서 개선**: 문서의 오류 수정이나 내용 보완
- **번역**: 다국어 지원 개선

### 이슈 선택

1. [GitHub Issues](https://github.com/opentutorials-org/otu.oss/issues)에서 작업할 이슈를 선택합니다
2. `good first issue` 라벨이 붙은 이슈는 처음 기여하는 분들에게 적합합니다
3. 작업하기 전에 이슈에 댓글을 남겨 담당자로 지정받으세요

## 개발 환경 설정

상세한 개발 환경 설정 방법은 [설치 가이드](./installation.md)를 참고하세요.

### 주요 npm 스크립트

```bash
npm run dev          # 개발 서버 실행
npm test             # Jest 단위 테스트
npm run type-check   # TypeScript 타입 체크
npm run prettier     # 코드 포맷팅
npm run build        # 프로덕션 빌드
```

## 기여 워크플로우

### 1. 브랜치 생성

```bash
# 최신 dev 브랜치로 업데이트
git checkout dev
git pull upstream dev

# 새 브랜치 생성
git checkout -b feature/이슈번호-간단한설명
# 예: git checkout -b feature/123-add-dark-mode
```

### 브랜치 명명 규칙

- `feature/이슈번호-설명`: 새로운 기능
- `fix/이슈번호-설명`: 버그 수정
- `docs/이슈번호-설명`: 문서 변경
- `refactor/이슈번호-설명`: 리팩토링

### 2. 개발

- 코딩 스타일 가이드를 따릅니다
- 변경사항에 대한 테스트를 작성합니다
- 커밋 메시지 규칙을 따릅니다

### 3. 테스트

```bash
# 단위 테스트
npm test

# 타입 체크
npm run type-check

# 코드 포맷팅
npm run prettier
```

### 4. Pull Request

- `dev` 브랜치로 PR을 생성합니다
- PR 템플릿을 작성합니다
- 코드 리뷰를 기다립니다

## 코딩 스타일

### Prettier 포맷팅 (필수)

이 프로젝트는 Prettier를 사용합니다. 코드 작성 후 반드시 포맷팅을 적용하세요.

```bash
npm run prettier
```

### Prettier 설정

- `printWidth: 100` - 한 줄 최대 100자
- `tabWidth: 4` - 들여쓰기 4칸
- `useTabs: false` - 스페이스 사용
- `semi: true` - 세미콜론 필수
- `singleQuote: true` - 싱글 쿼트 사용
- `trailingComma: 'es5'` - ES5 호환 trailing comma

### TypeScript 컴포넌트 패턴

```typescript
function ComponentName(): JSX.Element {
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = (): void => {
        // 구현
    };

    return <Box sx={{ padding: 2 }}>{/* 콘텐츠 */}</Box>;
}
```

### 다국어 처리

모든 UI 텍스트는 다국어 처리가 필요합니다.

```typescript
import { useLingui } from '@lingui/react/macro';

function MyComponent() {
    const { t } = useLingui();
    return <div>{t`안녕하세요`}</div>;
}
```

## 커밋 메시지 규칙

### 형식

```
<type>: <subject>

<body>
```

### 타입

- `feat`: 새로운 기능
- `fix`: 버그 수정
- `docs`: 문서 변경
- `style`: 코드 포맷팅 (기능 변경 없음)
- `refactor`: 리팩토링
- `test`: 테스트 추가/수정
- `chore`: 빌드, 설정 변경

### 예시

```
feat: 다크 모드 토글 버튼 추가

변경 이유:
- 사용자 요청에 따른 기능 추가

테스트 방법:
1. 설정 페이지로 이동
2. 테마 설정에서 다크 모드 토글
3. 전체 UI가 다크 모드로 변경되는지 확인
```

## Pull Request 가이드

### PR 체크리스트

- [ ] 코드가 프로젝트 스타일 가이드를 따름
- [ ] 모든 테스트가 통과함 (`npm test`)
- [ ] 타입 체크가 통과함 (`npm run type-check`)
- [ ] Prettier 포맷팅이 적용됨 (`npm run prettier`)
- [ ] 필요한 경우 문서가 업데이트됨
- [ ] 커밋 메시지가 규칙을 따름

### 리뷰 프로세스

1. 최소 1명 이상의 승인이 필요합니다
2. CI 검사가 모두 통과해야 합니다
3. 리뷰어의 피드백을 반영해 주세요

## 이슈 보고

### 버그 리포트

버그를 발견하면 [버그 리포트 템플릿](https://github.com/opentutorials-org/otu.oss/issues/new?template=bug_report.yml)을 사용하여 이슈를 등록해 주세요.

포함할 정보:

- 버그 설명
- 재현 단계
- 예상 동작
- 실제 동작
- 환경 정보 (브라우저, OS 등)
- 스크린샷 (해당되는 경우)

### 기능 제안

새로운 기능을 제안하려면 [기능 요청 템플릿](https://github.com/opentutorials-org/otu.oss/issues/new?template=feature_request.yml)을 사용해 주세요.

## 질문이 있으신가요?

- [GitHub Discussions](https://github.com/opentutorials-org/otu.oss/discussions)에서 질문해 주세요
- 이슈 댓글로 질문해 주세요

---

기여해 주셔서 감사합니다!
