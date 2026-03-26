import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRL } from "@/lib/currency";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, BarChart3, FileText } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
  LineChart, Line, AreaChart, Area, ComposedChart,
} from "recharts";
import { motion } from "framer-motion";

export default function Financeiro() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState("visao-geral");
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

  // 12 months data for report
  const { data: yearData = [] } = useQuery({
    queryKey: ["cash-year", user?.id],
    queryFn: async () => {
      const twelveMonthsAgo = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");
      const { data, error } = await supabase.from("cash_movements").select("*").gte("data", twelveMonthsAgo);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses-year", user?.id],
    queryFn: async () => {
      const twelveMonthsAgo = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");
      const { data, error } = await supabase.from("expenses").select("*").gte("vencimento_data", twelveMonthsAgo);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: salesData = [] } = useQuery({
    queryKey: ["sales-year", user?.id],
    queryFn: async () => {
      const twelveMonthsAgo = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");
      const { data, error } = await supabase.from("sales").select("*").gte("data_compra", twelveMonthsAgo);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Build 6-month chart data from cash_movements
  const chartData6m = (() => {
    const months: Record<string, { entradas: number; saidas: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const m = format(subMonths(new Date(), i), "yyyy-MM");
      months[m] = { entradas: 0, saidas: 0 };
    }
    yearData.forEach(d => {
      const m = d.data.substring(0, 7);
      if (months[m]) { if (d.tipo === "entrada") months[m].entradas += d.valor; else months[m].saidas += d.valor; }
    });
    return Object.entries(months).map(([mes, vals]) => ({
      mes: format(new Date(mes + "-01"), "MMM", { locale: ptBR }),
      ...vals,
    }));
  })();

  // Build 12-month report data
  const reportData = (() => {
    const months: Record<string, { receita: number; despesas: number; vendas: number }> = {};
    for (let i = 11; i >= 0; i--) {
      const m = format(subMonths(new Date(), i), "yyyy-MM");
      months[m] = { receita: 0, despesas: 0, vendas: 0 };
    }

    // Revenue from cash_movements entries
    yearData.forEach(d => {
      const m = d.data.substring(0, 7);
      if (months[m]) {
        if (d.tipo === "entrada") months[m].receita += d.valor;
        else months[m].despesas += d.valor;
      }
    });

    // Sales volume
    salesData.forEach(s => {
      const m = s.data_compra.substring(0, 7);
      if (months[m]) months[m].vendas += s.total_venda;
    });

    return Object.entries(months).map(([mes, vals]) => ({
      mes: format(new Date(mes + "-01"), "MMM/yy", { locale: ptBR }),
      fullMonth: format(new Date(mes + "-01"), "MMMM yyyy", { locale: ptBR }),
      Receita: vals.receita,
      Despesas: vals.despesas,
      Lucro: vals.receita - vals.despesas,
      Vendas: vals.vendas,
    }));
  })();

  // Expense categories for current month
  const expenseCategories = (() => {
    const monthExpenses = expenses.filter(e => {
      const m = e.vencimento_data.substring(0, 7);
      return m === format(currentMonth, "yyyy-MM");
    });
    const catMap = new Map<string, number>();
    monthExpenses.forEach(e => {
      catMap.set(e.categoria, (catMap.get(e.categoria) || 0) + e.valor);
    });
    return Array.from(catMap.entries())
      .map(([cat, valor]) => ({ categoria: cat, valor }))
      .sort((a, b) => b.valor - a.valor);
  })();

  const totalEntradas = movements.filter(m => m.tipo === "entrada").reduce((s, m) => s + m.valor, 0);
  const totalSaidas = movements.filter(m => m.tipo === "saida").reduce((s, m) => s + m.valor, 0);
  const saldo = totalEntradas - totalSaidas;

  const totalReceitaAno = reportData.reduce((s, d) => s + d.Receita, 0);
  const totalDespesasAno = reportData.reduce((s, d) => s + d.Despesas, 0);
  const totalLucroAno = totalReceitaAno - totalDespesasAno;
  const margemLucro = totalReceitaAno > 0 ? (totalLucroAno / totalReceitaAno * 100) : 0;

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 12,
    fontSize: 12,
    boxShadow: "0 4px 12px -2px rgb(0 0 0 / 0.15)",
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Fluxo de caixa, relatórios e análises</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Entradas (mês)", value: formatBRL(totalEntradas), icon: TrendingUp, color: "text-success", bg: "bg-success/10" },
          { label: "Saídas (mês)", value: formatBRL(totalSaidas), icon: TrendingDown, color: "text-destructive", bg: "bg-destructive/10" },
          { label: "Saldo (mês)", value: formatBRL(saldo), icon: Wallet, color: saldo >= 0 ? "text-success" : "text-destructive", bg: "bg-primary/10" },
          { label: "Lucro 12 meses", value: formatBRL(totalLucroAno), icon: BarChart3, color: totalLucroAno >= 0 ? "text-success" : "text-destructive", bg: totalLucroAno >= 0 ? "bg-success/10" : "bg-destructive/10" },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium truncate">{s.label}</p>
                <p className={`text-lg font-bold tracking-tight ${s.color}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="visao-geral" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Visão Geral</TabsTrigger>
          <TabsTrigger value="relatorio" className="gap-1.5"><FileText className="h-3.5 w-3.5" />Relatório Mensal</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-4 mt-4">
          {/* 6-month bar chart */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Entradas × Saídas (últimos 6 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData6m} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v}`} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={tooltipStyle} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Monthly movements table */}
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
        </TabsContent>

        <TabsContent value="relatorio" className="space-y-4 mt-4">
          {/* Annual summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="border-border/50">
              <CardContent className="p-4">
                <p className="text-[11px] text-muted-foreground font-medium">Receita Total (12m)</p>
                <p className="text-lg font-bold text-success">{formatBRL(totalReceitaAno)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <p className="text-[11px] text-muted-foreground font-medium">Despesas Total (12m)</p>
                <p className="text-lg font-bold text-destructive">{formatBRL(totalDespesasAno)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <p className="text-[11px] text-muted-foreground font-medium">Lucro Líquido (12m)</p>
                <p className={`text-lg font-bold ${totalLucroAno >= 0 ? "text-success" : "text-destructive"}`}>{formatBRL(totalLucroAno)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <p className="text-[11px] text-muted-foreground font-medium">Margem de Lucro</p>
                <p className={`text-lg font-bold ${margemLucro >= 0 ? "text-success" : "text-destructive"}`}>{margemLucro.toFixed(1)}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue vs Expenses vs Profit chart */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Receita × Despesas × Lucro (12 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={reportData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v}`} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={tooltipStyle} labelFormatter={(label) => {
                    const item = reportData.find(d => d.mes === label);
                    return item?.fullMonth || label;
                  }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="Receita" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} opacity={0.8} />
                  <Bar dataKey="Despesas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} opacity={0.8} />
                  <Line type="monotone" dataKey="Lucro" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Profit evolution area chart */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Evolução do Lucro Acumulado</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={reportData.reduce((acc, d, i) => {
                  const prev = i > 0 ? acc[i - 1].acumulado : 0;
                  acc.push({ ...d, acumulado: prev + d.Lucro });
                  return acc;
                }, [] as any[])}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v}`} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={tooltipStyle} />
                  <defs>
                    <linearGradient id="lucroGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="acumulado" name="Lucro Acumulado" stroke="hsl(var(--primary))" fill="url(#lucroGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Expense categories for selected month */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Despesas por Categoria</CardTitle>
                <span className="text-xs text-muted-foreground capitalize">{format(currentMonth, "MMMM yyyy", { locale: ptBR })}</span>
              </div>
            </CardHeader>
            <CardContent>
              {expenseCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma despesa neste mês</p>
              ) : (
                <div className="space-y-2">
                  {expenseCategories.map(cat => {
                    const total = expenseCategories.reduce((s, c) => s + c.valor, 0);
                    const pct = total > 0 ? (cat.valor / total * 100) : 0;
                    return (
                      <div key={cat.categoria} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium capitalize">{cat.categoria}</span>
                            <span className="text-xs font-bold">{formatBRL(cat.valor)} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-destructive/70 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monthly breakdown table */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Resumo Mensal (12 meses)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold">Mês</TableHead>
                    <TableHead className="text-right font-semibold">Receita</TableHead>
                    <TableHead className="text-right font-semibold">Despesas</TableHead>
                    <TableHead className="text-right font-semibold">Lucro</TableHead>
                    <TableHead className="text-right font-semibold">Margem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map(d => {
                    const margem = d.Receita > 0 ? (d.Lucro / d.Receita * 100) : 0;
                    return (
                      <TableRow key={d.mes} className="hover:bg-primary/5 transition-colors">
                        <TableCell className="text-sm font-medium capitalize">{d.fullMonth}</TableCell>
                        <TableCell className="text-sm text-right text-success font-semibold">{formatBRL(d.Receita)}</TableCell>
                        <TableCell className="text-sm text-right text-destructive">{formatBRL(d.Despesas)}</TableCell>
                        <TableCell className={`text-sm text-right font-bold ${d.Lucro >= 0 ? "text-success" : "text-destructive"}`}>{formatBRL(d.Lucro)}</TableCell>
                        <TableCell className="text-sm text-right">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${margem >= 20 ? "bg-success/10 text-success" : margem >= 0 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}`}>
                            {margem.toFixed(1)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
