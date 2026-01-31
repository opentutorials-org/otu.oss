# 리마인더 시스템 구조

## 개요

리마인더 시스템은 페이지별로 반복 알람을 설정하고, 지수 백오프 방식으로 지속적으로 알림을 보내는 시스템입니다. WatermelonDB 동기화와 독립적으로 작동합니다.

> **오픈소스 버전 참고**: 푸시 알림 전송 기능은 현재 비활성화 상태입니다. 알람 데이터는 DB에 저장되며, 향후 다른 푸시 서비스 통합이 가능한 구조입니다.

## 데이터베이스 구조

### alarm 테이블

페이지별 알람 정보를 저장합니다.

**주요 컬럼**:

- `page_id` (PK): 페이지 식별자
- `user_id`: 사용자 식별자
- `title`: 알림 제목 (페이지 제목에서 추출, 최대 2000자)
- `body`: 알림 본문 (페이지 본문에서 추출, 최대 2000자)
- `next_alarm_time`: 다음 알람 발송 예정 시간
- `sent_count`: 발송 횟수 (지수 백오프 계산에 사용)
- `last_notification_id`: 마지막 푸시 알림 ID
- `processed_at`: 처리 중 상태 마킹 (동시성 제어용)

### user_info 테이블

사용자 시간대 정보를 저장합니다.

**관련 컬럼**:

- `user_id` (unique): 사용자 식별자
- `timezone`: 사용자 시간대 (기본값: 'Asia/Seoul')

## API 엔드포인트

현재 사용 가능한 리마인더 관련 API:

### 1. 등록 (register-by-page)

**API**: `/api/reminder/register-by-page`

- 페이지 ID로 알람 생성 또는 업데이트
- `next_alarm_time = now` (즉시 발송 대상)
- `sent_count = 1`로 초기화 (이미 존재하면 유지)

### 2. 스케줄 (schedule/v2)

**API**: `/api/reminder/schedule/v2`

- 리마인더 스케줄링 관련 API

## 알람 처리 흐름

### 등록 흐름

1. 사용자가 페이지에서 알람 설정
2. `/api/reminder/register-by-page` API 호출
3. alarm 테이블에 레코드 생성/업데이트

### 동기화 중 삭제

WatermelonDB 푸시 단계에서:

- 삭제된 페이지의 알람 레코드를 DB에서 삭제

## 동시성 제어

### DB 레벨 락

```sql
FOR UPDATE SKIP LOCKED
```

- 행 단위 락으로 동시 요청 시 먼저 락을 획득한 프로세스만 처리
- 락 획득 실패 시 해당 알람을 건너뜀 (SKIP LOCKED)

### 앱 레벨 상태 추적

**processed_at 필드**:

- 처리 시작 시 현재 시간으로 마킹
- 처리 완료 후 `NULL`로 초기화
- **좀비 프로세스 복구**: `processed_at` 6시간 초과는 자동 복구 대상

```sql
WHERE (
    processed_at IS NULL OR
    processed_at < p_current_time - INTERVAL '6 hours'
)
```

### 시나리오별 처리

1. **동시 요청**: `FOR UPDATE SKIP LOCKED`로 먼저 락 획득한 프로세스만 처리
2. **좀비 프로세스**: 6시간 초과 시 자동 복구 대상 포함
3. **부분 실패**: `sent_count` 증가하지 않음, `processed_at` 유지 → 6시간 후 재처리 가능

### 오류 시 락 해제

```typescript
private async releaseProcessingLock(pageId: string): Promise<void> {
    await this.supabase
        .from('alarm')
        .update({ processed_at: null })
        .eq('page_id', pageId);
}
```

### 정상 처리 후 필드 업데이트

```typescript
.update({
    next_alarm_time: nextAlarmTime.toISOString(),
    sent_count: alarm.sent_count + 1,
    last_notification_id: notificationId,
    processed_at: null
})
```

## 중복 방지

### DB 레벨

**사용자별 동일 시간대 중복 방지**:

- `resolve_alarm_time_conflict` 함수로 충돌 해결
- 동일 사용자의 다른 알람과 시간이 겹치면 랜덤 시간 추가
- 최대 50회 재시도

### 앱 레벨

**idempotency-key**:

- 알람 ID 기반으로 중복 전송 방지
- 푸시 서비스 API 레벨에서 동일 키 요청 무시

## 모니터링 및 로깅

### 로깅 네임스페이스

- **네임스페이스**: `alarm`
- **활성화**: `localStorage.debug = 'alarm'` (클라이언트) 또는 `DEBUG='alarm'` (서버)
- **로거 함수**: `alarmLogger` (`src/debug/alarm`)

### Sentry 보고

> **선택적 기능**: `NEXT_PUBLIC_ENABLE_SENTRY=true` 설정 시 활성화됩니다.

다음 상황에서 Sentry로 보고:

- 과거 예약건 스킵
- 배치 업데이트 실패
- 푸시 알림 전송 오류
- DB 처리 오류

### 성능 메트릭

- 처리 시간 측정 (`processing_time_ms`)
- 배치 크기별 성능 추적
- 동시성 레벨 모니터링

## 확장성

### 수평 확장

- DB 기반 락으로 인스턴스 간 동기화 불필요
- 자연스러운 작업 분할 (SKIP LOCKED)
- 여러 CRON 인스턴스 동시 실행 가능

### 부하 분산

- 배치 크기 동적 조절 (`fetch_limit` 파라미터)
- 동시성 레벨 조정 (p-map concurrency: 10)
- 실행 시간 모니터링 기반 최적화
