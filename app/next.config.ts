import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 隐藏开发模式左下角的 Next 图标，方便录屏演示
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
