"use client";
import { useActionState, useState } from "react";
import { crearCabecera, type FormState } from "../actions";

interface Props {
  clientes: { nombre: string; compra_directa: boolean; sucursales: string[] }[];
  supervisores: { id: string; nombre: string }[];
  vendedores: { id: string; nombre: string }[] | null; // solo admin
  miSupervisor: string | null;
  lineas: string[];
}

export default function NuevaCabeceraForm({ clientes, supervisores, vendedores, miSupervisor, lineas }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(crearCabecera, null);
  const [cliente, setCliente] = useState("");
  const [marca, setMarca] = useState("");
  const existente = clientes.find((c) => c.nombre.toLowerCase() === cliente.trim().toLowerCase());
  const sucursales = existente?.sucursales ?? [];

  return (
    <form action={action} className="space-y-6">
      {state?.error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>}

      <section className="card grid gap-4 md:grid-cols-2">
        <h2 className="md:col-span-2 text-sm font-semibold text-slate-700">Ubicación</h2>
        <div>
          <label className="label">Cliente *</label>
          <input name="cliente" list="lista-clientes" required className="input" value={cliente}
            onChange={(e) => setCliente(e.target.value)} placeholder="Escriba o elija un cliente" />
          <datalist id="lista-clientes">{clientes.map((c) => <option key={c.nombre} value={c.nombre} />)}</datalist>
          {existente ? (
            <p className="mt-2 text-sm text-slate-600">
              Compra directa: <b className={existente.compra_directa ? "text-brand-700" : ""}>{existente.compra_directa ? "Sí" : "No"}</b>
              <span className="text-xs text-slate-400"> (dato del cliente)</span>
            </p>
          ) : cliente.trim().length >= 2 ? (
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="compra_directa" /> Compra directa
              <span className="text-xs text-slate-400">(cliente nuevo: se guardará con este dato)</span>
            </label>
          ) : null}
        </div>
        <div>
          <label className="label">Sucursal / identificación *</label>
          <input name="sucursal" list="lista-sucursales" required className="input" placeholder="Ej.: Sucursal Pocitos" />
          <datalist id="lista-sucursales">{sucursales.map((s) => <option key={s} value={s} />)}</datalist>
        </div>
        <div className="md:col-span-2">
          <label className="label">Dirección o ubicación (opcional)</label>
          <input name="direccion" className="input" />
        </div>
      </section>

      <section className="card grid gap-4 md:grid-cols-2">
        <h2 className="md:col-span-2 text-sm font-semibold text-slate-700">Responsables</h2>
        {vendedores ? (
          <div>
            <label className="label">Usuario responsable *</label>
            <select name="vendedor_id" required className="input" defaultValue="">
              <option value="" disabled>Seleccione…</option>
              {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </select>
          </div>
        ) : (
          <div className="text-sm text-slate-500 self-end pb-2">El usuario responsable es usted.</div>
        )}
        <div>
          <label className="label">Supervisor responsable</label>
          <select name="supervisor_id" className="input" defaultValue={miSupervisor ?? ""}>
            <option value="">(el asignado al vendedor)</option>
            {supervisores.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
      </section>

      <section className="card grid gap-4 md:grid-cols-2">
        <h2 className="md:col-span-2 text-sm font-semibold text-slate-700">Marca, vigencia e inversión</h2>
        <div>
          <label className="label">Marca o línea *</label>
          <select name="marca" required className="input" value={marca} onChange={(e) => setMarca(e.target.value)}>
            <option value="" disabled>Seleccione…</option>
            {lineas.map((l) => <option key={l}>{l}</option>)}
            <option>Mix</option>
          </select>
        </div>
        {marca === "Mix" && (
          <fieldset>
            <legend className="label">Líneas del Mix * (mínimo 2)</legend>
            <div className="flex flex-wrap gap-3 pt-1">
              {lineas.map((l) => (
                <label key={l} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="marcas_mix" value={l} /> {l}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div>
          <label className="label">Fecha de inicio *</label>
          <input type="date" name="fecha_inicio" required className="input" />
        </div>
        <div>
          <label className="label">Fecha de finalización *</label>
          <input type="date" name="fecha_fin" required className="input" />
        </div>
        <div>
          <label className="label">Costo de la cabecera en pesos uruguayos (UYU), SIN IMPUESTOS *</label>
          <input type="number" name="costo" required min="0.01" step="0.01" className="input" />
          <p className="mt-1 text-xs font-medium text-brand-700">Ingrese el importe SIN IMPUESTOS (IVA no incluido), en pesos uruguayos.</p>
        </div>
      </section>

      <section className="card grid gap-4">
        <h2 className="text-sm font-semibold text-slate-700">Complementarios</h2>
        <div>
          <label className="label">Fotografía del mueble</label>
          <input type="file" name="foto" accept="image/*" capture="environment" className="input" />
        </div>
        <div>
          <label className="label">Observaciones</label>
          <textarea name="observaciones" rows={3} className="input" />
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button className="btn" disabled={pending}>{pending ? "Guardando…" : "Registrar cabecera"}</button>
      </div>
    </form>
  );
}
