/**
 * 사용량 한도 체크 테스트 케이스
 *
 * Issue #779: 사용량 체크 기능 점검
 *
 * 이 파일은 사용량 한도 초과 시나리오와 API별 quota 체크 동작을 검증합니다.
 */

import { FREE_PLAN_USAGE_LIMIT, SUBSCRIPTION_USAGE_LIMIT } from '@/functions/constants';

export const target_user = '1941e5bc-2404-433b-9556-c86f5190c07e';

// 한도 근처 사용량 (테스트용)
const NEAR_FREE_LIMIT = FREE_PLAN_USAGE_LIMIT * 0.9; // $0.9
const NEAR_SUB_LIMIT = SUBSCRIPTION_USAGE_LIMIT * 0.9; // $9.0

// 소량 사용 시뮬레이션 (GPT-4o 기준)
const SMALL_USAGE = 0.05; // 약 2000 tokens input + 1000 tokens output
const MEDIUM_USAGE = 0.15; // 약 6000 tokens input + 3000 tokens output
const LARGE_USAGE = 0.5; // 약 20000 tokens input + 10000 tokens output

/**
 * 사용량 한도 테스트 케이스
 */
export const usageQuotaTestCases = {
    // ============================================
    // 무료 플랜 한도 초과 시나리오
    // ============================================

    FREE_PLAN_UNDER_LIMIT: {
        name: '무료 플랜 - 한도 내 사용',
        before: {
            user_id: target_user,
            current_quota: 0.5,
            plan_type: 'FREE',
            status: 'ACTIVE',
            last_reset_date: new Date().toISOString(),
            next_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        usage: SMALL_USAGE,
        expect: {
            current_quota: 0.55,
            status: 'ACTIVE',
            shouldAllowApiCall: true,
        },
    },

    FREE_PLAN_NEAR_LIMIT: {
        name: '무료 플랜 - 한도 임박',
        before: {
            user_id: target_user,
            current_quota: NEAR_FREE_LIMIT,
            plan_type: 'FREE',
            status: 'ACTIVE',
            last_reset_date: new Date().toISOString(),
            next_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        usage: SMALL_USAGE,
        expect: {
            current_quota: NEAR_FREE_LIMIT + SMALL_USAGE,
            status: 'ACTIVE',
            shouldAllowApiCall: true,
        },
    },

    FREE_PLAN_EXCEED_LIMIT: {
        name: '무료 플랜 - 한도 초과',
        before: {
            user_id: target_user,
            current_quota: NEAR_FREE_LIMIT,
            plan_type: 'FREE',
            status: 'ACTIVE',
            last_reset_date: new Date().toISOString(),
            next_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        usage: MEDIUM_USAGE, // 0.9 + 0.15 = 1.05 > 1.0
        expect: {
            current_quota: NEAR_FREE_LIMIT + MEDIUM_USAGE,
            status: 'INACTIVE_FREE_USAGE_EXCEEDED',
            shouldAllowApiCall: false,
        },
    },

    FREE_PLAN_ALREADY_EXCEEDED: {
        name: '무료 플랜 - 이미 한도 초과 상태',
        before: {
            user_id: target_user,
            current_quota: 1.2,
            plan_type: 'FREE',
            status: 'INACTIVE_FREE_USAGE_EXCEEDED',
            last_reset_date: new Date().toISOString(),
            next_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        usage: SMALL_USAGE,
        expect: {
            // checkQuota에서 차단되어야 하므로 사용량은 변하지 않음
            current_quota: 1.2,
            status: 'INACTIVE_FREE_USAGE_EXCEEDED',
            shouldAllowApiCall: false,
            expectedError: {
                cause: 'INACTIVE_FREE_USAGE_EXCEEDED',
                messagePattern: /월간 사용량이 초과되었습니다/,
            },
        },
    },

    // ============================================
    // 유료 플랜 한도 초과 시나리오
    // ============================================

    SUB_PLAN_UNDER_LIMIT: {
        name: '유료 플랜 - 한도 내 사용',
        before: {
            user_id: target_user,
            current_quota: 5.0,
            plan_type: 'MONTHLY',
            status: 'ACTIVE',
            last_reset_date: new Date().toISOString(),
            next_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        usage: LARGE_USAGE,
        expect: {
            current_quota: 5.5,
            status: 'ACTIVE',
            shouldAllowApiCall: true,
        },
    },

    SUB_PLAN_NEAR_LIMIT: {
        name: '유료 플랜 - 한도 임박',
        before: {
            user_id: target_user,
            current_quota: NEAR_SUB_LIMIT,
            plan_type: 'MONTHLY',
            status: 'ACTIVE',
            last_reset_date: new Date().toISOString(),
            next_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        usage: SMALL_USAGE,
        expect: {
            current_quota: NEAR_SUB_LIMIT + SMALL_USAGE,
            status: 'ACTIVE',
            shouldAllowApiCall: true,
        },
    },

    SUB_PLAN_EXCEED_LIMIT: {
        name: '유료 플랜 - 한도 초과',
        before: {
            user_id: target_user,
            current_quota: 9.9, // 9.0 -> 9.9로 변경하여 한도를 확실히 넘도록 수정
            plan_type: 'MONTHLY',
            status: 'ACTIVE',
            last_reset_date: new Date().toISOString(),
            next_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        usage: LARGE_USAGE, // 9.9 + 0.5 = 10.4 > 10.0
        expect: {
            current_quota: 9.9 + LARGE_USAGE,
            status: 'INACTIVE_SUBSCRIPTION_USAGE_EXCEEDED',
            shouldAllowApiCall: false,
        },
    },

    SUB_PLAN_ALREADY_EXCEEDED: {
        name: '유료 플랜 - 이미 한도 초과 상태',
        before: {
            user_id: target_user,
            current_quota: 12.0,
            plan_type: 'MONTHLY',
            status: 'INACTIVE_SUBSCRIPTION_USAGE_EXCEEDED',
            last_reset_date: new Date().toISOString(),
            next_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        usage: SMALL_USAGE,
        expect: {
            current_quota: 12.0,
            status: 'INACTIVE_SUBSCRIPTION_USAGE_EXCEEDED',
            shouldAllowApiCall: false,
            expectedError: {
                cause: 'INACTIVE_SUBSCRIPTION_USAGE_EXCEEDED',
                messagePattern: /월간 사용량이 초과되었습니다/,
            },
        },
    },

    // ============================================
    // 경계값 테스트
    // ============================================

    FREE_PLAN_EXACT_LIMIT: {
        name: '무료 플랜 - 정확히 한도까지 사용',
        before: {
            user_id: target_user,
            current_quota: 0.95,
            plan_type: 'FREE',
            status: 'ACTIVE',
            last_reset_date: new Date().toISOString(),
            next_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        usage: 0.05, // 정확히 1.0
        expect: {
            current_quota: 1.0,
            status: 'ACTIVE', // 같을 때는 ACTIVE
            shouldAllowApiCall: true,
        },
    },

    FREE_PLAN_JUST_OVER_LIMIT: {
        name: '무료 플랜 - 한도 바로 초과',
        before: {
            user_id: target_user,
            current_quota: 1.0,
            plan_type: 'FREE',
            status: 'ACTIVE',
            last_reset_date: new Date().toISOString(),
            next_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        usage: 0.01, // 1.01 > 1.0
        expect: {
            current_quota: 1.01,
            status: 'INACTIVE_FREE_USAGE_EXCEEDED',
            shouldAllowApiCall: false,
        },
    },

    SUB_PLAN_EXACT_LIMIT: {
        name: '유료 플랜 - 정확히 한도까지 사용',
        before: {
            user_id: target_user,
            current_quota: 9.95,
            plan_type: 'MONTHLY',
            status: 'ACTIVE',
            last_reset_date: new Date().toISOString(),
            next_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        usage: 0.05, // 정확히 10.0
        expect: {
            current_quota: 10.0,
            status: 'ACTIVE',
            shouldAllowApiCall: true,
        },
    },

    SUB_PLAN_JUST_OVER_LIMIT: {
        name: '유료 플랜 - 한도 바로 초과',
        before: {
            user_id: target_user,
            current_quota: 10.0,
            plan_type: 'MONTHLY',
            status: 'ACTIVE',
            last_reset_date: new Date().toISOString(),
            next_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        usage: 0.01, // 10.01 > 10.0
        expect: {
            current_quota: 10.01,
            status: 'INACTIVE_SUBSCRIPTION_USAGE_EXCEEDED',
            shouldAllowApiCall: false,
        },
    },

    // ============================================
    // 특수 케이스
    // ============================================

    EXPIRED_AUTO_RENEW_FAIL: {
        name: '구독 갱신 실패 - API 호출 차단',
        before: {
            user_id: target_user,
            current_quota: 5.0,
            plan_type: 'MONTHLY',
            status: 'INACTIVE_EXPIRED_AUTO_RENEW_FAIL',
            last_reset_date: new Date().toISOString(),
            next_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        usage: SMALL_USAGE,
        expect: {
            current_quota: 5.0, // checkQuota에서 차단
            status: 'INACTIVE_EXPIRED_AUTO_RENEW_FAIL',
            shouldAllowApiCall: false,
            expectedError: {
                cause: 'INACTIVE_EXPIRED_AUTO_RENEW_FAIL',
                messagePattern: /구독 갱신에 실패했습니다/,
            },
        },
    },

    ZERO_USAGE: {
        name: '사용량 0 - 새 사용자',
        before: {
            user_id: target_user,
            current_quota: 0,
            plan_type: 'FREE',
            status: 'ACTIVE',
            last_reset_date: new Date().toISOString(),
            next_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        usage: SMALL_USAGE,
        expect: {
            current_quota: SMALL_USAGE,
            status: 'ACTIVE',
            shouldAllowApiCall: true,
        },
    },

    PLAN_UPGRADE_DURING_EXCEEDED: {
        name: '한도 초과 후 플랜 업그레이드',
        before: {
            user_id: target_user,
            current_quota: 1.5, // 무료 한도 초과
            plan_type: 'FREE',
            status: 'INACTIVE_FREE_USAGE_EXCEEDED',
            last_reset_date: new Date().toISOString(),
            next_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        // 플랜 업그레이드 시뮬레이션 (webhook에서 처리)
        planChange: {
            new_plan_type: 'MONTHLY',
            reset_quota: false, // 사용량 유지
        },
        expect: {
            current_quota: 1.5, // 사용량 유지
            plan_type: 'MONTHLY',
            status: 'ACTIVE', // 유료 한도(10.0) 내로 복구
            shouldAllowApiCall: true,
        },
    },
};

/**
 * API별 checkQuota 동작 테스트 케이스
 */
export const apiQuotaCheckTestCases = {
    CHAT_API_WITH_QUOTA_CHECK: {
        name: 'AI 채팅 - checkQuota 정상 동작',
        api: '/api/ai/askLLM/openai',
        before: {
            user_id: target_user,
            current_quota: 1.2,
            plan_type: 'FREE',
            status: 'INACTIVE_FREE_USAGE_EXCEEDED',
            last_reset_date: new Date().toISOString(),
            next_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        expect: {
            shouldBlockBeforeCall: true,
            httpStatus: 429,
            errorType: 'quota_exceeded',
        },
    },

    TITLING_API_WITH_QUOTA_CHECK: {
        name: '자동 제목 - checkQuota 동작 (수정 후)',
        api: '/api/ai/titling',
        before: {
            user_id: target_user,
            current_quota: 1.2,
            plan_type: 'FREE',
            status: 'INACTIVE_FREE_USAGE_EXCEEDED',
            last_reset_date: new Date().toISOString(),
            next_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        expect: {
            shouldBlockBeforeCall: true,
            httpStatus: 429,
            errorType: 'quota_exceeded',
        },
    },

    CAPTIONING_API_WITH_QUOTA_CHECK: {
        name: '이미지 캡션 - checkQuota 동작 (수정 후)',
        api: '/api/ai/captioning',
        before: {
            user_id: target_user,
            current_quota: 1.2,
            plan_type: 'FREE',
            status: 'INACTIVE_FREE_USAGE_EXCEEDED',
            last_reset_date: new Date().toISOString(),
            next_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        expect: {
            shouldBlockBeforeCall: true,
            httpStatus: 429,
            errorType: 'quota_exceeded',
        },
    },
};

/**
 * 동시성 테스트 케이스
 */
export const concurrencyTestCases = {
    MULTIPLE_API_CALLS_SEQUENTIAL: {
        name: '순차적 다중 API 호출',
        before: {
            user_id: target_user,
            current_quota: 0.5,
            plan_type: 'FREE',
            status: 'ACTIVE',
            last_reset_date: new Date().toISOString(),
            next_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        apiCalls: [
            { api: '/api/ai/askLLM/openai', usage: 0.1 },
            { api: '/api/ai/titling', usage: 0.05 },
            { api: '/api/ai/captioning', usage: 0.2 },
        ],
        expect: {
            current_quota: 0.85, // 0.5 + 0.1 + 0.05 + 0.2
            status: 'ACTIVE',
            allCallsSucceeded: true,
        },
    },

    MULTIPLE_API_CALLS_EXCEED_DURING: {
        name: '다중 API 호출 중 한도 초과',
        before: {
            user_id: target_user,
            current_quota: 0.8,
            plan_type: 'FREE',
            status: 'ACTIVE',
            last_reset_date: new Date().toISOString(),
            next_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        apiCalls: [
            { api: '/api/ai/askLLM/openai', usage: 0.1 }, // 0.9 - OK
            { api: '/api/ai/titling', usage: 0.05 }, // 0.95 - OK
            { api: '/api/ai/captioning', usage: 0.2 }, // 1.15 > 1.0 - EXCEEDED
            { api: '/api/ai/askLLM/openai', usage: 0.1 }, // BLOCKED
        ],
        expect: {
            current_quota: 1.15,
            status: 'INACTIVE_FREE_USAGE_EXCEEDED',
            successfulCalls: 3,
            blockedCalls: 1,
        },
    },

    CONCURRENT_API_CALLS: {
        name: '동시 API 호출 - set_quota 트랜잭션 검증',
        before: {
            user_id: target_user,
            current_quota: 0.5,
            plan_type: 'FREE',
            status: 'ACTIVE',
            last_reset_date: new Date().toISOString(),
            next_reset_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        apiCalls: [
            { api: '/api/ai/askLLM/openai', usage: 0.15, concurrent: true },
            { api: '/api/ai/titling', usage: 0.1, concurrent: true },
            { api: '/api/ai/captioning', usage: 0.2, concurrent: true },
        ],
        expect: {
            current_quota: 0.95, // 0.5 + 0.15 + 0.1 + 0.2
            status: 'ACTIVE',
            // PostgreSQL 트랜잭션으로 정확한 합산 보장
            exactQuotaMatch: true,
        },
    },
};

/**
 * 테스트 헬퍼 함수
 */
export const testHelpers = {
    /**
     * 사용량이 한도를 초과하는지 확인
     */
    isQuotaExceeded(current_quota: number, plan_type: string): boolean {
        const limit = plan_type === 'FREE' ? FREE_PLAN_USAGE_LIMIT : SUBSCRIPTION_USAGE_LIMIT;
        return current_quota > limit;
    },

    /**
     * 예상 상태 계산
     */
    calculateExpectedStatus(
        current_quota: number,
        plan_type: string,
        current_status: string
    ): string {
        // 이미 다른 INACTIVE 상태면 유지
        if (current_status === 'INACTIVE_EXPIRED_AUTO_RENEW_FAIL') {
            return current_status;
        }

        const limit = plan_type === 'FREE' ? FREE_PLAN_USAGE_LIMIT : SUBSCRIPTION_USAGE_LIMIT;

        if (current_quota > limit) {
            return plan_type === 'FREE'
                ? 'INACTIVE_FREE_USAGE_EXCEEDED'
                : 'INACTIVE_SUBSCRIPTION_USAGE_EXCEEDED';
        }

        return 'ACTIVE';
    },

    /**
     * 에러 메시지 포맷 생성
     */
    formatQuotaErrorMessage(next_reset_date: string): string {
        const nextResetDate = new Date(next_reset_date);
        const year = nextResetDate.getFullYear();
        const month = nextResetDate.getMonth() + 1;
        const day = nextResetDate.getDate();
        const daysRemaining = Math.ceil(
            (nextResetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return `월간 사용량이 초과되었습니다. 다음 초기화 일자: ${year}년 ${month}월 ${day}일 (${daysRemaining}일 남음)`;
    },
};

/**
 * 테스트 실행 시나리오
 *
 * 1. 사용량 한도 기본 시나리오 (usageQuotaTestCases)
 *    - 무료/유료 플랜별 한도 초과 테스트
 *    - 경계값 테스트
 *    - 특수 케이스 테스트
 *
 * 2. API별 checkQuota 동작 검증 (apiQuotaCheckTestCases)
 *    - 각 AI API에서 한도 초과 시 올바르게 차단하는지 확인
 *    - HTTP 429 응답 및 에러 타입 검증
 *
 * 3. 동시성 테스트 (concurrencyTestCases)
 *    - 여러 API 순차/동시 호출 시 사용량 정확성
 *    - PostgreSQL set_quota 트랜잭션 보장 검증
 */
