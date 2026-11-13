"use server";
import { revalidatePath } from "next/cache";
import { requirePerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "../../cabeceras/actions";

export async function guardarUmbral(_: FormState, fd: FormData): Promise<FormState> {
  const perfil = await requirePerfil(["admin"]);
  const rentable = Number(fd.get("rentable")), noRentable = Number(fd.get("no_rentable"));
  const marca = String(fd.get("marca_id") ?? "");
  if (!(rentable > 0) || !(noRentable >= rentable)) return { error: "Los valores deben ser positivos y el umbral de no rentable debe ser mayor o igual al de rentable" };
  const sb = await createClient();
  const { error } = await sb.from("parametros_rentabilidad").insert({
    marca_id: marca ? Number(marca) : null, umbral_rentable: rentable, umbral_no_rentable: noRentable, created_by: perfil.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/parametros");
  return { ok: "Umbrales guardados (vigentes desde hoy; se conserva el historial)" };
}

export async function guardarConfig(_: FormState, fd: FormData): Promise<FormState> {
  await requirePerfil(["admin"]);
  const clave = String(fd.get("clave")), valor = Number(fd.get("valor"));
  if (!(valor >= 0)) return { error: "Valor inválido" };
  const sb = await createClient();
  const { error } = await sb.from("configuracion").update({ valor }).eq("clave", clave);
  if (error) return { error: error.message };
  revalidatePath("/admin/parametros");
  return { ok: "Parámetro actualizado" };
}
