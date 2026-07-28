-- Fix students marker_id reassignment collisions + support atomic reorder.
-- Run in Supabase Dashboard → SQL Editor.

-- Allow unique (class_id, marker_id) to be checked at COMMIT so mid-reorder
-- temporary duplicates do not fail.
alter table students drop constraint if exists students_class_id_marker_id_key;
alter table students
  add constraint students_class_id_marker_id_key
  unique (class_id, marker_id)
  deferrable initially deferred;

create or replace function public.reassign_class_markers(p_class_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  i int := 0;
  v_school uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select school_id into v_school from profiles where id = auth.uid();
  if v_school is null then
    raise exception 'no school';
  end if;

  if not exists (
    select 1 from classes c
    where c.id = p_class_id and c.school_id = v_school
  ) then
    raise exception 'not allowed';
  end if;

  for r in
    select id
    from students
    where class_id = p_class_id
    order by
      case when student_no ~ '^[0-9]+$' then student_no::int end nulls last,
      student_no
  loop
    update students set marker_id = i where id = r.id;
    i := i + 1;
  end loop;

  if i > 50 then
    raise exception '每班最多 50 人';
  end if;
end;
$$;

grant execute on function public.reassign_class_markers(uuid) to authenticated;
