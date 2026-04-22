import { differenceInDays } from "date-fns";

export type ReceivableInstallment = {
  id: string;
  sale_id?: string | null;
  customer_id: string;
  valor_parcela: number;
  pago_valor?: number | null;
  vencimento_data: string;
  numero_parcela: number;
  total_parcelas: number;
  status: string;
};

export type AllocationPreview = {
  installment: ReceivableInstallment;
  amount: number;
  remainingAfter: number;
  statusAfter: "pago" | "parcial";
};

export const getPaidValue = (installment: Pick<ReceivableInstallment, "pago_valor">) =>
  Number(installment.pago_valor ?? 0);

export const getRemainingValue = (installment: Pick<ReceivableInstallment, "valor_parcela" | "pago_valor">) =>
  Math.max(Number(installment.valor_parcela ?? 0) - getPaidValue(installment), 0);

export const isOpenInstallment = (installment: ReceivableInstallment) =>
  installment.status !== "pago" && getRemainingValue(installment) > 0.009;

export const hasOpenInstallmentDebt = (installments: ReceivableInstallment[]) =>
  installments.some(isOpenInstallment);

export function getCustomerActivityStatus(
  lastPurchaseDate: Date | string | null,
  installments: ReceivableInstallment[],
  now = new Date(),
) {
  const normalizedLastPurchase = lastPurchaseDate ? new Date(lastPurchaseDate) : null;
  const daysSinceLastPurchase = normalizedLastPurchase ? differenceInDays(now, normalizedLastPurchase) : null;
  const hasOpenDebt = hasOpenInstallmentDebt(installments);
  const boughtInLast30Days = daysSinceLastPurchase !== null && daysSinceLastPurchase <= 30;

  return {
    hasOpenDebt,
    boughtInLast30Days,
    daysSinceLastPurchase,
    isActive: hasOpenDebt || boughtInLast30Days,
    isInactive: !hasOpenDebt && !boughtInLast30Days,
  };
}

export function buildAllocationPreview(
  installments: ReceivableInstallment[],
  selectedInstallmentId: string,
  paymentAmount: number,
) {
  const selected = installments.find((installment) => installment.id === selectedInstallmentId);
  if (!selected || paymentAmount <= 0) return [];

  const scope = installments
    .filter((installment) => {
      const sameDebt = selected.sale_id
        ? installment.sale_id === selected.sale_id
        : installment.customer_id === selected.customer_id;
      return sameDebt && isOpenInstallment(installment);
    })
    .sort((a, b) => {
      if (a.id === selectedInstallmentId) return -1;
      if (b.id === selectedInstallmentId) return 1;
      return a.vencimento_data.localeCompare(b.vencimento_data) || a.numero_parcela - b.numero_parcela;
    });

  let remainingPayment = paymentAmount;
  const preview: AllocationPreview[] = [];

  for (const installment of scope) {
    if (remainingPayment <= 0.009) break;
    const due = getRemainingValue(installment);
    const amount = Math.min(due, remainingPayment);
    const remainingAfter = Math.max(due - amount, 0);
    preview.push({
      installment,
      amount: Math.round(amount * 100) / 100,
      remainingAfter: Math.round(remainingAfter * 100) / 100,
      statusAfter: remainingAfter <= 0.009 ? "pago" : "parcial",
    });
    remainingPayment -= amount;
  }

  return preview;
}