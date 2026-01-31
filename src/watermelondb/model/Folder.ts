import { Model } from '@nozbe/watermelondb';
import { field, text, readonly, date } from '@nozbe/watermelondb/decorators';
import { shouldUseDecorators } from '@/utils/environment';

export default class Folder extends Model {
    static table = 'folder';

    constructor(collection: any, raw: any) {
        super(collection, raw);

        // Turbopack 환경에서만 동적으로 모든 필드의 getter/setter 정의
        if (!shouldUseDecorators()) {
            // name
            Object.defineProperty(this, 'name', {
                get: function () {
                    const value = (this._raw as any).name || '';
                    return value;
                },
                set: function (value: string) {
                    (this._raw as any).name = value;
                },
                enumerable: true,
                configurable: true,
            });

            // description
            Object.defineProperty(this, 'description', {
                get: function () {
                    const value = (this._raw as any).description || '';
                    return value;
                },
                set: function (value: string) {
                    (this._raw as any).description = value;
                },
                enumerable: true,
                configurable: true,
            });

            // thumbnail_url
            Object.defineProperty(this, 'thumbnail_url', {
                get: function () {
                    const value = (this._raw as any).thumbnail_url || '';
                    return value;
                },
                set: function (value: string) {
                    (this._raw as any).thumbnail_url = value;
                },
                enumerable: true,
                configurable: true,
            });

            // page_count
            Object.defineProperty(this, 'page_count', {
                get: function () {
                    const value = (this._raw as any).page_count || 0;
                    return value;
                },
                set: function (value: number) {
                    (this._raw as any).page_count = value;
                },
                enumerable: true,
                configurable: true,
            });

            // createdAt
            Object.defineProperty(this, 'createdAt', {
                get: function () {
                    const value = (this._raw as any).created_at;
                    const dateValue = value ? new Date(value) : new Date();
                    return dateValue;
                },
                set: function (value: Date | number | string) {
                    if (value instanceof Date) {
                        (this._raw as any).created_at = value.getTime();
                    } else if (typeof value === 'number') {
                        (this._raw as any).created_at = value;
                    } else if (typeof value === 'string') {
                        (this._raw as any).created_at = new Date(value).getTime();
                    } else {
                        (this._raw as any).created_at = Date.now();
                    }
                },
                enumerable: true,
                configurable: true,
            });

            // updatedAt
            Object.defineProperty(this, 'updatedAt', {
                get: function () {
                    const value = (this._raw as any).updated_at;
                    const dateValue = value ? new Date(value) : new Date();
                    return dateValue;
                },
                set: function (value: Date | number | string) {
                    if (value instanceof Date) {
                        (this._raw as any).updated_at = value.getTime();
                    } else if (typeof value === 'number') {
                        (this._raw as any).updated_at = value;
                    } else if (typeof value === 'string') {
                        (this._raw as any).updated_at = new Date(value).getTime();
                    } else {
                        (this._raw as any).updated_at = Date.now();
                    }
                },
                enumerable: true,
                configurable: true,
            });

            // last_page_added_at
            Object.defineProperty(this, 'last_page_added_at', {
                get: function () {
                    const value = (this._raw as any).last_page_added_at || 0;
                    return value;
                },
                set: function (value: Date | number | string | null) {
                    if (value === null || value === undefined) {
                        (this._raw as any).last_page_added_at = 0;
                    } else if (value instanceof Date) {
                        (this._raw as any).last_page_added_at = value.getTime();
                    } else if (typeof value === 'number') {
                        (this._raw as any).last_page_added_at = value;
                    } else if (typeof value === 'string') {
                        (this._raw as any).last_page_added_at = value
                            ? new Date(value).getTime()
                            : 0;
                    } else {
                        (this._raw as any).last_page_added_at = 0;
                    }
                },
                enumerable: true,
                configurable: true,
            });

            // user_id
            Object.defineProperty(this, 'user_id', {
                get: function () {
                    const value = (this._raw as any).user_id || '';
                    return value;
                },
                set: function (value: string) {
                    (this._raw as any).user_id = value;
                },
                enumerable: true,
                configurable: true,
            });
        }
    }

    @text('name') name!: string;

    @text('description') description!: string;

    @text('thumbnail_url') thumbnail_url!: string;

    @field('page_count') page_count!: number;

    @date('created_at') createdAt!: Date;

    @date('updated_at') updatedAt!: Date;

    @field('last_page_added_at') last_page_added_at!: number;

    @field('user_id') user_id!: string;
}
