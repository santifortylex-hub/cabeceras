import Link from "next/link";
import { requirePerfil } from "@/lib/auth";
import { listarCabeceras } from "@/lib/cabeceras";
import { ClasifBadge, EstadoBadge, Empty, Kpi, PageHeader } from "@/components/ui";
import { ESTADOS, MARCAS_SIMPLES, estadoLabel } from "@/lib/types";
import { fecha, money, pct } from "@/lib/format";
import Charts, { type ChartData } from "./charts";

type SP = { desde?: string; hasta?: string; marca?: string; cliente?: string; supervisor?: string; usuario?: string; estado?: string };

const contar = (items: string[]) => {
  const m = new Map<string, number>();
  items.forEach((i) => m.set(i, (m.get(i) ?? 0) + 1));
  return [...m].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
};
const CERRADAS = ["finalizada", "dada_de_baja"];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const perfil = await requirePerfil();
  const sp = await searchParams;
  const todas = await listarCabeceras();

  const filas = todas.filter((c) =>
    (!sp.desde || c.fecha_inicio >= sp.desde) && (!sp.hasta || c.fecha_inicio <= sp.hasta) &&
    (!sp.marca || (c.marcas ?? []).includes(sp.marca)) && (!sp.cliente || c.cliente_id === sp.cliente) &&
    (!sp.supervisor || c.supervisor_id === sp.supervisor) && (!sp.usuario || c.vendedor_id === sp.usuario) &&
    (!sp.estado || c.estado === sp.estado));

  const vivas = filas.filter((c) => !CERRADAS.includes(c.estado));
  const inversion = vivas.reduce((s, c) => s + (c.costo_uyu ?? 0), 0);
  const sinConv = vivas.filter((c) => c.costo_uyu == null).length;
  const ventaAsoc = vivas.reduce((s, c) => s + (c.venta_asignada ?? 0), 0);
  const noRent = vivas.filter((c) => c.estado === "no_rentable" || c.clasificacion === "no_rentable").length;
  const porVencer = vivas.filter((c) => c.dias_para_vencer >= 0 && c.dias_para_vencer <= 60).length;

  // Gráficos
  const inv = new Map<string, number>();
  filas.filter((c) => !CERRADAS.includes(c.estado) || c.estado === "finalizada").forEach((c) => {
    const ms = c.marcas ?? [];
    ms.forEach((m) => inv.set(m, (inv.get(m) ?? 0) + (c.costo_uyu ?? 0) / ms.length));
  });
  const meses: ChartData["evolucion"] = [];
  const d0 = new Date(); d0.setDate(1);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(d0.getFullYear(), d0.getMonth() - i + 1, 0);
    const fin = d.toISOString().slice(0, 10);
    meses.push({
      mes: `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`,
      activas: filas.filter((c) => c.estado !== "pendiente_aprobacion" && c.fecha_inicio <= fin && (!c.fecha_cierre || c.fecha_cierre > fin)).length,
      bajas: filas.filter((c) => c.fecha_baja && c.fecha_baja <= fin).length,
    });
  }
  const bins = [["0–10 %", 0, 10], ["10–20 %", 10, 20], ["20–30 %", 20, 30], ["30–50 %", 30, 50], ["> 50 %", 50, Infinity]] as const;
  const conRatio = filas.filter((c) => c.ratio != null);
  const chart: ChartData = {
    porMarca: contar(filas.flatMap((c) => c.marcas ?? [])),
    porSupervisor: contar(filas.map((c) => c.supervisor ?? "Sin supervisor")),
    porUsuario: contar(filas.map((c) => c.vendedor)),
    porEstado: contar(filas.map((c) => estadoLabel(c.estado))),
    inversionLinea: [...inv].map(([name, value]) => ({ name, value: Math.round(value) })),
    evolucion: meses,
    ratios: bins.map(([name, a, b]) => ({ name, value: conRatio.filter((c) => c.ratio! >= a && c.ratio! < b).length })),
  };

  const opt = (arr: { id: string; n: string }[]) => [...new Map(arr.map((x) => [x.id, x])).values()].sort((a, b) => a.n.localeCompare(b.n));
  const clientes = opt(todas.map((c) => ({ id: c.cliente_id, n: c.cliente })));
  const sups = opt(todas.filter((c) => c.supervisor_id).map((c) => ({ id: c.supervisor_id!, n: c.supervisor! })));
  const users = opt(todas.map((c) => ({ id: c.vendedor_id, n: c.vendedor })));

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle={perfil.rol === "admin" ? "Visión consolidada de todas las cabeceras" : perfil.rol === "supervisor" ? "Cabeceras de su equipo" : "Sus cabeceras"}>
        <Link href="/cabeceras/nueva" className="btn">+ Nueva cabecera</Link>
      </PageHeader>

      <form className="card grid gap-3 md:grid-cols-4 lg:grid-cols-7">
        <div><label className="label">Inicio desde</label><input type="date" name="desde" defaultValue={sp.desde} className="input" /></div>
        <div><label className="label">Inicio hasta</label><input type="date" name="hasta" defaultValue={sp.hasta} className="input" /></div>
        <div><label className="label">Marca</label><select name="marca" defaultValue={sp.marca ?? ""} className="input"><option value="">Todas</option>{MARCAS_SIMPLES.map((m) => <option key={m}>{m}</option>)}</select></div>
        <div><label className="label">Cliente</label><select name="cliente" defaultValue={sp.cliente ?? ""} className="input"><option value="">Todos</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.n}</option>)}</select></div>
        {perfil.rol !== "vendedor" && (<>
          <div><label className="label">Supervisor</label><select name="supervisor" defaultValue={sp.supervisor ?? ""} className="input"><option value="">Todos</option>{sups.map((c) => <option key={c.id} value={c.id}>{c.n}</option>)}</select></div>
          <div><label className="label">Usuario</label><select name="usuario" defaultValue={sp.usuario ?? ""} className="input"><option value="">Todos</option>{users.map((c) => <option key={c.id} value={c.id}>{c.n}</option>)}</select></div>
        </>)}
        <div><label className="label">Estado</label><select name="estado" defaultValue={sp.estado ?? ""} className="input"><option value="">Todos</option>{ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}</select></div>
        <div className="flex gap-2 md:col-span-4 lg:col-span-7"><button className="btn">Aplicar filtros</button><Link href="/dashboard" className="btn-ghost">Limpiar</Link></div>
      </form>

      {todas.length === 0 ? (
        <Empty>Aún no hay cabeceras registradas. <Link className="text-brand-600 underline" href="/cabeceras/nueva">Registre la primera</Link>.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            <Kpi label="Total registradas" value={filas.length} />
            <Kpi label="Activas" value={filas.filter((c) => c.estado === "activa").length} tone="green" />
            <Kpi label="Pendientes de aprobación" value={filas.filter((c) => c.estado === "pendiente_aprobacion").length} tone="amber" />
            <Kpi label="En observación" value={filas.filter((c) => c.estado === "en_observacion").length} tone="amber" />
            <Kpi label="No rentables" value={noRent} tone={noRent ? "red" : undefined} hint="Por estado o por evaluación del ratio" />
            <Kpi label="Dadas de baja" value={filas.filter((c) => c.estado === "dada_de_baja").length} />
            <Kpi label="Inversión comprometida" value={money(inversion)} hint={sinConv ? `${sinConv} en USD sin tipo de cambio no se suman` : "Cabeceras vigentes, en UYU"} />
            <Kpi label="Venta mensual asociada" value={money(ventaAsoc)} hint="Sin duplicar ventas por sucursal" />
            <Kpi label="Próximas a vencer" value={porVencer} tone={porVencer ? "amber" : undefined} hint="En los próximos 60 días" />
          </div>
          <Charts d={chart} />
          {perfil.rol === "vendedor" && (
            <section>
              <h2 className="mb-1 text-base font-semibold text-slate-900">Mis cabeceras</h2>
              <p className="mb-3 text-sm text-slate-500">Estado de aprobación y observaciones del supervisor: abra una cabecera para verlos.</p>
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50"><tr>{["Código", "Cliente / Sucursal", "Marcas", "Costo", "Ratio", "Evaluación", "Estado", "Vence"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {filas.map((c) => (
                      <tr key={c.cabecera_id} className="hover:bg-slate-50">
                        <td className="td font-medium"><Link className="text-brand-600 hover:underline" href={`/cabeceras/${c.cabecera_id}`}>{c.codigo}</Link></td>
                        <td className="td">{c.cliente}<div className="text-xs text-slate-500">{c.sucursal}</div></td>
                        <td className="td">{(c.marcas ?? []).join(" + ")}</td>
                        <td className="td whitespace-nowrap">{money(c.costo, c.moneda)}</td>
                        <td className="td">{pct(c.ratio)}</td>
                        <td className="td"><ClasifBadge c={c.clasificacion} /></td>
                        <td className="td"><EstadoBadge estado={c.estado} /></td>
                        <td className="td whitespace-nowrap">{fecha(c.fecha_fin)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
