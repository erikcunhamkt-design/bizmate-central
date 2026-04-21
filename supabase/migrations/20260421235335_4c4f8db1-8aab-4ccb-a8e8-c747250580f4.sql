CREATE TABLE IF NOT EXISTS public.customer_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  sale_id UUID,
  valor_total NUMERIC NOT NULL,
  data_pagamento DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo_recebimento TEXT NOT NULL DEFAULT 'pix',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  payment_id UUID NOT NULL REFERENCES public.customer_payments(id) ON DELETE CASCADE,
  installment_id UUID NOT NULL,
  valor_aplicado NUMERIC NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'parcela',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_customer_payments_user_customer ON public.customer_payments(user_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_sale ON public.customer_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_installment ON public.payment_allocations(installment_id);

CREATE POLICY "Users manage own customer_payments"
ON public.customer_payments
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own payment_allocations"
ON public.payment_allocations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users create own payment_allocations"
ON public.payment_allocations
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.customer_payments cp
    WHERE cp.id = payment_id AND cp.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.installments i
    WHERE i.id = installment_id AND i.user_id = auth.uid()
  )
);

CREATE POLICY "Users update own payment_allocations"
ON public.payment_allocations
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own payment_allocations"
ON public.payment_allocations
FOR DELETE
USING (auth.uid() = user_id);