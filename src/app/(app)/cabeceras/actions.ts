"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePerfil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: string } | null;

const esc = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

const schema = z
  .object({
    cliente: z.string().trim().min(2, "Indique el cliente"),
    sucursal: z.string().trim().min(1, "Indique la sucursal"),
    direccion: z.string().trim().optional(),
    vendedor_id: z.string().uuid("Usuario responsable inválido"),
    supervisor_id: z.string().uuid().optional().or(z.literal("")),
    marca: z.enum(["Ades", "Fortylex", "Ayudín", "Kenvue", "Mix"], { message: "Seleccione la marca o línea" }),
    marcas_mix: z.array(z.string()).default([]),
    fecha_inicio: z.string().min(1, "Indique la fecha de inicio"),
    fecha_fin: z.string().min(1, "Indique la fecha de finalización"),
    costo: z.coerce.number({ message: "El costo es obligatorio" }).positive("El costo debe ser mayor a cero"),
    observaciones: z.string().trim().optional(),
  })
  .refine((v) => v.fecha_fin > v.fecha_inicio, { path: ["fecha_fin"], message: "La fecha de fin debe ser posterior a la de inicio" })
  .refine((v) => v.marca !== "Mix" || v.marcas_mix.length >= 2, { path: ["marcas_mix"], message: "Para Mix seleccione al menos dos líneas" });

