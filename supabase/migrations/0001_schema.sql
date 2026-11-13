-- =====================================================================
-- FORTYLEX · Gestión y rentabilidad de cabeceras comerciales
-- Migración 0001: esquema, funciones, vistas, RLS, auditoría y storage
-- =====================================================================


-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type rol_usuario as enum ('admin', 'supervisor', 'vendedor');
create type moneda_t as enum ('UYU', 'USD');
create type estado_cabecera as enum (
  'pendiente_aprobacion', 'aprobada', 'activa', 'en_observacion',
  'no_rentable', 'en_revision', 'finalizada', 'dada_de_baja'
);
create type tipo_alerta as enum (
  'inversion_elevada', 'sin_ventas', 'proxima_a_vencer',
  'vencida', 'necesita_revision', 'ventas_desactualizadas'
);
create type clasificacion_t as enum ('rentable', 'seguimiento', 'no_rentable', 'sin_datos');

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Perfiles (extiende auth.users)
-- ---------------------------------------------------------------------
create table public.perfiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  nombre        text not null,
  email         text not null,
  rol           rol_usuario not null default 'vendedor',
  supervisor_id uuid references public.perfiles(id) on delete set null,
  activo        boolean not null default true,
  es_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.perfiles (supervisor_id);
create trigger perfiles_updated before update on public.perfiles
  for each row execute function public.set_updated_at();

-- El rol se toma de app_metadata (no editable por el usuario).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre, email, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_app_meta_data->>'rol')::rol_usuario, 'vendedor')
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers de permisos (security definer para evitar recursión de RLS)
create or replace function public.auth_rol() returns rol_usuario
language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid() and activo
$$;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_rol() = 'admin', false)
$$;

