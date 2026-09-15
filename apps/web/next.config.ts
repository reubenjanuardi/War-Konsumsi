import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@war-konsumsi/shared'],
};

export default nextConfig;