export async function crearCabecera(_: FormState, fd: FormData): Promise<FormState> {
  const perfil = await requirePerfil();
  const parsed = schema.safeParse({
    cliente: fd.get("cliente"), sucursal: fd.get("sucursal"), direccion: fd.get("direccion"),
    vendedor_id: perfil.rol === "admin" ? fd.get("vendedor_id") : perfil.id,
    supervisor_id: fd.get("supervisor_id") ?? "",
    marca: fd.get("marca"), marcas_mix: fd.getAll("marcas_mix").map(String),
    fecha_inicio: fd.get("fecha_inicio"), fecha_fin: fd.get("fecha_fin"),
    costo: fd.get("costo"), observaciones: fd.get("observaciones") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const supabase = await createClient();

  // Cliente (buscar o crear)
  let clienteId: string | undefined;
  {
    const { data } = await supabase.from("clientes").select("id").ilike("nombre", esc(v.cliente)).maybeSingle();
    clienteId = data?.id;
    if (!clienteId) {
      const ins = await supabase.from("clientes").insert({ nombre: v.cliente, compra_directa: fd.get("compra_directa") === "on", created_by: perfil.id }).select("id").single();
      if (ins.error) {
        const again = await supabase.from("clientes").select("id").ilike("nombre", esc(v.cliente)).maybeSingle();
        clienteId = again.data?.id;
        if (!clienteId) return { error: `No se pudo registrar el cliente: ${ins.error.message}` };
      } else clienteId = ins.data.id;
    }
  }
  // Sucursal (buscar o crear)
  let sucursalId: string | undefined;
  {
    const { data } = await supabase.from("sucursales").select("id").eq("cliente_id", clienteId).ilike("nombre", esc(v.sucursal)).maybeSingle();
    sucursalId = data?.id;
    if (!sucursalId) {
      const ins = await supabase.from("sucursales")
        .insert({ cliente_id: clienteId, nombre: v.sucursal, direccion: v.direccion || null, created_by: perfil.id })
        .select("id").single();
      if (ins.error) return { error: `No se pudo registrar la sucursal: ${ins.error.message}` };
      sucursalId = ins.data.id;
    }
  }
  // Marcas
  const nombres = v.marca === "Mix" ? v.marcas_mix : [v.marca];
  const { data: marcas } = await supabase.from("marcas").select("id,nombre").in("nombre", nombres);
  if (!marcas || marcas.length !== nombres.length) return { error: "Alguna de las marcas seleccionadas no existe" };

  const ins = await supabase.from("cabeceras").insert({
    sucursal_id: sucursalId, vendedor_id: v.vendedor_id, supervisor_id: v.supervisor_id || null,
    fecha_inicio: v.fecha_inicio, fecha_fin: v.fecha_fin, costo: v.costo, moneda: "UYU", // el sistema trabaja solo en pesos uruguayos, sin impuestos
    observaciones: v.observaciones || null,
  }).select("id").single();
  if (ins.error) return { error: `No se pudo guardar la cabecera: ${ins.error.message}` };
  const id = ins.data.id as string;

  const cm = await supabase.from("cabecera_marcas").insert(marcas.map((m) => ({ cabecera_id: id, marca_id: m.id })));
  if (cm.error) return { error: `Cabecera creada pero falló la asignación de marcas: ${cm.error.message}` };

  // Fotografía (opcional)
  const foto = fd.get("foto");
  if (foto instanceof File && foto.size > 0) {
    if (!foto.type.startsWith("image/")) return { error: "La fotografía debe ser una imagen" };
    const safe = foto.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${id}/${Date.now()}-${safe}`;
    const up = await supabase.storage.from("cabeceras-fotos").upload(path, foto, { contentType: foto.type });
    if (!up.error) await supabase.from("cabeceras").update({ foto_path: path }).eq("id", id);
  }

  revalidatePath("/cabeceras");
  redirect(`/cabeceras/${id}`);
}

export async function cambiarEstado(_: FormState, fd: FormData): Promise<FormState> {
  await requirePerfil(["admin", "supervisor"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cambiar_estado", {
    p_cabecera: String(fd.get("id")),
    p_estado: String(fd.get("estado")),
    p_motivo: String(fd.get("motivo") ?? "") || null,
    p_observaciones: String(fd.get("observaciones") ?? "") || null,
    p_fecha_revision: String(fd.get("fecha_revision") ?? "") || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/cabeceras/${fd.get("id")}`);
  revalidatePath("/cabeceras");
  return { ok: "Estado actualizado y registrado en el historial" };
}

export async function agregarComentario(_: FormState, fd: FormData): Promise<FormState> {
  const perfil = await requirePerfil(["admin", "supervisor"]);
  const texto = String(fd.get("comentario") ?? "").trim();
  if (!texto) return { error: "Escriba un comentario" };
  const supabase = await createClient();
  const { error } = await supabase.from("cabecera_comentarios").insert({
    cabecera_id: String(fd.get("id")), autor_id: perfil.id, comentario: texto,
    fecha_revision: String(fd.get("fecha_revision") ?? "") || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/cabeceras/${fd.get("id")}`);
  return { ok: "Comentario agregado" };
}

export async function actualizarCosto(_: FormState, fd: FormData): Promise<FormState> {
  await requirePerfil(["admin"]);
  const costo = Number(fd.get("costo"));
  if (!(costo > 0)) return { error: "El costo debe ser mayor a cero" };
  const supabase = await createClient();
  const { error } = await supabase.from("cabeceras").update({ costo, moneda: "UYU" }).eq("id", String(fd.get("id")));
  if (error) return { error: error.message };
  revalidatePath(`/cabeceras/${fd.get("id")}`);
  return { ok: "Costo actualizado (queda en auditoría)" };
}

export async function reasignarSupervisor(_: FormState, fd: FormData): Promise<FormState> {
  await requirePerfil(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("cabeceras")
    .update({ supervisor_id: String(fd.get("supervisor_id")) || null }).eq("id", String(fd.get("id")));
  if (error) return { error: error.message };
  revalidatePath(`/cabeceras/${fd.get("id")}`);
  return { ok: "Supervisor actualizado" };
}

export async function actualizarCompraDirecta(_: FormState, fd: FormData): Promise<FormState> {
  await requirePerfil(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("clientes")
    .update({ compra_directa: fd.get("compra_directa") === "on" }).eq("id", String(fd.get("cliente_id")));
  if (error) return { error: error.message };
  revalidatePath(`/cabeceras/${fd.get("id")}`);
  revalidatePath("/cabeceras");
  return { ok: "Dato del cliente actualizado" };
}
