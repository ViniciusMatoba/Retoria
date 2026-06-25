import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Impede o Next.js de bundlar o firebase-admin e suas dependências (jose, jwks-rsa).
  // Sem isso, o bundler do webpack encontra um ESM/CJS mismatch e a função serverless crasha.
  serverExternalPackages: ["firebase-admin", "firebase-admin/app", "firebase-admin/auth", "firebase-admin/firestore", "googleapis"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        port: "",
        pathname: "/v0/b/**",
      },
    ],
  },
};

export default nextConfig;
