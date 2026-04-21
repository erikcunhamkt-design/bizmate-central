import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export function useMonthlySalesData() {
  const { user } = useAuth();
  const now = new Date();

  // Last 6 months
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i);
    return {
      start: format(startOfMonth(d), "yyyy-MM-dd"),
      end: format(endOfMonth(d), "yyyy-MM-dd"),
      label: format(d, "MMM", { locale: ptBR }),
    };
  });

  const salesQuery = useQuery({
    queryKey: ["monthly-sales", user?.id],
    queryFn: async () => {
      const sixMonthsAgo = months[0].start;
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("total_venda, data_compra, desconto_total")
        .gte("data_compra", sixMonthsAgo);
      if (salesError) throw salesError;

      const { data: payments, error: paymentsError } = await supabase
        .from("cash_movements")
        .select("valor, data, tipo")
        .eq("tipo", "entrada")
        .gte("data", sixMonthsAgo);
      if (paymentsError) throw paymentsError;

      return { sales: sales ?? [], payments: payments ?? [] };
    },
    enabled: !!user,
  });

  const chartData = months.map((m) => {
    const sales = salesQuery.data?.sales ?? [];
    const payments = salesQuery.data?.payments ?? [];

    const monthSales = sales.filter(
      (s) => s.data_compra >= m.start && s.data_compra <= m.end
    );
    const monthPayments = payments.filter(
      (p) => p.data >= m.start && p.data <= m.end
    );

    const vendas = monthSales.reduce((sum, s) => sum + (s.total_venda ?? 0), 0);
    const recebido = monthPayments.reduce((sum, p) => sum + (p.valor ?? 0), 0);

    return {
      name: m.label.charAt(0).toUpperCase() + m.label.slice(1),
      vendas,
      recebido,
    };
  });

  return {
    chartData,
    loading: salesQuery.isLoading,
  };
}
