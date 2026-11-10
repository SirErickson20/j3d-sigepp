-- J3D SIGEPP — ejecutar en Supabase: SQL Editor → New query → Run
-- Idempotente: sirve para una base vacía o para migrar el esquema anterior.

create extension if not exists pgcrypto;

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  apellido text not null,
  email text not null,
  telefono text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clientes_email_key unique (email)
);

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  cliente_id uuid not null references public.clientes(id),
  estado text not null default 'Pendiente de presupuesto',
  producto text not null,
  colores text[] not null default '{}',
  cantidad integer not null check (cantidad > 0),
  diseno text not null,
  archivo_nombre text,
  archivo_url text,
  modalidad_entrega text not null check (modalidad_entrega in ('Retiro', 'Envío')),
  fecha_estimada date not null default (current_date + 7),
  domicilio text,
  ciudad text,
  codigo_postal text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.parametros_cotizacion (
  id uuid primary key default gen_random_uuid(),
  precio_material_kg numeric not null check (precio_material_kg > 0),
  energia_importe numeric not null check (energia_importe > 0),
  energia_dias numeric not null check (energia_dias > 0),
  valor_impresora numeric not null check (valor_impresora > 0),
  porcentaje_mantenimiento numeric not null check (porcentaje_mantenimiento >= 0),
  vida_util_anos numeric not null check (vida_util_anos > 0),
  mano_obra_hora numeric not null check (mano_obra_hora > 0),
  porcentaje_impuestos numeric not null check (porcentaje_impuestos >= 0),
  laca_cm3_envase numeric not null default 0 check (laca_cm3_envase >= 0),
  laca_cm3_por_pieza numeric not null default 0 check (laca_cm3_por_pieza >= 0),
  laca_precio numeric not null default 0 check (laca_precio >= 0),
  acetona_precio_cm3 numeric not null default 0 check (acetona_precio_cm3 >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  id_cotizacion uuid not null references public.parametros_cotizacion(id),
  cantidad_material numeric not null check (cantidad_material > 0),
  tiempo_horas numeric not null check (tiempo_horas > 0),
  cantidad_laca numeric not null default 0 check (cantidad_laca >= 0),
  acetona_cm3 numeric not null default 0 check (acetona_cm3 >= 0),
  fecha_entrega date not null,
  total_calculado numeric not null,
  total numeric not null,
  estado text not null default 'Generado',
  created_at timestamptz not null default now()
);

-- Migración: si pedidos todavía tiene columnas de cliente, pasarlas a clientes.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pedidos'
      and column_name = 'email'
  ) then
    alter table public.pedidos add column if not exists cliente_id uuid;

    insert into public.clientes (nombre, apellido, email, telefono)
    select distinct on (lower(trim(email)))
      cliente_nombre,
      cliente_apellido,
      lower(trim(email)),
      telefono
    from public.pedidos
    where email is not null and trim(email) <> ''
    order by lower(trim(email)), created_at
    on conflict (email) do nothing;

    update public.pedidos p
    set cliente_id = c.id
    from public.clientes c
    where p.cliente_id is null
      and lower(trim(p.email)) = c.email;

    alter table public.pedidos
      drop column if exists cliente_nombre,
      drop column if exists cliente_apellido,
      drop column if exists email,
      drop column if exists telefono;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pedidos'
      and column_name = 'cliente_id'
  ) then
    alter table public.pedidos
      add column cliente_id uuid not null references public.clientes(id);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pedidos'
      and column_name = 'cliente_id'
      and is_nullable = 'YES'
  ) then
    alter table public.pedidos alter column cliente_id set not null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pedidos_cliente_id_fkey'
  ) then
    alter table public.pedidos
      add constraint pedidos_cliente_id_fkey
      foreign key (cliente_id) references public.clientes(id);
  end if;
end $$;

