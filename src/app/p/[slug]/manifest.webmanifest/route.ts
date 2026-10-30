import { NextRequest, NextResponse } from "next/server";
import { getAppBranding } from "@/lib/appBranding";

type Params = { params: Promise<{ slug: string }> };

// Manifesto do app instalável de cada profissional: nome, ícone e cores próprios.
export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const branding = await getAppBranding(slug).catch(() => null);
  if (!branding) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });

  const base = `/p/${encodeURIComponent(slug)}`;
  const manifest = {
    name: branding.name,
    short_name: branding.name,
    id: base,
    start_url: base,
    scope: `${base}`,
    display: "standalone",
    theme_color: branding.themeColor,
    background_color: branding.backgroundColor,
    icons: [
      { src: `${base}/app-icon`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}/app-icon`, sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
