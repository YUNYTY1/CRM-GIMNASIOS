-- =====================================================================
--  GYM QR CRM · borrar_demo.sql
--  Elimina SOLO los datos ficticios creados por seed.sql (es_demo = true).
--  Tus socios, pagos y planes reales no se tocan.
-- =====================================================================
begin;

delete from public.asistencias where socio_id in (select id from public.socios where es_demo);
delete from public.pagos       where socio_id in (select id from public.socios where es_demo);
delete from public.membresias  where socio_id in (select id from public.socios where es_demo);
delete from public.socios      where es_demo;

-- Planes de demo: solo se borran si ningún socio real los usa
delete from public.planes p
 where p.es_demo and not exists (select 1 from public.membresias m where m.plan_id = p.id);

commit;
