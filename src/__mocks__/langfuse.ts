/**
 * langfuse SDK 경량 모킹 (#143)
 *
 * CI 워커 OOM 방지를 위해 실제 langfuse SDK(716KB) 대신 이 모듈이 로드됩니다.
 * jest.config.js의 moduleNameMapper에서 'langfuse' → 이 파일로 매핑.
 */

export class Langfuse {
    trace = jest.fn().mockReturnValue({
        id: 'mock-trace-id',
        span: jest.fn(),
        generation: jest.fn(),
        score: jest.fn(),
    });
    generation = jest.fn();
    span = jest.fn();
    score = jest.fn();
    flushAsync = jest.fn().mockResolvedValue(undefined);
    shutdownAsync = jest.fn().mockResolvedValue(undefined);
}
