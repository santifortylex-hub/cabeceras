import Link from "next/link";
import { requirePerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";
import type { Rol } from "@/lib/types";

const NAV: { href: string; label: string; roles: Rol[] }[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin", "supervisor", "vendedor"] },
  { href: "/cabeceras", label: "Cabeceras", roles: ["admin", "supervisor"] },
  { href: "/cabeceras/nueva", label: "Nueva cabecera", roles: ["admin", "supervisor", "vendedor"] },
  { href: "/supervisor", label: "Panel de supervisión", roles: ["admin", "supervisor"] },
  { href: "/ventas", label: "Ventas y rentabilidad", roles: ["admin"] },
  { href: "/alertas", label: "Alertas", roles: ["admin", "supervisor"] },
  { href: "/admin/usuarios", label: "Usuarios", roles: ["admin"] },
  { href: "/admin/parametros", label: "Parámetros", roles: ["admin"] },
  { href: "/admin/auditoria", label: "Auditoría", roles: ["admin"] },
];
const ROL_LABEL: Record<Rol, string> = { admin: "Administrador", supervisor: "Supervisor", vendedor: "Vendedor" };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const perfil = await requirePerfil();
  const supabase = await createClient();
  const { count } = await supabase
    .from("notificaciones").select("id", { count: "exact", head: true }).eq("leida", false);
  const items = NAV.filter((n) => n.roles.includes(perfil.rol));

  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-brand-900 text-slate-200 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0">
        <div className="flex items-center justify-between px-5 py-4 md:block">
          <div>
            <div className="text-lg font-bold tracking-tight text-white">FORTYLEX</div>
            <div className="text-xs text-slate-400">Cabeceras comerciales</div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-1 md:overflow-visible">
          {items.map((n) => (
            <Link key={n.href} href={n.href}
              className="flex items-center justify-between whitespace-nowrap rounded-md px-3 py-2 text-sm hover:bg-white/10">
              {n.label}
              {n.href === "/alertas" && !!count && (
                <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">{count}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t border-white/10 px-5 py-4 text-sm md:absolute md:bottom-0 md:block md:w-60">
          <div className="truncate font-medium text-white">{perfil.nombre}</div>
          <div className="text-xs text-slate-400">{ROL_LABEL[perfil.rol]}</div>
          <form action={logout} className="mt-2">
            <button className="text-xs text-slate-300 underline hover:text-white">Cerrar sesión</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        {children}
        <form action={logout} className="mt-10 md:hidden">
          <button className="text-xs text-slate-500 underline">Cerrar sesión ({perfil.nombre})</button>
        </form>
      </main>
    </div>
  );
}
