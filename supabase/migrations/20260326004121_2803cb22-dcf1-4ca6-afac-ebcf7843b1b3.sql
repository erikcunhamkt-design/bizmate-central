
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS cpf text,
ADD COLUMN IF NOT EXISTS endereco text;
