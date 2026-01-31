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
    migrations: [],
});
