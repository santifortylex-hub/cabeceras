"use client";
import { useActionState } from "react";
import { cargarVenta, guardarTipoCambio, importarVentas } from "./actions";
import type { FormState } from "../cabeceras/actions";

function Msg({ s }: { s: FormState }) {
  if (!s) return null;
  return <div className={`rounded-md border px-3 py-2 text-sm ${s.error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{s.error ?? s.ok}</div>;
}

export function VentaForm({ sucursales, marcas }: { sucursales: { id: string; label: string }[]; marcas: { id: number; nombre: string }[] }) {
  const [s, action, pending] = useActionState<FormState, FormData>(cargarVenta, null);
  return (
    <form action={action} className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <label className="label">Cliente / Sucursal *</label>
        <select name="sucursal_id" required defaultValue="" className="input">
          <option value="" disabled>Seleccione…</option>
          {sucursales.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Línea o marca (opcional)</label>
        <select name="marca_id" className="input" defaultValue="">
          <option value="">Toda la sucursal</option>
          {marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Período de referencia *</label>
        <input type="month" name="periodo" required className="input" />
      </div>
      <div>
        <label className="label">Venta mensual promedio *</label>
        <input name="venta" inputMode="decimal" required className="input" />
      </div>
      <div>
        <label className="label">Moneda</label>
        <select name="moneda" className="input" defaultValue="UYU"><option>UYU</option><option>USD</option></select>
      </div>
      <div className="md:col-span-2"><Msg s={s} /></div>
      <div className="md:col-span-2"><button className="btn" disabled={pending}>Guardar venta</button></div>
    </form>
  );
}

export function ImportForm() {
  const [s, action, pending] = useActionState<FormState, FormData>(importarVentas, null);
  return (
    <form action={action} className="space-y-3">
      <input type="file" name="archivo" accept=".xlsx,.csv" required className="input" />
      <p className="text-xs text-slate-500">
        Columnas: <code>cliente</code>, <code>sucursal</code>, <code>venta_mensual_promedio</code>, <code>periodo</code> (AAAA-MM o MM/AAAA);
        opcionales <code>marca</code>, <code>moneda</code>. Cliente y sucursal deben existir; si ya hay una venta para ese período se actualiza.
      </p>
      <Msg s={s} />
      <button className="btn" disabled={pending}>{pending ? "Importando…" : "Importar archivo"}</button>
    </form>
  );
}

export function TipoCambioForm() {
  const [s, action, pending] = useActionState<FormState, FormData>(guardarTipoCambio, null);
  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Fecha</label><input type="date" name="fecha" required defaultValue={new Date().toISOString().slice(0, 10)} className="input" /></div>
        <div><label className="label">1 USD en UYU</label><input name="usd_uyu" inputMode="decimal" required className="input" /></div>
      </div>
      <Msg s={s} />
      <button className="btn-ghost" disabled={pending}>Guardar cotización</button>
    </form>
  );
}
