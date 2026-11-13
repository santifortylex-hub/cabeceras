import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClasifBadge, EstadoBadge, PageHeader } from "@/components/ui";
import { estadoLabel, TIPO_ALERTA_LABEL, type FilaCabecera } from "@/lib/types";
import { fecha, fechaHora, money, pct, periodo } from "@/lib/format";
import { CambiarEstadoForm, ComentarioForm, CompraDirectaForm, CostoForm, SupervisorForm } from "./forms";

const Dato = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div><dt className="label">{k}</dt><dd className="text-sm text-slate-800">{v ?? "—"}</dd></div>
);

export default async function FichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await requirePerfil();
  const supabase = await createClient();

  const { data: row } = await supabase.from("v_cabecera_rentabilidad").select("*").eq("cabecera_id", id).maybeSingle();
  if (!row) notFound();
  const c = row as FilaCabecera;

  const [hist, coms, alertas, baja, trans, sups, det, cli] = await Promise.all([
    supabase.from("cabecera_estados_historial").select("*, usuario:perfiles(nombre)").eq("cabecera_id", id).order("created_at", { ascending: false }),
    supabase.from("cabecera_comentarios").select("*, autor:perfiles(nombre)").eq("cabecera_id", id).order("created_at", { ascending: false }),
    supabase.from("alertas").select("*").eq("cabecera_id", id).order("generada_en", { ascending: false }),
    supabase.from("cabecera_bajas").select("*, usuario:perfiles(nombre)").eq("cabecera_id", id).maybeSingle(),
    supabase.from("transiciones_estado").select("hasta").eq("desde", c.estado),
    supabase.from("perfiles").select("id,nombre").eq("rol", "supervisor").eq("activo", true).order("nombre"),
    supabase.from("cabeceras").select("observaciones").eq("id", id).single(),
    supabase.from("clientes").select("compra_directa").eq("id", c.cliente_id).maybeSingle(),
  ]);
  const compraDirecta = cli.data?.compra_directa ?? false;

  let fotoUrl: string | null = null;
  if (c.foto_path) {
    const s = await supabase.storage.from("cabeceras-fotos").createSignedUrl(c.foto_path, 3600);
    fotoUrl = s.data?.signedUrl ?? null;
  }
  const puedeGestionar = perfil.rol === "admin" || perfil.rol === "supervisor";
  const opciones = (trans.data ?? []).map((t: { hasta: string }) => ({ value: t.hasta, label: estadoLabel(t.hasta) }));
  type H = { id: string; estado_anterior: string | null; estado_nuevo: string; motivo: string | null; created_at: string; usuario: { nombre: string } | null };
  type Cm = { id: string; comentario: string; fecha_revision: string | null; created_at: string; autor: { nombre: string } | null };
  type Al = { id: string; tipo: string; motivo: string; generada_en: string; resuelta_en: string | null };

  return (
    <div>
      <PageHeader title={`${c.codigo} · ${c.cliente}`} subtitle={`${c.sucursal}${c.direccion ? " — " + c.direccion : ""}`}>
        <EstadoBadge estado={c.estado} />
        <Link href={perfil.rol === "vendedor" ? "/dashboard" : "/cabeceras"} className="btn-ghost">← Volver</Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <div className="grid gap-6 md:grid-cols-[220px_1fr]">
              <div>
                {fotoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={fotoUrl} alt="Fotografía del mueble" className="h-44 w-full rounded-md object-cover" />
                  : <div className="flex h-44 items-center justify-center rounded-md bg-slate-100 text-sm text-slate-400">Sin fotografía</div>}
              </div>
              <dl className="grid grid-cols-2 gap-4">
                <Dato k="Marcas" v={(c.marcas ?? []).join(" + ") + (c.es_mix ? " (Mix)" : "")} />
                <Dato k="Compra directa" v={compraDirecta ? "Sí" : "No"} />
                <Dato k="Usuario responsable" v={c.vendedor} />
                <Dato k="Supervisor" v={c.supervisor} />
                <Dato k="Inicio" v={fecha(c.fecha_inicio)} />
                <Dato k="Finalización" v={`${fecha(c.fecha_fin)} (${c.dias_para_vencer >= 0 ? `en ${c.dias_para_vencer} días` : `vencida hace ${-c.dias_para_vencer} días`})`} />
              </dl>
            </div>
            {det.data?.observaciones && <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600">{det.data.observaciones}</p>}
          </section>

          <section className="card">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Inversión y rentabilidad</h2>
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Dato k="Costo de inversión (sin impuestos)" v={money(c.costo, c.moneda)} />
              <Dato k="Costo en UYU" v={money(c.costo_uyu)} />
              <Dato k="Venta mensual promedio asignada" v={money(c.venta_asignada)} />
              <Dato k="Último período de ventas" v={periodo(c.ultimo_periodo)} />
              <Dato k="Ratio de inversión" v={<b>{pct(c.ratio)}</b>} />
              <Dato k="Ratio mensualizado" v={pct(c.ratio_mensual)} />
              <Dato k="Umbrales (rentable / no rentable)" v={c.umbral_rentable != null ? `≤ ${c.umbral_rentable}% / > ${c.umbral_no_rentable}%` : "—"} />
              <Dato k="Evaluación" v={<ClasifBadge c={c.clasificacion} />} />
            </dl>
            <p className="mt-4 text-xs text-slate-400">
              Ratio de inversión = costo ÷ venta mensual promedio × 100. No es un ROI: no incorpora margen de contribución ni ventas incrementales.
            </p>
          </section>

          {baja.data && (
            <section className="card border-red-200 bg-red-50">
              <h2 className="mb-2 text-sm font-semibold text-red-800">Baja registrada</h2>
              <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Dato k="Fecha" v={fecha(baja.data.fecha_baja)} />
                <Dato k="Motivo" v={baja.data.motivo} />
                <Dato k="Decidió" v={(baja.data.usuario as { nombre: string } | null)?.nombre} />
                <Dato k="Observaciones" v={baja.data.observaciones} />
              </dl>
            </section>
          )}

          <section className="card">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Historial de cambios de estado</h2>
            <ol className="space-y-3">
              {((hist.data ?? []) as unknown as H[]).map((h) => (
                <li key={h.id} className="border-l-2 border-brand-100 pl-4 text-sm">
                  <div className="font-medium">
                    {h.estado_anterior ? `${estadoLabel(h.estado_anterior)} → ` : ""}{estadoLabel(h.estado_nuevo)}
                  </div>
                  <div className="text-xs text-slate-500">{fechaHora(h.created_at)} · {h.usuario?.nombre ?? "sistema"}{h.motivo ? ` · ${h.motivo}` : ""}</div>
                </li>
              ))}
            </ol>
          </section>

          <section className="card">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Observaciones del supervisor</h2>
            {(coms.data ?? []).length === 0 && <p className="text-sm text-slate-500">Sin observaciones registradas.</p>}
            <ul className="space-y-3">
              {((coms.data ?? []) as unknown as Cm[]).map((m) => (
                <li key={m.id} className="rounded-md bg-slate-50 p-3 text-sm">
                  <p>{m.comentario}</p>
                  <p className="mt-1 text-xs text-slate-500">{fechaHora(m.created_at)} · {m.autor?.nombre}{m.fecha_revision ? ` · Revisar el ${fecha(m.fecha_revision)}` : ""}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Alertas generadas</h2>
            {(alertas.data ?? []).length === 0 && <p className="text-sm text-slate-500">Sin alertas.</p>}
            <ul className="space-y-2">
              {((alertas.data ?? []) as Al[]).map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 p-3 text-sm">
                  <div>
                    <div className="font-medium">{TIPO_ALERTA_LABEL[a.tipo] ?? a.tipo}</div>
                    <div className="text-slate-600">{a.motivo}</div>
                    <div className="text-xs text-slate-400">Generada: {fechaHora(a.generada_en)}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${a.resuelta_en ? "bg-slate-100 text-slate-600" : "bg-red-100 text-red-700"}`}>
                    {a.resuelta_en ? "Resuelta" : "Abierta"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          {puedeGestionar && (
            <>
              <section className="card">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Decisión sobre la cabecera</h2>
                <CambiarEstadoForm id={id} opciones={opciones} />
              </section>
              <section className="card">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Documentar observación</h2>
                <ComentarioForm id={id} />
              </section>
            </>
          )}
          {perfil.rol === "admin" && (
            <>
              <section className="card">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Costo, sin impuestos (solo administrador)</h2>
                <CostoForm id={id} costo={c.costo} />
              </section>
              <section className="card">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Cliente: compra directa</h2>
                <CompraDirectaForm id={id} clienteId={c.cliente_id} directa={compraDirecta} />
              </section>
              <section className="card">
                <h2 className="mb-3 text-sm font-semibold text-slate-700">Supervisor</h2>
                <SupervisorForm id={id} actual={c.supervisor_id} supervisores={sups.data ?? []} />
              </section>
            </>
          )}
          {perfil.rol === "vendedor" && (
            <section className="card text-sm text-slate-600">
              Estado de aprobación: <EstadoBadge estado={c.estado} />. Las observaciones del supervisor aparecen en esta ficha.
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
