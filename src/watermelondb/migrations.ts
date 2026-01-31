// https://watermelondb.dev/docs/Advanced/Migrations
import { addColumns, createTable, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';
export default schemaMigrations({
    migrations: [
        {
            toVersion: 2,
            steps: [
                createTable({
                    name: 'page_offline',
                    columns: [
                        { name: 'title', type: 'string', isOptional: true },
                        { name: 'body', type: 'string', isOptional: true },
                        { name: 'is_public', type: 'boolean', isOptional: true },
                        { name: 'child_count', type: 'number', isOptional: true },
                        { name: 'parent_count', type: 'number', isOptional: true },
                        { name: 'last_viewed_at', type: 'number', isOptional: true },
                        { name: 'img_url', type: 'string', isOptional: true },
                        { name: 'length', type: 'number', isOptional: true },
                        { name: 'created_at', type: 'number' },
                        { name: 'updated_at', type: 'number' },
                    ],
                }),
                createTable({
                    name: 'page',
                    columns: [
                        { name: 'title', type: 'string', isOptional: true },
                        { name: 'body', type: 'string', isOptional: true },
                        { name: 'is_public', type: 'boolean', isOptional: true },
                        { name: 'child_count', type: 'number', isOptional: true },
                        { name: 'parent_count', type: 'number', isOptional: true },
                        { name: 'last_viewed_at', type: 'number', isOptional: true },
                        { name: 'img_url', type: 'string', isOptional: true },
                        { name: 'length', type: 'number', isOptional: true },
                        { name: 'created_at', type: 'number' },
                        { name: 'updated_at', type: 'number' },
                    ],
                }),
            ],
        },
        {
            toVersion: 3,
            steps: [
                addColumns({
                    table: 'page',
                    columns: [
                        { name: 'user_id', type: 'string' },
                        { name: 'type', type: 'string' },
                    ],
                }),
                addColumns({
                    table: 'page_offline',
                    columns: [
                        { name: 'user_id', type: 'string' },
                        { name: 'type', type: 'string' },
                    ],
                }),
            ],
        },
        // 테이블 삭제에 관한 마이그레이션
        // WatermelonDB는 테이블을 삭제하는 직접적인 마이그레이션 기능을 제공하지 않습니다.
        // 테이블을 삭제하기 위한 적절한 방법은 다음과 같습니다:
        // 1. 스키마 파일(schema.ts)에서 테이블 정의를 제거
        // 2. 스키마 버전을 증가
        // 3. 마이그레이션 파일에 해당 버전에 대한 빈 마이그레이션 추가
        //
        // SQLite 어댑터를 사용하는 경우 아래와 같이 unsafeExecuteSql을 사용하여 직접 DROP TABLE
        // 명령을 실행할 수도 있지만, LokiJS 어댑터(현재 사용 중)에서는 작동하지 않습니다:
        // import { unsafeExecuteSql } from '@nozbe/watermelondb/Schema/migrations'
        // steps: [
        //   unsafeExecuteSql('DROP TABLE IF EXISTS backup_page;')
        // ]
        {
            toVersion: 4,
            steps: [], // backup_page 테이블이 schema.ts에서 제거되었으므로 빈 마이그레이션으로 처리
        },
        {
            toVersion: 5,
            steps: [
                // folder 테이블 생성
                createTable({
                    name: 'folder',
                    columns: [
                        { name: 'name', type: 'string' },
                        { name: 'description', type: 'string', isOptional: true },
                        { name: 'thumbnail_url', type: 'string', isOptional: true },
                        { name: 'page_count', type: 'number', isOptional: true },
                        { name: 'created_at', type: 'number' },
                        { name: 'updated_at', type: 'number' },
                        { name: 'last_page_added_at', type: 'number', isOptional: true },
                        { name: 'user_id', type: 'string' },
                    ],
                }),
                // page 테이블에 folder_id 컬럼 추가
                addColumns({
                    table: 'page',
                    columns: [{ name: 'folder_id', type: 'string', isOptional: true }],
                }),
                // page_offline 테이블에 folder_id 컬럼 추가
                addColumns({
                    table: 'page_offline',
                    columns: [{ name: 'folder_id', type: 'string', isOptional: true }],
                }),
            ],
        },
        {
            toVersion: 6,
            steps: [
                // alarm 테이블 생성
                createTable({
                    name: 'alarm',
                    columns: [
                        { name: 'user_id', type: 'string' },
                        { name: 'page_id', type: 'string' },
                        { name: 'content', type: 'string', isOptional: true },
                        { name: 'next_alarm_time', type: 'number' },
                        { name: 'sent_count', type: 'number' },
                        { name: 'last_notification_id', type: 'string', isOptional: true },
                        { name: 'processed_at', type: 'number', isOptional: true },
                        { name: 'created_at', type: 'number' },
                        { name: 'updated_at', type: 'number' },
                    ],
                }),
            ],
        },
    ],
});
