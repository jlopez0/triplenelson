/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["images.unsplash.com", "res.cloudinary.com"],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'triplenelson.com', '*.triplenelson.com']
    }
  }
};

export default nextConfig;
