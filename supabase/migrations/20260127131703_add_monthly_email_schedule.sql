-- Add monthly option to schedule_type by updating the CHECK constraint
-- First, drop the old constraint and add the new one that includes 'monthly'

-- Drop the existing check constraint on schedule_type
ALTER TABLE email_schedules DROP CONSTRAINT IF EXISTS email_schedules_schedule_type_check;

-- Add new check constraint that includes 'monthly'
ALTER TABLE email_schedules
ADD CONSTRAINT email_schedules_schedule_type_check
CHECK (schedule_type IN ('daily', 'weekly', 'monthly'));

-- Add day_of_month column to email_schedules table
ALTER TABLE email_schedules
ADD COLUMN IF NOT EXISTS day_of_month integer;

-- Add comment for documentation
COMMENT ON COLUMN email_schedules.day_of_month IS 'Day of month (1-28) for monthly schedules. Used only when schedule_type is monthly.';

-- Add check constraint to ensure day_of_month is between 1 and 28 if provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_day_of_month_range'
  ) THEN
    ALTER TABLE email_schedules
    ADD CONSTRAINT check_day_of_month_range
    CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 28));
  END IF;
END$$;
