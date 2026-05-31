/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Headers de sécurité recommandés pour usage institutionnel
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 's-maxage=14400, stale-while-revalidate=28800' },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
