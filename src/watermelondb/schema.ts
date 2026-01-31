/*
1. migrations.ts에 마이그레이션을 정의한다. 
2. schema.ts에 스키마를 정의한다.
3. schmma.ts의 version을 1 증가 시킨다.
*/
import { appSchema, tableSchema } from '@nozbe/watermelondb';
export const schema = appSchema({
    version: 6,
    tables: [
        tableSchema({
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
                { name: 'user_id', type: 'string' },
                { name: 'type', type: 'string' },
                { name: 'folder_id', type: 'string', isOptional: true },
            ],
        }),
        tableSchema({
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
        tableSchema({
            name: 'alarm',
            columns: [
                { name: 'user_id', type: 'string' },
                { name: 'page_id', type: 'string' },
                { name: 'next_alarm_time', type: 'number', isOptional: true },
                { name: 'sent_count', type: 'number' },
                { name: 'last_notification_id', type: 'string', isOptional: true },
                { name: 'created_at', type: 'number' },
                { name: 'updated_at', type: 'number' },
            ],
        }),
    ],
});
