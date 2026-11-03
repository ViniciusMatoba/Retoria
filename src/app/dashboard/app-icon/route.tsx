import { ImageResponse } from "next/og";
import { ADMIN_APP_THEME } from "@/lib/adminApp";

// Ícone do app do painel (PNG): o logotipo do Retoria, o calendário branco sobre o quadrado índigo da barra lateral.
export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: ADMIN_APP_THEME,
        }}
      >
        <svg width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M3 10h18" />
        </svg>
      </div>
    ),
    { width: 512, height: 512, headers: { "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800" } }
  );
}
