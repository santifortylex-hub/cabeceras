import { createAdminClient } from "@/lib/supabase/server";

/**
 * Envía los correos en cola (correos_pendientes) con Resend.
 * Si no hay RESEND_API_KEY los deja en cola: la app funciona igual (centro de notificaciones).
 */
export async function enviarCorreosPendientes(limite = 50): Promise<{ enviados: number; errores: number; omitido?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { enviados: 0, errores: 0, omitido: "RESEND_API_KEY no configurada: los correos quedan en cola" };
  const from = process.env.EMAIL_FROM ?? "Fortylex Cabeceras <onboarding@resend.dev>";
  const sb = createAdminClient();
  const { data } = await sb.from("correos_pendientes").select("*").eq("estado", "pendiente").lt("intentos", 5)
    .order("created_at").limit(limite);
  let enviados = 0, errores = 0;
  for (const c of data ?? []) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [c.destinatario], subject: c.asunto, text: c.cuerpo }),
    }).catch((e: Error) => ({ ok: false, text: async () => e.message }) as unknown as Response);
    if (res.ok) {
      enviados++;
      await sb.from("correos_pendientes").update({ estado: "enviado", enviado_en: new Date().toISOString(), intentos: c.intentos + 1 }).eq("id", c.id);
    } else {
      errores++;
      await sb.from("correos_pendientes").update({
        intentos: c.intentos + 1, error: (await res.text()).slice(0, 500), estado: c.intentos + 1 >= 5 ? "error" : "pendiente",
      }).eq("id", c.id);
    }
  }
  return { enviados, errores };
}
