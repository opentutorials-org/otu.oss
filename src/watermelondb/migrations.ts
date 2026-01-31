/**
 * WatermelonDB 마이그레이션 파일
 *
 * 오픈소스 버전은 신규 설치 기준이므로 마이그레이션이 비어 있습니다.
 * WatermelonDB에서 toVersion: 1 마이그레이션은 지원되지 않습니다.
 * 버전 1은 스키마 자체가 초기 상태이므로 schema.ts만으로 테이블이 생성됩니다.
 *
 * 마이그레이션 추가 방법:
 * 1. schema.ts의 version을 1 증가 (예: 1 → 2)
 * 2. 이 파일의 migrations 배열에 새 마이그레이션 객체 추가 (toVersion: 2)
 *
 * @see https://watermelondb.dev/docs/Advanced/Migrations
 */
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
    migrations: [
        // 버전 1은 초기 스키마이므로 마이그레이션이 필요 없습니다.
        // 스키마 변경 시 여기에 toVersion: 2 이상의 마이그레이션을 추가하세요.
    ],
});
