import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  experimental: {
    // Proxy inspects Host for every request, so Next buffers request bodies that pass through it.
    // Keep this just above the 25 MiB direct-package limit plus multipart overhead.
    proxyClientMaxBodySize: '27mb',
  },
};

export default nextConfig;
