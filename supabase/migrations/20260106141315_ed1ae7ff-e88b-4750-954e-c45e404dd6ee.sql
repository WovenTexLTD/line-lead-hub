-- Add sort_order column to blocker_types table
ALTER TABLE public.blocker_types 
ADD COLUMN sort_order integer DEFAULT 0;

-- Update existing rows with sequential sort_order based on current alphabetical order
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY factory_id ORDER BY name) as rn
  FROM public.blocker_types
)
UPDATE public.blocker_types bt
SET sort_order = ranked.rn
FROM ranked
WHERE bt.id = ranked.id;