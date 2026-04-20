-- predictions_lock_guard — enforces events.lock_at at the DB boundary.
--
-- Ultimate authority on lock state. Server actions fast-fail ahead of this,
-- but this trigger is the source of truth — no client or app code can bypass.
--
-- Reference: plans/flickering-giggling-valley.md §2 Prediction locking.

create or replace function public.reject_locked_prediction()
returns trigger
language plpgsql
as $$
declare
  v_lock_at timestamptz;
begin
  select lock_at into v_lock_at from public.events where id = new.event_id;
  if v_lock_at is null then
    raise exception 'Event % not found or lock_at unset', new.event_id;
  end if;
  if now() > v_lock_at then
    raise exception 'Predictions closed for this event'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger predictions_lock_guard
  before insert or update on public.predictions
  for each row execute function public.reject_locked_prediction();
