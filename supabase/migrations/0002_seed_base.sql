-- Datos base (no son de prueba): marcas y umbrales iniciales editables.
insert into public.marcas (nombre) values ('Ades'), ('Fortylex'), ('Ayudín'), ('Kenvue')
on conflict (nombre) do nothing;

-- Umbrales de partida (SUPUESTO a validar): editables en Administración > Parámetros.
insert into public.parametros_rentabilidad (marca_id, umbral_rentable, umbral_no_rentable)
select null, 15, 30
where not exists (select 1 from public.parametros_rentabilidad where marca_id is null);
