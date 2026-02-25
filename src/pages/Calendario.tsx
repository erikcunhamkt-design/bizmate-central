import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { formatBRL } from "@/lib/currency";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

type CalendarEvent = {
  id: string;
  date: string;
  tipo: "parcela" | "conta";
  descricao: string;
  valor: number;
  status: string;
};

export default function Calendario() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const mesInicio = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const mesFim = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const { data: installments = [] } = useQuery({
    queryKey: ["cal-installments", user?.id, mesInicio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installments")
        .select("*, customers(nome)")
        .gte("vencimento_data", mesInicio)
        .lte("vencimento_data", mesFim);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["cal-expenses", user?.id, mesInicio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .gte("vencimento_data", mesInicio)
        .lte("vencimento_data", mesFim);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const events: CalendarEvent[] = useMemo(() => [
    ...installments.map(i => ({
      id: i.id,
      date: i.vencimento_data,
      tipo: "parcela" as const,
      descricao: `${(i as any).customers?.nome ?? "Cliente"} — Parcela ${i.numero_parcela}/${i.total_parcelas}`,
      valor: i.valor_parcela,
      status: i.status,
    })),
    ...expenses.map(e => ({
      id: e.id,
      date: e.vencimento_data,
      tipo: "conta" as const,
      descricao: e.descricao,
      valor: e.valor,
      status: e.status,
    })),
  ], [installments, expenses]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { locale: ptBR });
  const calEnd = endOfWeek(monthEnd, { locale: ptBR });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const selectedEvents = selectedDate
    ? events.filter(e => isSameDay(new Date(e.date), selectedDate))
    : [];

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Calendário</h1>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-base capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
            {days.map(day => {
              const dayStr = format(day, "yyyy-MM-dd");
              const dayEvents = events.filter(e => e.date === dayStr);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());

              return (
                <button
                  key={dayStr}
                  onClick={() => setSelectedDate(day)}
                  className={`relative p-2 text-sm rounded-md transition-colors min-h-[48px]
                    ${!isCurrentMonth ? "text-muted-foreground/40" : ""}
                    ${isSelected ? "bg-primary/20 ring-1 ring-primary" : "hover:bg-secondary"}
                    ${isToday ? "font-bold text-primary" : ""}
                  `}
                >
                  {format(day, "d")}
                  {dayEvents.length > 0 && (
                    <div className="flex justify-center gap-0.5 mt-1">
                      {dayEvents.some(e => e.tipo === "parcela" && e.status === "pendente" && new Date(e.date) < new Date()) && <div className="w-1.5 h-1.5 rounded-full bg-destructive" />}
                      {dayEvents.some(e => e.tipo === "parcela" && !(new Date(e.date) < new Date() && e.status === "pendente")) && <div className="w-1.5 h-1.5 rounded-full bg-success" />}
                      {dayEvents.some(e => e.tipo === "conta") && <div className="w-1.5 h-1.5 rounded-full bg-destructive" />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedDate && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento neste dia</p>
            ) : (
              <div className="space-y-3">
                {selectedEvents.map(ev => (
                  <div key={ev.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ev.descricao}</p>
                      <p className="text-xs text-muted-foreground capitalize">{ev.tipo}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">{formatBRL(ev.valor)}</span>
                      <StatusBadge status={ev.status} vencimento={ev.date} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
