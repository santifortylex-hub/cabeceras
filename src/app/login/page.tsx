import { login } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const msg =
    error === "credenciales" ? "Correo o contraseña incorrectos."
    : error === "inactivo" ? "Su usuario está inactivo o no tiene perfil. Contacte al administrador."
    : null;
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-900 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold tracking-tight text-brand-700">FORTYLEX</div>
          <div className="mt-1 text-sm text-slate-500">Gestión de cabeceras comerciales</div>
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