-- Migración: cotización EAV o 4 precios fijos → parámetros del Excel.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'parametros_cotizacion'
      and column_name = 'clave'
  ) or exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'parametros_cotizacion'
      and column_name = 'precio_material'
  ) then
    alter table public.presupuestos drop constraint if exists presupuestos_id_cotizacion_fkey;
    drop table if exists public.parametros_cotizacion_new;

    create table public.parametros_cotizacion_new (
      id uuid primary key default gen_random_uuid(),
      precio_material_kg numeric not null check (precio_material_kg > 0),
      energia_importe numeric not null check (energia_importe > 0),
      energia_dias numeric not null check (energia_dias > 0),
      valor_impresora numeric not null check (valor_impresora > 0),
      porcentaje_mantenimiento numeric not null check (porcentaje_mantenimiento >= 0),
      vida_util_anos numeric not null check (vida_util_anos > 0),
      mano_obra_hora numeric not null check (mano_obra_hora > 0),
      porcentaje_impuestos numeric not null check (porcentaje_impuestos >= 0),
      laca_cm3_envase numeric not null default 0 check (laca_cm3_envase >= 0),
      laca_cm3_por_pieza numeric not null default 0 check (laca_cm3_por_pieza >= 0),
      laca_precio numeric not null default 0 check (laca_precio >= 0),
      acetona_precio_cm3 numeric not null default 0 check (acetona_precio_cm3 >= 0),
      updated_at timestamptz not null default now()
    );

    insert into public.parametros_cotizacion_new (
      precio_material_kg, energia_importe, energia_dias, valor_impresora,
      porcentaje_mantenimiento, vida_util_anos, mano_obra_hora, porcentaje_impuestos,
      laca_cm3_envase, laca_cm3_por_pieza, laca_precio, acetona_precio_cm3, updated_at
    )
    values (16000, 150000, 31, 400000, 0.3, 1, 700, 0, 390, 2, 7000, 0, now());

    drop table public.parametros_cotizacion;
    alter table public.parametros_cotizacion_new rename to parametros_cotizacion;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'presupuestos'
        and column_name = 'id_cotizacion'
    ) then
      update public.presupuestos
      set id_cotizacion = (
        select id from public.parametros_cotizacion order by updated_at desc limit 1
      );
    end if;
  end if;
end $$;

-- Migración: presupuesto guarda cantidades + id_cotizacion, no los precios.
do $$
declare
  v_cotizacion_id uuid;
begin
  select id into v_cotizacion_id
  from public.parametros_cotizacion
  order by updated_at desc
  limit 1;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'presupuestos'
      and column_name = 'material'
  ) then
    alter table public.presupuestos
      add column if not exists id_cotizacion uuid,
      add column if not exists cantidad_material numeric;

    update public.presupuestos p
    set
      id_cotizacion = coalesce(p.id_cotizacion, v_cotizacion_id),
      cantidad_material = coalesce(
        p.cantidad_material,
        (select ped.cantidad from public.pedidos ped where ped.id = p.pedido_id),
        1
      );

    alter table public.presupuestos
      drop column if exists material,
      drop column if exists electricidad,
      drop column if exists desgaste,
      drop column if exists mano_obra;

    if v_cotizacion_id is not null then
      alter table public.presupuestos alter column id_cotizacion set not null;
    end if;

    alter table public.presupuestos alter column cantidad_material set not null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'presupuestos_id_cotizacion_fkey'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'presupuestos'
      and column_name = 'id_cotizacion'
  ) then
    alter table public.presupuestos
      add constraint presupuestos_id_cotizacion_fkey
      foreign key (id_cotizacion) references public.parametros_cotizacion(id);
  end if;
end $$;

alter table public.presupuestos
  add column if not exists fecha_entrega date,
  add column if not exists cantidad_laca numeric,
  add column if not exists acetona_cm3 numeric,
  add column if not exists total_calculado numeric;

update public.presupuestos p
set fecha_entrega = coalesce(p.fecha_entrega, ped.fecha_estimada, current_date + 7)
from public.pedidos ped
where p.pedido_id = ped.id
  and p.fecha_entrega is null;

