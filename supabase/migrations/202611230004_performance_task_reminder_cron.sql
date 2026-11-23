create extension if not exists pg_cron;
select cron.schedule('portal-performance-task-reminders', '*/15 * * * *', 'select public.performance_task_send_reminders();');
