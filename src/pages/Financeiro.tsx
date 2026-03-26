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
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { motion } from "framer-motion";

export default function Financeiro() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const mesInicio = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const mesFim = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["cash-movements", user?.id, mesInicio],
    queryFn: async () => {
      const { data, error } = await supabase.from("cash_movements").select("*").gte("data", mesInicio).lte("data", mesFim).order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: chartData = [] } = useQuery({
    queryKey: ["cash-chart", user?.id],
    queryFn: async () => {
      const sixMonthsAgo = format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd");
      const { data, error } = await supabase.from("cash_movements").select("*").gte("data", sixMonthsAgo);
      if (error) throw error;
      const months: Record<string, { entradas: number; saidas: number }> = {};
      for (let i = 5; i >= 0; i--) {
        const m = format(subMonths(new Date(), i), "yyyy-MM");
        months[m] = { entradas: 0, saidas: 0 };
      }
      (data ?? []).forEach(d => {
        const m = d.data.substring(0, 7);
        if (months[m]) { if (d.tipo === "entrada") months[m].entradas += d.valor; else months[m].saidas += d.valor; }
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
  const saldo = totalEntradas - totalSaidas;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Fluxo de caixa e movimentações</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4 px-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center"><TrendingUp className="h-3.5 w-3.5 text-success" /></div>
              <span className="text-xs text-muted-foreground font-medium">Entradas</span>
            </div>
            <p className="text-xl font-bold text-success">{formatBRL(totalEntradas)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4 px-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center"><TrendingDown className="h-3.5 w-3.5 text-destructive" /></div>
              <span className="text-xs text-muted-foreground font-medium">Saídas</span>
            </div>
            <p className="text-xl font-bold text-destructive">{formatBRL(totalSaidas)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4 px-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><Wallet className="h-3.5 w-3.5 text-primary" /></div>
              <span className="text-xs text-muted-foreground font-medium">Saldo</span>
            </div>
            <p className={`text-xl font-bold ${saldo >= 0 ? "text-success" : "text-destructive"}`}>{formatBRL(saldo)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Entradas × Saídas (últimos 6 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v}`} />
              <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12, boxShadow: "0 4px 12px -2px rgb(0 0 0 / 0.15)" }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly movements */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <CardTitle className="text-sm capitalize font-semibold">{format(currentMonth, "MMMM yyyy", { locale: ptBR })}</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold">Data</TableHead>
                <TableHead className="font-semibold">Descrição</TableHead>
                <TableHead className="font-semibold">Origem</TableHead>
                <TableHead className="font-semibold">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : movements.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma movimentação</TableCell></TableRow>
              ) : movements.map(m => (
                <TableRow key={m.id} className="hover:bg-primary/5 transition-colors">
                  <TableCell className="text-sm">{format(new Date(m.data), "dd/MM")}</TableCell>
                  <TableCell className="text-sm">{m.descricao || "—"}</TableCell>
                  <TableCell><span className="capitalize text-xs bg-muted px-2 py-0.5 rounded-md">{m.origem}</span></TableCell>
                  <TableCell className={`font-semibold text-sm ${m.tipo === "entrada" ? "text-success" : "text-destructive"}`}>
                    {m.tipo === "entrada" ? "+" : "−"}{formatBRL(m.valor)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  );
}
