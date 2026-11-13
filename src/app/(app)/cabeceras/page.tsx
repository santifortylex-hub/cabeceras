import Link from "next/link";
import { requirePerfil } from "@/lib/auth";
import { listarCabeceras } from "@/lib/cabeceras";
import { ClasifBadge, DirectaBadge, EstadoBadge, Empty, PageHeader } from "@/components/ui";
import { ESTADOS, MARCAS_SIMPLES } from "@/lib/types";
import { fecha, money, pct } from "@/lib/format";

type SP = { q?: string; estado?: string; marca?: string };

export default async function CabecerasPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePerfil(["admin", "supervisor"]);
  const sp = await searchParams;
  const todas = await listarCabeceras();
  const q = sp.q?.trim().toLowerCase();
  const filas = todas.filter((c) =>
    (!q || [c.codigo, c.cliente, c.sucursal, c.vendedor, c.supervisor ?? ""].some((x) => x.toLowerCase().includes(q))) &&
    (!sp.estado || c.estado === sp.estado) &&
    (!sp.marca || (c.marcas ?? []).includes(sp.marca)));

  return (
    <div>
      <PageHeader title="Cabeceras" subtitle={`${filas.length} de ${todas.length} cabeceras`}>
        <Link href="/cabeceras/nueva" className="btn">+ Nueva cabecera</Link>
      </PageHeader>
      <form className="card mb-4 grid gap-3 md:grid-cols-4">
        <input name="q" defaultValue={sp.q} placeholder="Buscar código, cliente, sucursal, usuario…" className="input md:col-span-2" />
        <select name="estado" defaultValue={sp.estado ?? ""} className="input">
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
        <select name="marca" defaultValue={sp.marca ?? ""} className="input">
          <option value="">Todas las marcas</option>
          {MARCAS_SIMPLES.map((m) => <option key={m}>{m}</option>)}
        </select>
        <div className="md:col-span-4 flex gap-2">
          <button className="btn">Filtrar</button>
          <Link href="/cabeceras" className="btn-ghost">Limpiar</Link>
        </div>
      </form>
      {filas.length === 0 ? <Empty>No hay cabeceras para mostrar.</Empty> : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>{["Código", "Cliente / Sucursal", "Marcas", "Usuario", "Costo", "Ratio", "Evaluación", "Estado", "Vence"].map((h) => <th key={h} className="th">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((c) => (
                <tr key={c.cabecera_id} className="hover:bg-slate-50">
                  <td className="td font-medium"><Link className="text-brand-600 hover:underline" href={`/cabeceras/${c.cabecera_id}`}>{c.codigo}</Link></td>
                  <td className="td">{c.cliente}<DirectaBadge directa={c.compra_directa} /><div className="text-xs text-slate-500">{c.sucursal}</div></td>
                  <td className="td">{(c.marcas ?? []).join(" + ")}</td>
                  <td className="td">{c.vendedor}</td>
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
      )}
    </div>
  );
}
