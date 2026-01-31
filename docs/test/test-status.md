# 테스트 현황

이 문서는 otu.ai.web 프로젝트의 테스트 코드 현황을 정리합니다.

## 📊 전체 현황

- **테스트 파일**: 22개 (Jest)
- **DB 테스트** (pgTAP):
    - `get_dynamic_pages_chunk` 함수 테스트: 9개
- **통합 테스트** (자체 프레임워크):
    - 미들웨어 통합 테스트: 3개
- **실행 명령어**:
    - `npm test` - Jest 테스트 전체 + DB 테스트
    - `npm run test:middleware` - 미들웨어 통합 테스트

## 🗂️ 테스트 구조

### 1. API 테스트

#### Sync API

**위치**: `app/api/sync/__tests__/*.test.ts`

- `sync-database.test.ts` - WatermelonDB와 Supabase 간 동기화

**위치**: `app/api/sync/pull/all/`

- `route.test.ts` - Pull All API 테스트

**위치**: `app/api/sync/push/`

- `route.folder-page-order.integration.test.ts` - 폴더-페이지 순서 통합 테스트

#### Setting API

**위치**: `app/api/setting/withdraw/`

- `route.test.ts` - 회원 탈퇴 API 전체 플로우

### 2. 컴포넌트 테스트

#### BlockNote 에디터

**위치**: `src/components/common/BlockNoteEditor/__tests__/`

- `BlockNoteWrapper.unmount.test.tsx` - 에디터 언마운트 처리

#### Home 컴포넌트

**위치**: `src/components/home/logined/page/CreateUpdate/components/__tests__/`

- `LinkifiedTitle.test.tsx` - 링크화된 제목 컴포넌트

#### Home2 컴포넌트 (React Router 기반)

**위치**: `src/components/home2/editor/__tests__/`

- `title-auto-generation.test.tsx` - 자동 제목 생성

**위치**: `src/components/home2/sections/__tests__/`

- `section-routing.test.tsx` - 섹션 라우팅

#### Layout 컴포넌트

**위치**: `src/components/layout/__tests__/`

- `Login.oauth.test.tsx` - OAuth 로그인

### 3. 훅 테스트

**위치**: `src/functions/hooks/__tests__/`

- `useSync.concurrent.test.tsx` - 동기화 훅 동시성 테스트

**위치**: `src/hooks/`

- `useReminderList.test.tsx` - 리마인더 목록 훅

### 4. 유틸리티/함수 테스트

#### 사용량 관리

**위치**: `src/functions/usage/__tests__/`

- `usageService.get.test.ts` - 사용량 조회 테스트

#### 유효성 검사

**위치**: `src/functions/validation/__tests__/`

- `textLength.test.ts` - 텍스트 길이 검증

#### 샘플 데이터

**위치**: `src/functions/sample/`

- `seedSamplePageIfNeeded.server.test.ts` - 샘플 페이지 생성

#### 썸네일

**위치**: `src/functions/`

- `thumbnail.test.ts` - 썸네일 처리

### 5. WatermelonDB 테스트

**위치**: `src/watermelondb/`

- `sync.test.ts` - 동기화 로직
- `sync.concurrent.test.ts` - 동시성 동기화

### 6. 기타 테스트

**위치**: `src/__tests__/`

- `pr1223-usertype-removal.test.ts` - PR 관련 테스트
- `snackbar.duplication.test.tsx` - 스낵바 중복 방지
- `theme.navigation.test.ts` - 테마 네비게이션

**위치**: `src/test/`

- `http-429-error-handling.test.ts` - HTTP 429 에러 처리

**위치**: `src/utils/__tests__/`

- `pageCloseHandler.test.ts` - 페이지 닫기 핸들러

### 7. 미들웨어 통합 테스트

**위치**: `src/test/`

- `middleware-webhook-exclusion.test.js` - 미들웨어 제외 검증

**실행 방법**:

```bash
# 개발 서버 실행 필수
npm run dev

# 별도 터미널에서 테스트
npm run test:middleware
```

## 🔧 테스트 환경

### 설정 파일

- `jest.config.js` - Jest 설정 (타임아웃 30초, jsdom 환경)
- `jest.setup.js` - 환경 변수 및 polyfill 설정

### 환경 변수

테스트용 환경 변수는 `jest.setup.js`에서 자동 설정:

