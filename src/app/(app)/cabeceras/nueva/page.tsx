import { requirePerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { MARCAS_SIMPLES } from "@/lib/types";
import NuevaCabeceraForm from "./form";

export default async function NuevaCabeceraPage() {
  const perfil = await requirePerfil();
  const supabase = await createClient();
  const [{ data: cls }, { data: sups }, { data: vends }] = await Promise.all([
    supabase.from("clientes").select("nombre, compra_directa, sucursales(nombre)").eq("activo", true).order("nombre"),
    supabase.from("perfiles").select("id,nombre").eq("rol", "supervisor").eq("activo", true).order("nombre"),
    perfil.rol === "admin"
      ? supabase.from("perfiles").select("id,nombre").eq("activo", true).order("nombre")
      : Promise.resolve({ data: null }),
  ]);
  const clientes = (cls ?? []).map((c: { nombre: string; compra_directa: boolean; sucursales: { nombre: string }[] }) => ({
    nombre: c.nombre, compra_directa: c.compra_directa, sucursales: c.sucursales.map((s) => s.nombre),
  }));
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nueva cabecera" subtitle="La cabecera queda pendiente de aprobación del supervisor o administrador." />
      <NuevaCabeceraForm
        clientes={clientes} supervisores={sups ?? []} vendedores={vends}
        miSupervisor={perfil.supervisor_id} lineas={MARCAS_SIMPLES}
      />
    </div>
  );
}
