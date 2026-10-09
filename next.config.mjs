/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdf-lib", "@pdf-lib/fontkit", "exceljs", "docx", "jszip"],
  experimental: { serverActions: { bodySizeLimit: "25mb" } },
  // The PDF/DOCX exporters read these at runtime; ship them with the functions.
  outputFileTracingIncludes: {
    "/api/**/*": ["./src/fonts/**", "./public/brand/**"],
  },
};
export default nextConfig;
