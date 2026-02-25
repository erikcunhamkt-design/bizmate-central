import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/currency";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function Financeiro() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const mesInicio = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const mesFim = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["cash-movements", user?.id, mesInicio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_movements")
        .select("*")
        .gte("data", mesInicio)
        .lte("data", mesFim)
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Last 6 months chart data
  const { data: chartData = [] } = useQuery({
    queryKey: ["cash-chart", user?.id],
    queryFn: async () => {
      const sixMonthsAgo = format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("cash_movements")
        .select("*")
        .gte("data", sixMonthsAgo);
      if (error) throw error;

      const months: Record<string, { entradas: number; saidas: number }> = {};
      for (let i = 5; i >= 0; i--) {
        const m = format(subMonths(new Date(), i), "yyyy-MM");
        months[m] = { entradas: 0, saidas: 0 };
      }
      (data ?? []).forEach(d => {
        const m = d.data.substring(0, 7);
        if (months[m]) {
          if (d.tipo === "entrada") months[m].entradas += d.valor;
          else months[m].saidas += d.valor;
        }
      });

      return Object.entries(months).map(([mes, vals]) => ({
        mes: format(new Date(mes + "-01"), "MMM", { locale: ptBR }),
        ...vals,
      }));
    },
    enabled: !!user,
  });

  const totalEntradas = movements.filter(m => m.tipo === "entrada").reduce((s, m) => s + m.valor, 0);
  const totalSaidas = movements.filter(m => m.tipo === "saida").reduce((s, m) => s + m.valor, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Financeiro</h1>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Entradas × Saídas (últimos 6 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Monthly movements */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <CardTitle className="text-base capitalize">{format(currentMonth, "MMMM yyyy", { locale: ptBR })}</CardTitle>
              <div className="flex gap-4 justify-center mt-1 text-sm">
                <span className="text-success flex items-center gap-1"><TrendingUp className="h-3 w-3" />{formatBRL(totalEntradas)}</span>
                <span className="text-destructive flex items-center gap-1"><TrendingDown className="h-3 w-3" />{formatBRL(totalSaidas)}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : movements.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhuma movimentação neste mês</TableCell></TableRow>
              ) : movements.map(m => (
                <TableRow key={m.id}>
                  <TableCell>{format(new Date(m.data), "dd/MM")}</TableCell>
                  <TableCell>{m.descricao || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{m.origem}</Badge></TableCell>
                  <TableCell className={m.tipo === "entrada" ? "text-success font-medium" : "text-destructive font-medium"}>
                    {m.tipo === "entrada" ? "+" : "−"}{formatBRL(m.valor)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
