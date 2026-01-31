import { Model } from '@nozbe/watermelondb';
import { field, text, readonly, date } from '@nozbe/watermelondb/decorators';
import { shouldUseDecorators } from '@/utils/environment';

export default class Page extends Model {
    static table = 'page';

    constructor(collection: any, raw: any) {
        super(collection, raw);

        // Turbopack 환경에서만 동적으로 모든 필드의 getter/setter 정의
        if (!shouldUseDecorators()) {
            // title
            Object.defineProperty(this, 'title', {
                get: function () {
                    const value = (this._raw as any).title || '';
                    return value;
                },
                set: function (value: string) {
                    (this._raw as any).title = value;
                },
                enumerable: true,
                configurable: true,
            });

            // body
            Object.defineProperty(this, 'body', {
                get: function () {
                    const value = (this._raw as any).body || '';
                    return value;
                },
                set: function (value: string) {
                    (this._raw as any).body = value;
                },
                enumerable: true,
                configurable: true,
            });

            // is_public
            Object.defineProperty(this, 'is_public', {
                get: function () {
                    const value = (this._raw as any).is_public || false;
                    return value;
                },
                set: function (value: boolean) {
                    (this._raw as any).is_public = value;
                },
                enumerable: true,
                configurable: true,
            });

            // child_count
            Object.defineProperty(this, 'child_count', {
                get: function () {
                    const value = (this._raw as any).child_count || 0;
                    return value;
                },
                set: function (value: number) {
                    (this._raw as any).child_count = value;
                },
                enumerable: true,
                configurable: true,
            });

            // parent_count
            Object.defineProperty(this, 'parent_count', {
                get: function () {
                    const value = (this._raw as any).parent_count || 0;
                    return value;
                },
                set: function (value: number) {
                    (this._raw as any).parent_count = value;
                },
                enumerable: true,
                configurable: true,
            });

            // last_viewed_at
            Object.defineProperty(this, 'last_viewed_at', {
                get: function () {
                    const value = (this._raw as any).last_viewed_at || 0;
                    return value;
                },
                set: function (value: Date | number | string | null) {
                    if (value === null || value === undefined) {
                        (this._raw as any).last_viewed_at = 0;
                    } else if (value instanceof Date) {
                        (this._raw as any).last_viewed_at = value.getTime();
                    } else if (typeof value === 'number') {
                        (this._raw as any).last_viewed_at = value;
                    } else if (typeof value === 'string') {
                        (this._raw as any).last_viewed_at = value ? new Date(value).getTime() : 0;
                    } else {
                        (this._raw as any).last_viewed_at = 0;
                    }
                },
                enumerable: true,
                configurable: true,
            });

            // img_url
            Object.defineProperty(this, 'img_url', {
                get: function () {
                    const value = (this._raw as any).img_url || '';
                    return value;
                },
                set: function (value: string) {
                    (this._raw as any).img_url = value;
                },
                enumerable: true,
                configurable: true,
            });

            // length
            Object.defineProperty(this, 'length', {
                get: function () {
                    const value = (this._raw as any).length || 0;
                    return value;
                },
                set: function (value: number) {
                    (this._raw as any).length = value;
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

            // type
            Object.defineProperty(this, 'type', {
                get: function () {
                    const value = (this._raw as any).type || '';
                    return value;
                },
                set: function (value: string) {
                    (this._raw as any).type = value;
                },
                enumerable: true,
                configurable: true,
            });

            // folder_id
            Object.defineProperty(this, 'folder_id', {
                get: function () {
                    const value = (this._raw as any).folder_id || '';
                    return value;
                },
                set: function (value: string) {
                    (this._raw as any).folder_id = value;
                },
                enumerable: true,
                configurable: true,
            });
        }
    }

    // webpack 환경에서만 데코레이터가 작동함
    @text('title') title!: string;

    @text('body') body!: string;

    @field('is_public') is_public!: boolean;

    @field('child_count') child_count!: number;

    @field('parent_count') parent_count!: number;

    @field('last_viewed_at') last_viewed_at!: number;

    @field('img_url') img_url!: string;

    @field('length') length!: number;

    @date('created_at') createdAt!: Date;

    @date('updated_at') updatedAt!: Date;

    @field('user_id') user_id!: string;

    @field('type') type!: string;

    @field('folder_id') folder_id!: string;
}
