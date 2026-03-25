/**
 * @jest-environment node
 */
import {
    getSupabaseConfig,
    isSupabaseConfigured,
    SUPABASE_NOT_CONFIGURED_MESSAGE,
} from '../config';

describe('supabase/utils/config', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('getSupabaseConfig', () => {
        it('should return config when both env vars are set', () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

            const config = getSupabaseConfig();
            expect(config).toEqual({
                url: 'https://test.supabase.co',
                anonKey: 'test-anon-key',
            });
        });

        it('should return null when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

            expect(getSupabaseConfig()).toBeNull();
        });

        it('should return null when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
            delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

            expect(getSupabaseConfig()).toBeNull();
        });

        it('should return null when both env vars are missing', () => {
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

            expect(getSupabaseConfig()).toBeNull();
        });

        it('should return null when env vars are empty strings', () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = '';
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';

            expect(getSupabaseConfig()).toBeNull();
        });
    });

    describe('isSupabaseConfigured', () => {
        it('should return true when configured', () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

            expect(isSupabaseConfigured()).toBe(true);
        });

        it('should return false when not configured', () => {
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

            expect(isSupabaseConfigured()).toBe(false);
        });
    });

    describe('SUPABASE_NOT_CONFIGURED_MESSAGE', () => {
        it('should contain guidance about required env vars', () => {
            expect(SUPABASE_NOT_CONFIGURED_MESSAGE).toContain('NEXT_PUBLIC_SUPABASE_URL');
            expect(SUPABASE_NOT_CONFIGURED_MESSAGE).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
        });
    });
});
