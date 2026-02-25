import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, endOfMonth, format, isToday, isBefore, startOfDay } from "date-fns";

export function useDashboardData() {
  const { user } = useAuth();
  const now = new Date();
  const mesInicio = format(startOfMonth(now), "yyyy-MM-dd");
  const mesFim = format(endOfMonth(now), "yyyy-MM-dd");
  const hoje = format(now, "yyyy-MM-dd");

  const installments = useQuery({
    queryKey: ["dashboard-installments", user?.id, mesInicio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installments")
        .select("*, customers(nome)")
        .gte("vencimento_data", mesInicio)
        .lte("vencimento_data", mesFim);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const expenses = useQuery({
    queryKey: ["dashboard-expenses", user?.id, mesInicio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .gte("vencimento_data", mesInicio)
        .lte("vencimento_data", mesFim);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const cashMovements = useQuery({
    queryKey: ["dashboard-cash", user?.id, mesInicio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_movements")
        .select("*")
        .gte("data", mesInicio)
        .lte("data", mesFim);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const inst = installments.data ?? [];
  const exp = expenses.data ?? [];
  const cash = cashMovements.data ?? [];

  const entradas = cash.filter(c => c.tipo === "entrada").reduce((s, c) => s + c.valor, 0);
  const saidas = cash.filter(c => c.tipo === "saida").reduce((s, c) => s + c.valor, 0);
  const lucro = entradas - saidas;

  const aReceber = inst.filter(i => i.status === "pendente").reduce((s, i) => s + i.valor_parcela, 0);
  const aPagar = exp.filter(e => e.status === "pendente").reduce((s, e) => s + e.valor, 0);

  const venceHoje = [
    ...inst.filter(i => i.vencimento_data === hoje && i.status === "pendente"),
    ...exp.filter(e => e.vencimento_data === hoje && e.status === "pendente"),
  ];

  const todayInstallments = inst
    .filter(i => i.vencimento_data === hoje)
    .map(i => ({
      id: i.id,
      tipo: "parcela" as const,
      descricao: `${(i as any).customers?.nome ?? "Cliente"} — Parcela ${i.numero_parcela}/${i.total_parcelas}`,
      valor: i.valor_parcela,
      status: i.status,
    }));

  const todayExpenses = exp
    .filter(e => e.vencimento_data === hoje)
    .map(e => ({
      id: e.id,
      tipo: "conta" as const,
      descricao: e.descricao,
      valor: e.valor,
      status: e.status,
    }));

  return {
    loading: installments.isLoading || expenses.isLoading || cashMovements.isLoading,
    entradas,
    saidas,
    lucro,
    aReceber,
    aPagar,
    venceHojeCount: venceHoje.length,
    todayItems: [...todayInstallments, ...todayExpenses],
  };
}
