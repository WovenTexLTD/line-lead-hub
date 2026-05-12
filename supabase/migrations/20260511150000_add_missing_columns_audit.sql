-- Schema audit follow-up: add columns the frontend already writes to but
-- which never existed in the DB, plus a UNIQUE needed for an upsert to work.
--
-- Found by /tmp/qc-schema-audit sweep:
--   1. profiles.onboarding_setup_dismissed_at  (useOnboardingChecklist)
--   2. profiles.onboarding_banner_dismissed_at (useOnboardingChecklist)
--   3. profiles.onboarding_tour_completed_at   (useTour)
--   4. profiles.onboarding_version             (useTour)
--   5. cutting_targets.remarks                 (EditCuttingTargetModal — UI field, never persisted)
--   6. production_updates_finishing.blocker_resolution_date (ReportBlocker — silently dropped)
--   7. production_updates_finishing.action_taken_today      (ReportBlocker — silently dropped)
--   8. UNIQUE(document_id) on document_ingestion_queue      (documentIngestion upsert)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_setup_dismissed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_banner_dismissed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_tour_completed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_version             TEXT;

ALTER TABLE public.cutting_targets
  ADD COLUMN IF NOT EXISTS remarks TEXT;

ALTER TABLE public.production_updates_finishing
  ADD COLUMN IF NOT EXISTS blocker_resolution_date DATE,
  ADD COLUMN IF NOT EXISTS action_taken_today      TEXT;

-- Idempotent UNIQUE: only add if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.document_ingestion_queue'::regclass
       AND conname  = 'document_ingestion_queue_document_id_key'
  ) THEN
    ALTER TABLE public.document_ingestion_queue
      ADD CONSTRAINT document_ingestion_queue_document_id_key UNIQUE (document_id);
  END IF;
END $$;
