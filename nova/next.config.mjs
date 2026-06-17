/** @type {import('next').NextConfig} */
const nextConfig = {
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
