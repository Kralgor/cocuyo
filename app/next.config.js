/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',           // static export — no server needed
  images: { unoptimized: true }, // required for static export
  trailingSlash: true,        // consistent paths on static hosts
};

module.exports = nextConfig;
