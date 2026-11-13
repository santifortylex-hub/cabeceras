# Fortylex · Gestión y rentabilidad de cabeceras comerciales

Aplicación web (Next.js + React + TypeScript + Tailwind) sobre Supabase (PostgreSQL, Auth, Storage), lista para Vercel.

## Qué incluye

| Módulo | Ruta | Roles |
|---|---|---|
| Dashboard ejecutivo (KPI, 7 gráficos, filtros) | `/dashboard` | todos (cada uno ve lo suyo por RLS) |
| Listado y búsqueda de cabeceras | `/cabeceras` | todos |
| Alta de cabecera (Mix multi-línea, foto, costo obligatorio, código automático) | `/cabeceras/nueva` | todos |
| Ficha individual (rentabilidad, historial, observaciones, alertas, baja) | `/cabeceras/[id]` | todos; decisiones: supervisor/admin |
| Panel de supervisión | `/supervisor` | supervisor, admin |
| Ventas y rentabilidad (manual, Excel/CSV, tipo de cambio) | `/ventas` | admin |
| Centro de notificaciones y alertas | `/alertas` | todos |
| Usuarios y roles | `/admin/usuarios` | admin |
| Umbrales y parámetros de alertas | `/admin/parametros` | admin |
| Auditoría | `/admin/auditoria` | admin |

## Puesta en marcha

1. **Supabase**: cree un proyecto y, en el SQL Editor (o con `supabase db push`), ejecute en orden
   `supabase/migrations/0001_schema.sql` y `0002_seed_base.sql`.
2. En *Authentication → Providers → Email* desactive «Allow new users to sign up» (los usuarios los crea el administrador).
3. Copie `.env.example` a `.env.local` y complete URL, anon key y service role key (Project Settings → API).
4. `npm install`
5. Cree el administrador: complete `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NOMBRE` y ejecute `npm run create-admin`.
6. (Opcional) Datos de prueba identificados como demo: `npm run seed:demo`. Para eliminarlos: `npm run seed:demo -- --borrar`.
7. `npm run dev` → http://localhost:3000

## Despliegue en Vercel

1. Importe el repositorio en Vercel (framework: Next.js).
2. Cargue las variables de `.env.example` (todas, salvo las `ADMIN_*`). `CRON_SECRET` debe ser una cadena aleatoria larga.
3. `vercel.json` programa `/api/jobs/alertas` una vez por día (11:00 UTC = 08:00 Uruguay). En el plan Hobby de Vercel
   los cron jobs solo pueden correr una vez por día; con Pro pueden ser más frecuentes.
4. Correo: con `RESEND_API_KEY` y `EMAIL_FROM` (dominio verificado en Resend) se envían las alertas al supervisor y a los administradores.
   Sin esas variables los correos quedan en la tabla `correos_pendientes` y la app funciona igual.

## Reglas de negocio implementadas

- **Ratio de inversión** = costo ÷ venta mensual promedio × 100 (vista `v_cabecera_rentabilidad`). No es un ROI.
  Se informa además el **ratio mensualizado** (costo ÷ meses de vigencia ÷ venta × 100).
- **Moneda**: el costo puede estar en UYU o USD; se convierte con el último tipo de cambio cargado.
- **Ventas sin duplicar**: la venta de la sucursal se reparte entre sus cabeceras vigentes
  (por marca si hay venta cargada por marca; si no, venta general en partes iguales).
- **Umbrales** (rentable / seguimiento / no rentable) editables, generales o por marca, con historial.
  Cabecera no iniciada: sin evaluación; en los días de gracia desde el inicio no se clasifica como no rentable.
- **Alertas** (6 tipos): inversión elevada, sin ventas, próxima a vencer, vencida, necesita revisión, ventas desactualizadas.
  Notifican al supervisor, al administrador y al vendedor, con motivo y fecha; correo a supervisor y administradores.
  **Nunca dan de baja nada**: la baja la registra manualmente un supervisor o administrador (fecha, motivo, usuario, observaciones).
- **Seguridad**: RLS en todas las tablas. El vendedor no puede modificar costo ni estado; el supervisor tampoco puede modificar el costo;
  el estado solo cambia mediante `fn_cambiar_estado` (valida rol, equipo y transición). Auditoría por triggers.

## Supuestos a validar

- El **costo** es el total de la inversión del contrato (no mensual). Si fuese mensual, el ratio se interpreta distinto.
- Las ventas se cargan en UYU (también admite USD) y el tipo de cambio lo carga el administrador.
- Umbrales iniciales **15 % / 30 %** (editables en Parámetros). Son valores de partida, no una definición de negocio.
- Colores sobrios provisorios: reemplazar por la identidad corporativa en `src/app/globals.css` (`--color-brand-*`) y el logo en `(app)/layout.tsx`.

## Preparado para el futuro

La lógica vive en vistas/funciones SQL, por lo que Power BI, reportes Excel, rentabilidad por marca/vendedor/supervisor,
análisis antes/después de instalar una cabecera y proyección de ROI pueden consumir `v_cabecera_rentabilidad` y `ventas_sucursal`
(que conserva el historial por período) sin cambiar la aplicación. `ventas_sucursal.origen` e `importaciones_ventas` dejan
lugar a una importación automática. Para ROI real se agregarán margen de contribución y ventas incrementales.
