-- Dato informativo del cliente: si su compra es directa.
-- Se completa al registrar un cliente nuevo desde "Nueva cabecera" y solo un administrador puede modificarlo después.
alter table public.clientes
  add column if not exists compra_directa boolean not null default false;

comment on column public.clientes.compra_directa is 'true = el cliente compra de forma directa (dato informativo; no influye en el cálculo de rentabilidad)';
