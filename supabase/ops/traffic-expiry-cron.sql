-- Chạy một lần sau khi bật pg_cron trong Supabase Dashboard.
-- Job cập nhật status/version; trigger đồng thời broadcast thay đổi cho map clients.
select cron.unschedule(jobid)
from cron.job
where jobname = 'expire-traffic-reports';

select cron.schedule(
  'expire-traffic-reports',
  '* * * * *',
  'select public.expire_stale_traffic_reports();'
);
