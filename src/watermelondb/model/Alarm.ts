import { Model } from '@nozbe/watermelondb';
import { field, text, readonly, date } from '@nozbe/watermelondb/decorators';
import { shouldUseDecorators } from '@/utils/environment';

export default class Alarm extends Model {
    static table = 'alarm';

    constructor(collection: any, raw: any) {
        super(collection, raw);

        // Turbopack 환경에서만 동적으로 모든 필드의 getter/setter 정의
        if (!shouldUseDecorators()) {
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

            // page_id
            Object.defineProperty(this, 'page_id', {
                get: function () {
                    const value = (this._raw as any).page_id || '';
                    return value;
                },
                set: function (value: string) {
                    (this._raw as any).page_id = value;
                },
                enumerable: true,
                configurable: true,
            });

            // next_alarm_time
            Object.defineProperty(this, 'next_alarm_time', {
                get: function () {
                    const value = (this._raw as any).next_alarm_time || 0;
                    return value;
                },
                set: function (value: Date | number | string | null) {
                    if (value === null || value === undefined) {
                        (this._raw as any).next_alarm_time = 0;
                    } else if (value instanceof Date) {
                        (this._raw as any).next_alarm_time = value.getTime();
                    } else if (typeof value === 'number') {
                        (this._raw as any).next_alarm_time = value;
                    } else if (typeof value === 'string') {
                        (this._raw as any).next_alarm_time = value ? new Date(value).getTime() : 0;
                    } else {
                        (this._raw as any).next_alarm_time = 0;
                    }
                },
                enumerable: true,
                configurable: true,
            });

            // sent_count
            Object.defineProperty(this, 'sent_count', {
                get: function () {
                    const value = (this._raw as any).sent_count || 0;
                    return value;
                },
                set: function (value: number) {
                    (this._raw as any).sent_count = value;
                },
                enumerable: true,
                configurable: true,
            });

            // last_notification_id
            Object.defineProperty(this, 'last_notification_id', {
                get: function () {
                    const value = (this._raw as any).last_notification_id || '';
                    return value;
                },
                set: function (value: string) {
                    (this._raw as any).last_notification_id = value;
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
        }
    }

    // webpack 환경에서만 데코레이터가 작동함
    @field('user_id') user_id!: string;

    @field('page_id') page_id!: string;

    @field('next_alarm_time') next_alarm_time!: number;

    @field('sent_count') sent_count!: number;

    @field('last_notification_id') last_notification_id!: string;

    @date('created_at') createdAt!: Date;

    @date('updated_at') updatedAt!: Date;
}
