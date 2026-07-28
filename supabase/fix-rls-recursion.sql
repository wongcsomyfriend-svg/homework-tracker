-- Fix: infinite recursion detected in policy for relation "classes"
-- Cause: classes policies queried students, students policies queried classes.
-- Run this in Supabase Dashboard → SQL Editor.

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

create or replace function public.is_my_school_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from classes c
    where c.id = p_class_id
      and c.school_id = (select school_id from profiles where id = auth.uid())
  )
$$;

create or replace function public.is_my_linked_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from students s
    join student_links sl on sl.student_id = s.id
    where s.class_id = p_class_id and sl.user_id = auth.uid()
  )
$$;

create or replace function public.is_my_school_assignment(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from assignments a
    join classes c on c.id = a.class_id
    where a.id = p_assignment_id
      and c.school_id = (select school_id from profiles where id = auth.uid())
  )
$$;

create or replace function public.is_my_school_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from students s
    join classes c on c.id = s.class_id
    where s.id = p_student_id
      and c.school_id = (select school_id from profiles where id = auth.uid())
  )
$$;

grant execute on function public.my_school_id() to authenticated;
grant execute on function public.my_student_ids() to authenticated;
grant execute on function public.is_my_school_class(uuid) to authenticated;
grant execute on function public.is_my_linked_class(uuid) to authenticated;
grant execute on function public.is_my_school_assignment(uuid) to authenticated;
grant execute on function public.is_my_school_student(uuid) to authenticated;

drop policy if exists "classes by school" on classes;
drop policy if exists "classes read linked student" on classes;
drop policy if exists "students by school" on students;
drop policy if exists "students read linked" on students;
drop policy if exists "assignments by school" on assignments;
drop policy if exists "assignments read linked student" on assignments;
drop policy if exists "submissions by school" on submissions;
drop policy if exists "submissions read linked student" on submissions;
drop policy if exists "scan_sessions by school" on scan_sessions;
drop policy if exists "student_links read own" on student_links;

create policy "classes by school"
  on classes for all
  using (school_id = public.my_school_id())
  with check (school_id = public.my_school_id());

create policy "classes read linked student"
  on classes for select
  using (public.is_my_linked_class(id));

create policy "students by school"
  on students for all
  using (public.is_my_school_class(class_id))
  with check (public.is_my_school_class(class_id));

create policy "students read linked"
  on students for select
  using (id in (select public.my_student_ids()));

create policy "assignments by school"
  on assignments for all
  using (public.is_my_school_class(class_id))
  with check (public.is_my_school_class(class_id));

create policy "assignments read linked student"
  on assignments for select
  using (public.is_my_linked_class(class_id));

create policy "submissions by school"
  on submissions for all
  using (public.is_my_school_assignment(assignment_id))
  with check (public.is_my_school_assignment(assignment_id));

create policy "submissions read linked student"
  on submissions for select
  using (student_id in (select public.my_student_ids()));

create policy "scan_sessions by school"
  on scan_sessions for all
  using (public.is_my_school_assignment(assignment_id))
  with check (public.is_my_school_assignment(assignment_id));

create policy "student_links read own"
  on student_links for select
  using (
    user_id = auth.uid()
    or public.is_my_school_student(student_id)
  );
