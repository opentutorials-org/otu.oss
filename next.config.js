const createNextIntlPlugin = require('next-intl/plugin');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
    analyzerMode: process.env.ANALYZE_JSON === 'true' ? 'json' : 'static',
    generateStatsFile: true,
    statsFilename: './analyze/stats.json',
    openAnalyzer: process.env.ANALYZE_JSON !== 'true',
});
const { withSentryConfig } = require('@sentry/nextjs');

const fs = require('fs');
const path = require('path');

const { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } = require('next/constants');

const project = process.env.NEXT_PUBLIC_SENTRY_PROJECT || 'dev-otu-ai';

const sentryWebpackPluginOptions = {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    org: 'opentutorials',
    project,

    // Only print logs for uploading source maps in CI
    silent: true,

    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Automatically annotate React components to show their full name in breadcrumbs and session replay
    reactComponentAnnotation: {
        enabled: true,
    },

    // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    // This can increase your server load as well as your hosting bill.
    // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
    // side errors will fail.
    // tunnelRoute: "/monitoring",

    // Hides source maps from generated client bundles
    hideSourceMaps: false,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,

    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,
    sourcemaps: {
        disable: false,
        deleteSourcemapsAfterUpload: true,
    },
};

/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            // Uploadcare legacy global domain (accounts before Sept 4, 2025)
            {
                protocol: 'https',
                hostname: 'ucarecdn.com',
                port: '',
                pathname: '/**',
            },
            // Uploadcare personal subdomains (new projects after Sept 4, 2025)
            {
                protocol: 'https',
                hostname: '*.ucarecd.net',
                port: '',
                pathname: '/**',
            },
            // Uploadcare proxy domains for remote file fetching
            {
                protocol: 'https',
                hostname: '*.ucr.io',
                port: '',
                pathname: '/**',
            },
        ],
    },
    experimental: {
        optimizePackageImports: [
            // UI 라이브러리
            '@emotion/react',
            '@emotion/styled',
            '@mui/material',
            '@mui/icons-material',
            '@mui/lab',
            '@mantine/core',
            '@mantine/hooks',
            '@headlessui/react',
            '@heroicons/react',
            // 애니메이션
            'motion',
            // 유틸리티
            'lodash',
            'dayjs',
            'zod',
            // Supabase
            '@supabase/supabase-js',
            '@supabase/ssr',
        ],
        // SWC 사용 강제 (Babel 비활성화)
        forceSwcTransforms: true,
    },
    transpilePackages: [],
    // Babel 대신 SWC 사용 명시
    allowedDevOrigins: [
        'otu-blackdew-3001.otu.ai',
        'otu-egoing-3000.otu.ai',
        'duru-3000.otu.ai',
        'localhost',
        '127.0.0.1',
    ],
    reactStrictMode: true,
    productionBrowserSourceMaps: false,
};

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const revision = crypto.randomUUID();

const isPwaDisabled = process.env.NEXT_PUBLIC_PWA_DISABLED !== 'false';

/** @type {(phase: string, defaultConfig: import("next").NextConfig) => Promise<import("next").NextConfig>} */
const withSerwistConfig = async (phase) => {
    if (phase === PHASE_DEVELOPMENT_SERVER || phase === PHASE_PRODUCTION_BUILD) {
        const withSerwist = (await import('@serwist/next')).default({
            disable: isPwaDisabled, // true to disable PWA
            swSrc: 'app/sw.ts',
            swDest: 'public/sw.js',
            additionalPrecacheEntries: [
                { url: '/welcome', revision },
                { url: '/signin', revision },
                { url: '/~fallback', revision },
                { url: '/manifest.json', revision },
                { url: '/home', revision },
                { url: '/consent', revision },
            ],
            // cacheOnNavigation: true
        });
        return withSerwist(nextConfig);
    }

    return nextConfig;
};

module.exports = async (phase, { defaultConfig }) => {
    const serwistConfig = await withSerwistConfig(phase);

    return withSentryConfig(
        withBundleAnalyzer(withNextIntl(serwistConfig)),
        sentryWebpackPluginOptions
    );
};
