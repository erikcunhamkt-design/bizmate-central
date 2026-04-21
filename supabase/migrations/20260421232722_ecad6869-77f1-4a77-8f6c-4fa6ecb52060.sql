ALTER TABLE public.sales
DROP CONSTRAINT IF EXISTS sales_forma_pagamento_check;

ALTER TABLE public.sales
ADD CONSTRAINT sales_forma_pagamento_check
CHECK (forma_pagamento IN ('pix', 'dinheiro', 'cartao', 'outro', 'parcelado'));