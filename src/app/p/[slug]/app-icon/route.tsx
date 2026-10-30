import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { getAppBranding } from "@/lib/appBranding";

type Params = { params: Promise<{ slug: string }> };

const CACHE = "public, max-age=0, s-maxage=300, stale-while-revalidate=3600";

// Ícone do app (PNG). Usa o ícone enviado pelo profissional; sem ele, gera um com a inicial do nome.
export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params;
  const branding = await getAppBranding(slug).catch(() => null);
  if (!branding) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });

  if (branding.iconUrl && branding.iconUrl.startsWith("https://firebasestorage.googleapis.com/")) {
    try {
      const res = await fetch(branding.iconUrl);
      if (res.ok) {
        return new NextResponse(await res.arrayBuffer(), {
          headers: { "Content-Type": "image/png", "Cache-Control": CACHE },
        });
      }
    } catch {
      // cai no ícone gerado
    }
  }

  const initial = branding.name.charAt(0).toUpperCase() || "R";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: branding.themeColor,
          color: "#ffffff",
          fontSize: 300,
          fontWeight: 800,
        }}
      >
        {initial}
      </div>
    ),
    { width: 512, height: 512, headers: { "Cache-Control": CACHE } }
  );
}
