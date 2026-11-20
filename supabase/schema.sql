-- =====================================================================
--  GYM QR CRM · schema.sql
--  Ejecutar completo en Supabase > SQL Editor. Es seguro re-ejecutarlo.
--  Zona horaria de negocio: America/Lima
-- =====================================================================

-- ---------- Utilidades ----------
create or replace function public.hoy_lima()
returns date language sql stable
as $$ select (now() at time zone 'America/Lima')::date $$;

-- ---------- Tablas ----------
create table if not exists public.perfiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  nombre    text not null check (char_length(btrim(nombre)) >= 2),
  rol       text not null default 'recepcion' check (rol in ('admin', 'recepcion')),
  creado_en timestamptz not null default now()
);

create table if not exists public.socios (
  id         bigint generated always as identity primary key,
  nombre     text not null check (char_length(btrim(nombre)) >= 3),
  dni        text not null unique check (dni ~ '^[0-9]{8}$'),
  telefono   text not null check (telefono ~ '^9[0-9]{8}$'),
  correo     text check (correo is null or correo ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  foto_url   text,
  codigo_qr  uuid not null unique default gen_random_uuid(),
  estado     text not null default 'activo' check (estado in ('activo', 'inactivo')),
  es_demo    boolean not null default false,
  creado_en  timestamptz not null default now()
);
create index if not exists socios_telefono_idx on public.socios (telefono);
create index if not exists socios_nombre_idx on public.socios (lower(nombre));

create table if not exists public.planes (
  id            bigint generated always as identity primary key,
  nombre        text not null unique check (char_length(btrim(nombre)) >= 2),
  duracion_dias integer not null check (duracion_dias > 0 and duracion_dias <= 3650),
  precio        numeric(10,2) not null check (precio >= 0),
  activo        boolean not null default true,
  es_demo       boolean not null default false
);

create table if not exists public.membresias (
  id           bigint generated always as identity primary key,
  socio_id     bigint not null references public.socios(id) on delete cascade,
  plan_id      bigint not null references public.planes(id) on delete restrict,
  fecha_inicio date not null default public.hoy_lima(),
  fecha_fin    date not null,
  estado       text not null default 'activa' check (estado in ('activa', 'por_vencer', 'vencida')),
  creado_en    timestamptz not null default now(),
  check (fecha_fin >= fecha_inicio)
);
create index if not exists membresias_socio_fin_idx on public.membresias (socio_id, fecha_fin desc);

create table if not exists public.pagos (
  id               bigint generated always as identity primary key,
  socio_id         bigint not null references public.socios(id) on delete restrict,
  membresia_id     bigint references public.membresias(id) on delete set null,
  monto            numeric(10,2) not null check (monto >= 0),
  monto_pendiente  numeric(10,2) not null default 0 check (monto_pendiente >= 0),
  metodo           text not null check (metodo in ('efectivo', 'yape', 'plin', 'transferencia', 'tarjeta')),
  concepto         text,
  fecha            timestamptz not null default now(),
  registrado_por   uuid references public.perfiles(id) on delete set null
);
create index if not exists pagos_socio_idx on public.pagos (socio_id, fecha desc);
create index if not exists pagos_fecha_idx on public.pagos (fecha);
create index if not exists pagos_deuda_idx on public.pagos (socio_id) where monto_pendiente > 0;

create table if not exists public.asistencias (
  id             bigint generated always as identity primary key,
  socio_id       bigint not null references public.socios(id) on delete cascade,
  fecha_hora     timestamptz not null default now(),
  registrado_por uuid references public.perfiles(id) on delete set null
);
create index if not exists asistencias_socio_idx on public.asistencias (socio_id, fecha_hora desc);
create index if not exists asistencias_fecha_idx on public.asistencias (fecha_hora);

-- ---------- Perfiles ----------
-- IMPORTANTE (seguridad): los perfiles NO se crean automáticamente. Un usuario de Auth sin fila en
-- `perfiles` no puede leer ni escribir nada. Así, aunque alguien se registre con la anon key pública,
-- no obtiene acceso. Ver README (paso "Crear el primer usuario admin").
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- ---------- Rol del usuario actual ----------
create or replace function public.rol_actual()
returns text language sql stable security definer set search_path = public
as $$ select rol from public.perfiles where id = auth.uid() $$;

-- ---------- Vista: resumen por socio (membresía actual + deuda) ----------
create or replace view public.v_socios_resumen with (security_invoker = true) as
select
  s.id, s.nombre, s.dni, s.telefono, s.correo, s.foto_url, s.codigo_qr, s.estado, s.es_demo, s.creado_en,
  m.id          as membresia_id,
  m.plan_id,
  p.nombre      as plan_nombre,
  m.fecha_inicio,
  m.fecha_fin,
  case when m.id is null then null else (m.fecha_fin - public.hoy_lima()) end as dias_restantes,
  case
    when m.id is null then 'sin_membresia'
    when m.fecha_fin < public.hoy_lima() then 'vencida'
    when m.fecha_fin - public.hoy_lima() <= 7 then 'por_vencer'
    else 'activa'
  end as estado_membresia,
  coalesce(d.deuda, 0)::numeric(10,2) as deuda
from public.socios s
left join lateral (
  select * from public.membresias mm where mm.socio_id = s.id order by mm.fecha_fin desc, mm.id desc limit 1
) m on true
left join public.planes p on p.id = m.plan_id
left join lateral (
  select sum(pg.monto_pendiente) as deuda from public.pagos pg where pg.socio_id = s.id
) d on true;

-- ---------- Evaluación de acceso ----------
create or replace function public.evaluar_socio(p_socio_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  v       record;
  motivos text[] := '{}';
  nivel   text;
begin
  select * into v from public.v_socios_resumen where id = p_socio_id;
  if not found then
    return jsonb_build_object('encontrado', false, 'acceso', false, 'nivel', 'denegado',
                              'motivos', jsonb_build_array('QR no válido'), 'deuda', 0);
  end if;

  if v.estado <> 'activo' then motivos := array_append(motivos, 'Socio inactivo'::text); end if;
  if v.estado_membresia = 'sin_membresia' then motivos := array_append(motivos, 'Sin membresía'::text);
  elsif v.estado_membresia = 'vencida' then motivos := array_append(motivos, 'Membresía vencida'::text); end if;
  if v.deuda > 0 then motivos := array_append(motivos, 'Deuda pendiente'::text); end if;

  if cardinality(motivos) > 0 then nivel := 'denegado';
  elsif v.dias_restantes <= 3 then nivel := 'aviso';
  else nivel := 'permitido'; end if;

  return jsonb_build_object(
    'encontrado', true, 'socio_id', v.id, 'nombre', v.nombre, 'dni', v.dni, 'foto_url', v.foto_url,
    'estado_socio', v.estado, 'estado_membresia', v.estado_membresia,
    'fecha_fin', v.fecha_fin, 'dias_restantes', v.dias_restantes, 'deuda', v.deuda,
    'acceso', nivel <> 'denegado', 'nivel', nivel, 'motivos', to_jsonb(motivos)
  );
end $$;

-- Estado de acceso de un socio dado su codigo_qr (solo consulta, no registra asistencia)
create or replace function public.estado_acceso(p_codigo_qr uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_id bigint;
begin
  if public.rol_actual() is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  select id into v_id from public.socios where codigo_qr = p_codigo_qr;
  return public.evaluar_socio(coalesce(v_id, -1));
end $$;

-- Escaneo en puerta: evalúa, aplica anti-duplicado (5 min) y guarda la asistencia
create or replace function public.registrar_acceso(p_codigo text default null, p_dni text default null)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_socio bigint;
  v_uuid  uuid;
  v_res   jsonb;
  v_ult   timestamptz;
begin
  if public.rol_actual() is null then raise exception 'No autorizado' using errcode = '42501'; end if;

  if p_dni is not null and btrim(p_dni) <> '' then
    select id into v_socio from public.socios where dni = btrim(p_dni);
    if v_socio is null then
      return jsonb_build_object('encontrado', false, 'acceso', false, 'nivel', 'denegado',
                                'motivos', jsonb_build_array('DNI no registrado'), 'deuda', 0, 'duplicado', false);
    end if;
  else
    begin
      v_uuid := btrim(coalesce(p_codigo, ''))::uuid;
    exception when others then
      v_uuid := null;
    end;
    select id into v_socio from public.socios where codigo_qr = v_uuid;
  end if;

  v_res := public.evaluar_socio(coalesce(v_socio, -1));
  if not (v_res->>'acceso')::boolean then
    return v_res || jsonb_build_object('duplicado', false, 'registrado', false);
  end if;

  perform pg_advisory_xact_lock(v_socio);
  select max(fecha_hora) into v_ult from public.asistencias
   where socio_id = v_socio and fecha_hora > now() - interval '5 minutes';

  if v_ult is not null then
    return v_res || jsonb_build_object('duplicado', true, 'registrado', false,
             'minutos', floor(extract(epoch from (now() - v_ult)) / 60)::int);
  end if;

  insert into public.asistencias (socio_id, registrado_por) values (v_socio, auth.uid());
  return v_res || jsonb_build_object('duplicado', false, 'registrado', true);
end $$;

-- ---------- Pagos ----------
-- Registra pago y crea/renueva la membresía. Vigente: fecha_fin + duración. Vencida: desde hoy.
-- La fecha_fin es inclusiva: un plan de 30 días iniciado hoy termina hoy + 29.
create or replace function public.registrar_pago(p_socio_id bigint, p_plan_id bigint, p_monto numeric, p_metodo text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_plan  public.planes;
  v_mem   public.membresias;
  v_hoy   date := public.hoy_lima();
  v_pend  numeric(10,2);
  v_mem_id bigint;
  v_fin   date;
begin
  if public.rol_actual() is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_metodo not in ('efectivo', 'yape', 'plin', 'transferencia', 'tarjeta') then
    raise exception 'Método de pago no válido';
  end if;

  select * into v_plan from public.planes where id = p_plan_id and activo;
  if not found then raise exception 'El plan no existe o está inactivo'; end if;
  if p_monto is null or p_monto < 0 or p_monto > v_plan.precio then
    raise exception 'El monto debe estar entre 0 y el precio del plan (S/ %)', v_plan.precio;
  end if;
  perform 1 from public.socios where id = p_socio_id for update;
  if not found then raise exception 'El socio no existe'; end if;

  v_pend := v_plan.precio - p_monto;

  select * into v_mem from public.membresias where socio_id = p_socio_id order by fecha_fin desc, id desc limit 1;
  if found and v_mem.fecha_fin >= v_hoy then
    v_fin := v_mem.fecha_fin + v_plan.duracion_dias;
    update public.membresias set plan_id = p_plan_id, fecha_fin = v_fin, estado = 'activa' where id = v_mem.id;
    v_mem_id := v_mem.id;
  else
    v_fin := v_hoy + v_plan.duracion_dias - 1;
    insert into public.membresias (socio_id, plan_id, fecha_inicio, fecha_fin)
    values (p_socio_id, p_plan_id, v_hoy, v_fin) returning id into v_mem_id;
  end if;

  insert into public.pagos (socio_id, membresia_id, monto, monto_pendiente, metodo, concepto, registrado_por)
  values (p_socio_id, v_mem_id, p_monto, v_pend, p_metodo, v_plan.nombre, auth.uid());

  return jsonb_build_object('membresia_id', v_mem_id, 'fecha_fin', v_fin, 'monto_pendiente', v_pend);
end $$;

-- Abono a deuda: descuenta de los pagos con saldo pendiente (el más antiguo primero)
create or replace function public.abonar_deuda(p_socio_id bigint, p_monto numeric, p_metodo text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_deuda numeric(10,2);
  v_rest  numeric(10,2);
  r       record;
  v_desc  numeric(10,2);
begin
  if public.rol_actual() is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if p_metodo not in ('efectivo', 'yape', 'plin', 'transferencia', 'tarjeta') then
    raise exception 'Método de pago no válido';
  end if;
  perform 1 from public.socios where id = p_socio_id for update;
  if not found then raise exception 'El socio no existe'; end if;

  select coalesce(sum(monto_pendiente), 0) into v_deuda from public.pagos where socio_id = p_socio_id;
  if p_monto is null or p_monto <= 0 or p_monto > v_deuda then
    raise exception 'El abono debe ser mayor que 0 y no superar la deuda (S/ %)', v_deuda;
  end if;

  v_rest := p_monto;
  for r in select id, monto_pendiente from public.pagos
            where socio_id = p_socio_id and monto_pendiente > 0 order by fecha, id loop
    exit when v_rest <= 0;
    v_desc := least(r.monto_pendiente, v_rest);
    update public.pagos set monto_pendiente = monto_pendiente - v_desc where id = r.id;
    v_rest := v_rest - v_desc;
  end loop;

  insert into public.pagos (socio_id, monto, monto_pendiente, metodo, concepto, registrado_por)
  values (p_socio_id, p_monto, 0, p_metodo, 'Abono de deuda', auth.uid());

  return jsonb_build_object('deuda_restante', v_deuda - p_monto);
end $$;

-- ---------- Mantenimiento y dashboard ----------
create or replace function public.refrescar_estados_membresias()
returns void language sql security definer set search_path = public
as $$
  update public.membresias set estado = case
      when fecha_fin < public.hoy_lima() then 'vencida'
      when fecha_fin - public.hoy_lima() <= 7 then 'por_vencer'
      else 'activa' end
  where public.rol_actual() is not null
    and estado is distinct from case
      when fecha_fin < public.hoy_lima() then 'vencida'
      when fecha_fin - public.hoy_lima() <= 7 then 'por_vencer'
      else 'activa' end;
$$;

create or replace function public.resumen_dashboard()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_hoy date := public.hoy_lima();
begin
  if public.rol_actual() is distinct from 'admin' then
    raise exception 'Solo el administrador puede ver el dashboard' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'socios_activos', (select count(*) from public.v_socios_resumen
                        where estado = 'activo' and estado_membresia in ('activa', 'por_vencer')),
    'ingresos_mes', (select coalesce(sum(monto), 0) from public.pagos
                      where (fecha at time zone 'America/Lima')::date >= date_trunc('month', v_hoy)::date),
    'asistencias_hoy', (select count(*) from public.asistencias
                         where (fecha_hora at time zone 'America/Lima')::date = v_hoy),
    'vencen_semana', (select count(*) from public.v_socios_resumen
                       where estado = 'activo' and dias_restantes between 0 and 7),
    'por_vencer', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'telefono', telefono,
                          'fecha_fin', fecha_fin, 'dias_restantes', dias_restantes) order by dias_restantes, nombre), '[]'::jsonb)
                     from public.v_socios_resumen where estado = 'activo' and dias_restantes between 0 and 7),
    'deudores', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'telefono', telefono,
                       'deuda', deuda) order by deuda desc), '[]'::jsonb)
                   from public.v_socios_resumen where deuda > 0),
    'asistencias_30', (select jsonb_agg(jsonb_build_object('dia', to_char(d, 'YYYY-MM-DD'), 'total', coalesce(c.total, 0)) order by d)
                         from generate_series(v_hoy - 29, v_hoy, interval '1 day') as d
                         left join (select (fecha_hora at time zone 'America/Lima')::date as dia, count(*) as total
                                      from public.asistencias group by 1) c on c.dia = d::date),
    'ingresos_meses', (select jsonb_agg(jsonb_build_object('mes', to_char(m, 'YYYY-MM'), 'total', coalesce(c.total, 0)) order by m)
                         from generate_series(date_trunc('month', v_hoy) - interval '5 months', date_trunc('month', v_hoy), interval '1 month') as m
                         left join (select date_trunc('month', fecha at time zone 'America/Lima')::date as mes, sum(monto) as total
                                      from public.pagos group by 1) c on c.mes = m::date)
  );
