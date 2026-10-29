import type { NextConfig } from 'next';

// Static export: every page is plain HTML, served from S3 + CloudFront.
const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default config;
