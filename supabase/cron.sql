-- Schedule send-reminders Edge Function every 5 minutes.
-- Copy from supabase/cron.local.sql (gitignored) for a filled-in version,
-- or replace placeholders below before running in SQL Editor.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'send-reminders-every-5-min';

select cron.schedule(
  'send-reminders-every-5-min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);
