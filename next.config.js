const withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
    analyzerMode: process.env.ANALYZE_JSON === 'true' ? 'json' : 'static',
    generateStatsFile: true,
    statsFilename: './analyze/stats.json',
    openAnalyzer: process.env.ANALYZE_JSON !== 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
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
        swcPlugins: [['@lingui/swc-plugin', {}]],
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
    turbopack: {
        rules: {
            '*.po': {
                loaders: ['@lingui/loader'],
                as: '*.js',
            },
        },
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

module.exports = async (phase, { defaultConfig }) => {
    return withBundleAnalyzer(nextConfig);
};
