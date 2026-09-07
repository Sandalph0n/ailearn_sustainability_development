import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/api/tool/:path*",
        headers: [
          // A runtime iframe deliberately omits `allow-same-origin`, so browsers serialize its
          // origin as `null`. Bearer JWTs, not ambient cookies, authorize every data operation.
          { key: 'Access-Control-Allow-Origin', value: 'null' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type, If-Match' },
          { key: 'Access-Control-Expose-Headers', value: 'ETag' },
        ],
      },
    ];
  },
};

export default nextConfig;
