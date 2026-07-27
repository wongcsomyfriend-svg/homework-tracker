-- Homework ArUco Tracker — Supabase schema + RLS
-- Run in Supabase SQL editor after creating a project.
-- Safe to re-run on a fresh project. On an existing project, prefer
-- applying only the new ALTER / CREATE blocks if tables already exist.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique,
  created_at timestamptz not null default now()
);

-- Existing projects: add join_code if missing
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'schools' and column_name = 'join_code'
  ) then
    alter table schools add column join_code text;
    update schools
    set join_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
    where join_code is null;
    alter table schools alter column join_code set not null;
    alter table schools add constraint schools_join_code_key unique (join_code);
  end if;
end $$;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  name text not null default '',
  role text not null default 'teacher' check (role in ('teacher', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  school_year text not null,
  created_at timestamptz not null default now()
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_no text not null,
  name text not null,
  marker_id int not null check (marker_id >= 0 and marker_id < 50),
  claim_code text unique,
  claim_code_rotated_at timestamptz,
  unique (class_id, marker_id),
  unique (class_id, student_no)
);

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students' and column_name = 'claim_code'
  ) then
    alter table students add column claim_code text unique;
    alter table students add column claim_code_rotated_at timestamptz;
  end if;
end $$;

-- Backfill claim codes for existing students
update students
set
  claim_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  claim_code_rotated_at = now()
where claim_code is null;

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  title text not null,
  subject text not null default '',
  due_date date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  status text not null check (status in ('submitted', 'missing', 'late', 'excused')),
  detected_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create table if not exists scan_sessions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  detected_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists student_links (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, user_id)
);

create index if not exists student_links_user_id_idx on student_links (user_id);
create index if not exists student_links_student_id_idx on student_links (student_id);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on push_subscriptions (user_id);

create table if not exists reminder_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday int not null check (weekday >= 0 and weekday <= 6),
  time_of_day time not null,
  timezone text not null default 'Asia/Hong_Kong',
  label text not null default '',
  class_id uuid references classes(id) on delete set null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists reminder_rules_user_id_idx on reminder_rules (user_id);

