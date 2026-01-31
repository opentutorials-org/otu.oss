const nextJest = require('next/jest');

const createJestConfig = nextJest({
    // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
    dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    testEnvironment: 'jsdom',
    moduleNameMapper: {
        '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
        '^@/components/(.*)$': '<rootDir>/src/components/$1',
        '^@/functions/(.*)$': '<rootDir>/src/functions/$1',
        '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
        '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
        '^@/watermelondb$': '<rootDir>/src/watermelondb',
        '^@/watermelondb/(.*)$': '<rootDir>/src/watermelondb/$1',
        '^@/debug/(.*)$': '<rootDir>/src/debug/$1',
        '^@/types$': '<rootDir>/src/types/index',
        '^@/types/(.*)$': '<rootDir>/src/types/$1',
        '^@/constants$': '<rootDir>/src/constants',
        '^@/i18n$': '<rootDir>/src/i18n',
        '^@/i18n-server$': '<rootDir>/src/i18n-server',
        '^@/(.*)$': '<rootDir>/$1',
        '^next-intl/server$': '<rootDir>/src/test/mocks/next-intl-server.ts',
    },
    testMatch: [
        '**/__tests__/**/*.test.ts',
        '**/__tests__/**/*.test.tsx',
        '**/*.test.ts',
        '**/*.test.tsx',
    ],
    // DB 의존 통합 테스트 제외 (npm run test:integration으로 별도 실행)
    // 오픈소스 환경에서는 Supabase 없이 기본 테스트 실행 가능해야 함
    testPathIgnorePatterns: [
        '/node_modules/',
        '\.integration\.test\.',
        'sync-database\.test\.ts',
        'route\.next_alarm_time_update\.test\.ts',
        'route\.reminder_processed_at_concurrency\.test\.ts',
        'updateNotificationIdsBatch\.test\.ts',
        'calculate_progressive_interval\.test\.ts',
        'withdraw/route\.test\.ts',
    ],
    testTimeout: 30000, // 30초
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = async () => {
    const jestConfig = await createJestConfig(customJestConfig)();
    // ESM 패키지를 변환하도록 transformIgnorePatterns 수정
    jestConfig.transformIgnorePatterns = [
        '/node_modules/(?!(p-map)/)',
        '^.+\\.module\\.(css|sass|scss)$',
    ];
    return jestConfig;
};
