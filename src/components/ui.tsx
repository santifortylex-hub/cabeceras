import type { Clasificacion, Estado } from "@/lib/types";
import { CLASIF_LABEL, estadoLabel } from "@/lib/types";

const ESTADO_CLS: Record<Estado, string> = {
  pendiente_aprobacion: "bg-amber-100 text-amber-800",
  aprobada: "bg-sky-100 text-sky-800",
  activa: "bg-emerald-100 text-emerald-800",
  en_observacion: "bg-orange-100 text-orange-800",
  no_rentable: "bg-red-100 text-red-800",
  en_revision: "bg-violet-100 text-violet-800",
  finalizada: "bg-slate-200 text-slate-700",
  dada_de_baja: "bg-slate-300 text-slate-700",
};
const CLASIF_CLS: Record<Clasificacion, string> = {
  rentable: "bg-emerald-100 text-emerald-800",
  seguimiento: "bg-amber-100 text-amber-800",
  no_rentable: "bg-red-100 text-red-800",
  sin_datos: "bg-slate-100 text-slate-600",
};

export const Pill = ({ cls, children }: { cls: string; children: React.ReactNode }) => (
  <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>
);
export const EstadoBadge = ({ estado }: { estado: Estado }) => <Pill cls={ESTADO_CLS[estado]}>{estadoLabel(estado)}</Pill>;
export const ClasifBadge = ({ c }: { c: Clasificacion }) => <Pill cls={CLASIF_CLS[c]}>{CLASIF_LABEL[c]}</Pill>;

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "red" | "amber" | "green" }) {
  const t = tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : tone === "green" ? "text-emerald-600" : "text-slate-900";
  return (
    <div className="card">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${t}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <div className={`mb-4 rounded-md border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
      {error ?? ok}
    </div>
  );
}

export const Empty = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">{children}</div>
);

/** Insignia informativa: el cliente compra de forma directa. */
export function DirectaBadge({ directa }: { directa?: boolean }) {
  if (!directa) return null;
  return <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">Compra directa</span>;
}
