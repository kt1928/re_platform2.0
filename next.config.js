/** @type {import('next').NextConfig} */
const nextConfig = {
  // API-only configuration - no pages directory
  serverExternalPackages: ['@prisma/client'],
  
  // Security headers for API-only app
  async headers() {
    return [
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },

  // Redirect root to health check or documentation
  async redirects() {
    return [
      {
        source: '/',
        destination: '/api/health',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;