update public.presupuestos
set fecha_entrega = current_date + 7
where fecha_entrega is null;

update public.presupuestos
set
  cantidad_laca = coalesce(cantidad_laca, 0),
  acetona_cm3 = coalesce(acetona_cm3, 0),
  total_calculado = coalesce(total_calculado, total);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'presupuestos'
      and column_name = 'fecha_entrega'
      and is_nullable = 'YES'
  ) then
    alter table public.presupuestos alter column fecha_entrega set not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'presupuestos'
      and column_name = 'cantidad_laca'
      and is_nullable = 'YES'
  ) then
    alter table public.presupuestos alter column cantidad_laca set not null;
    alter table public.presupuestos alter column cantidad_laca set default 0;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'presupuestos'
      and column_name = 'acetona_cm3'
      and is_nullable = 'YES'
  ) then
    alter table public.presupuestos alter column acetona_cm3 set not null;
    alter table public.presupuestos alter column acetona_cm3 set default 0;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'presupuestos'
      and column_name = 'total_calculado'
      and is_nullable = 'YES'
  ) then
    alter table public.presupuestos alter column total_calculado set not null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'presupuestos_id_cotizacion_fkey'
  ) then
    alter table public.presupuestos
      add constraint presupuestos_id_cotizacion_fkey
      foreign key (id_cotizacion) references public.parametros_cotizacion(id);
  end if;
end $$;

alter table public.pedidos
  alter column estado set default 'Pendiente de presupuesto';

-- Migración: el estado viejo "Enviado" equivale a "Disponible" (HU-09).
update public.presupuestos set estado = 'Disponible' where estado = 'Enviado';

-- Migración: un pedido con presupuesto Disponible ya no espera presupuesto (HU-09).
update public.pedidos p
set estado = 'Pendiente de seña', updated_at = now()
where p.estado = 'Pendiente de presupuesto'
  and (
    select q.estado from public.presupuestos q
    where q.pedido_id = p.id
    order by q.created_at desc
    limit 1
  ) = 'Disponible';

-- El presupuesto solo tiene los estados del TP: Generado (HU-08) y Disponible (HU-09).
alter table public.presupuestos alter column estado set default 'Generado';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'presupuestos_estado_check'
  ) then
    alter table public.presupuestos
      add constraint presupuestos_estado_check
      check (estado in ('Generado', 'Disponible'));
  end if;
end $$;

alter table public.clientes enable row level security;
alter table public.pedidos enable row level security;
alter table public.parametros_cotizacion enable row level security;
alter table public.presupuestos enable row level security;

insert into public.parametros_cotizacion (
  precio_material_kg, energia_importe, energia_dias, valor_impresora,
  porcentaje_mantenimiento, vida_util_anos, mano_obra_hora, porcentaje_impuestos,
  laca_cm3_envase, laca_cm3_por_pieza, laca_precio, acetona_precio_cm3
)
select 16000, 150000, 31, 400000, 0.3, 1, 700, 0, 390, 2, 7000, 0
where not exists (select 1 from public.parametros_cotizacion);

insert into storage.buckets (id, name, public)
values ('referencias', 'referencias', false)
on conflict (id) do nothing;

-- =====================================================================
-- Correcciones de la inspección del TP3 (errores 1, 4, 6, 7 y 11) y del TP7.
-- Idempotente: se puede volver a ejecutar sin romper nada.
-- =====================================================================

-- HU-01 / error 1: usuarios con rol de operador. El rol lo lee solo el servidor (clave de servicio).
-- Para dar de alta un operador: node scripts/crear-operador.mjs <email> "<nombre>"
create table if not exists public.operadores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.operadores enable row level security;

