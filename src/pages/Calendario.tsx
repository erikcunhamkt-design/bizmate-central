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
  isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays as CalIcon } from "lucide-react";
import { motion } from "framer-motion";

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
      const { data, error } = await supabase.from("installments").select("*, customers(nome)").gte("vencimento_data", mesInicio).lte("vencimento_data", mesFim);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["cal-expenses", user?.id, mesInicio],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").gte("vencimento_data", mesInicio).lte("vencimento_data", mesFim);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const events: CalendarEvent[] = useMemo(() => [
    ...installments.map(i => ({
      id: i.id, date: i.vencimento_data, tipo: "parcela" as const,
      descricao: `${(i as any).customers?.nome ?? "Cliente"} — Parcela ${i.numero_parcela}/${i.total_parcelas}`,
      valor: i.valor_parcela, status: i.status,
    })),
    ...expenses.map(e => ({
      id: e.id, date: e.vencimento_data, tipo: "conta" as const,
      descricao: e.descricao, valor: e.valor, status: e.status,
    })),
  ], [installments, expenses]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { locale: ptBR });
  const calEnd = endOfWeek(monthEnd, { locale: ptBR });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const selectedEvents = selectedDate ? events.filter(e => isSameDay(new Date(e.date), selectedDate)) : [];
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calendário</h1>
        <p className="text-sm text-muted-foreground">Acompanhe vencimentos e compromissos</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-sm capitalize font-semibold">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map(d => (
                <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground py-2 uppercase tracking-wider">{d}</div>
              ))}
              {days.map(day => {
                const dayStr = format(day, "yyyy-MM-dd");
                const dayEvents = events.filter(e => e.date === dayStr);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const today = isToday(day);
                const hasOverdue = dayEvents.some(e => e.tipo === "parcela" && e.status === "pendente" && new Date(e.date) < new Date());
                const hasGreen = dayEvents.some(e => e.tipo === "parcela" && !(new Date(e.date) < new Date() && e.status === "pendente"));
                const hasExpense = dayEvents.some(e => e.tipo === "conta");

                return (
                  <button
                    key={dayStr}
                    onClick={() => setSelectedDate(day)}
                    className={`relative p-2 text-sm rounded-xl transition-all duration-200 min-h-[52px] font-medium
                      ${!isCurrentMonth ? "text-muted-foreground/30" : ""}
                      ${isSelected ? "bg-primary text-primary-foreground shadow-glow" : "hover:bg-secondary"}
                      ${today && !isSelected ? "ring-2 ring-primary/30 font-bold text-primary" : ""}
                    `}
                  >
                    {format(day, "d")}
                    {dayEvents.length > 0 && (
                      <div className="flex justify-center gap-0.5 mt-1">
                        {hasOverdue && <div className="w-1.5 h-1.5 rounded-full bg-destructive" />}
                        {hasGreen && <div className="w-1.5 h-1.5 rounded-full bg-success" />}
                        {hasExpense && <div className="w-1.5 h-1.5 rounded-full bg-destructive" />}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-4 mt-4 pt-3 border-t border-border/50">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-success" /> Parcela no prazo
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-destructive" /> Atrasado / Conta
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selected Day Panel */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <CalIcon className="h-3.5 w-3.5 text-primary" />
              </div>
              <CardTitle className="text-sm font-semibold">
                {selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : "Selecione um dia"}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <p className="text-sm text-muted-foreground text-center py-8">Clique em um dia para ver os eventos</p>
            ) : selectedEvents.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-2xl mb-1">📭</div>
                <p className="text-sm text-muted-foreground">Nenhum evento neste dia</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map(ev => (
                  <div key={ev.id} className={`p-3 rounded-xl border transition-colors ${
                    ev.tipo === "conta" ? "bg-destructive/5 border-destructive/10" :
                    ev.status === "pendente" && new Date(ev.date) < new Date() ? "bg-destructive/5 border-destructive/10" :
                    "bg-secondary/50 border-border/30"
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold truncate flex-1">{ev.descricao}</p>
                      <StatusBadge status={ev.status} vencimento={ev.date} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground capitalize">{ev.tipo}</span>
                      <span className="text-sm font-bold">{formatBRL(ev.valor)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
