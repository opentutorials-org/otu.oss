/**
 * WatermelonDB 마이그레이션 파일
 *
 * 오픈소스 버전은 신규 설치 기준이므로 단일 마이그레이션으로 통합되어 있습니다.
 * 스키마 버전 1로 시작하여 모든 테이블을 한 번에 생성합니다.
 *
 * 마이그레이션 추가 방법:
 * 1. schema.ts의 version을 1 증가
 * 2. 이 파일의 migrations 배열에 새 마이그레이션 객체 추가
 *
 * @see https://watermelondb.dev/docs/Advanced/Migrations
 */
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
    migrations: [
        // 스키마 버전 1은 초기 스키마입니다.
        // schema.ts의 appSchema가 모든 테이블을 정의하므로 마이그레이션이 필요 없습니다.
        // WatermelonDB에서 마이그레이션의 최소 toVersion은 2입니다.
        //
        // 새 마이그레이션 추가 시:
        // 1. schema.ts의 version을 N+1로 증가
        // 2. 여기에 { toVersion: N+1, steps: [...] } 추가
    ],
});
