import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @vikc/registration is consumed as TypeScript source (the workspace package has no build step)
  transpilePackages: ["@vikc/registration"],
  // `@/…` alias + `.js`→`.ts` mapping for the NodeNext workspace packages.
  // (webpack is used explicitly: `next build --webpack`.)
  webpack: (config) => {
    config.resolve.alias = { ...(config.resolve.alias ?? {}), "@": path.resolve(import.meta.dirname, "src") };
    // the workspace packages are NodeNext TypeScript: their relative imports carry a `.js` suffix
    // that webpack must map back to the `.ts` source
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
