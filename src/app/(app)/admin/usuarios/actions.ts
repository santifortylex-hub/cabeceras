"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePerfil } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { FormState } from "../../cabeceras/actions";

const base = {
  nombre: z.string().trim().min(2, "Indique el nombre"),
  rol: z.enum(["admin", "supervisor", "vendedor"]),
  supervisor_id: z.string().uuid().optional().or(z.literal("")),
};

export async function crearUsuario(_: FormState, fd: FormData): Promise<FormState> {
  await requirePerfil(["admin"]);
  const p = z.object({ ...base, email: z.string().email("Correo inválido"), password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres") })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const v = p.data;
  const adm = createAdminClient();
  const { data, error } = await adm.auth.admin.createUser({
    email: v.email, password: v.password, email_confirm: true,
    user_metadata: { nombre: v.nombre }, app_metadata: { rol: v.rol },
  });
  if (error || !data.user) return { error: error?.message ?? "No se pudo crear el usuario" };
  if (v.supervisor_id) await adm.from("perfiles").update({ supervisor_id: v.supervisor_id }).eq("id", data.user.id);
  revalidatePath("/admin/usuarios");
  return { ok: `Usuario ${v.email} creado` };
}

export async function actualizarUsuario(_: FormState, fd: FormData): Promise<FormState> {
  const yo = await requirePerfil(["admin"]);
  const id = String(fd.get("id"));
  const p = z.object({ ...base }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const v = p.data;
  const activo = fd.get("activo") === "on";
  if (id === yo.id && (v.rol !== "admin" || !activo)) return { error: "No puede quitarse a sí mismo el rol de administrador ni desactivarse" };
  const sb = await createClient();
  const { error } = await sb.from("perfiles").update({
    nombre: v.nombre, rol: v.rol, supervisor_id: v.supervisor_id || null, activo,
  }).eq("id", id);
  if (error) return { error: error.message };
  const adm = createAdminClient();
  const pass = String(fd.get("password") ?? "");
  if (pass && pass.length < 8) return { error: "La nueva contraseña debe tener al menos 8 caracteres" };
  const { error: e2 } = await adm.auth.admin.updateUserById(id, { app_metadata: { rol: v.rol }, ...(pass ? { password: pass } : {}), ban_duration: activo ? "none" : "876000h" });
  if (e2) return { error: e2.message };
  revalidatePath("/admin/usuarios");
  return { ok: "Usuario actualizado" };
}

export async function eliminarUsuario(_: FormState, fd: FormData): Promise<FormState> {
  const yo = await requirePerfil(["admin"]);
  const id = String(fd.get("id"));
  if (id === yo.id) return { error: "No puede eliminar su propio usuario" };
  const { error } = await createAdminClient().auth.admin.deleteUser(id);
  if (error) return { error: "No se pudo eliminar: el usuario tiene cabeceras u otros registros asociados. Desactívelo en su lugar." };
  revalidatePath("/admin/usuarios");
  return { ok: "Usuario eliminado" };
}
