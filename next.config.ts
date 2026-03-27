import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const tailwindcss = path.join(projectRoot, "node_modules/tailwindcss");
const tailwindPostcss = path.join(
  projectRoot,
  "node_modules/@tailwindcss/postcss",
);

const nextConfig: NextConfig = {
  // Lock resolution to this app folder. A package.json / lockfile in ~ (home) can make
  // Next/Turbopack treat the parent `humor-proj-3` folder as the root, so `tailwindcss`
  // is resolved from the wrong place and fails.
  turbopack: {
    root: projectRoot,
    resolveAlias: {
      tailwindcss,
      "@tailwindcss/postcss": tailwindPostcss,
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...config.resolve.alias,
      tailwindcss,
      "@tailwindcss/postcss": tailwindPostcss,
    };
    return config;
  },
};

export default nextConfig;
