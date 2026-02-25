import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/hooks/useDashboardData";
import { formatBRL } from "@/lib/currency";
import { StatusBadge } from "@/components/StatusBadge";
import { Link } from "react-router-dom";
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
} from "lucide-react";

export default function Dashboard() {
  const { loading, entradas, saidas, lucro, aReceber, aPagar, venceHojeCount, todayItems } =
    useDashboardData();

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
      <h1 className="text-2xl font-bold">Dashboard</h1>

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
