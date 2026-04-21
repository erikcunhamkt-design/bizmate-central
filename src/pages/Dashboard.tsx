import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useMonthlySalesData } from "@/hooks/useMonthlySalesData";
import { useOverdueNotifications } from "@/hooks/useOverdueNotifications";
import { formatBRL } from "@/lib/currency";
import { StatusBadge } from "@/components/StatusBadge";
import { RevenueGoalCard } from "@/components/RevenueGoalCard";
import { RevenueGoalHistory } from "@/components/RevenueGoalHistory";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  AlertTriangle,
  CalendarDays,
  UserPlus,
  ShoppingCart,
  FileText,
  CreditCard,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
} from "lucide-react";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export default function Dashboard() {
  const { loading, entradas, saidas, lucro, totalVendido, totalAReceberParcelado, aReceberParceladoMes, aReceber, aPagar, venceHojeCount, todayItems, overdueItems, upcomingItems } =
    useDashboardData();
  const { chartData, loading: chartLoading } = useMonthlySalesData();
  useOverdueNotifications();

  const kpis = [
    { label: "Entradas", value: entradas, icon: TrendingUp, color: "text-success", bgColor: "bg-success/10", arrow: ArrowUpRight },
    { label: "Saídas", value: saidas, icon: TrendingDown, color: "text-destructive", bgColor: "bg-destructive/10", arrow: ArrowDownRight },
    { label: "Lucro", value: lucro, icon: DollarSign, color: lucro >= 0 ? "text-success" : "text-destructive", bgColor: lucro >= 0 ? "bg-success/10" : "bg-destructive/10", arrow: lucro >= 0 ? ArrowUpRight : ArrowDownRight },
    { label: "A Receber", value: aReceber, icon: Clock, color: "text-primary", bgColor: "bg-primary/10" },
    { label: "A Pagar", value: aPagar, icon: AlertTriangle, color: "text-warning", bgColor: "bg-warning/10" },
    { label: "Vence Hoje", value: venceHojeCount, icon: CalendarDays, color: "text-warning", bgColor: "bg-warning/10", isCount: true },
  ];

  const quickActions = [
    { label: "Novo Cliente", icon: UserPlus, to: "/clientes?novo=1", color: "hover:border-primary/50 hover:bg-primary/5" },
    { label: "Nova Venda", icon: ShoppingCart, to: "/vendas?nova=1", color: "hover:border-success/50 hover:bg-success/5" },
    { label: "Nova Conta", icon: FileText, to: "/contas?nova=1", color: "hover:border-warning/50 hover:bg-warning/5" },
    { label: "Registrar Pagamento", icon: CreditCard, to: "/vendas?tab=parcelas", color: "hover:border-primary/50 hover:bg-primary/5" },
  ];

  const handleEnableNotifications = () => {
    if ("Notification" in window) Notification.requestPermission();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="pt-6 h-28" /></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visão geral do seu negócio</p>
        </div>
        <div className="flex gap-2">
          {"Notification" in window && Notification.permission === "default" && (
            <Button variant="outline" size="sm" onClick={handleEnableNotifications} className="gap-2 text-xs">
              <Bell className="h-3.5 w-3.5" />
              Ativar Alertas
            </Button>
          )}
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="group hover:shadow-card-hover transition-all duration-300 border-border/50">
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-8 h-8 rounded-lg ${kpi.bgColor} flex items-center justify-center`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
                {kpi.arrow && <kpi.arrow className={`h-3.5 w-3.5 ${kpi.color} opacity-60`} />}
              </div>
              <p className={`text-xl font-bold ${kpi.color} tracking-tight`}>
                {kpi.isCount ? kpi.value : formatBRL(kpi.value)}
              </p>
              <span className="text-[11px] text-muted-foreground font-medium">{kpi.label}</span>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total vendido</p>
              <p className="text-lg font-bold text-success">{formatBRL(totalVendido)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">A receber parcelado</p>
              <p className="text-lg font-bold text-primary">{formatBRL(totalAReceberParcelado)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">A receber no mês</p>
              <p className="text-lg font-bold text-warning">{formatBRL(aReceberParceladoMes)}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={item} className="flex flex-wrap gap-2">
        {quickActions.map((a) => (
          <Button key={a.label} variant="outline" size="sm" asChild className={`gap-2 transition-all duration-200 border-border/50 ${a.color}`}>
            <Link to={a.to}>
              <a.icon className="h-3.5 w-3.5" />
              {a.label}
            </Link>
          </Button>
        ))}
      </motion.div>

      {/* Revenue Goal */}
      <motion.div variants={item}>
        <RevenueGoalCard entradas={entradas} />
      </motion.div>

      {/* Revenue Goal History */}
      <motion.div variants={item}>
        <RevenueGoalHistory />
      </motion.div>

      <motion.div variants={item}>
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="h-3.5 w-3.5 text-primary" />
              </div>
              <CardTitle className="text-sm font-semibold">Vendas & Recebimentos — Últimos 6 Meses</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <div className="h-64 animate-pulse bg-muted/50 rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
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
                    formatter={(value: number) => [formatBRL(value)]}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="vendas" name="Vendas" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="recebido" name="Recebido" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item} className="grid md:grid-cols-2 gap-4">
        {/* Clientes Atrasados */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              </div>
              <CardTitle className="text-sm font-semibold">Clientes Atrasados</CardTitle>
              {overdueItems.length > 0 && (
                <span className="ml-auto text-xs font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                  {overdueItems.length}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {overdueItems.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-2xl mb-1">🎉</div>
                <p className="text-sm text-muted-foreground">Nenhum cliente atrasado</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {overdueItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-destructive/5 border border-destructive/10 hover:bg-destructive/10 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{item.cliente}</p>
                      <p className="text-[11px] text-muted-foreground">Parcela {item.parcela} • Venceu {format(new Date(item.vencimento), "dd/MM/yyyy")}</p>
                    </div>
                    <span className="text-sm font-bold text-destructive ml-3">{formatBRL(item.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Próximos 7 dias */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-warning/10 flex items-center justify-center">
                <CalendarDays className="h-3.5 w-3.5 text-warning" />
              </div>
              <CardTitle className="text-sm font-semibold">Próximos 7 Dias</CardTitle>
              {upcomingItems.length > 0 && (
                <span className="ml-auto text-xs font-bold text-warning bg-warning/10 px-2 py-0.5 rounded-full">
                  {upcomingItems.length}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {upcomingItems.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-2xl mb-1">✨</div>
                <p className="text-sm text-muted-foreground">Nenhum vencimento</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {upcomingItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border/30 hover:bg-secondary transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{item.cliente}</p>
                      <p className="text-[11px] text-muted-foreground">Parcela {item.parcela} • Vence {format(new Date(item.vencimento), "dd/MM/yyyy")}</p>
                    </div>
                    <span className="text-sm font-bold ml-3">{formatBRL(item.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Today's Items */}
      <motion.div variants={item}>
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <CalendarDays className="h-3.5 w-3.5 text-primary" />
              </div>
              <CardTitle className="text-sm font-semibold">Vencimentos de Hoje</CardTitle>
              {todayItems.length > 0 && (
                <span className="ml-auto text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {todayItems.length}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {todayItems.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-2xl mb-1">🎉</div>
                <p className="text-sm text-muted-foreground">Nenhum vencimento para hoje</p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{item.descricao}</p>
                      <p className="text-[11px] text-muted-foreground">{item.tipo === "parcela" ? "Parcela" : "Conta"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold">{formatBRL(item.valor)}</span>
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
