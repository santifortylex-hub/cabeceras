import { requirePerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { fecha, fechaHora, money, periodo } from "@/lib/format";
import { ImportForm, TipoCambioForm, VentaForm } from "./forms";

export default async function VentasPage() {
  await requirePerfil(["admin"]);
  const sb = await createClient();
  const [sucs, marcas, ventas, imps, tc] = await Promise.all([
    sb.from("sucursales").select("id,nombre,clientes(nombre)").order("nombre"),
    sb.from("marcas").select("id,nombre").eq("activa", true).order("nombre"),
    sb.from("ventas_sucursal").select("id,venta_mensual_promedio,moneda,periodo,origen,sucursales(nombre,clientes(nombre)),marcas(nombre)")
      .order("periodo", { ascending: false }).order("created_at", { ascending: false }).limit(100),
    sb.from("importaciones_ventas").select("*").order("created_at", { ascending: false }).limit(10),
    sb.from("tipos_cambio").select("*").order("fecha", { ascending: false }).limit(5),
  ]);
  type S = { id: string; nombre: string; clientes: { nombre: string } | null };
  const sucursales = ((sucs.data ?? []) as unknown as S[])
    .map((s) => ({ id: s.id, label: `${s.clientes?.nombre} — ${s.nombre}` }))
    .sort((a, b) => a.label.localeCompare(b.label));
  type V = { id: string; venta_mensual_promedio: number; moneda: "UYU" | "USD"; periodo: string; origen: string; sucursales: { nombre: string; clientes: { nombre: string } } | null; marcas: { nombre: string } | null };

  return (
    <div>
      <PageHeader title="Ventas y rentabilidad" subtitle="Carga de ventas mensuales promedio. Se vinculan automáticamente a las cabeceras de cada sucursal." />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Carga manual</h2>
          <VentaForm sucursales={sucursales} marcas={marcas.data ?? []} />
        </section>
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Tipo de cambio (UYU/USD)</h2>
          <TipoCambioForm />
          <ul className="mt-3 space-y-1 text-xs text-slate-500">
            {(tc.data ?? []).map((t: { fecha: string; usd_uyu: number; es_demo: boolean }) => (
              <li key={t.fecha}>{fecha(t.fecha)}: {t.usd_uyu}{t.es_demo ? " (demo)" : ""}</li>
            ))}
            {(tc.data ?? []).length === 0 && <li>Sin cotización cargada: las cabeceras en USD no tendrán ratio.</li>}
          </ul>
        </section>
        <section className="card lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Importar Excel o CSV</h2>
          <ImportForm />
          {(imps.data ?? []).length > 0 && (
            <table className="mt-4 min-w-full text-sm">
              <thead><tr><th className="th">Fecha</th><th className="th">Archivo</th><th className="th">OK</th><th className="th">Errores</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {(imps.data ?? []).map((i: { id: string; created_at: string; archivo: string; filas_ok: number; filas_error: number; errores: { fila: number; motivo: string }[] }) => (
                  <tr key={i.id}>
                    <td className="td">{fechaHora(i.created_at)}</td><td className="td">{i.archivo}</td><td className="td">{i.filas_ok}</td>
                    <td className="td">{i.filas_error > 0 ? (
                      <details><summary className="cursor-pointer text-red-600">{i.filas_error}</summary>
                        <ul className="mt-1 text-xs">{i.errores.slice(0, 20).map((e) => <li key={e.fila}>Fila {e.fila}: {e.motivo}</li>)}</ul></details>
                    ) : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="card lg:col-span-3 overflow-x-auto">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Últimas ventas cargadas</h2>
          <table className="min-w-full">
            <thead><tr>{["Período", "Cliente", "Sucursal", "Marca", "Venta mensual prom.", "Origen"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {((ventas.data ?? []) as unknown as V[]).map((v) => (
                <tr key={v.id}>
                  <td className="td">{periodo(v.periodo)}</td><td className="td">{v.sucursales?.clientes.nombre}</td>
                  <td className="td">{v.sucursales?.nombre}</td><td className="td">{v.marcas?.nombre ?? "Toda la sucursal"}</td>
                  <td className="td">{money(v.venta_mensual_promedio, v.moneda)}</td><td className="td">{v.origen}</td>
                </tr>
              ))}
              {(ventas.data ?? []).length === 0 && <tr><td className="td text-slate-500" colSpan={6}>Aún no hay ventas cargadas.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
