/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // The MVP ships without an ESLint config; type-safety is enforced via `npm run typecheck`.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
