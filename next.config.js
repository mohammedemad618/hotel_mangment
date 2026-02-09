/** @type {import('next').NextConfig} */
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

    return {
        ...baseConfig,
        // Keep dev and prod build artifacts isolated. This prevents cases where `next build`
        // (or cleaning `.next`) breaks a running `next dev` instance.
        distDir: isDev ? '.next-dev' : '.next',
        ...(isDev ? {} : { output: 'standalone' }),
    };
};
