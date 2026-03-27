/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
            poll: 2000,
            aggregateTimeout: 500,
            ignored: /node_modules/,
          };
    }
    return config;
  },
  images: {
    domains: ["images.unsplash.com", "res.cloudinary.com"],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "localhost:3000", "triplenelson.com", "*.triplenelson.com"],
    },
    serverComponentsExternalPackages: [
      "firebase-admin",
      "@google-cloud/firestore",
      "google-auth-library",
      "google-gax",
      "googleapis-common",
      "pdf-lib",
      "qrcode",
      "resend",
    ],
  },
};

export default nextConfig;
