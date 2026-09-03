-- Migration: 20260514000000_create_admin_activity.sql

CREATE TABLE IF NOT EXISTS public.admin_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    actor TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE public.admin_activity IS 'Audit log for administrative events.';

-- Fix functions to explicitly use public schema to avoid search_path issues during auth hooks
CREATE OR REPLACE FUNCTION public.log_company_signup()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.admin_activity (event, action, description, actor)
  VALUES ('New Company', 'signup', 'New company registered: ' || NEW.name, 'System');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_company_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.admin_activity (event, action, description, actor)
    VALUES ('Company Status', 'status_changed', 'Status changed: ' || OLD.status || ' → ' || NEW.status, 'System');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_ticket_created()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.admin_activity (event, action, description, actor)
  VALUES ('Support Ticket', 'ticket_opened', 'Ticket opened: ' || NEW.subject, 'System');
  RETURN NEW;
END;
$function$;
