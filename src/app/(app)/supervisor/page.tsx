import Link from "next/link";
import { requirePerfil } from "@/lib/auth";
import { listarCabeceras } from "@/lib/cabeceras";
import { createClient } from "@/lib/supabase/server";
import { ClasifBadge, EstadoBadge, Empty, Kpi, PageHeader } from "@/components/ui";
import { fecha, money, pct } from "@/lib/format";

export default async function SupervisorPage() {
  await requirePerfil(["admin", "supervisor"]);
  const sb = await createClient();
  const [todas, { data: alertas }] = await Promise.all([
    listarCabeceras(),
    sb.from("alertas").select("cabecera_id").is("resuelta_en", null),
  ]);
  const conAlerta = new Set((alertas ?? []).map((a: { cabecera_id: string }) => a.cabecera_id));
  const vivas = todas.filter((c) => !["finalizada", "dada_de_baja"].includes(c.estado));
  const pendientes = todas.filter((c) => c.estado === "pendiente_aprobacion");
  const revisar = vivas.filter((c) =>
    c.estado !== "pendiente_aprobacion" &&
    (c.clasificacion === "no_rentable" || c.clasificacion === "seguimiento" || ["en_observacion", "en_revision", "no_rentable"].includes(c.estado) || conAlerta.has(c.cabecera_id)));

  const Tabla = ({ filas }: { filas: typeof todas }) => (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50"><tr>{["Código", "Cliente / Sucursal", "Usuario", "Costo", "Ratio", "Evaluación", "Estado", "Vence", "Alertas"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {filas.map((c) => (
            <tr key={c.cabecera_id} className="hover:bg-slate-50">
              <td className="td"><Link className="text-brand-600 hover:underline" href={`/cabeceras/${c.cabecera_id}`}>{c.codigo}</Link></td>
              <td className="td">{c.cliente}<div className="text-xs text-slate-500">{c.sucursal}</div></td>
              <td className="td">{c.vendedor}</td><td className="td whitespace-nowrap">{money(c.costo, c.moneda)}</td>
              <td className="td">{pct(c.ratio)}</td><td className="td"><ClasifBadge c={c.clasificacion} /></td>
              <td className="td"><EstadoBadge estado={c.estado} /></td><td className="td whitespace-nowrap">{fecha(c.fecha_fin)}</td>
              <td className="td">{conAlerta.has(c.cabecera_id) ? <span className="text-red-600">● Abierta</span> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-8">
      <PageHeader title="Panel de supervisión" subtitle="Cabeceras de su equipo que requieren una decisión" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Pendientes de aprobación" value={pendientes.length} tone={pendientes.length ? "amber" : undefined} />
        <Kpi label="A revisar" value={revisar.length} tone={revisar.length ? "red" : undefined} />
        <Kpi label="Con alertas abiertas" value={conAlerta.size} />
        <Kpi label="Cabeceras vigentes" value={vivas.length} />
      </div>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Pendientes de aprobación</h2>
        {pendientes.length ? <Tabla filas={pendientes} /> : <Empty>No hay cabeceras pendientes.</Empty>}
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Con bajo rendimiento, observación o alertas</h2>
        {revisar.length ? <Tabla filas={revisar} /> : <Empty>Nada para revisar por ahora.</Empty>}
      </section>
    </div>
  );
}
