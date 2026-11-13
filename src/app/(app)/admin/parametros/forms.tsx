"use client";
import { useActionState } from "react";
import { guardarConfig, guardarUmbral } from "./actions";
import type { FormState } from "../../cabeceras/actions";

function Msg({ s }: { s: FormState }) {
  if (!s) return null;
  return <div className={`rounded-md border px-3 py-2 text-sm ${s.error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{s.error ?? s.ok}</div>;
}

export function UmbralForm({ marcas, marcaId, rentable, noRentable }: { marcas?: { id: number; nombre: string }[]; marcaId?: number | null; rentable?: number; noRentable?: number }) {
  const [s, action, pending] = useActionState<FormState, FormData>(guardarUmbral, null);
  return (
    <form action={action} className="grid items-end gap-3 md:grid-cols-4">
      {marcas ? (
        <div><label className="label">Aplica a</label>
          <select name="marca_id" className="input" defaultValue=""><option value="" disabled>Marca…</option>{marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></div>
      ) : <input type="hidden" name="marca_id" value={marcaId ?? ""} />}
      <div><label className="label">Rentable si ratio ≤ (%)</label><input name="rentable" type="number" step="0.01" min="0.01" defaultValue={rentable} required className="input" /></div>
      <div><label className="label">No rentable si ratio &gt; (%)</label><input name="no_rentable" type="number" step="0.01" min="0.01" defaultValue={noRentable} required className="input" /></div>
      <button className="btn" disabled={pending}>Guardar</button>
      <div className="md:col-span-4"><Msg s={s} /></div>
    </form>
  );
}

export function ConfigForm({ clave, valor, descripcion }: { clave: string; valor: number; descripcion: string }) {
  const [s, action, pending] = useActionState<FormState, FormData>(guardarConfig, null);
  return (
    <form action={action} className="grid items-end gap-3 md:grid-cols-[1fr_140px_auto]">
      <input type="hidden" name="clave" value={clave} />
      <div className="text-sm"><div className="font-medium">{descripcion}</div><div className="text-xs text-slate-400">{clave}</div></div>
      <input name="valor" type="number" min="0" defaultValue={valor} className="input" />
      <button className="btn-ghost" disabled={pending}>Guardar</button>
      <div className="md:col-span-3"><Msg s={s} /></div>
    </form>
  );
}
