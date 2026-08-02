ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS codigo_barras text,
  ADD COLUMN IF NOT EXISTS unidade text NOT NULL DEFAULT 'UN',
  ADD COLUMN IF NOT EXISTS marca text,
  ADD COLUMN IF NOT EXISTS ncm text,
  ADD COLUMN IF NOT EXISTS fornecedor text,
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS products_user_codigo_barras_uidx
  ON public.products (user_id, codigo_barras)
  WHERE codigo_barras IS NOT NULL AND codigo_barras <> '';

CREATE INDEX IF NOT EXISTS products_user_sku_idx ON public.products (user_id, sku);

CREATE TABLE IF NOT EXISTS public.product_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  lote text,
  validade date,
  quantidade integer NOT NULL DEFAULT 0,
  custo_unitario numeric NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_batches TO authenticated;
GRANT ALL ON public.product_batches TO service_role;

ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own product_batches"
  ON public.product_batches FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS product_batches_product_idx ON public.product_batches (product_id);

CREATE TRIGGER update_product_batches_updated_at
  BEFORE UPDATE ON public.product_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();