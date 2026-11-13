import Link from "next/link";
import { requirePerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listarCabeceras } from "@/lib/cabeceras";
import { Empty, PageHeader } from "@/components/ui";
import { TIPO_ALERTA_LABEL } from "@/lib/types";
import { fechaHora } from "@/lib/format";
import { ejecutarVerificacion, marcarLeidas } from "./actions";

export default async function AlertasPage() {
  const perfil = await requirePerfil(["admin", "supervisor"]);
  const sb = await createClient();
  const [{ data: notifs }, { data: alertas }, cabs] = await Promise.all([
    sb.from("notificaciones").select("*").order("created_at", { ascending: false }).limit(100),
    sb.from("alertas").select("*").is("resuelta_en", null).order("generada_en", { ascending: false }),
    listarCabeceras(),
  ]);
  const byId = new Map(cabs.map((c) => [c.cabecera_id, c]));
  type N = { id: string; titulo: string; detalle: string | null; leida: boolean; created_at: string; cabecera_id: string | null };
  type A = { id: string; cabecera_id: string; tipo: string; motivo: string; generada_en: string };

  return (
    <div>
      <PageHeader title="Centro de notificaciones" subtitle="Alertas automáticas. Ninguna cabecera se da de baja automáticamente: la decisión es del supervisor o administrador.">
        {perfil.rol === "admin" && (
          <form action={ejecutarVerificacion}><button className="btn-ghost">Ejecutar verificación ahora</button></form>
        )}
        <form action={marcarLeidas}><button className="btn-ghost">Marcar todas como leídas</button></form>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Mis notificaciones</h2>
          {(notifs ?? []).length === 0 ? <Empty>Sin notificaciones.</Empty> : (
            <ul className="space-y-2">
              {((notifs ?? []) as N[]).map((n) => (
                <li key={n.id} className={`card flex items-start justify-between gap-3 !p-4 ${n.leida ? "opacity-60" : "border-l-4 border-l-red-400"}`}>
                  <div className="text-sm">
                    <div className="font-medium">{n.titulo}</div>
                    <div className="text-slate-600">{n.detalle}</div>
                    <div className="mt-1 text-xs text-slate-400">{fechaHora(n.created_at)}</div>
                    {n.cabecera_id && <Link className="text-xs text-brand-600 hover:underline" href={`/cabeceras/${n.cabecera_id}`}>Ver ficha</Link>}
                  </div>
                  {!n.leida && (
                    <form action={marcarLeidas}><input type="hidden" name="id" value={n.id} /><button className="btn-ghost !px-2 !py-1 text-xs">Leída</button></form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Alertas abiertas ({(alertas ?? []).length})</h2>
          {(alertas ?? []).length === 0 ? <Empty>No hay alertas abiertas.</Empty> : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50"><tr>{["Cabecera", "Motivo", "Responsable", "Supervisor", "Generada"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {((alertas ?? []) as A[]).map((a) => {
                    const c = byId.get(a.cabecera_id);
                    return (
                      <tr key={a.id}>
                        <td className="td"><Link className="text-brand-600 hover:underline" href={`/cabeceras/${a.cabecera_id}`}>{c?.codigo}</Link><div className="text-xs text-slate-500">{c?.cliente} / {c?.sucursal}</div></td>
                        <td className="td"><div className="font-medium">{TIPO_ALERTA_LABEL[a.tipo]}</div><div className="text-xs text-slate-500">{a.motivo}</div></td>
                        <td className="td">{c?.vendedor}</td><td className="td">{c?.supervisor ?? "—"}</td>
                        <td className="td whitespace-nowrap">{fechaHora(a.generada_en)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
