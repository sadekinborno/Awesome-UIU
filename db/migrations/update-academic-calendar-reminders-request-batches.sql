-- ============================================
-- Academic Calendar Reminders: Request Batches + Duplicate Prevention
--
-- Goals:
-- - Group per-student request into one batch id
-- - Store selected reminder types on each row for admin readability
-- - Prevent multiple simultaneous pending requests for same email+term
-- ============================================

ALTER TABLE public.academic_calendar_reminder_requests
ADD COLUMN IF NOT EXISTS request_group_id TEXT,
ADD COLUMN IF NOT EXISTS request_term TEXT,
ADD COLUMN IF NOT EXISTS requested_types TEXT[];

-- Backfill missing values so admin UI can group old rows reasonably.
UPDATE public.academic_calendar_reminder_requests
SET request_group_id = COALESCE(request_group_id, id::text)
WHERE request_group_id IS NULL OR btrim(request_group_id) = '';

UPDATE public.academic_calendar_reminder_requests r
SET request_term = COALESCE(r.request_term, e.term)
FROM public.academic_calendar_events e
WHERE r.event_id = e.id
  AND (r.request_term IS NULL OR btrim(r.request_term) = '');

UPDATE public.academic_calendar_reminder_requests
SET request_term = COALESCE(request_term, 'unknown')
WHERE request_term IS NULL OR btrim(request_term) = '';

UPDATE public.academic_calendar_reminder_requests
SET requested_types = ARRAY['unspecified']
WHERE requested_types IS NULL;

ALTER TABLE public.academic_calendar_reminder_requests
ALTER COLUMN request_group_id SET NOT NULL,
ALTER COLUMN request_term SET NOT NULL,
ALTER COLUMN requested_types SET NOT NULL;

-- One active pending request batch per user per term.
-- Multiple rows in the same batch are allowed.
CREATE OR REPLACE FUNCTION public.enforce_single_pending_reminder_batch()
RETURNS TRIGGER AS $$
DECLARE
  existing_group TEXT;
BEGIN
  IF NEW.status = 'pending' AND NEW.is_active = true THEN
    SELECT request_group_id
    INTO existing_group
    FROM public.academic_calendar_reminder_requests
    WHERE request_email = NEW.request_email
      AND request_term = NEW.request_term
      AND status = 'pending'
      AND is_active = true
    LIMIT 1;

    IF existing_group IS NOT NULL AND existing_group <> NEW.request_group_id THEN
      RAISE EXCEPTION 'pending_reminder_request_exists';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enforce_single_pending_reminder_batch ON public.academic_calendar_reminder_requests;
CREATE TRIGGER trigger_enforce_single_pending_reminder_batch
BEFORE INSERT OR UPDATE ON public.academic_calendar_reminder_requests
FOR EACH ROW
EXECUTE FUNCTION public.enforce_single_pending_reminder_batch();

CREATE INDEX IF NOT EXISTS idx_calendar_reminders_group
ON public.academic_calendar_reminder_requests(request_group_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_calendar_reminders_email_term_status
ON public.academic_calendar_reminder_requests(request_email, request_term, status, is_active);
