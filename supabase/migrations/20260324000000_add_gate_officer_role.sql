-- Add gate_officer role to app_role enum
-- This was added on Lovable Cloud but not tracked in git migrations
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gate_officer';
