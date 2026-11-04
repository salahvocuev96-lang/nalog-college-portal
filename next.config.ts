import type { NextConfig } from "next";

// Серверный режим: права доступа проверяются на сервере (src/server), поэтому статический экспорт не используется.
const nextConfig: NextConfig = {
  serverExternalPackages: [],
  poweredByHeader: false,
  trailingSlash: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
