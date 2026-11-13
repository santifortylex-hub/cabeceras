import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Perfil, Rol } from "@/lib/types";

export const getPerfil = cache(async (): Promise<Perfil | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("perfiles").select("*").eq("id", auth.user.id).single();
  return (data as Perfil) ?? null;
});

export async function requirePerfil(roles?: Rol[]): Promise<Perfil> {
  const p = await getPerfil();
  if (!p || !p.activo) redirect("/login?error=inactivo");
  if (roles && !roles.includes(p.rol)) redirect("/dashboard");
  return p;
}
