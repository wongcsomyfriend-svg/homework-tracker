-- Fix duplicate marker_id on student insert + ensure deferred unique for reassign.
-- Run in Supabase Dashboard → SQL Editor.

alter table students drop constraint if exists students_class_id_marker_id_key;
alter table students
  add constraint students_class_id_marker_id_key
  unique (class_id, marker_id)
  deferrable initially deferred;

create or replace function public.add_student_to_class(
  p_class_id uuid,
  p_student_no text,
  p_name text
)
returns students
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_school uuid;
  v_no text := trim(p_student_no);
  v_name text := trim(p_name);
  v_marker int;
  v_row students;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select school_id into v_school from profiles where id = v_uid;
  if v_school is null then
    raise exception 'no school';
  end if;

  if not exists (
    select 1 from classes c
    where c.id = p_class_id and c.school_id = v_school
  ) then
    raise exception 'not allowed';
  end if;

  if v_no is null or v_no = '' then
    raise exception '請填寫學號';
  end if;
  if v_name is null or v_name = '' then
    raise exception '請填寫姓名';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_class_id::text));

  if exists (
    select 1 from students
    where class_id = p_class_id and student_no = v_no
  ) then
    raise exception '學號「%」已存在，請使用其他學號', v_no;
  end if;

  if (select count(*) from students where class_id = p_class_id) >= 50 then
    raise exception '每班最多 50 人';
  end if;

  select gs.n into v_marker
  from generate_series(0, 49) as gs(n)
  where not exists (
    select 1 from students s
    where s.class_id = p_class_id and s.marker_id = gs.n
  )
  order by gs.n
  limit 1;

  if v_marker is null then
    raise exception '每班最多 50 人';
  end if;

  insert into students (class_id, student_no, name, marker_id)
  values (p_class_id, v_no, v_name, v_marker)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.add_student_to_class(uuid, text, text) to authenticated;

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
