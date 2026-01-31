/**
 * 현재 환경이 프로덕션인지 확인하는 유틸리티 함수
 * @returns 프로덕션 환경이면 true, 아니면 false
 */
export const isProduction = (): boolean => {
    return (
        process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'
    );
};

/**
 * 현재 환경이 개발 환경인지 확인하는 유틸리티 함수
 * @returns 개발 환경이면 true, 아니면 false
 */
export const isDevelopment = (): boolean => {
    return !isProduction();
};

/**
 * Turbopack을 사용 중인지 확인하는 유틸리티 함수
 * 환경변수 TURBOPACK=true로 명시적으로 설정된 경우에만 true 반환
 * @returns Turbopack을 사용 중이면 true, 아니면 false
 */
export const isTurbopack = (): boolean => {
    // 환경변수 기반 감지 (가장 신뢰할 수 있는 방법)
    const envTurbopack = Boolean(process.env.TURBOPACK);
    return envTurbopack;
};

/**
 * WatermelonDB에서 데코레이터를 사용할지 getter/setter를 사용할지 결정
 * @returns 데코레이터를 사용해야 하면 true, getter/setter를 사용해야 하면 false
 */
export const shouldUseDecorators = (): boolean => {
    const useDecorators = !isTurbopack();
    return useDecorators;
};
