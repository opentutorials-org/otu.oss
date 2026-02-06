// LinguiJS 전역 모킹 (통합 테스트용)
jest.mock('@/lib/lingui', () => ({
    getServerI18n: jest.fn().mockResolvedValue({
        _: (descriptor) =>
            typeof descriptor === 'string' ? descriptor : descriptor.id || 'translated',
    }),
}));

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
process.env.NEXT_PUBLIC_HOST = 'http://localhost:3000';
process.env.NODE_ENV = 'test';

// TextEncoder/TextDecoder polyfill (모든 환경에서 필요)
const { TextEncoder, TextDecoder } = require('util');
if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;

// crypto polyfill (Node.js 환경에서만 필요)
if (typeof global.crypto === 'undefined') {
    const { webcrypto } = require('node:crypto');
    global.crypto = webcrypto;
}

// Import @testing-library/jest-dom for additional matchers
require('@testing-library/jest-dom');

// Add any global test setup here
beforeAll(() => {
    // Global setup before all tests
});

afterAll(() => {
    // Global cleanup after all tests
});
