/** @type {import('next').NextConfig} */
const createSecurityHeaders = (isDev) => [
    {
        key: 'X-Frame-Options',
        value: 'DENY',
    },
    {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
    },
    {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
    },
    {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
    },
    {
        key: 'Cross-Origin-Opener-Policy',
        value: 'same-origin',
    },
    {
        key: 'Cross-Origin-Resource-Policy',
        value: 'same-site',
    },
    {
        key: 'Content-Security-Policy',
        value: `default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' https:;`,
    },
];

const baseConfig = {
    reactStrictMode: true,
    experimental: {
        serverActions: {
            bodySizeLimit: '2mb',
        },
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
};

const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

module.exports = (phase) => {
    const isDev = phase === PHASE_DEVELOPMENT_SERVER;
    const securityHeaders = createSecurityHeaders(isDev);
    const headers = isDev
        ? securityHeaders
        : [
            ...securityHeaders,
            {
                key: 'Strict-Transport-Security',
                value: 'max-age=63072000; includeSubDomains; preload',
            },
        ];

    return {
        ...baseConfig,
        async headers() {
            return [
                {
                    source: '/(.*)',
                    headers,
                },
            ];
        },
        // Keep dev and prod build artifacts isolated. This prevents cases where `next build`
        // (or cleaning `.next`) breaks a running `next dev` instance.
        distDir: isDev ? '.next-dev' : '.next',
        ...(isDev ? {} : { output: 'standalone' }),
    };
};