-- Error 4: el tipo de producto, el estado y la cantidad se controlan también en la base.
-- NOT VALID: se aplica a los pedidos nuevos sin rechazar los que ya estaban cargados.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pedidos_producto_check') then
    alter table public.pedidos add constraint pedidos_producto_check
      check (producto in ('Mate', 'Llavero', 'Medalla', 'Vaso', 'Juguete', 'Maceta', 'Soporte', 'Otros')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'pedidos_estado_check') then
    alter table public.pedidos add constraint pedidos_estado_check
      check (estado in ('Pendiente de presupuesto', 'En rediseño', 'Pendiente de seña', 'En producción',
                        'Finalizado', 'Pendiente de saldo', 'Entregado')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'pedidos_cantidad_maxima_check') then
    alter table public.pedidos add constraint pedidos_cantidad_maxima_check
      check (cantidad between 1 and 500) not valid;
  end if;
end $$;

-- Error 11: "En rediseño" es una etapa opcional. Se registra si el pedido pasó por ella
-- para no mostrarla como cumplida cuando nunca ocurrió.
alter table public.pedidos add column if not exists paso_por_rediseno boolean not null default false;
update public.pedidos set paso_por_rediseno = true where estado = 'En rediseño' and not paso_por_rediseno;

create or replace function public.marcar_paso_por_rediseno()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.estado = 'En rediseño' then
    new.paso_por_rediseno := true;
  end if;
  return new;
end;
$$;

drop trigger if exists pedidos_marcar_rediseno on public.pedidos;
create trigger pedidos_marcar_rediseno
  before insert or update of estado on public.pedidos
  for each row execute function public.marcar_paso_por_rediseno();

-- Error 7: un pedido no puede tener dos presupuestos "Generado" a la vez.
-- Si ya había duplicados, se conserva el más reciente.
delete from public.presupuestos p
using public.presupuestos q
where p.estado = 'Generado'
  and q.estado = 'Generado'
  and p.pedido_id = q.pedido_id
  and (p.created_at, p.id) < (q.created_at, q.id);

create unique index if not exists presupuestos_un_generado_por_pedido
  on public.presupuestos (pedido_id)
  where estado = 'Generado';

-- Error 6: publicar el presupuesto y pasar el pedido a "Pendiente de seña" en una sola transacción.
-- Devuelve 'ok', o 'conflicto' si el presupuesto o el pedido cambiaron mientras tanto (no modifica nada).
create or replace function public.publicar_presupuesto(
  p_presupuesto_id uuid,
  p_pedido_id uuid,
  p_fecha_entrega date,
  p_total numeric
)
returns text
language plpgsql
set search_path = public
as $$
begin
  if p_total is null or p_total <= 0 then
    raise exception 'El monto del presupuesto debe ser mayor a 0.';
  end if;

  update public.presupuestos
  set fecha_entrega = p_fecha_entrega, total = p_total, estado = 'Disponible'
  where id = p_presupuesto_id
    and pedido_id = p_pedido_id
    and estado = 'Generado';
  if not found then
    return 'conflicto';
  end if;

  update public.pedidos
  set estado = 'Pendiente de seña', fecha_estimada = p_fecha_entrega, updated_at = now()
  where id = p_pedido_id
    and estado in ('Pendiente de presupuesto', 'En rediseño');
  if not found then
    -- Deshace la publicación: la función corre dentro de una transacción.
    raise exception using errcode = 'P0001', message = 'conflicto';
  end if;

  return 'ok';
exception
  when raise_exception then
    if sqlerrm = 'conflicto' then
      return 'conflicto';
    end if;
    raise;
end;
$$;

-- Las funciones de public se pueden llamar desde la API pública: esta solo la usa el servidor.
revoke all on function public.publicar_presupuesto(uuid, uuid, date, numeric) from public, anon, authenticated;
grant execute on function public.publicar_presupuesto(uuid, uuid, date, numeric) to service_role;
revoke all on function public.marcar_paso_por_rediseno() from public, anon, authenticated;

-- Lineamiento 1 del TP7: los archivos de referencia dejan de tener enlace público.
-- El operador los ve con enlaces temporales generados por el servidor.
update storage.buckets set public = false where id = 'referencias';