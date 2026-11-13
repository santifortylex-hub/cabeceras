import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { enviarCorreosPendientes } from "@/lib/email";

export const dynamic = "force-dynamic";

// Vercel Cron: GET con "Authorization: Bearer $CRON_SECRET".
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const sb = createAdminClient();
  const { data, error } = await sb.rpc("fn_generar_alertas");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const correos = await enviarCorreosPendientes();
  return NextResponse.json({ alertas_nuevas: data, correos });
}
