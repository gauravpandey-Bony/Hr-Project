/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: "/dashboard/kpis/new",
        destination: "/dashboard/kpis/create",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
