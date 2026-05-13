CREATE OR REPLACE FUNCTION public.register_customer_payment(
  p_customer_id uuid,
  p_sale_id uuid,
  p_selected_installment_id uuid,
  p_valor numeric,
  p_data date,
  p_metodo text,
  p_observacoes text,
  p_operador text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_payment_id uuid;
  v_remaining numeric := p_valor;
  v_amount numeric;
  v_due numeric;
  v_new_paid numeric;
  v_new_status text;
  v_inst record;
  v_total_aplicado numeric := 0;
  v_customer_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;

  -- Validar parcela selecionada
  PERFORM 1 FROM installments
   WHERE id = p_selected_installment_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela não encontrada';
  END IF;

  SELECT nome INTO v_customer_name FROM customers WHERE id = p_customer_id AND user_id = v_user_id;

  -- Cria o pagamento
  INSERT INTO customer_payments (user_id, customer_id, sale_id, valor_total, data_pagamento, metodo_recebimento, observacoes, operador)
  VALUES (v_user_id, p_customer_id, p_sale_id, p_valor, p_data, p_metodo, NULLIF(p_observacoes,''), NULLIF(p_operador,''))
  RETURNING id INTO v_payment_id;

  -- Itera pelas parcelas em aberto da mesma venda (ou cliente, se sem venda), priorizando a selecionada
  FOR v_inst IN
    SELECT i.* FROM installments i
     WHERE i.user_id = v_user_id
       AND i.status <> 'pago'
       AND ((p_sale_id IS NOT NULL AND i.sale_id = p_sale_id)
            OR (p_sale_id IS NULL AND i.customer_id = p_customer_id))
       AND (i.valor_parcela - COALESCE(i.pago_valor, 0)) > 0.009
     ORDER BY (i.id <> p_selected_installment_id), i.vencimento_data, i.numero_parcela
  LOOP
    EXIT WHEN v_remaining <= 0.009;
    v_due := round((v_inst.valor_parcela - COALESCE(v_inst.pago_valor, 0))::numeric, 2);
    v_amount := round(LEAST(v_due, v_remaining)::numeric, 2);
    v_new_paid := round((COALESCE(v_inst.pago_valor, 0) + v_amount)::numeric, 2);
    v_new_status := CASE WHEN (v_due - v_amount) <= 0.009 THEN 'pago' ELSE 'parcial' END;

    INSERT INTO payment_allocations (user_id, payment_id, installment_id, valor_aplicado, tipo)
    VALUES (v_user_id, v_payment_id, v_inst.id, v_amount,
      CASE WHEN v_inst.id = p_selected_installment_id THEN 'parcela' ELSE 'abatimento' END);

    UPDATE installments
       SET pago_valor = v_new_paid,
           status = v_new_status,
           pago_em = CASE WHEN v_new_status = 'pago' THEN p_data::timestamptz ELSE NULL END,
           metodo_recebimento = p_metodo
     WHERE id = v_inst.id;

    v_remaining := round((v_remaining - v_amount)::numeric, 2);
    v_total_aplicado := round((v_total_aplicado + v_amount)::numeric, 2);
  END LOOP;

  IF abs(v_total_aplicado - p_valor) > 0.009 THEN
    RAISE EXCEPTION 'Valor recebido (%) é maior que o saldo em aberto (%)', p_valor, v_total_aplicado;
  END IF;

  INSERT INTO cash_movements (user_id, tipo, valor, origem, ref_id, descricao, data)
  VALUES (v_user_id, 'entrada', p_valor, 'recebimento', v_payment_id,
          'Recebimento — ' || COALESCE(v_customer_name, 'cliente'), p_data);

  RETURN v_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_customer_payment(uuid, uuid, uuid, numeric, date, text, text, text) TO authenticated;