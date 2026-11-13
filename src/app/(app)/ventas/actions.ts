"use server";
import Papa from "papaparse";
import { readSheet } from "read-excel-file/node";
import { revalidatePath } from "next/cache";
import { requirePerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "../cabeceras/actions";

type Sb = Awaited<ReturnType<typeof createClient>>;
const esc = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

/** "2026-05", "05/2026", "2026-05-17", Date → "2026-05-01" */
function normalizarPeriodo(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-01`;
  m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}-01`;
  m = s.match(/^\d{1,2}\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}-01`;
  return null;
}
function normalizarNumero(v: unknown): number | null {
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v ?? "").trim().replace(/[^\d.,-]/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : null;
}

async function guardarVenta(sb: Sb, v: {
  sucursal_id: string; marca_id: number | null; venta: number; moneda: "UYU" | "USD";
  periodo: string; origen: "manual" | "importacion"; importacion_id?: string; user: string;
}) {
  let q = sb.from("ventas_sucursal").select("id").eq("sucursal_id", v.sucursal_id).eq("periodo", v.periodo);
  q = v.marca_id == null ? q.is("marca_id", null) : q.eq("marca_id", v.marca_id);
  const { data: ex } = await q.maybeSingle();
  const payload = {
    sucursal_id: v.sucursal_id, marca_id: v.marca_id, venta_mensual_promedio: v.venta, moneda: v.moneda,
    periodo: v.periodo, origen: v.origen, importacion_id: v.importacion_id ?? null, created_by: v.user,
  };
  return ex
    ? sb.from("ventas_sucursal").update(payload).eq("id", ex.id)
    : sb.from("ventas_sucursal").insert(payload);
}

export async function cargarVenta(_: FormState, fd: FormData): Promise<FormState> {
  const perfil = await requirePerfil(["admin"]);
  const sucursal_id = String(fd.get("sucursal_id") ?? "");
  const venta = normalizarNumero(fd.get("venta"));
  const periodo = normalizarPeriodo(fd.get("periodo"));
  const moneda = fd.get("moneda") === "USD" ? "USD" : "UYU";
  const marcaRaw = String(fd.get("marca_id") ?? "");
  if (!sucursal_id) return { error: "Seleccione la sucursal" };
  if (venta == null || venta < 0) return { error: "Venta mensual promedio inválida" };
  if (!periodo) return { error: "Período inválido" };
  const sb = await createClient();
  const { error } = await guardarVenta(sb, {
    sucursal_id, marca_id: marcaRaw ? Number(marcaRaw) : null, venta, moneda, periodo, origen: "manual", user: perfil.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/ventas");
  return { ok: "Venta registrada. Las ratios de las cabeceras vinculadas se recalcularon." };
}

export async function guardarTipoCambio(_: FormState, fd: FormData): Promise<FormState> {
  const perfil = await requirePerfil(["admin"]);
  const usd = normalizarNumero(fd.get("usd_uyu"));
  const f = String(fd.get("fecha") ?? "");
  if (!usd || usd <= 0 || !f) return { error: "Indique fecha y cotización válidas" };
  const sb = await createClient();
  const { error } = await sb.from("tipos_cambio").upsert({ fecha: f, usd_uyu: usd, es_demo: false, created_by: perfil.id });
  if (error) return { error: error.message };
  revalidatePath("/ventas");
  return { ok: "Tipo de cambio guardado" };
}

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s_-]+/g, " ");

export async function importarVentas(_: FormState, fd: FormData): Promise<FormState> {
  const perfil = await requirePerfil(["admin"]);
  const file = fd.get("archivo");
  if (!(file instanceof File) || file.size === 0) return { error: "Seleccione un archivo .xlsx o .csv" };
  const nombre = file.name.toLowerCase();

  let filas: unknown[][];
  try {
    if (nombre.endsWith(".csv")) {
      const txt = await file.text();
      const r = Papa.parse<string[]>(txt, { skipEmptyLines: true });
      filas = r.data;
    } else if (nombre.endsWith(".xlsx")) {
      filas = (await readSheet(Buffer.from(await file.arrayBuffer()))) as unknown[][];
    } else return { error: "Formato no soportado. Use .xlsx o .csv" };
  } catch (e) {
    return { error: `No se pudo leer el archivo: ${(e as Error).message}` };
  }
  if (filas.length < 2) return { error: "El archivo no tiene filas de datos" };

  const cab = filas[0].map(norm);
  const col = (...alias: string[]) => cab.findIndex((h) => alias.includes(h));
  const iCliente = col("cliente"), iSuc = col("sucursal"), iMarca = col("marca", "linea", "marca o linea");
  const iVenta = col("venta mensual promedio", "venta", "venta mensual", "venta_mensual_promedio".replace(/_/g, " "));
  const iPer = col("periodo", "periodo de referencia", "mes"), iMon = col("moneda");
  if ([iCliente, iSuc, iVenta, iPer].some((i) => i < 0))
    return { error: "Faltan columnas. Requeridas: cliente, sucursal, venta_mensual_promedio, periodo. Opcionales: marca, moneda." };

  const sb = await createClient();
  const [{ data: clientes }, { data: sucs }, { data: marcas }] = await Promise.all([
    sb.from("clientes").select("id,nombre"), sb.from("sucursales").select("id,cliente_id,nombre"), sb.from("marcas").select("id,nombre"),
  ]);
  const cMap = new Map((clientes ?? []).map((c) => [norm(c.nombre), c.id]));
  const sMap = new Map((sucs ?? []).map((s) => [`${s.cliente_id}|${norm(s.nombre)}`, s.id]));
  const mMap = new Map((marcas ?? []).map((m) => [norm(m.nombre), m.id]));

  const imp = await sb.from("importaciones_ventas").insert({ archivo: file.name, usuario_id: perfil.id }).select("id").single();
  if (imp.error) return { error: imp.error.message };

  const errores: { fila: number; motivo: string }[] = [];
  let ok = 0;
  for (let r = 1; r < filas.length; r++) {
    const f = filas[r];
    const n = r + 1;
    const clienteId = cMap.get(norm(f[iCliente]));
    if (!clienteId) { errores.push({ fila: n, motivo: `Cliente no encontrado: "${f[iCliente]}"` }); continue; }
    const sucId = sMap.get(`${clienteId}|${norm(f[iSuc])}`);
    if (!sucId) { errores.push({ fila: n, motivo: `Sucursal no encontrada: "${f[iSuc]}"` }); continue; }
    const marcaTxt = iMarca >= 0 ? String(f[iMarca] ?? "").trim() : "";
    const marcaId = marcaTxt ? mMap.get(norm(marcaTxt)) : null;
    if (marcaTxt && !marcaId) { errores.push({ fila: n, motivo: `Marca no encontrada: "${marcaTxt}"` }); continue; }
    const venta = normalizarNumero(f[iVenta]);
    if (venta == null || venta < 0) { errores.push({ fila: n, motivo: "Venta inválida" }); continue; }
    const periodo = normalizarPeriodo(f[iPer]);
    if (!periodo) { errores.push({ fila: n, motivo: `Período inválido: "${f[iPer]}"` }); continue; }
    const moneda = iMon >= 0 && norm(f[iMon]) === "usd" ? "USD" : "UYU";
    const { error } = await guardarVenta(sb, {
      sucursal_id: sucId, marca_id: marcaId ?? null, venta, moneda, periodo,
      origen: "importacion", importacion_id: imp.data.id, user: perfil.id,
    });
    if (error) errores.push({ fila: n, motivo: error.message }); else ok++;
  }
  await sb.from("importaciones_ventas").update({ filas_ok: ok, filas_error: errores.length, errores: errores.slice(0, 200) }).eq("id", imp.data.id);
  revalidatePath("/ventas");
  if (ok === 0) return { error: `No se importó ninguna fila. Primer error: fila ${errores[0]?.fila}: ${errores[0]?.motivo}` };
  return { ok: `Importación completa: ${ok} filas cargadas, ${errores.length} con error.${errores.length ? " Detalle en el historial de importaciones." : ""}` };
}
