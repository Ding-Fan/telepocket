/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@telepocket/shared'],
  experimental: {
    serverComponentsExternalPackages: ['open-graph-scraper', 'undici'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Allow all HTTPS domains for link preview images
      },
    ],
  },
};

module.exports = nextConfig;
