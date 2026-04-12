-- PIN-based authentication for child accounts
CREATE TABLE IF NOT EXISTS public.pin_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pin text NOT NULL UNIQUE CHECK (length(pin) = 4 AND pin ~ '^[0-9]{4}$'),
  child_id text NOT NULL UNIQUE,
  child_name text NOT NULL,
  parent_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pin_codes_pin ON public.pin_codes (pin);
ALTER TABLE public.pin_codes DISABLE ROW LEVEL SECURITY;
