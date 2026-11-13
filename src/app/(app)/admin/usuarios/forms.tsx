"use client";
import { useActionState } from "react";
import { actualizarUsuario, crearUsuario, eliminarUsuario } from "./actions";
import type { FormState } from "../../cabeceras/actions";

type U = { id: string; nombre: string; email: string; rol: string; supervisor_id: string | null; activo: boolean };
type Sup = { id: string; nombre: string };

function Msg({ s }: { s: FormState }) {
  if (!s) return null;
  return <div className={`rounded-md border px-3 py-2 text-sm ${s.error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{s.error ?? s.ok}</div>;
}

export function NuevoUsuario({ sups }: { sups: Sup[] }) {
  const [s, action, pending] = useActionState<FormState, FormData>(crearUsuario, null);
  return (
    <form action={action} className="grid gap-3 md:grid-cols-3">
      <div><label className="label">Nombre *</label><input name="nombre" required className="input" /></div>
      <div><label className="label">Correo *</label><input name="email" type="email" required className="input" /></div>
      <div><label className="label">Contraseña inicial *</label><input name="password" type="password" minLength={8} required className="input" autoComplete="new-password" /></div>
      <div><label className="label">Rol *</label>
        <select name="rol" className="input" defaultValue="vendedor"><option value="vendedor">Usuario / Vendedor</option><option value="supervisor">Supervisor</option><option value="admin">Administrador</option></select></div>
      <div><label className="label">Supervisor asignado</label>
        <select name="supervisor_id" className="input" defaultValue=""><option value="">—</option>{sups.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></div>
      <div className="flex items-end"><button className="btn w-full" disabled={pending}>Crear usuario</button></div>
      <div className="md:col-span-3"><Msg s={s} /></div>
    </form>
  );
}

export function FilaUsuario({ u, sups, esYo }: { u: U; sups: Sup[]; esYo: boolean }) {
  const [s, action, pending] = useActionState<FormState, FormData>(actualizarUsuario, null);
  const [d, del, delPending] = useActionState<FormState, FormData>(eliminarUsuario, null);
  return (
    <div className="card !p-4">
      <form action={action} className="grid items-end gap-3 md:grid-cols-6">
        <input type="hidden" name="id" value={u.id} />
        <div className="md:col-span-2"><label className="label">Nombre</label><input name="nombre" defaultValue={u.nombre} className="input" /><div className="mt-1 text-xs text-slate-400">{u.email}</div></div>
        <div><label className="label">Rol</label>
          <select name="rol" defaultValue={u.rol} className="input"><option value="vendedor">Vendedor</option><option value="supervisor">Supervisor</option><option value="admin">Administrador</option></select></div>
        <div><label className="label">Supervisor</label>
          <select name="supervisor_id" defaultValue={u.supervisor_id ?? ""} className="input"><option value="">—</option>{sups.filter((x) => x.id !== u.id).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></div>
        <div><label className="label">Nueva contraseña</label><input name="password" type="password" autoComplete="new-password" placeholder="(sin cambios)" className="input" /></div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="activo" defaultChecked={u.activo} /> Activo</label>
          <button className="btn !px-3" disabled={pending}>Guardar</button>
        </div>
        <div className="md:col-span-6"><Msg s={s} /></div>
      </form>
      {!esYo && (
        <form action={del} className="mt-2 flex items-center gap-3" onSubmit={(e) => { if (!confirm(`¿Eliminar a ${u.nombre}?`)) e.preventDefault(); }}>
          <input type="hidden" name="id" value={u.id} />
          <button className="text-xs text-red-600 underline" disabled={delPending}>Eliminar usuario</button>
          {d && <span className={`text-xs ${d.error ? "text-red-600" : "text-emerald-600"}`}>{d.error ?? d.ok}</span>}
        </form>
      )}
    </div>
  );
}
