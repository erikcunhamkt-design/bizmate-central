import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatBRL } from "@/lib/currency";
import { History, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function RevenueGoalHistory() {
  const { user } = useAuth();

  const { data: goals } = useQuery({
    queryKey: ["revenue-goals-history", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revenue_goals")
        .select("*")
        .order("ano", { ascending: false })
        .order("mes", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: cashMovements } = useQuery({
    queryKey: ["revenue-goals-cash-history", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_movements")
        .select("data, valor, tipo")
        .eq("tipo", "entrada");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  if (!goals || goals.length === 0) return null;

  // Aggregate cash by month
  const cashByMonth: Record<string, number> = {};
  (cashMovements ?? []).forEach((c) => {
    const d = new Date(c.data);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    cashByMonth[key] = (cashByMonth[key] ?? 0) + c.valor;
  });

  const chartData = goals
    .map((g) => {
      const key = `${g.ano}-${g.mes}`;
      const faturado = cashByMonth[key] ?? 0;
      const percent = g.meta_valor > 0 ? (faturado / g.meta_valor) * 100 : 0;
      return {
        name: `${MONTH_NAMES[g.mes - 1]}/${String(g.ano).slice(2)}`,
        meta: g.meta_valor,
        faturado,
        percent: Math.round(percent),
      };
    })
    .reverse();

  const avgPercent = chartData.length > 0
    ? Math.round(chartData.reduce((s, d) => s + d.percent, 0) / chartData.length)
    : 0;
  const metasAtingidas = chartData.filter((d) => d.percent >= 100).length;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent/50 flex items-center justify-center">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <CardTitle className="text-sm font-semibold">Histórico de Metas</CardTitle>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Média</p>
              <p className={`text-sm font-bold ${avgPercent >= 100 ? "text-success" : avgPercent >= 70 ? "text-primary" : "text-warning"}`}>
                {avgPercent}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Atingidas</p>
              <p className="text-sm font-bold text-success">{metasAtingidas}/{chartData.length}</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "12px",
                color: "hsl(var(--card-foreground))",
                fontSize: "12px",
                boxShadow: "0 4px 12px -2px rgb(0 0 0 / 0.15)",
              }}
              formatter={(value: number, name: string) => [formatBRL(value), name === "faturado" ? "Faturado" : "Meta"]}
            />
            <Bar dataKey="meta" name="Meta" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="faturado" name="Faturado" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.percent >= 100 ? "hsl(var(--success))" : entry.percent >= 70 ? "hsl(var(--primary))" : "hsl(var(--warning))"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {chartData.map((d) => {
            const Icon = d.percent >= 100 ? TrendingUp : d.percent >= 70 ? Minus : TrendingDown;
            const color = d.percent >= 100 ? "text-success" : d.percent >= 70 ? "text-primary" : "text-warning";
            return (
              <div key={d.name} className="p-2 rounded-lg bg-secondary/50 border border-border/30 text-center">
                <p className="text-[11px] text-muted-foreground font-medium">{d.name}</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Icon className={`h-3 w-3 ${color}`} />
                  <span className={`text-sm font-bold ${color}`}>{d.percent}%</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{formatBRL(d.faturado)}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
