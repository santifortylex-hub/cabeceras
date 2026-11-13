import { requirePerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { FilaUsuario, NuevoUsuario } from "./forms";
import type { Perfil } from "@/lib/types";

export default async function UsuariosPage() {
  const yo = await requirePerfil(["admin"]);
  const sb = await createClient();
  const { data } = await sb.from("perfiles").select("*").order("nombre");
  const usuarios = (data ?? []) as Perfil[];
  const sups = usuarios.filter((u) => u.rol === "supervisor" && u.activo).map((u) => ({ id: u.id, nombre: u.nombre }));
  return (
    <div className="space-y-6">
      <PageHeader title="Usuarios y roles" subtitle="Los vendedores se asocian a un supervisor, que verá sus cabeceras." />
      <section className="card"><h2 className="mb-3 text-sm font-semibold text-slate-700">Nuevo usuario</h2><NuevoUsuario sups={sups} /></section>
      <section className="space-y-3">
        {usuarios.map((u) => <FilaUsuario key={u.id} u={u} sups={sups} esYo={u.id === yo.id} />)}
      </section>
    </div>
  );
}
