/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdf-lib", "@pdf-lib/fontkit", "exceljs", "docx", "jszip"],
  experimental: { serverActions: { bodySizeLimit: "25mb" } },
};
export default nextConfig;