-- ¿El usuario actual puede ver una cabecera con este vendedor/supervisor?
create or replace function public.puede_ver(p_vendedor uuid, p_supervisor uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.auth_rol() = 'admin' then true
    when public.auth_rol() = 'supervisor' then
      p_supervisor = auth.uid()
      or exists (select 1 from public.perfiles v where v.id = p_vendedor and v.supervisor_id = auth.uid())
    when public.auth_rol() = 'vendedor' then p_vendedor = auth.uid()
    else false
  end
$$;

-- ---------------------------------------------------------------------
-- Maestros
-- ---------------------------------------------------------------------
create table public.marcas (
  id     smallint generated always as identity primary key,
  nombre text not null unique,
  activa boolean not null default true
);

create table public.clientes (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  documento  text,
  activo     boolean not null default true,
  es_demo    boolean not null default false,
  created_by uuid references public.perfiles(id),
  created_at timestamptz not null default now()
);
create unique index clientes_nombre_uk on public.clientes (lower(nombre));

create table public.sucursales (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  nombre     text not null,
  direccion  text,
  contacto   text,
  es_demo    boolean not null default false,
  created_by uuid references public.perfiles(id),
  created_at timestamptz not null default now()
);
create unique index sucursales_uk on public.sucursales (cliente_id, lower(nombre));

-- ---------------------------------------------------------------------
-- Cabeceras
-- ---------------------------------------------------------------------
create sequence public.cabecera_seq;

create table public.cabeceras (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique
                default ('CAB-' || lpad(nextval('public.cabecera_seq')::text, 6, '0')),
  sucursal_id   uuid not null references public.sucursales(id) on delete restrict,
  vendedor_id   uuid not null references public.perfiles(id) on delete restrict,
  supervisor_id uuid references public.perfiles(id) on delete set null,
  fecha_inicio  date not null,
  fecha_fin     date not null,
  costo         numeric(14,2) not null check (costo > 0),
  moneda        moneda_t not null,
  estado        estado_cabecera not null default 'pendiente_aprobacion',
  foto_path     text,
  observaciones text,
  contacto_local text,
  es_demo       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (fecha_fin > fecha_inicio)
);
create index on public.cabeceras (sucursal_id);
create index on public.cabeceras (vendedor_id);
create index on public.cabeceras (supervisor_id);
create index on public.cabeceras (estado);
create trigger cabeceras_updated before update on public.cabeceras
  for each row execute function public.set_updated_at();

create table public.cabecera_marcas (
  cabecera_id uuid not null references public.cabeceras(id) on delete cascade,
  marca_id    smallint not null references public.marcas(id),
  primary key (cabecera_id, marca_id)
);

-- Supervisor por defecto = supervisor del vendedor
create or replace function public.cabeceras_defaults() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.supervisor_id is null then
    select supervisor_id into new.supervisor_id from public.perfiles where id = new.vendedor_id;
  end if;
  return new;
end $$;
create trigger cabeceras_bi before insert on public.cabeceras
  for each row execute function public.cabeceras_defaults();

-- Protección de campos sensibles:
--  * costo y moneda: solo administrador
--  * estado: solo mediante fn_cambiar_estado
create or replace function public.cabeceras_protect() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    if (new.costo is distinct from old.costo or new.moneda is distinct from old.moneda)
       and not public.es_admin() then
      raise exception 'Solo el administrador puede modificar el costo de una cabecera';
    end if;
    if new.estado is distinct from old.estado
       and coalesce(current_setting('app.allow_estado', true), '') <> '1' then
      raise exception 'El estado solo puede cambiarse mediante el flujo de aprobación';
    end if;
  end if;
  return new;
end $$;
create trigger cabeceras_bu before update on public.cabeceras
  for each row execute function public.cabeceras_protect();

-- ---------------------------------------------------------------------
-- Ventas, importaciones, tipo de cambio
-- ---------------------------------------------------------------------
create table public.importaciones_ventas (
  id          uuid primary key default gen_random_uuid(),
  archivo     text not null,
  usuario_id  uuid references public.perfiles(id),
  filas_ok    int not null default 0,
  filas_error int not null default 0,
  errores     jsonb not null default '[]',
  created_at  timestamptz not null default now()
);

create table public.ventas_sucursal (
  id            uuid primary key default gen_random_uuid(),
  sucursal_id   uuid not null references public.sucursales(id) on delete cascade,
  marca_id      smallint references public.marcas(id),
  venta_mensual_promedio numeric(16,2) not null check (venta_mensual_promedio >= 0),
  moneda        moneda_t not null default 'UYU',
  periodo       date not null,          -- primer día del mes de referencia
  origen        text not null default 'manual' check (origen in ('manual','importacion')),
  importacion_id uuid references public.importaciones_ventas(id) on delete set null,
  es_demo       boolean not null default false,
  created_by    uuid references public.perfiles(id),
  created_at    timestamptz not null default now()
);
create unique index ventas_uk on public.ventas_sucursal (sucursal_id, coalesce(marca_id, 0), periodo);

create table public.tipos_cambio (
  fecha    date primary key,
  usd_uyu  numeric(10,4) not null check (usd_uyu > 0),
  es_demo  boolean not null default false,
  created_by uuid references public.perfiles(id)
);

-- ---------------------------------------------------------------------
-- Parámetros configurables
-- ---------------------------------------------------------------------
create table public.parametros_rentabilidad (
  id              uuid primary key default gen_random_uuid(),
  marca_id        smallint references public.marcas(id),   -- null = general
  umbral_rentable numeric(8,2) not null,   -- ratio <= este valor: rentable
  umbral_no_rentable numeric(8,2) not null, -- ratio > este valor: no rentable
  vigente_desde   date not null default current_date,
  created_by      uuid references public.perfiles(id),
  created_at      timestamptz not null default now(),
  check (umbral_rentable > 0 and umbral_no_rentable >= umbral_rentable)
);
create index on public.parametros_rentabilidad (marca_id, vigente_desde desc);

create table public.configuracion (
  clave       text primary key,
  valor       numeric not null,
  descripcion text
);

-- ---------------------------------------------------------------------
-- Seguimiento: estados, comentarios, bajas
-- ---------------------------------------------------------------------
create table public.transiciones_estado (
  desde estado_cabecera not null,
  hasta estado_cabecera not null,
  primary key (desde, hasta)
);

create table public.cabecera_estados_historial (
  id           uuid primary key default gen_random_uuid(),
  cabecera_id  uuid not null references public.cabeceras(id) on delete cascade,
  estado_anterior estado_cabecera,
  estado_nuevo estado_cabecera not null,
  motivo       text,
  usuario_id   uuid references public.perfiles(id),
  created_at   timestamptz not null default now()
);
create index on public.cabecera_estados_historial (cabecera_id, created_at desc);

create table public.cabecera_comentarios (
  id           uuid primary key default gen_random_uuid(),
  cabecera_id  uuid not null references public.cabeceras(id) on delete cascade,
  autor_id     uuid not null references public.perfiles(id),
  comentario   text not null check (length(trim(comentario)) > 0),
  fecha_revision date,
  created_at   timestamptz not null default now()
);
create index on public.cabecera_comentarios (cabecera_id, created_at desc);

create table public.cabecera_bajas (
  id           uuid primary key default gen_random_uuid(),
  cabecera_id  uuid not null unique references public.cabeceras(id) on delete cascade,
  fecha_baja   date not null default current_date,
  motivo       text not null,
  usuario_id   uuid not null references public.perfiles(id),
  observaciones text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Alertas, notificaciones, correo, auditoría
-- ---------------------------------------------------------------------
create table public.alertas (
  id          uuid primary key default gen_random_uuid(),
  cabecera_id uuid not null references public.cabeceras(id) on delete cascade,
  tipo        tipo_alerta not null,
  motivo      text not null,
  generada_en timestamptz not null default now(),
  resuelta_en timestamptz
);
create unique index alertas_abierta_uk on public.alertas (cabecera_id, tipo) where resuelta_en is null;
create index on public.alertas (generada_en desc);

create table public.notificaciones (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.perfiles(id) on delete cascade,
  alerta_id   uuid references public.alertas(id) on delete cascade,
  cabecera_id uuid references public.cabeceras(id) on delete cascade,
  titulo      text not null,
  detalle     text,
  leida       boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on public.notificaciones (usuario_id, leida, created_at desc);

create table public.correos_pendientes (
  id          uuid primary key default gen_random_uuid(),
  destinatario text not null,
  asunto      text not null,
  cuerpo      text not null,
  estado      text not null default 'pendiente' check (estado in ('pendiente','enviado','error')),
  intentos    int not null default 0,
  error       text,
  created_at  timestamptz not null default now(),
  enviado_en  timestamptz
);

create table public.auditoria (
  id          bigint generated always as identity primary key,
  tabla       text not null,
  registro_id text,
  accion      text not null,
  antes       jsonb,
  despues     jsonb,
  usuario_id  uuid,
  created_at  timestamptz not null default now()
);
create index on public.auditoria (created_at desc);
create index on public.auditoria (tabla, registro_id);

create or replace function public.fn_auditar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_id text;
begin
  if tg_op = 'DELETE' then
    v_id := coalesce(to_jsonb(old)->>'id', to_jsonb(old)->>'fecha');
    insert into public.auditoria (tabla, registro_id, accion, antes, usuario_id)
    values (tg_table_name, v_id, tg_op, to_jsonb(old), auth.uid());
    return old;
  elsif tg_op = 'UPDATE' then
    v_id := coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'fecha');
    insert into public.auditoria (tabla, registro_id, accion, antes, despues, usuario_id)
    values (tg_table_name, v_id, tg_op, to_jsonb(old), to_jsonb(new), auth.uid());
    return new;
  else
    v_id := coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'fecha');
    insert into public.auditoria (tabla, registro_id, accion, despues, usuario_id)
    values (tg_table_name, v_id, tg_op, to_jsonb(new), auth.uid());
    return new;
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['cabeceras','ventas_sucursal','parametros_rentabilidad',
                           'configuracion','tipos_cambio','perfiles','cabecera_bajas','cabecera_marcas']
  loop
    execute format('create trigger %I_audit after insert or update or delete on public.%I
                    for each row execute function public.fn_auditar()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Umbrales vigentes (por marca si la cabecera tiene una sola; si no, general)
-- ---------------------------------------------------------------------
create or replace function public.fn_umbral(p_marca smallint)
returns table (rentable numeric, no_rentable numeric)
language sql stable security definer set search_path = public as $$
  select umbral_rentable, umbral_no_rentable from (
    select umbral_rentable, umbral_no_rentable, 1 as prio, vigente_desde
      from public.parametros_rentabilidad
     where marca_id = p_marca and p_marca is not null and vigente_desde <= current_date
    union all
    select umbral_rentable, umbral_no_rentable, 2, vigente_desde
      from public.parametros_rentabilidad
     where marca_id is null and vigente_desde <= current_date
  ) x order by prio, vigente_desde desc limit 1
$$;

-- ---------------------------------------------------------------------
-- Vista de rentabilidad (ratio de inversión = costo / venta mensual × 100)
--
-- Asignación de ventas (evita duplicar la venta del local):
--  * Si hay venta cargada por marca para alguna marca de la cabecera, se reparte
--    entre las cabeceras vivas de la sucursal que incluyen esa marca.
--  * Si no, se usa la venta general de la sucursal (sin marca) repartida en
--    partes iguales entre las cabeceras vivas de la sucursal.
-- Evaluación y vigencia:
--  * Cabecera que aún no inició: sin_datos.
--  * Primeros N días desde el inicio (configuracion.dias_gracia_inicio): nunca
--    se clasifica como no_rentable (máximo "seguimiento").
-- ---------------------------------------------------------------------
insert into public.configuracion (clave, valor, descripcion) values
  ('dias_preaviso_vencimiento', 60, 'Días antes de la fecha de fin para alertar vencimiento próximo'),
  ('dias_max_sin_ventas', 90, 'Días máximos sin actualizar ventas de la sucursal'),
  ('dias_gracia_inicio', 60, 'Días desde el inicio en los que no se clasifica como no rentable');

create or replace view public.v_cabecera_rentabilidad as
with tc as (
  select usd_uyu from public.tipos_cambio order by fecha desc limit 1
),
cfg as (
  select
    coalesce((select valor from public.configuracion where clave = 'dias_gracia_inicio'), 60) as gracia
),
vivas as (
  select id, sucursal_id from public.cabeceras
   where estado not in ('finalizada', 'dada_de_baja')
),
uv as (
  select distinct on (v.sucursal_id, v.marca_id)
         v.sucursal_id, v.marca_id, v.periodo,
         case when v.moneda = 'USD' then v.venta_mensual_promedio * (select usd_uyu from tc)
              else v.venta_mensual_promedio end as venta_uyu
    from public.ventas_sucursal v
   order by v.sucursal_id, v.marca_id, v.periodo desc
),
n_marca as (
  select vi.sucursal_id, cm.marca_id, count(*) as n
    from vivas vi join public.cabecera_marcas cm on cm.cabecera_id = vi.id
   group by vi.sucursal_id, cm.marca_id
),
n_suc as (
  select sucursal_id, count(*) as n from vivas group by sucursal_id
),
v_marca as (
  select c.id as cabecera_id,
         sum(uv.venta_uyu / nm.n) as venta,
         max(uv.periodo) as periodo
    from public.cabeceras c
    join public.cabecera_marcas cm on cm.cabecera_id = c.id
    join uv on uv.sucursal_id = c.sucursal_id and uv.marca_id = cm.marca_id
    join n_marca nm on nm.sucursal_id = c.sucursal_id and nm.marca_id = cm.marca_id
   group by c.id
),
v_gen as (
  select c.id as cabecera_id, uv.venta_uyu / ns.n as venta, uv.periodo
    from public.cabeceras c
    join uv on uv.sucursal_id = c.sucursal_id and uv.marca_id is null
    join n_suc ns on ns.sucursal_id = c.sucursal_id
),
base as (
  select
    c.id as cabecera_id, c.codigo, c.estado,
    cl.id as cliente_id, cl.nombre as cliente,
    s.id as sucursal_id, s.nombre as sucursal, s.direccion,
    c.vendedor_id, pv.nombre as vendedor,
    c.supervisor_id, ps.nombre as supervisor,
    (select array_agg(m.nombre order by m.nombre)
       from public.cabecera_marcas cm join public.marcas m on m.id = cm.marca_id
      where cm.cabecera_id = c.id) as marcas,
    (select count(*) from public.cabecera_marcas cm where cm.cabecera_id = c.id) > 1 as es_mix,
    (select cm.marca_id from public.cabecera_marcas cm where cm.cabecera_id = c.id limit 1) as marca_unica,
    c.costo, c.moneda,
    case when c.moneda = 'USD' then c.costo * (select usd_uyu from tc) else c.costo end as costo_uyu,
    c.fecha_inicio, c.fecha_fin, c.foto_path, c.created_at, c.vendedor_id as _v, c.supervisor_id as _s,
    coalesce(vm.venta, vg.venta) as venta_asignada,
    coalesce(vm.periodo, vg.periodo) as ultimo_periodo,
    coalesce(b.fecha_baja,
             case when c.estado = 'finalizada' then c.fecha_fin end) as fecha_cierre,
    b.fecha_baja
  from public.cabeceras c
  join public.sucursales s on s.id = c.sucursal_id
  join public.clientes cl on cl.id = s.cliente_id
  join public.perfiles pv on pv.id = c.vendedor_id
  left join public.perfiles ps on ps.id = c.supervisor_id
  left join v_marca vm on vm.cabecera_id = c.id
  left join v_gen vg on vg.cabecera_id = c.id
  left join public.cabecera_bajas b on b.cabecera_id = c.id
),
calc as (
  select b.*,
    case when b.venta_asignada > 0 and b.costo_uyu is not null
         then round(b.costo_uyu / b.venta_asignada * 100, 2) end as ratio,
    case when b.venta_asignada > 0 and b.costo_uyu is not null
         then round(b.costo_uyu / greatest(1, ((b.fecha_fin - b.fecha_inicio) / 30.4375))
                    / b.venta_asignada * 100, 2) end as ratio_mensual,
    u.rentable as umbral_rentable, u.no_rentable as umbral_no_rentable
  from base b
  left join lateral public.fn_umbral(case when b.es_mix then null else b.marca_unica end) u on true
)
select
  cabecera_id, codigo, estado, cliente_id, cliente, sucursal_id, sucursal, direccion,
  vendedor_id, vendedor, supervisor_id, supervisor, marcas, es_mix,
  costo, moneda, costo_uyu, fecha_inicio, fecha_fin, foto_path, created_at,
  venta_asignada, ultimo_periodo, ratio, ratio_mensual,
  umbral_rentable, umbral_no_rentable, fecha_cierre, fecha_baja,
  (fecha_fin - current_date) as dias_para_vencer,
  case
    when ratio is null or umbral_rentable is null or fecha_inicio > current_date then 'sin_datos'::clasificacion_t
    when ratio <= umbral_rentable then 'rentable'::clasificacion_t
    when ratio <= umbral_no_rentable then 'seguimiento'::clasificacion_t
    when current_date - fecha_inicio <= (select gracia from cfg) then 'seguimiento'::clasificacion_t
    else 'no_rentable'::clasificacion_t
  end as clasificacion
from calc
where public.puede_ver(_v, _s);

grant select on public.v_cabecera_rentabilidad to authenticated;

-- ---------------------------------------------------------------------
-- Cambio de estado controlado
-- ---------------------------------------------------------------------
insert into public.transiciones_estado (desde, hasta) values
  ('pendiente_aprobacion','aprobada'), ('pendiente_aprobacion','dada_de_baja'),
  ('aprobada','activa'), ('aprobada','dada_de_baja'),
  ('activa','en_observacion'), ('activa','en_revision'), ('activa','no_rentable'),
  ('activa','finalizada'), ('activa','dada_de_baja'),
  ('en_observacion','activa'), ('en_observacion','en_revision'), ('en_observacion','no_rentable'),
  ('en_observacion','finalizada'), ('en_observacion','dada_de_baja'),
  ('en_revision','activa'), ('en_revision','en_observacion'), ('en_revision','no_rentable'),
  ('en_revision','finalizada'), ('en_revision','dada_de_baja'),
  ('no_rentable','activa'), ('no_rentable','en_observacion'), ('no_rentable','en_revision'),
  ('no_rentable','finalizada'), ('no_rentable','dada_de_baja');

create or replace function public.fn_cambiar_estado(
  p_cabecera uuid,
  p_estado estado_cabecera,
  p_motivo text default null,
  p_observaciones text default null,
  p_fecha_revision date default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.cabeceras;
  v_rol rol_usuario := public.auth_rol();
begin
  if v_rol is null or v_rol = 'vendedor' then
    raise exception 'No tiene permiso para cambiar el estado de una cabecera';
  end if;
  select * into c from public.cabeceras where id = p_cabecera;
  if not found then raise exception 'Cabecera inexistente'; end if;
  if not public.puede_ver(c.vendedor_id, c.supervisor_id) then
    raise exception 'La cabecera no pertenece a su equipo';
  end if;
  if c.estado = p_estado then raise exception 'La cabecera ya está en ese estado'; end if;
  if not exists (select 1 from public.transiciones_estado where desde = c.estado and hasta = p_estado) then
    raise exception 'Transición no permitida: % → %', c.estado, p_estado;
  end if;
  if p_estado in ('dada_de_baja', 'no_rentable') and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Debe indicar el motivo';
  end if;
  if p_estado = 'en_observacion' and p_fecha_revision is null then
    raise exception 'Indique la fecha en que volverá a revisarse';
  end if;

  perform set_config('app.allow_estado', '1', true);
  update public.cabeceras set estado = p_estado where id = p_cabecera;

  insert into public.cabecera_estados_historial (cabecera_id, estado_anterior, estado_nuevo, motivo, usuario_id)
  values (p_cabecera, c.estado, p_estado, p_motivo, auth.uid());

  if p_estado = 'dada_de_baja' then
    insert into public.cabecera_bajas (cabecera_id, motivo, usuario_id, observaciones)
    values (p_cabecera, p_motivo, auth.uid(), p_observaciones)
    on conflict (cabecera_id) do update
      set motivo = excluded.motivo, usuario_id = excluded.usuario_id,
          observaciones = excluded.observaciones, fecha_baja = current_date;
  end if;

  if coalesce(trim(p_observaciones), '') <> '' or p_fecha_revision is not null then
    insert into public.cabecera_comentarios (cabecera_id, autor_id, comentario, fecha_revision)
    values (p_cabecera, auth.uid(),
            coalesce(nullif(trim(p_observaciones), ''), 'Cambio a ' || p_estado::text),
            p_fecha_revision);
  end if;
end $$;
grant execute on function public.fn_cambiar_estado(uuid, estado_cabecera, text, text, date) to authenticated;

-- Al crear una cabecera se registra el estado inicial
create or replace function public.cabeceras_ai() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.cabecera_estados_historial (cabecera_id, estado_anterior, estado_nuevo, motivo, usuario_id)
  values (new.id, null, new.estado, 'Registro inicial', auth.uid());
  return new;
end $$;
create trigger cabeceras_ai after insert on public.cabeceras
  for each row execute function public.cabeceras_ai();

-- ---------------------------------------------------------------------
-- Motor de alertas (no da de baja nada: solo informa)
-- ---------------------------------------------------------------------
create or replace function public.fn_generar_alertas() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_preaviso int := coalesce((select valor from public.configuracion where clave='dias_preaviso_vencimiento'), 60);
  v_sin_ventas int := coalesce((select valor from public.configuracion where clave='dias_max_sin_ventas'), 90);
  r record; a record; v_nuevas int := 0; v_id uuid; v_admin record; v_dest uuid; v_titulo text; v_det text;
begin
  if auth.uid() is not null and not public.es_admin() then
    raise exception 'Solo el administrador puede ejecutar la verificación de alertas';
  end if;

  create temp table _cond (cabecera_id uuid, tipo tipo_alerta, motivo text) on commit drop;

  insert into _cond
  select v.cabecera_id, 'inversion_elevada',
         'Ratio de inversión ' || v.ratio || '% supera el umbral de ' || v.umbral_no_rentable || '%'
    from public.v_cabecera_rentabilidad v
   where v.clasificacion = 'no_rentable' and v.estado in ('activa','aprobada','en_observacion','en_revision','no_rentable');

  insert into _cond
  select v.cabecera_id, 'sin_ventas', 'No hay ventas cargadas para la sucursal ' || v.cliente || ' / ' || v.sucursal
    from public.v_cabecera_rentabilidad v
   where v.venta_asignada is null and v.fecha_inicio <= current_date
     and v.estado in ('activa','aprobada','en_observacion','en_revision','no_rentable');

  insert into _cond
  select v.cabecera_id, 'proxima_a_vencer', 'Vence en ' || v.dias_para_vencer || ' días (' || v.fecha_fin || ')'
    from public.v_cabecera_rentabilidad v
   where v.dias_para_vencer between 0 and v_preaviso
     and v.estado in ('activa','aprobada','en_observacion','en_revision','no_rentable');

  insert into _cond
  select v.cabecera_id, 'vencida', 'La fecha de finalización (' || v.fecha_fin || ') ya pasó y la cabecera sigue vigente'
    from public.v_cabecera_rentabilidad v
   where v.dias_para_vencer < 0
     and v.estado in ('activa','aprobada','en_observacion','en_revision','no_rentable');

  insert into _cond
  select v.cabecera_id, 'necesita_revision',
         'Fecha de revisión programada vencida (' || cc.fecha_revision || ')'
    from public.v_cabecera_rentabilidad v
    join lateral (select fecha_revision from public.cabecera_comentarios
                   where cabecera_id = v.cabecera_id and fecha_revision is not null
                   order by created_at desc limit 1) cc on true
   where v.estado = 'en_observacion' and cc.fecha_revision <= current_date;

  insert into _cond
  select v.cabecera_id, 'ventas_desactualizadas',
         'Última venta cargada: ' || to_char(v.ultimo_periodo, 'MM/YYYY') || ' (más de ' || v_sin_ventas || ' días)'
    from public.v_cabecera_rentabilidad v
   where v.ultimo_periodo is not null and v.ultimo_periodo < current_date - v_sin_ventas
     and v.estado in ('activa','aprobada','en_observacion','en_revision','no_rentable');

  -- Resolver alertas abiertas cuya condición ya no se cumple
  update public.alertas al set resuelta_en = now()
   where al.resuelta_en is null
     and not exists (select 1 from _cond c where c.cabecera_id = al.cabecera_id and c.tipo = al.tipo);

  -- Crear alertas nuevas y notificar
  for r in select * from _cond loop
    insert into public.alertas (cabecera_id, tipo, motivo)
    values (r.cabecera_id, r.tipo, r.motivo)
    on conflict (cabecera_id, tipo) where resuelta_en is null do nothing
    returning id into v_id;

    if v_id is not null then
      v_nuevas := v_nuevas + 1;
      select c.codigo, c.vendedor_id, c.supervisor_id, p.nombre as vendedor, cl.nombre as cliente, s.nombre as sucursal
        into a
        from public.cabeceras c
        join public.perfiles p on p.id = c.vendedor_id
        join public.sucursales s on s.id = c.sucursal_id
        join public.clientes cl on cl.id = s.cliente_id
       where c.id = r.cabecera_id;
      v_titulo := 'Alerta ' || a.codigo || ': ' || replace(r.tipo::text, '_', ' ');
      v_det := r.motivo || ' · ' || a.cliente || ' / ' || a.sucursal || ' · Responsable: ' || a.vendedor;

      for v_dest in
        select distinct x from (
          select a.vendedor_id as x
          union all select a.supervisor_id
          union all select id from public.perfiles where rol = 'admin' and activo
        ) q where x is not null
      loop
        insert into public.notificaciones (usuario_id, alerta_id, cabecera_id, titulo, detalle)
        values (v_dest, v_id, r.cabecera_id, v_titulo, v_det);
      end loop;

      -- correo: supervisor y administradores
      for v_admin in
        select distinct email from public.perfiles
         where activo and (id = a.supervisor_id or rol = 'admin')
      loop
        insert into public.correos_pendientes (destinatario, asunto, cuerpo)
        values (v_admin.email, '[Fortylex] ' || v_titulo, v_det || E'\n\nGenerada el ' || to_char(now(), 'DD/MM/YYYY HH24:MI'));
      end loop;
    end if;
    v_id := null;
  end loop;

  return v_nuevas;
end $$;
revoke all on function public.fn_generar_alertas() from public, anon;
grant execute on function public.fn_generar_alertas() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.perfiles enable row level security;
alter table public.marcas enable row level security;
alter table public.clientes enable row level security;
alter table public.sucursales enable row level security;
alter table public.cabeceras enable row level security;
alter table public.cabecera_marcas enable row level security;
alter table public.ventas_sucursal enable row level security;
alter table public.importaciones_ventas enable row level security;
alter table public.tipos_cambio enable row level security;
alter table public.parametros_rentabilidad enable row level security;
alter table public.configuracion enable row level security;
alter table public.transiciones_estado enable row level security;
alter table public.cabecera_estados_historial enable row level security;
alter table public.cabecera_comentarios enable row level security;
alter table public.cabecera_bajas enable row level security;
alter table public.alertas enable row level security;
alter table public.notificaciones enable row level security;
alter table public.correos_pendientes enable row level security;
alter table public.auditoria enable row level security;

-- perfiles
create policy perfiles_select on public.perfiles for select to authenticated using (true);
create policy perfiles_admin_all on public.perfiles for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- catálogos de solo lectura para todos; escritura solo admin
create policy marcas_select on public.marcas for select to authenticated using (true);
create policy marcas_admin on public.marcas for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create policy transiciones_select on public.transiciones_estado for select to authenticated using (true);
create policy tipos_cambio_select on public.tipos_cambio for select to authenticated using (true);
create policy tipos_cambio_admin on public.tipos_cambio for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy parametros_select on public.parametros_rentabilidad for select to authenticated using (true);
create policy parametros_admin on public.parametros_rentabilidad for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy configuracion_select on public.configuracion for select to authenticated using (true);
create policy configuracion_admin on public.configuracion for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- clientes y sucursales: cualquier usuario activo registra; solo admin modifica/elimina
create policy clientes_select on public.clientes for select to authenticated using (public.auth_rol() is not null);
create policy clientes_insert on public.clientes for insert to authenticated with check (public.auth_rol() is not null);
create policy clientes_admin_upd on public.clientes for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy clientes_admin_del on public.clientes for delete to authenticated using (public.es_admin());

create policy sucursales_select on public.sucursales for select to authenticated using (public.auth_rol() is not null);
create policy sucursales_insert on public.sucursales for insert to authenticated with check (public.auth_rol() is not null);
create policy sucursales_admin_upd on public.sucursales for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy sucursales_admin_del on public.sucursales for delete to authenticated using (public.es_admin());

-- cabeceras
create policy cabeceras_select on public.cabeceras for select to authenticated
  using (public.puede_ver(vendedor_id, supervisor_id));
create policy cabeceras_insert on public.cabeceras for insert to authenticated
  with check (
    estado = 'pendiente_aprobacion'
    and (public.es_admin() or (public.auth_rol() is not null and vendedor_id = auth.uid()))
  );
create policy cabeceras_update on public.cabeceras for update to authenticated
  using (
    public.es_admin()
    or (public.auth_rol() = 'supervisor' and public.puede_ver(vendedor_id, supervisor_id))
    or (vendedor_id = auth.uid() and estado = 'pendiente_aprobacion')
  )
  with check (
    public.es_admin()
    or (public.auth_rol() = 'supervisor' and public.puede_ver(vendedor_id, supervisor_id))
    or (vendedor_id = auth.uid())
  );
create policy cabeceras_delete on public.cabeceras for delete to authenticated using (public.es_admin());

create policy cabecera_marcas_select on public.cabecera_marcas for select to authenticated
  using (exists (select 1 from public.cabeceras c where c.id = cabecera_id and public.puede_ver(c.vendedor_id, c.supervisor_id)));
create policy cabecera_marcas_insert on public.cabecera_marcas for insert to authenticated
  with check (exists (select 1 from public.cabeceras c where c.id = cabecera_id
    and (public.es_admin() or (c.vendedor_id = auth.uid() and c.estado = 'pendiente_aprobacion'))));
create policy cabecera_marcas_admin on public.cabecera_marcas for delete to authenticated using (public.es_admin());

-- ventas: solo administrador (lectura y escritura). Supervisores/vendedores ven el resultado vía la vista.
create policy ventas_admin on public.ventas_sucursal for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy importaciones_admin on public.importaciones_ventas for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- historial / comentarios / bajas
create policy historial_select on public.cabecera_estados_historial for select to authenticated
  using (exists (select 1 from public.cabeceras c where c.id = cabecera_id and public.puede_ver(c.vendedor_id, c.supervisor_id)));
create policy comentarios_select on public.cabecera_comentarios for select to authenticated
  using (exists (select 1 from public.cabeceras c where c.id = cabecera_id and public.puede_ver(c.vendedor_id, c.supervisor_id)));
create policy comentarios_insert on public.cabecera_comentarios for insert to authenticated
  with check (
    autor_id = auth.uid() and public.auth_rol() in ('admin','supervisor')
    and exists (select 1 from public.cabeceras c where c.id = cabecera_id and public.puede_ver(c.vendedor_id, c.supervisor_id))
  );
create policy bajas_select on public.cabecera_bajas for select to authenticated
  using (exists (select 1 from public.cabeceras c where c.id = cabecera_id and public.puede_ver(c.vendedor_id, c.supervisor_id)));

-- alertas y notificaciones
create policy alertas_select on public.alertas for select to authenticated
  using (exists (select 1 from public.cabeceras c where c.id = cabecera_id and public.puede_ver(c.vendedor_id, c.supervisor_id)));
create policy notif_select on public.notificaciones for select to authenticated using (usuario_id = auth.uid());
create policy notif_update on public.notificaciones for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- auditoría: solo admin lee; correos_pendientes: solo service_role (sin políticas)
create policy auditoria_admin on public.auditoria for select to authenticated using (public.es_admin());

-- ---------------------------------------------------------------------
-- Storage: fotografías de cabeceras (bucket privado, URLs firmadas)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cabeceras-fotos', 'cabeceras-fotos', false, 8388608,
        array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

create policy fotos_select on storage.objects for select to authenticated
  using (bucket_id = 'cabeceras-fotos' and public.auth_rol() is not null);
create policy fotos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'cabeceras-fotos' and public.auth_rol() is not null);
create policy fotos_admin_del on storage.objects for delete to authenticated
  using (bucket_id = 'cabeceras-fotos' and public.es_admin());
