import { login } from "./actions";
import { Logo } from "@/components/logo";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const msg =
    error === "credenciales" ? "Correo o contraseña incorrectos."
    : error === "inactivo" ? "Su usuario está inactivo o no tiene perfil. Contacte al administrador."
    : null;
  return (
    <main className="bg-login flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border-t-4 border-brand-600 bg-white p-8 shadow-2xl">
        <div className="mb-6">
          <Logo />
          <div className="mt-2 text-sm text-slate-500">Gestión de cabeceras comerciales</div>
        </div>
        {msg && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</div>}
        <form action={login} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Correo electrónico</label>
            <input id="email" name="email" type="email" required autoComplete="username" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">Contraseña</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
          </div>
          <button className="btn w-full" type="submit">Ingresar</button>
        </form>
      </div>
    </main>
  );
}