- `NEXT_PUBLIC_SUPABASE_URL`: 로컬 Supabase (localhost:54321)
- `NEXT_PUBLIC_PUSH_SERVICE_APP_ID`: test-app-id

### Mock 전략

- **Supabase**: E2E 테스트는 실제 로컬 Supabase 사용, 단위 테스트는 mock
- **푸시 서비스**: 전체 mock (fetch 오버라이드)
- **WatermelonDB**: observe 로직은 mock 처리, 나머지는 실제 구현 사용

## 🔍 디버깅 및 로깅

### Debug 로거 시스템

프로젝트는 [debug](https://www.npmjs.com/package/debug) 라이브러리를 사용하여 카테고리별 로깅을 지원합니다.

### 사용 가능한 로거

`src/debug/` 디렉토리에 42개 로거 파일:

- `alarm` - 알람 관련 로그
- `sync` - 동기화 관련 로그
- `usage` - 사용량 추적 로그
- `test` - 테스트 관련 로그
- `editor` - 에디터 관련 로그
- 기타 37개 카테고리

### 테스트 시 로거 활성화 방법

기본적으로 모든 테스트는 로그 출력이 억제됩니다 (Jest `--silent` 옵션 사용):

```bash
npm run test  # 모든 console 출력 억제
```

특정 카테고리의 로그만 활성화하려면 `--debug` 플래그 사용:

```bash
# 단일 카테고리
npm run test -- --debug alarm    # alarm 로그만 출력
npm run test -- --debug sync     # sync 로그만 출력
npm run test -- --debug usage    # usage 로그만 출력

# 여러 카테고리 조합 (debug 라이브러리 문법)
npm run test -- --debug "alarm,sync"     # alarm과 sync 로그 출력
npm run test -- --debug "alarm:*"        # alarm 네임스페이스의 모든 로그
npm run test -- --debug "*"              # 모든 로그 출력
```

### 개발 중 로거 활성화

```bash
# 개발 서버 실행 시
DEBUG=alarm,sync,editor npm run dev

# 브라우저 콘솔에서 (클라이언트 로그)
localStorage.debug = 'alarm,sync'
```

### 로거 구현

모든 로거는 `src/debug/` 디렉토리에 정의되어 있으며, [debug](https://www.npmjs.com/package/debug) 라이브러리를 사용합니다.

예시:

```typescript
import { alarmLogger } from '@/debug/alarm';

alarmLogger('알람 갱신 요청 수신', { requestId, timestamp });
```

## 🎯 테스트 전략

### 통합 테스트 (E2E)

- API 테스트는 실제 로컬 Supabase와 연동
- 전체 요청/응답 사이클 검증
- DB 상태 변경 확인

### 단위 테스트

- 훅과 유틸리티 함수는 독립적으로 테스트
- 필요한 모듈만 mock 처리
- 순수 함수 로직 검증

### 동시성 테스트

- Promise.all로 동시 요청 시뮬레이션
- DB 락 메커니즘 검증 (processed_at 기반)
- 중복 처리 방지 확인

## ⚠️ 주의사항

### WatermelonDB 훅 테스트

- observe 로직이 테스트 데이터를 덮어쓸 수 있음
- 반드시 WatermelonDB mock 추가 필요
- 참고: `src/hooks/useReminderList.test.tsx`

### 타임아웃 설정

- 비동기 테스트는 명시적 타임아웃 설정 권장 (3초 이상)
- 기본 1초는 로컬 Supabase 연동 시 부족할 수 있음

### 테스트 데이터 정리

- E2E 테스트는 반드시 try-finally로 cleanup 보장
- 테스트 실패 시에도 데이터 정리되도록 구현

## 🚀 테스트 실행 명령어 요약

```bash
# 기본 테스트 (로그 없음)
npm run test

# 특정 로거 활성화
npm run test -- --debug alarm        # alarm 로그만
npm run test -- --debug sync         # sync 로그만
npm run test -- --debug "*"          # 모든 로그

# 특정 테스트 파일 실행
npm run test -- src/hooks/useReminderList.test.tsx

# 미들웨어 통합 테스트 (개발 서버 실행 필수)
npm run test:middleware

# Watch 모드 (Jest)
npm run test -- --watch
```

---

**마지막 업데이트**: 2026-01-31
**테스트 프레임워크**: Jest 30.0.4 (⚠️ Vitest는 사용하지 않음)

**관련 문서**: [CLAUDE.md](../../CLAUDE.md)