create table if not exists notification_log (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references reminder_rules(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  occurrence_date date not null,
  sent_at timestamptz not null default now(),
  status text not null default 'sent',
  error text,
  unique (rule_id, occurrence_date)
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.generate_join_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.my_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from profiles where id = auth.uid()
$$;

create or replace function public.my_student_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select student_id from student_links where user_id = auth.uid()
$$;

-- Drop old auto-create school helper
drop function if exists public.ensure_my_workspace(text);

-- ---------------------------------------------------------------------------
-- Teacher workspace RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_school(p_name text default '我的學校')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_school_id uuid;
  v_code text;
  v_tries int := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from profiles where id = v_uid) then
    raise exception 'already joined a school';
  end if;

  loop
    v_code := public.generate_join_code();
    begin
      insert into schools (name, join_code)
      values (coalesce(nullif(trim(p_name), ''), '我的學校'), v_code)
      returning id into v_school_id;
      exit;
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_tries > 10 then
        raise;
      end if;
    end;
  end loop;

  insert into profiles (id, school_id, name, role)
  values (v_uid, v_school_id, '', 'admin');

  return v_school_id;
end;
$$;

create or replace function public.join_school(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_school_id uuid;
  v_code text := upper(trim(p_code));
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from profiles where id = v_uid) then
    raise exception 'already joined a school';
  end if;

  select id into v_school_id from schools where join_code = v_code;
  if v_school_id is null then
    raise exception 'invalid join code';
  end if;

  insert into profiles (id, school_id, name, role)
  values (v_uid, v_school_id, '', 'teacher');

  return v_school_id;
end;
$$;

create or replace function public.rotate_school_join_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_school_id uuid;
  v_role text;
  v_code text;
  v_tries int := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select school_id, role into v_school_id, v_role from profiles where id = v_uid;
  if v_school_id is null then
    raise exception 'no school profile';
  end if;
  if v_role <> 'admin' then
    raise exception 'only admin can rotate join code';
  end if;

  loop
    v_code := public.generate_join_code();
    begin
      update schools set join_code = v_code where id = v_school_id;
      return v_code;
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_tries > 10 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Student claim RPCs
-- ---------------------------------------------------------------------------

create or replace function public.claim_student(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(trim(p_code));
  v_student students%rowtype;
  v_class classes%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Teachers with a school profile should not claim as students on same account
  if exists (select 1 from profiles where id = v_uid) then
    raise exception 'teacher accounts cannot claim student identities';
  end if;

  select * into v_student from students where claim_code = v_code;
  if v_student.id is null then
    raise exception 'invalid claim code';
  end if;

  insert into student_links (student_id, user_id)
  values (v_student.id, v_uid)
  on conflict (student_id, user_id) do nothing;

  select * into v_class from classes where id = v_student.class_id;

  return jsonb_build_object(
    'studentId', v_student.id,
    'studentNo', v_student.student_no,
    'name', v_student.name,
    'classId', v_class.id,
    'className', v_class.name
  );
end;
$$;

create or replace function public.rotate_student_claim_code(p_student_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_tries int := 0;
begin
  if public.my_school_id() is null then
    raise exception 'not authenticated as teacher';
  end if;

  if not exists (
    select 1
    from students s
    join classes c on c.id = s.class_id
    where s.id = p_student_id and c.school_id = public.my_school_id()
  ) then
    raise exception 'student not found in your school';
  end if;

  loop
    v_code := public.generate_join_code();
    begin
      update students
      set claim_code = v_code, claim_code_rotated_at = now()
      where id = p_student_id;
      return v_code;
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_tries > 10 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

create or replace function public.unlink_student(p_student_id uuid, p_user_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Teacher unlinking a device from a school student
  if public.my_school_id() is not null then
    if not exists (
      select 1
      from students s
      join classes c on c.id = s.class_id
      where s.id = p_student_id and c.school_id = public.my_school_id()
    ) then
      raise exception 'student not found in your school';
    end if;

    if p_user_id is null then
      delete from student_links where student_id = p_student_id;
    else
      delete from student_links where student_id = p_student_id and user_id = p_user_id;
    end if;
    return;
  end if;

  -- Student unlinking self
  delete from student_links
  where student_id = p_student_id and user_id = v_uid;
end;
$$;

-- Auto-assign claim_code when teachers insert students
create or replace function public.students_set_claim_code()
returns trigger
language plpgsql
as $$
begin
  if new.claim_code is null or new.claim_code = '' then
    new.claim_code := public.generate_join_code();
    new.claim_code_rotated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists students_claim_code_trg on students;
create trigger students_claim_code_trg
before insert on students
for each row execute function public.students_set_claim_code();

grant execute on function public.create_school(text) to authenticated;
grant execute on function public.join_school(text) to authenticated;
grant execute on function public.rotate_school_join_code() to authenticated;
grant execute on function public.claim_student(text) to authenticated;
grant execute on function public.rotate_student_claim_code(uuid) to authenticated;
grant execute on function public.unlink_student(uuid, uuid) to authenticated;
grant execute on function public.my_student_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table schools enable row level security;
alter table profiles enable row level security;
alter table classes enable row level security;
alter table students enable row level security;
alter table assignments enable row level security;
alter table submissions enable row level security;
alter table scan_sessions enable row level security;
alter table student_links enable row level security;
alter table push_subscriptions enable row level security;
alter table reminder_rules enable row level security;
alter table notification_log enable row level security;

-- Drop and recreate policies for idempotency on fresh/re-run setups
do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'schools','profiles','classes','students','assignments',
        'submissions','scan_sessions','student_links',
        'push_subscriptions','reminder_rules','notification_log'
      )
  loop
    execute format('drop policy if exists %I on %I', pol.policyname, pol.tablename);
  end loop;
end $$;

create policy "profiles read own school"
  on profiles for select
  using (school_id = public.my_school_id() or id = auth.uid());

create policy "profiles insert self"
  on profiles for insert
  with check (id = auth.uid());

create policy "profiles update self"
  on profiles for update
  using (id = auth.uid());

create policy "schools read own"
  on schools for select
  using (id = public.my_school_id());

create policy "schools update own"
  on schools for update
  using (id = public.my_school_id());

create policy "classes by school"
  on classes for all
  using (school_id = public.my_school_id())
  with check (school_id = public.my_school_id());

create policy "classes read linked student"
  on classes for select
  using (
    id in (
      select s.class_id from students s
      where s.id in (select public.my_student_ids())
    )
  );

create policy "students by school"
  on students for all
  using (
    exists (
      select 1 from classes c
      where c.id = students.class_id and c.school_id = public.my_school_id()
    )
  )
  with check (
    exists (
      select 1 from classes c
      where c.id = students.class_id and c.school_id = public.my_school_id()
    )
  );

create policy "students read linked"
  on students for select
  using (id in (select public.my_student_ids()));

create policy "assignments by school"
  on assignments for all
  using (
    exists (
      select 1 from classes c
      where c.id = assignments.class_id and c.school_id = public.my_school_id()
    )
  )
  with check (
    exists (
      select 1 from classes c
      where c.id = assignments.class_id and c.school_id = public.my_school_id()
    )
  );

create policy "assignments read linked student"
  on assignments for select
  using (
    class_id in (
      select s.class_id from students s
      where s.id in (select public.my_student_ids())
    )
  );

create policy "submissions by school"
  on submissions for all
  using (
    exists (
      select 1
      from assignments a
      join classes c on c.id = a.class_id
      where a.id = submissions.assignment_id and c.school_id = public.my_school_id()
    )
  )
  with check (
    exists (
      select 1
      from assignments a
      join classes c on c.id = a.class_id
      where a.id = submissions.assignment_id and c.school_id = public.my_school_id()
    )
  );

create policy "submissions read linked student"
  on submissions for select
  using (student_id in (select public.my_student_ids()));

create policy "scan_sessions by school"
  on scan_sessions for all
  using (
    exists (
      select 1
      from assignments a
      join classes c on c.id = a.class_id
      where a.id = scan_sessions.assignment_id and c.school_id = public.my_school_id()
    )
  )
  with check (
    exists (
      select 1
      from assignments a
      join classes c on c.id = a.class_id
      where a.id = scan_sessions.assignment_id and c.school_id = public.my_school_id()
    )
  );

create policy "student_links read own"
  on student_links for select
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from students s
      join classes c on c.id = s.class_id
      where s.id = student_links.student_id and c.school_id = public.my_school_id()
    )
  );

create policy "student_links delete own"
  on student_links for delete
  using (user_id = auth.uid());

-- Inserts go through claim_student (security definer); no direct insert policy for students

create policy "push_subscriptions own"
  on push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "reminder_rules own"
  on reminder_rules for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notification_log read own"
  on notification_log for select
  using (user_id = auth.uid());
