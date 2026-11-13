"use client";
import { useActionState, useState } from "react";
import { agregarComentario, actualizarCosto, cambiarEstado, reasignarSupervisor, type FormState, actualizarCompraDirecta } from "../actions";

function Msg({ s }: { s: FormState }) {
  if (!s) return null;
  return <div className={`rounded-md border px-3 py-2 text-sm ${s.error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{s.error ?? s.ok}</div>;
}

export function CambiarEstadoForm({ id, opciones }: { id: string; opciones: { value: string; label: string }[] }) {
  const [s, action, pending] = useActionState<FormState, FormData>(cambiarEstado, null);
  const [estado, setEstado] = useState("");
  if (opciones.length === 0) return <p className="text-sm text-slate-500">No hay transiciones disponibles desde el estado actual.</p>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div>
        <label className="label">Nuevo estado</label>
        <select name="estado" required className="input" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="" disabled>Seleccione…</option>
          {opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {(estado === "dada_de_baja" || estado === "no_rentable") && (
        <div>
          <label className="label">Motivo *</label>
          <input name="motivo" required className="input" />
        </div>
      )}
      {estado === "en_observacion" && (
        <div>
          <label className="label">Volver a revisar el *</label>
          <input type="date" name="fecha_revision" required className="input" />
        </div>
      )}
      <div>
        <label className="label">Observaciones / decisión documentada</label>
        <textarea name="observaciones" rows={2} className="input" />
      </div>
      <Msg s={s} />
      {estado === "dada_de_baja" && <p className="text-xs text-amber-700">La baja es una decisión manual y queda registrada con su fecha, motivo y usuario.</p>}
      <button className={estado === "dada_de_baja" ? "btn-danger" : "btn"} disabled={pending || !estado}>{pending ? "Guardando…" : "Aplicar cambio de estado"}</button>
    </form>
  );
}

export function ComentarioForm({ id }: { id: string }) {
  const [s, action, pending] = useActionState<FormState, FormData>(agregarComentario, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <textarea name="comentario" required rows={3} className="input" placeholder="Agregar comentario u observación…" />
      <div>
        <label className="label">Fecha para volver a revisar (opcional)</label>
        <input type="date" name="fecha_revision" className="input" />
      </div>
      <Msg s={s} />
      <button className="btn" disabled={pending}>Agregar comentario</button>
    </form>
  );
}

export function CostoForm({ id, costo }: { id: string; costo: number }) {
  const [s, action, pending] = useActionState<FormState, FormData>(actualizarCosto, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input name="costo" type="number" step="0.01" min="0.01" defaultValue={costo} required className="input" />
      <p className="text-xs text-slate-500">En pesos uruguayos (UYU), SIN IMPUESTOS.</p>
      <Msg s={s} />
      <button className="btn-ghost" disabled={pending}>Actualizar costo</button>
    </form>
  );
}

export function SupervisorForm({ id, actual, supervisores }: { id: string; actual: string | null; supervisores: { id: string; nombre: string }[] }) {
  const [s, action, pending] = useActionState<FormState, FormData>(reasignarSupervisor, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <select name="supervisor_id" defaultValue={actual ?? ""} className="input">
        <option value="">Sin supervisor</option>
        {supervisores.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
      </select>
      <Msg s={s} />
      <button className="btn-ghost" disabled={pending}>Reasignar supervisor</button>
    </form>
  );
}

export function CompraDirectaForm({ id, clienteId, directa }: { id: string; clienteId: string; directa: boolean }) {
  const [s, action, pending] = useActionState<FormState, FormData>(actualizarCompraDirecta, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="cliente_id" value={clienteId} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="compra_directa" defaultChecked={directa} /> El cliente compra de forma directa</label>
      <Msg s={s} />
      <button className="btn-ghost" disabled={pending}>Guardar</button>
    </form>
  );
}
