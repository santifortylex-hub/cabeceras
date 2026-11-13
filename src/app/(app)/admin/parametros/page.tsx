import { requirePerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { fecha } from "@/lib/format";
import { ConfigForm, UmbralForm } from "./forms";

export default async function ParametrosPage() {
  await requirePerfil(["admin"]);
  const sb = await createClient();
  const [{ data: params }, { data: marcas }, { data: cfg }] = await Promise.all([
    sb.from("parametros_rentabilidad").select("*, marcas(nombre)").order("vigente_desde", { ascending: false }).order("created_at", { ascending: false }),
    sb.from("marcas").select("id,nombre").eq("activa", true).order("nombre"),
    sb.from("configuracion").select("*").order("clave"),
  ]);
  type P = { id: string; marca_id: number | null; umbral_rentable: number; umbral_no_rentable: number; vigente_desde: string; marcas: { nombre: string } | null };
  const lista = (params ?? []) as unknown as P[];
  const general = lista.find((p) => p.marca_id == null);

  return (
    <div className="space-y-6">
      <PageHeader title="Parámetros de rentabilidad" subtitle="Ratio de inversión = costo ÷ venta mensual promedio × 100. Menor ratio = mejor." />
      <section className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Umbrales generales</h2>
        <UmbralForm marcaId={null} rentable={general?.umbral_rentable} noRentable={general?.umbral_no_rentable} />
        <p className="mt-3 text-xs text-slate-500">Rentable: ratio ≤ primer umbral. Requiere seguimiento: entre ambos. No rentable: ratio por encima del segundo.
          Cabecera sin inicio: sin evaluación. Durante los días de gracia desde el inicio nunca se clasifica como no rentable.</p>
      </section>
      <section className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Umbral específico por marca (cabeceras de una sola marca)</h2>
        <UmbralForm marcas={marcas ?? []} />
      </section>
      <section className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Alertas y vigencia</h2>
        <div className="space-y-4">
          {(cfg ?? []).map((c: { clave: string; valor: number; descripcion: string }) => <ConfigForm key={c.clave} clave={c.clave} valor={c.valor} descripcion={c.descripcion} />)}
        </div>
      </section>
      <section className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Historial de umbrales</h2>
        <table className="min-w-full"><thead><tr>{["Vigente desde", "Aplica a", "Rentable ≤", "No rentable >"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{lista.map((p) => (
            <tr key={p.id}><td className="td">{fecha(p.vigente_desde)}</td><td className="td">{p.marcas?.nombre ?? "General"}</td><td className="td">{p.umbral_rentable}%</td><td className="td">{p.umbral_no_rentable}%</td></tr>
          ))}</tbody></table>
      </section>
    </div>
  );
}
