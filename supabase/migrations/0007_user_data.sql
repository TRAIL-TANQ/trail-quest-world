-- Per-child card collection and stage progress
CREATE TABLE IF NOT EXISTS public.card_collection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id text NOT NULL,
  card_id text NOT NULL,
  obtained_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, card_id)
);
ALTER TABLE public.card_collection DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.stage_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id text NOT NULL,
  stage_id integer NOT NULL,
  cleared boolean NOT NULL DEFAULT false,
  rewarded boolean NOT NULL DEFAULT false,
  cleared_at timestamptz,
  UNIQUE (child_id, stage_id)
);
ALTER TABLE public.stage_progress DISABLE ROW LEVEL SECURITY;
