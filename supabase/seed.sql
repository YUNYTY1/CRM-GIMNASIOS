-- =====================================================================
--  GYM QR CRM · seed.sql  (DATOS FICTICIOS PARA PRUEBAS Y DEMOS)
--  Ejecutar DESPUÉS de schema.sql. Es opcional: puedes ignorarlo.
--  Todo lo que crea queda marcado con es_demo = true.
--  Para quitarlo: supabase/borrar_demo.sql
-- =====================================================================
do $$
declare
  v_hoy  date := (now() at time zone 'America/Lima')::date;
  v_men  bigint; v_tri bigint; v_anu bigint;
  v_plan bigint; v_dias int; v_precio numeric;
  v_socio bigint; v_mem bigint;
  r record;
begin
  insert into public.planes (nombre, duracion_dias, precio, es_demo) values
    ('Mensual', 30, 90, true), ('Trimestral', 90, 240, true), ('Anual', 365, 850, true)
  on conflict (nombre) do nothing;

  select id into v_men from public.planes where nombre = 'Mensual';
  select id into v_tri from public.planes where nombre = 'Trimestral';
  select id into v_anu from public.planes where nombre = 'Anual';

  -- nombre, dni, telefono, plan(M/T/A), fin (días desde hoy), pendiente, estado
  for r in select * from (values
    ('Carlos Mendoza Quispe',  '99900001', '987000001', 'M',  20, 0,  'activo'),   -- vigente
    ('Lucía Fernández Rojas',  '99900002', '987000002', 'T',  60, 0,  'activo'),   -- vigente
    ('Jorge Huamán Salas',     '99900003', '987000003', 'A', 250, 0,  'activo'),   -- vigente
    ('María Torres Vega',      '99900004', '987000004', 'M',  15, 0,  'activo'),   -- vigente
    ('Diego Paredes Cruz',     '99900005', '987000005', 'T',  45, 0,  'activo'),   -- vigente
    ('Andrea Ramos Flores',    '99900006', '987000006', 'M',   6, 0,  'activo'),   -- por vencer (6 días)
    ('Luis Castillo Díaz',     '99900007', '987000007', 'M',   4, 0,  'activo'),   -- por vencer (4 días)
    ('Sofía Chávez Luna',      '99900008', '987000008', 'M',   2, 0,  'activo'),   -- vence pronto (2 días, amarillo)
    ('Pedro Gutiérrez Ortiz',  '99900009', '987000009', 'M',  -5, 0,  'activo'),   -- vencida
    ('Valeria Soto Medina',    '99900010', '987000010', 'T', -20, 0,  'activo'),   -- vencida
    ('Raúl Vargas León',       '99900011', '987000011', 'M', -40, 0,  'activo'),   -- vencida
    ('Camila Rivera Ponce',    '99900012', '987000012', 'M',  18, 45, 'activo'),   -- vigente con deuda
    ('Miguel Ángel Sánchez',   '99900013', '987000013', 'T',  30, 120,'activo'),   -- vigente con deuda
    ('Fiorella Navarro Cano',  '99900014', '987000014', 'M',  10, 0,  'inactivo'), -- inactivo
    ('Héctor Delgado Ruiz',    '99900015', '987000015', 'A', 120, 0,  'activo')    -- vigente
  ) as t(nombre, dni, telefono, plan, fin, pendiente, estado) loop

    v_plan := case r.plan when 'M' then v_men when 'T' then v_tri else v_anu end;
    select duracion_dias, precio into v_dias, v_precio from public.planes where id = v_plan;

    insert into public.socios (nombre, dni, telefono, correo, estado, es_demo)
    values (r.nombre, r.dni, r.telefono,
            lower(split_part(r.nombre, ' ', 1)) || '.' || r.dni || '@demo.gym', r.estado, true)
    on conflict (dni) do nothing
    returning id into v_socio;
    continue when v_socio is null;

    insert into public.membresias (socio_id, plan_id, fecha_inicio, fecha_fin, estado)
    values (v_socio, v_plan, v_hoy + r.fin - v_dias + 1, v_hoy + r.fin,
            case when r.fin < 0 then 'vencida' when r.fin <= 7 then 'por_vencer' else 'activa' end)
    returning id into v_mem;

    insert into public.pagos (socio_id, membresia_id, monto, monto_pendiente, metodo, concepto, fecha)
    values (v_socio, v_mem, v_precio - r.pendiente, r.pendiente,
            (array['efectivo','yape','plin','transferencia','tarjeta'])[1 + (v_socio % 5)],
            (select nombre from public.planes where id = v_plan),
            ((v_hoy + r.fin - v_dias + 1)::timestamp + time '10:00') at time zone 'America/Lima');
  end loop;

  -- Pagos históricos (meses anteriores) para que el gráfico de ingresos tenga datos
  insert into public.pagos (socio_id, monto, monto_pendiente, metodo, concepto, fecha)
  select s.id, 90, 0, 'efectivo', 'Mensual',
         ((v_hoy - (m * 30 + (s.id % 9))::int)::timestamp + time '11:00') at time zone 'America/Lima'
  from public.socios s cross join generate_series(1, 5) as m
  where s.es_demo and (s.id + m) % 3 <> 0;

  -- Asistencias de los últimos 30 días (solo socios activos)
  insert into public.asistencias (socio_id, fecha_hora)
  select s.id,
         case when d = 0 then now() - interval '15 minutes' - random() * interval '5 hours'
              else (((v_hoy - d)::timestamp + time '06:00') at time zone 'America/Lima') + random() * interval '14 hours' end
  from public.socios s cross join generate_series(0, 29) as d
  where s.es_demo and s.estado = 'activo' and random() < 0.35;
end $$;