end $$;

-- ---------- Permisos de funciones ----------
do $$
declare f text;
begin
  foreach f in array array[
    'evaluar_socio(bigint)', 'estado_acceso(uuid)', 'registrar_acceso(text,text)',
    'registrar_pago(bigint,bigint,numeric,text)', 'abonar_deuda(bigint,numeric,text)',
    'refrescar_estados_membresias()', 'resumen_dashboard()', 'rol_actual()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke all on public.v_socios_resumen from anon;
grant select on public.v_socios_resumen to authenticated;

-- ---------- Row Level Security ----------
alter table public.perfiles    enable row level security;
alter table public.socios      enable row level security;
alter table public.planes      enable row level security;
alter table public.membresias  enable row level security;
alter table public.pagos       enable row level security;
alter table public.asistencias enable row level security;

-- Se borran las políticas previas para poder re-ejecutar el script
do $$
declare p record;
begin
  for p in select policyname, tablename from pg_policies
            where schemaname = 'public' and tablename in ('perfiles','socios','planes','membresias','pagos','asistencias') loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- perfiles: cada quien ve el suyo; el admin gestiona todos
create policy perfiles_select on public.perfiles for select to authenticated
  using (id = auth.uid() or public.rol_actual() = 'admin');
create policy perfiles_admin on public.perfiles for all to authenticated
  using (public.rol_actual() = 'admin') with check (public.rol_actual() = 'admin');

-- socios: lectura para cualquier usuario con perfil; escritura solo admin
create policy socios_select on public.socios for select to authenticated using (public.rol_actual() is not null);
create policy socios_insert on public.socios for insert to authenticated with check (public.rol_actual() = 'admin');
create policy socios_update on public.socios for update to authenticated
  using (public.rol_actual() = 'admin') with check (public.rol_actual() = 'admin');
create policy socios_delete on public.socios for delete to authenticated using (public.rol_actual() = 'admin');

-- planes: lectura para todos; recepción NO puede crear, editar ni borrar
create policy planes_select on public.planes for select to authenticated using (public.rol_actual() is not null);
create policy planes_insert on public.planes for insert to authenticated with check (public.rol_actual() = 'admin');
create policy planes_update on public.planes for update to authenticated
  using (public.rol_actual() = 'admin') with check (public.rol_actual() = 'admin');
create policy planes_delete on public.planes for delete to authenticated using (public.rol_actual() = 'admin');

-- membresias, pagos, asistencias: solo lectura directa; las escrituras pasan por las funciones RPC
create policy membresias_select on public.membresias for select to authenticated using (public.rol_actual() is not null);
create policy pagos_select on public.pagos for select to authenticated using (public.rol_actual() is not null);
create policy asistencias_select on public.asistencias for select to authenticated using (public.rol_actual() is not null);

-- ---------- Storage: fotos de socios (bucket público, nombres de archivo aleatorios) ----------
insert into storage.buckets (id, name, public) values ('fotos-socios', 'fotos-socios', true)
on conflict (id) do nothing;

drop policy if exists fotos_socios_insert on storage.objects;
drop policy if exists fotos_socios_update on storage.objects;
drop policy if exists fotos_socios_delete on storage.objects;
create policy fotos_socios_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos-socios' and public.rol_actual() = 'admin');
create policy fotos_socios_update on storage.objects for update to authenticated
  using (bucket_id = 'fotos-socios' and public.rol_actual() = 'admin');
create policy fotos_socios_delete on storage.objects for delete to authenticated
  using (bucket_id = 'fotos-socios' and public.rol_actual() = 'admin');
