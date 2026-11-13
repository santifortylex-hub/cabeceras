/* Logo + nombre. El archivo de imagen es public/logo.png (reemplazarlo para cambiar el logo). */
export function Logo({ oscuro = false, size = 40 }: { oscuro?: boolean; size?: number }) {
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Fortylex" height={size} style={{ height: size, width: "auto" }}
        className={oscuro ? "rounded-md bg-white p-0.5" : ""} />
      <div className={`text-2xl font-bold tracking-tight ${oscuro ? "text-white" : "text-[#1a0a0a]"}`}>
        Forty<span className="text-brand-500">Lex</span>
      </div>
    </div>
  );
}
