"use server";
import { revalidatePath } from "next/cache";
import { requirePerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { enviarCorreosPendientes } from "@/lib/email";

export async function marcarLeidas(formData: FormData) {
  const perfil = await requirePerfil();
  const sb = await createClient();
  const id = String(formData.get("id") ?? "");
  let q = sb.from("notificaciones").update({ leida: true }).eq("usuario_id", perfil.id).eq("leida", false);
  if (id) q = q.eq("id", id);
  await q;
  revalidatePath("/alertas");
  revalidatePath("/", "layout");
}

export async function ejecutarVerificacion() {
  await requirePerfil(["admin"]);
  const sb = await createClient();
  const { error } = await sb.rpc("fn_generar_alertas");
  if (error) throw new Error(error.message);
  await enviarCorreosPendientes();
  revalidatePath("/alertas");
  revalidatePath("/", "layout");
}
