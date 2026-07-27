-- Homework ArUco Tracker — Supabase schema + RLS
-- Run in Supabase SQL editor after creating a project.

create extension if not exists "pgcrypto";

create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

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
  unique (class_id, marker_id),
  unique (class_id, student_no)
);

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

create or replace function public.my_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from profiles where id = auth.uid()
$$;

-- First Magic Link login: create school + profile for the authenticated user.
create or replace function public.ensure_my_workspace(p_school_name text default '我的學校')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_school_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select school_id into v_school_id from profiles where id = v_uid;
  if v_school_id is not null then
    return v_school_id;
  end if;

  insert into schools (name)
  values (coalesce(nullif(trim(p_school_name), ''), '我的學校'))
  returning id into v_school_id;

  insert into profiles (id, school_id, name, role)
  values (v_uid, v_school_id, '', 'teacher');

  return v_school_id;
end;
$$;

grant execute on function public.ensure_my_workspace(text) to authenticated;

alter table schools enable row level security;
alter table profiles enable row level security;
alter table classes enable row level security;
alter table students enable row level security;
alter table assignments enable row level security;
alter table submissions enable row level security;
alter table scan_sessions enable row level security;

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
