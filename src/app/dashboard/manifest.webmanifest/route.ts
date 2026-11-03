import { NextResponse } from "next/server";
import { ADMIN_APP_BACKGROUND, ADMIN_APP_THEME } from "@/lib/adminApp";

// Manifesto do app instalável do painel do administrador.
export function GET() {
  const manifest = {
    name: "Retoria — Painel",
    short_name: "Retoria",
    id: "/dashboard",
    start_url: "/dashboard/slots",
    scope: "/dashboard",
    display: "standalone",
    theme_color: ADMIN_APP_THEME,
    background_color: ADMIN_APP_BACKGROUND,
    icons: [
      { src: "/dashboard/app-icon", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/dashboard/app-icon", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
