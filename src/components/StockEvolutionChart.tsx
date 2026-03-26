import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Movement {
  created_at: string;
  tipo: string;
  quantidade: number;
  estoque_posterior: number;
  products?: { nome: string } | null;
}

interface StockEvolutionChartProps {
  movements: Movement[];
}

export function StockEvolutionChart({ movements }: StockEvolutionChartProps) {
  const chartData = useMemo(() => {
    if (movements.length === 0) return [];

    const today = startOfDay(new Date());
    const days = 30;
    const dateMap = new Map<string, { entradas: number; saidas: number; ajustes: number }>();

    for (let i = days; i >= 0; i--) {
      const date = format(subDays(today, i), "yyyy-MM-dd");
      dateMap.set(date, { entradas: 0, saidas: 0, ajustes: 0 });
    }

    for (const m of movements) {
      const date = format(new Date(m.created_at), "yyyy-MM-dd");
      const entry = dateMap.get(date);
      if (entry) {
        if (m.tipo === "entrada") entry.entradas += m.quantidade;
        else if (m.tipo === "saida") entry.saidas += m.quantidade;
        else entry.ajustes += m.quantidade;
      }
    }

    return Array.from(dateMap.entries()).map(([date, data]) => ({
      date: format(new Date(date + "T00:00:00"), "dd/MM", { locale: ptBR }),
      fullDate: date,
      Entradas: data.entradas,
      Saídas: data.saidas,
      Ajustes: data.ajustes,
    }));
  }, [movements]);

  if (chartData.length === 0 || movements.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Nenhuma movimentação nos últimos 30 dias para exibir no gráfico.
        </CardContent>
      </Card>
    );
  }

  const totalEntradas = chartData.reduce((s, d) => s + d.Entradas, 0);
  const totalSaidas = chartData.reduce((s, d) => s + d.Saídas, 0);

  return (
    <Card className="border-border/50">
      <CardContent className="pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Movimentações dos últimos 30 dias</h3>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-success" />
              Entradas: <span className="font-bold">{totalEntradas}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
              Saídas: <span className="font-bold">{totalSaidas}</span>
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                borderRadius: "0.75rem",
                fontSize: "12px",
              }}
            />
            <Legend iconSize={10} wrapperStyle={{ fontSize: "12px" }} />
            <Line type="monotone" dataKey="Entradas" stroke="hsl(var(--success))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="Saídas" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="Ajustes" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
