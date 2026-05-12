-- QC Module — Phase 1 step 1a: add the QC value to the app_role enum.
-- Postgres requires this to commit before any function/policy can reference
-- the literal 'qc'. The helper function lives in the next migration.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'qc';
