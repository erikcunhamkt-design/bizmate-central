
CREATE TABLE public.revenue_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mes integer NOT NULL,
  ano integer NOT NULL,
  meta_valor numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, mes, ano)
);

ALTER TABLE public.revenue_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own revenue_goals"
  ON public.revenue_goals
  FOR ALL
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
