import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useMonthlySalesData } from "@/hooks/useMonthlySalesData";
import { useOverdueNotifications } from "@/hooks/useOverdueNotifications";
import { formatBRL } from "@/lib/currency";
import { StatusBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
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
} from "lucide-react";

export default function Dashboard() {
  const { loading, entradas, saidas, lucro, aReceber, aPagar, venceHojeCount, todayItems, overdueItems, upcomingItems } =
    useDashboardData();
  const { chartData, loading: chartLoading } = useMonthlySalesData();
  useOverdueNotifications();

  const kpis = [
    { label: "Entradas", value: entradas, icon: TrendingUp, color: "text-success" },
    { label: "Saídas", value: saidas, icon: TrendingDown, color: "text-destructive" },
    { label: "Lucro", value: lucro, icon: DollarSign, color: lucro >= 0 ? "text-success" : "text-destructive" },
    { label: "A Receber", value: aReceber, icon: Clock, color: "text-primary" },
    { label: "A Pagar", value: aPagar, icon: AlertTriangle, color: "text-warning" },
    { label: "Vence Hoje", value: venceHojeCount, icon: CalendarDays, color: "text-warning", isCount: true },
  ];

  const quickActions = [
    { label: "Novo Cliente", icon: UserPlus, to: "/clientes?novo=1" },
    { label: "Nova Venda", icon: ShoppingCart, to: "/vendas?nova=1" },
    { label: "Nova Conta", icon: FileText, to: "/contas?nova=1" },
    { label: "Registrar Pagamento", icon: CreditCard, to: "/vendas?tab=parcelas" },
  ];

  const handleEnableNotifications = () => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="pt-6 h-24" /></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {"Notification" in window && Notification.permission === "default" && (
          <Button variant="outline" size="sm" onClick={handleEnableNotifications} className="gap-2">
            <Bell className="h-4 w-4" />
            Ativar Notificações
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-5 pb-4 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <p className={`text-xl font-bold ${kpi.color}`}>
                {kpi.isCount ? kpi.value : formatBRL(kpi.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        {quickActions.map((a) => (
          <Button key={a.label} variant="outline" size="sm" asChild>
            <Link to={a.to} className="gap-2">
              <a.icon className="h-4 w-4" />
              {a.label}
            </Link>
          </Button>
        ))}
      </div>

      {/* Monthly Sales Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Vendas & Recebimentos — Últimos 6 Meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartLoading ? (
            <div className="h-64 animate-pulse bg-muted rounded" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(v) =>
                    v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--card-foreground))",
                  }}
                  formatter={(value: number) => [formatBRL(value)]}
                />
                <Legend />
                <Bar dataKey="vendas" name="Vendas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="recebido" name="Recebido" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Clientes Atrasados */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Clientes Atrasados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overdueItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum cliente atrasado 🎉</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {overdueItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.cliente}</p>
                      <p className="text-xs text-muted-foreground">Parcela {item.parcela} • Venceu {format(new Date(item.vencimento), "dd/MM/yyyy")}</p>
                    </div>
                    <span className="text-sm font-semibold text-destructive">{formatBRL(item.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Próximos 7 dias */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-warning" />
              Vencimentos Próximos 7 Dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum vencimento nos próximos 7 dias 🎉</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {upcomingItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.cliente}</p>
                      <p className="text-xs text-muted-foreground">Parcela {item.parcela} • Vence {format(new Date(item.vencimento), "dd/MM/yyyy")}</p>
                    </div>
                    <span className="text-sm font-semibold">{formatBRL(item.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Today's Items */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Vencimentos de Hoje</CardTitle>
        </CardHeader>
        <CardContent>
          {todayItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum vencimento para hoje 🎉</p>
          ) : (
            <div className="space-y-3">
              {todayItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.descricao}</p>
                    <p className="text-xs text-muted-foreground">{item.tipo === "parcela" ? "Parcela" : "Conta"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{formatBRL(item.valor)}</span>
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
