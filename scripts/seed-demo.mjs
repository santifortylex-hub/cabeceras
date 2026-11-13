// Datos de PRUEBA claramente identificados (es_demo = true, clientes "[DEMO] ...").
// Uso: npm run seed:demo        |  Para borrarlos: npm run seed:demo -- --borrar
import { createClient } from "@supabase/supabase-js";

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
if (!url || !key) { console.error("Faltan variables de entorno de Supabase en .env.local"); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });
const PASS = "Demo-Fortylex-2026!";

if (process.argv.includes("--borrar")) {
  await sb.from("cabeceras").delete().eq("es_demo", true);
  await sb.from("ventas_sucursal").delete().eq("es_demo", true);
  await sb.from("sucursales").delete().eq("es_demo", true);
  await sb.from("clientes").delete().eq("es_demo", true);
  await sb.from("tipos_cambio").delete().eq("es_demo", true);
  const { data: us } = await sb.from("perfiles").select("id").eq("es_demo", true);
  for (const u of us ?? []) await sb.auth.admin.deleteUser(u.id);
  console.log("Datos de prueba eliminados.");
  process.exit(0);
}

async function usuario(email, nombre, rol, supervisor_id = null) {
  const { data, error } = await sb.auth.admin.createUser({
    email, password: PASS, email_confirm: true, user_metadata: { nombre }, app_metadata: { rol },
  });
  let id = data?.user?.id;
  if (error) {
    const { data: l } = await sb.auth.admin.listUsers({ perPage: 1000 });
    id = l.users.find((u) => u.email === email)?.id;
  }
  await sb.from("perfiles").update({ es_demo: true, supervisor_id }).eq("id", id);
  return id;
}

const sup = await usuario("demo.supervisor@fortylex.test", "[DEMO] Supervisor", "supervisor");
const v1 = await usuario("demo.vendedor1@fortylex.test", "[DEMO] Vendedor Uno", "vendedor", sup);
const v2 = await usuario("demo.vendedor2@fortylex.test", "[DEMO] Vendedor Dos", "vendedor", sup);

const { data: marcas } = await sb.from("marcas").select("id,nombre");
const M = Object.fromEntries(marcas.map((m) => [m.nombre, m.id]));

await sb.from("tipos_cambio").upsert({ fecha: new Date().toISOString().slice(0, 10), usd_uyu: 40, es_demo: true }, { onConflict: "fecha", ignoreDuplicates: true });

const clientes = ["[DEMO] Farmacia Central", "[DEMO] Supermercados Norte", "[DEMO] Autoservicio Sur"];
const sucs = {};
for (const nombre of clientes) {
  let { data: c } = await sb.from("clientes").select("id").eq("nombre", nombre).maybeSingle();
  if (!c) ({ data: c } = await sb.from("clientes").insert({ nombre, es_demo: true }).select("id").single());
  for (const s of ["Sucursal Centro", "Sucursal Costa"]) {
    let { data: x } = await sb.from("sucursales").select("id").eq("cliente_id", c.id).eq("nombre", s).maybeSingle();
    if (!x) ({ data: x } = await sb.from("sucursales").insert({ cliente_id: c.id, nombre: s, direccion: "Dirección de prueba 123", es_demo: true }).select("id").single());
    sucs[`${nombre}|${s}`] = x.id;
  }
}

const hoy = new Date();
const d = (meses) => { const x = new Date(hoy); x.setMonth(x.getMonth() + meses); return x.toISOString().slice(0, 10); };
const mes = (m) => { const x = new Date(hoy.getFullYear(), hoy.getMonth() + m, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-01`; };

const defs = [
  ["[DEMO] Farmacia Central|Sucursal Centro", v1, ["Ades"], -8, 4, 30000, "UYU", "activa"],
  ["[DEMO] Farmacia Central|Sucursal Costa", v1, ["Fortylex", "Kenvue"], -6, 6, 900, "USD", "activa"],
  ["[DEMO] Supermercados Norte|Sucursal Centro", v2, ["Ayudín"], -10, 2, 120000, "UYU", "activa"],
  ["[DEMO] Supermercados Norte|Sucursal Costa", v2, ["Kenvue"], -1, 11, 45000, "UYU", "pendiente_aprobacion"],
  ["[DEMO] Autoservicio Sur|Sucursal Centro", v1, ["Ades"], -12, -1, 60000, "UYU", "activa"],
  ["[DEMO] Autoservicio Sur|Sucursal Costa", v2, ["Fortylex"], -4, 8, 20000, "UYU", "activa"],
];
for (const [suc, vend, ms, ini, fin, costo, moneda, estado] of defs) {
  const { data: cab, error } = await sb.from("cabeceras").insert({
    sucursal_id: sucs[suc], vendedor_id: vend, supervisor_id: sup, fecha_inicio: d(ini), fecha_fin: d(fin),
    costo, moneda, es_demo: true, observaciones: "Dato de prueba",
  }).select("id").single();
  if (error) { console.error(suc, error.message); continue; }
  await sb.from("cabecera_marcas").insert(ms.map((m) => ({ cabecera_id: cab.id, marca_id: M[m] })));
  if (estado !== "pendiente_aprobacion") {
    // Con service role (sin auth.uid()) el trigger permite fijar el estado directamente: solo para datos demo.
    await sb.from("cabeceras").update({ estado }).eq("id", cab.id);
  }
}
const ventas = [
  ["[DEMO] Farmacia Central|Sucursal Centro", 400000], ["[DEMO] Farmacia Central|Sucursal Costa", 350000],
  ["[DEMO] Supermercados Norte|Sucursal Centro", 300000], ["[DEMO] Autoservicio Sur|Sucursal Centro", 150000],
  ["[DEMO] Autoservicio Sur|Sucursal Costa", 90000],
];
await sb.from("ventas_sucursal").delete().eq("es_demo", true);
for (const [suc, venta] of ventas)
  await sb.from("ventas_sucursal").insert({ sucursal_id: sucs[suc], venta_mensual_promedio: venta, moneda: "UYU", periodo: mes(-1), es_demo: true, origen: "manual" });

console.log("Datos de prueba cargados. Usuarios demo (contraseña " + PASS + "):\n  demo.supervisor@fortylex.test\n  demo.vendedor1@fortylex.test\n  demo.vendedor2@fortylex.test");
console.log("Luego, como administrador, use 'Ejecutar verificación ahora' en Alertas.");
