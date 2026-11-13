export type Rol = "admin" | "supervisor" | "vendedor";
export type Estado =
  | "pendiente_aprobacion" | "aprobada" | "activa" | "en_observacion"
  | "no_rentable" | "en_revision" | "finalizada" | "dada_de_baja";
export type Clasificacion = "rentable" | "seguimiento" | "no_rentable" | "sin_datos";

export interface Perfil {
  id: string; nombre: string; email: string; rol: Rol;
  supervisor_id: string | null; activo: boolean;
}

export interface FilaCabecera {
  cabecera_id: string; codigo: string; estado: Estado;
  cliente_id: string; cliente: string; compra_directa?: boolean; sucursal_id: string; sucursal: string; direccion: string | null;
  vendedor_id: string; vendedor: string; supervisor_id: string | null; supervisor: string | null;
  marcas: string[] | null; es_mix: boolean;
  costo: number; moneda: "UYU" | "USD"; costo_uyu: number | null;
  fecha_inicio: string; fecha_fin: string; foto_path: string | null; created_at: string;
  venta_asignada: number | null; ultimo_periodo: string | null;
  ratio: number | null; ratio_mensual: number | null;
  umbral_rentable: number | null; umbral_no_rentable: number | null;
  fecha_cierre: string | null; fecha_baja: string | null;
  dias_para_vencer: number; clasificacion: Clasificacion;
}

export const ESTADOS: { value: Estado; label: string }[] = [
  { value: "pendiente_aprobacion", label: "Pendiente de aprobación" },
  { value: "aprobada", label: "Aprobada" },
  { value: "activa", label: "Activa" },
  { value: "en_observacion", label: "En observación" },
  { value: "no_rentable", label: "No rentable" },
  { value: "en_revision", label: "En revisión" },
  { value: "finalizada", label: "Finalizada" },
  { value: "dada_de_baja", label: "Dada de baja" },
];
export const estadoLabel = (e: string) => ESTADOS.find((x) => x.value === e)?.label ?? e;
export const MARCAS_SIMPLES = ["Ades", "Fortylex", "Ayudín", "Kenvue"];
export const TIPO_ALERTA_LABEL: Record<string, string> = {
  inversion_elevada: "Inversión elevada respecto a las ventas",
  sin_ventas: "Sin ventas cargadas",
  proxima_a_vencer: "Próxima a vencer",
  vencida: "Fecha de finalización vencida",
  necesita_revision: "Necesita revisión",
  ventas_desactualizadas: "Ventas desactualizadas",
};
export const CLASIF_LABEL: Record<Clasificacion, string> = {
  rentable: "Rentable", seguimiento: "Requiere seguimiento", no_rentable: "No rentable", sin_datos: "Sin datos",
};
