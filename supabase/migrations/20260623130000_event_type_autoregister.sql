-- ============================================================
-- Event-type registry: auto-register on emit (self-healing, compliance-first)
-- ------------------------------------------------------------
-- system_events.event_type has a FK to event_types, so EVERY emitted type must
-- be pre-registered or the insert fails with 23503 "Key is not present in table
-- event_types" — which ABORTS the business operation that emitted it. The app
-- emits types that were never seeded (quotation.submitted, vo.*, ...), so those
-- flows break.
--
-- An append-only event ledger must NOT reject an event because its type isn't
-- catalogued yet. This BEFORE INSERT trigger upserts the type into event_types
-- (module = the segment before the first dot) so the FK is always satisfied and
-- the registry stays complete automatically — no per-emitter seeding required.
-- SECURITY DEFINER so it works regardless of the caller's role/RLS.
-- ============================================================

create or replace function public.register_event_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.event_types (event_type, module, is_active)
  values (NEW.event_type, nullif(split_part(NEW.event_type, '.', 1), ''), true)
  on conflict (event_type) do nothing;
  return NEW;
end $$;

drop trigger if exists trg_register_event_type on public.system_events;
create trigger trg_register_event_type
  before insert on public.system_events
  for each row execute function public.register_event_type();

-- Catalog any types already present in the ledger (no-op if empty).
insert into public.event_types (event_type, module, is_active)
select distinct se.event_type,
       nullif(split_part(se.event_type, '.', 1), ''),
       true
  from public.system_events se
 where se.event_type is not null
on conflict (event_type) do nothing;

NOTIFY pgrst, 'reload schema';
