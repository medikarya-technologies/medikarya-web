-- migration.sql
-- Add feedback_json JSONB to public.case_attempts
-- Add index on (user_id, case_id, created_at DESC)

ALTER TABLE IF EXISTS public.case_attempts 
ADD COLUMN IF NOT EXISTS feedback_json JSONB;

ALTER TABLE IF EXISTS public.case_attempts
ADD COLUMN IF NOT EXISTS attempt_number INT;

ALTER TABLE IF EXISTS public.case_attempts
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for faster history retrieval
CREATE INDEX IF NOT EXISTS idx_case_attempts_user_case_created_at 
ON public.case_attempts (user_id, case_id, created_at DESC);
