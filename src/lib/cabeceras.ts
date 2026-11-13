import { createClient } from "@/lib/supabase/server";
import type { FilaCabecera } from "@/lib/types";

/** Todas las cabeceras visibles para el usuario (RLS filtra por rol) con su rentabilidad. */
export async function listarCabeceras(): Promise<FilaCabecera[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_cabecera_rentabilidad")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as FilaCabecera[];
  const { data: cls } = await supabase.from("clientes").select("id, compra_directa");
  const directa = new Map((cls ?? []).map((c: { id: string; compra_directa: boolean }) => [c.id, c.compra_directa]));
  return filas.map((f) => ({ ...f, compra_directa: directa.get(f.cliente_id) ?? false }));
}
