CREATE OR REPLACE FUNCTION public.undo_installment_payment(p_installment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_alloc record;
  v_payment record;
  v_new_total numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  PERFORM 1 FROM installments WHERE id = p_installment_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela não encontrada';
  END IF;

  FOR v_alloc IN
    SELECT * FROM payment_allocations
     WHERE installment_id = p_installment_id AND user_id = v_user_id
  LOOP
    SELECT * INTO v_payment FROM customer_payments
     WHERE id = v_alloc.payment_id AND user_id = v_user_id;
    IF FOUND THEN
      v_new_total := round((COALESCE(v_payment.valor_total, 0) - v_alloc.valor_aplicado)::numeric, 2);
      IF v_new_total <= 0.009 THEN
        DELETE FROM cash_movements WHERE ref_id = v_payment.id AND user_id = v_user_id;
        DELETE FROM payment_allocations WHERE payment_id = v_payment.id AND user_id = v_user_id;
        DELETE FROM customer_payments WHERE id = v_payment.id AND user_id = v_user_id;
      ELSE
        UPDATE customer_payments SET valor_total = v_new_total WHERE id = v_payment.id;
        UPDATE cash_movements SET valor = v_new_total WHERE ref_id = v_payment.id AND user_id = v_user_id;
      END IF;
    END IF;
  END LOOP;

  DELETE FROM payment_allocations WHERE installment_id = p_installment_id AND user_id = v_user_id;

  UPDATE installments
     SET pago_valor = NULL,
         pago_em = NULL,
         status = 'pendente',
         metodo_recebimento = NULL
   WHERE id = p_installment_id AND user_id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.undo_installment_payment(uuid) TO authenticated;