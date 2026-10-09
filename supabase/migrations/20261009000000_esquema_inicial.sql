-- Gatito Finanzas: esquema inicial.
-- Cada fila pertenece a un usuario (user_id) y a una tienda (tienda_id).
-- Row Level Security: cada quien solo ve y modifica sus propios datos.
-- Los objetos completos van en `datos` (jsonb); las columnas aparte sirven para ordenar y filtrar.

create table public.tiendas (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  nombre text not null,
  creada_en timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.ajustes (
  user_id uuid not null default auth.uid(),
  tienda_id text not null,
  datos jsonb not null,
  actualizado_en timestamptz not null default now(),
  primary key (user_id, tienda_id),
  foreign key (user_id, tienda_id) references public.tiendas (user_id, id) on delete cascade
);

create table public.productos (
  user_id uuid not null default auth.uid(),
  tienda_id text not null,
  id text not null,
  datos jsonb not null,
  actualizado_en timestamptz not null default now(),
  primary key (user_id, tienda_id, id),
  foreign key (user_id, tienda_id) references public.tiendas (user_id, id) on delete cascade
);

create table public.reportes (
  user_id uuid not null default auth.uid(),
  tienda_id text not null,
  id text not null,
  semana date not null,
  tipo text not null check (tipo in ('parcial', 'completo')),
  datos jsonb not null,
  actualizado_en timestamptz not null default now(),
  primary key (user_id, tienda_id, id),
  foreign key (user_id, tienda_id) references public.tiendas (user_id, id) on delete cascade
);

create table public.compras (
  user_id uuid not null default auth.uid(),
  tienda_id text not null,
  id text not null,
  fecha date not null,
  datos jsonb not null,
  actualizado_en timestamptz not null default now(),
  primary key (user_id, tienda_id, id),
  foreign key (user_id, tienda_id) references public.tiendas (user_id, id) on delete cascade
);

create table public.cobros (
  user_id uuid not null default auth.uid(),
  tienda_id text not null,
  id text not null,
  fecha date not null,
  monto numeric(12, 2) not null,
  datos jsonb not null,
  actualizado_en timestamptz not null default now(),
  primary key (user_id, tienda_id, id),
  foreign key (user_id, tienda_id) references public.tiendas (user_id, id) on delete cascade
);

create index reportes_semana_idx on public.reportes (user_id, tienda_id, semana);
create index compras_fecha_idx on public.compras (user_id, tienda_id, fecha);
create index cobros_fecha_idx on public.cobros (user_id, tienda_id, fecha);

-- Seguridad por fila: solo el dueño.
do $$
declare
  t text;
begin
  foreach t in array array['tiendas', 'ajustes', 'productos', 'reportes', 'compras', 'cobros'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "solo el dueño" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end
$$;

-- Fecha de última modificación automática.
create or replace function public.tocar_actualizado_en() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['ajustes', 'productos', 'reportes', 'compras', 'cobros'] loop
    execute format(
      'create trigger tocar_actualizado_en before update on public.%I
         for each row execute function public.tocar_actualizado_en()',
      t
    );
  end loop;
end
$$;
