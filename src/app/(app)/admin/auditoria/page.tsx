import { requirePerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { fechaHora } from "@/lib/format";

export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<{ tabla?: string }> }) {
  await requirePerfil(["admin"]);
  const { tabla } = await searchParams;
  const sb = await createClient();
  let q = sb.from("auditoria").select("*").order("created_at", { ascending: false }).limit(200);
  if (tabla) q = q.eq("tabla", tabla);
  const [{ data }, { data: perfiles }] = await Promise.all([q, sb.from("perfiles").select("id,nombre")]);
  const nombres = new Map((perfiles ?? []).map((p: { id: string; nombre: string }) => [p.id, p.nombre]));
  type A = { id: number; tabla: string; registro_id: string; accion: string; antes: Record<string, unknown> | null; despues: Record<string, unknown> | null; usuario_id: string | null; created_at: string };
  const diff = (a: A) => {
    if (a.accion !== "UPDATE" || !a.antes || !a.despues) return null;
    return Object.keys(a.despues).filter((k) => k !== "updated_at" && JSON.stringify(a.antes![k]) !== JSON.stringify(a.despues![k]))
      .map((k) => `${k}: ${JSON.stringify(a.antes![k])} → ${JSON.stringify(a.despues![k])}`).join(" · ");
  };
  return (
    <div>
      <PageHeader title="Registro de auditoría" subtitle="Últimos 200 movimientos sobre datos sensibles" />
      <form className="card mb-4 flex gap-3">
        <select name="tabla" defaultValue={tabla ?? ""} className="input max-w-xs">
          <option value="">Todas las tablas</option>
          {["cabeceras", "ventas_sucursal", "parametros_rentabilidad", "configuracion", "tipos_cambio", "perfiles", "cabecera_bajas", "cabecera_marcas"].map((t) => <option key={t}>{t}</option>)}
        </select>
        <button className="btn">Filtrar</button>
      </form>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50"><tr>{["Fecha", "Usuario", "Tabla", "Acción", "Detalle"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {((data ?? []) as A[]).map((a) => (
              <tr key={a.id}>
                <td className="td whitespace-nowrap">{fechaHora(a.created_at)}</td>
                <td className="td">{a.usuario_id ? nombres.get(a.usuario_id) ?? a.usuario_id.slice(0, 8) : "sistema"}</td>
                <td className="td">{a.tabla}</td><td className="td">{a.accion}</td>
                <td className="td max-w-xl break-words text-xs text-slate-600">{diff(a) ?? (a.accion === "INSERT" ? `Alta ${a.registro_id}` : a.accion === "DELETE" ? `Baja ${a.registro_id}` : "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
