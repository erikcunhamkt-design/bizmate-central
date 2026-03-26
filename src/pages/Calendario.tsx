import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { formatBRL } from "@/lib/currency";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  isBefore,
  startOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays as CalIcon,
  DollarSign,
  CreditCard,
  FileText,
  ShoppingCart,
  Filter,
  Plus,
  Bell,
  Trash2,
  Clock,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

type CalendarEvent = {
  id: string;
  date: string;
  tipo: "parcela" | "conta" | "pagamento" | "venda" | "lembrete";
  descricao: string;
  valor: number;
  status: string;
  hora?: string | null;
  customEventId?: string;
};

type FilterType = "todos" | "parcela" | "conta" | "pagamento" | "venda" | "lembrete";

const TIPO_CONFIG: Record<string, { label: string; color: string; bgColor: string; dotColor: string; icon: typeof DollarSign }> = {
  parcela: { label: "Parcela", color: "text-primary", bgColor: "bg-primary/10", dotColor: "bg-primary", icon: CreditCard },
  conta: { label: "Conta", color: "text-destructive", bgColor: "bg-destructive/10", dotColor: "bg-warning", icon: FileText },
  pagamento: { label: "Pagamento", color: "text-success", bgColor: "bg-success/10", dotColor: "bg-success", icon: DollarSign },
  venda: { label: "Venda", color: "text-accent-foreground", bgColor: "bg-accent/50", dotColor: "bg-accent-foreground", icon: ShoppingCart },
  lembrete: { label: "Lembrete", color: "text-warning", bgColor: "bg-warning/10", dotColor: "bg-warning", icon: Bell },
};

const COR_OPTIONS = [
  { value: "primary", label: "Azul", class: "bg-primary" },
  { value: "success", label: "Verde", class: "bg-success" },
  { value: "warning", label: "Amarelo", class: "bg-warning" },
  { value: "destructive", label: "Vermelho", class: "bg-destructive" },
];

export default function Calendario() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filter, setFilter] = useState<FilterType>("todos");
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newTitulo, setNewTitulo] = useState("");
  const [newDescricao, setNewDescricao] = useState("");
  const [newHora, setNewHora] = useState("");
  const [newCor, setNewCor] = useState("primary");

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

  const { data: cashMovements = [] } = useQuery({
    queryKey: ["cal-cash", user?.id, mesInicio],
    queryFn: async () => {
      const { data, error } = await supabase.from("cash_movements").select("*").eq("tipo", "entrada").gte("data", mesInicio).lte("data", mesFim);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["cal-sales", user?.id, mesInicio],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales").select("*, customers(nome)").gte("data_compra", mesInicio).lte("data_compra", mesFim);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: customEvents = [] } = useQuery({
    queryKey: ["cal-custom-events", user?.id, mesInicio],
    queryFn: async () => {
      const { data, error } = await supabase.from("calendar_events").select("*").gte("data", mesInicio).lte("data", mesFim).order("hora", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createEvent = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !newTitulo.trim()) return;
      const { error } = await supabase.from("calendar_events").insert({
        user_id: user!.id,
        titulo: newTitulo.trim(),
        descricao: newDescricao.trim() || null,
        data: format(selectedDate, "yyyy-MM-dd"),
        hora: newHora || null,
        cor: newCor,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cal-custom-events"] });
      toast.success("Evento criado!");
      setShowNewEvent(false);
      setNewTitulo("");
      setNewDescricao("");
      setNewHora("");
      setNewCor("primary");
    },
    onError: () => toast.error("Erro ao criar evento"),
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("calendar_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cal-custom-events"] });
      toast.success("Evento removido!");
    },
    onError: () => toast.error("Erro ao remover evento"),
  });

  const events: CalendarEvent[] = useMemo(() => {
    const all: CalendarEvent[] = [
      ...installments.map((i) => ({
        id: `inst-${i.id}`, date: i.vencimento_data, tipo: "parcela" as const,
        descricao: `${(i as any).customers?.nome ?? "Cliente"} — Parcela ${i.numero_parcela}/${i.total_parcelas}`,
        valor: i.valor_parcela, status: i.status,
      })),
      ...expenses.map((e) => ({
        id: `exp-${e.id}`, date: e.vencimento_data, tipo: "conta" as const,
        descricao: e.descricao, valor: e.valor, status: e.status,
      })),
      ...cashMovements.map((c) => ({
        id: `cash-${c.id}`, date: c.data, tipo: "pagamento" as const,
        descricao: c.descricao || "Recebimento", valor: c.valor, status: "pago",
      })),
      ...sales.map((s) => ({
        id: `sale-${s.id}`, date: s.data_compra, tipo: "venda" as const,
        descricao: `Venda — ${(s as any).customers?.nome ?? "Cliente"}`,
        valor: s.total_venda, status: s.status,
      })),
      ...customEvents.map((ce) => ({
        id: `custom-${ce.id}`, date: ce.data, tipo: "lembrete" as const,
        descricao: ce.titulo, valor: 0, status: "lembrete",
        hora: ce.hora, customEventId: ce.id,
      })),
    ];
    return filter === "todos" ? all : all.filter((e) => e.tipo === filter);
  }, [installments, expenses, cashMovements, sales, customEvents, filter]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { locale: ptBR });
  const calEnd = endOfWeek(monthEnd, { locale: ptBR });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const selectedEvents = selectedDate ? events.filter((e) => isSameDay(new Date(e.date), selectedDate)) : [];
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const summary = useMemo(() => {
    const parcelas = events.filter((e) => e.tipo === "parcela");
    const contas = events.filter((e) => e.tipo === "conta");
    const pagamentos = events.filter((e) => e.tipo === "pagamento");
    const vendas = events.filter((e) => e.tipo === "venda");
    const lembretes = events.filter((e) => e.tipo === "lembrete");
    return {
      totalParcelas: parcelas.reduce((s, e) => s + e.valor, 0),
      totalContas: contas.reduce((s, e) => s + e.valor, 0),
      totalRecebido: pagamentos.reduce((s, e) => s + e.valor, 0),
      totalVendas: vendas.reduce((s, e) => s + e.valor, 0),
      countParcelas: parcelas.length,
      countContas: contas.length,
      countPagamentos: pagamentos.length,
      countVendas: vendas.length,
      countLembretes: lembretes.length,
    };
  }, [events]);

  const filters: { key: FilterType; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "parcela", label: "Parcelas" },
    { key: "conta", label: "Contas" },
    { key: "pagamento", label: "Pagamentos" },
    { key: "venda", label: "Vendas" },
    { key: "lembrete", label: "Lembretes" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendário</h1>
          <p className="text-sm text-muted-foreground">Vencimentos, pagamentos e eventos do negócio</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Parcelas", value: summary.totalParcelas, count: summary.countParcelas, color: "text-primary", bg: "bg-primary/10", icon: CreditCard, showValue: true },
          { label: "Contas", value: summary.totalContas, count: summary.countContas, color: "text-destructive", bg: "bg-destructive/10", icon: FileText, showValue: true },
          { label: "Recebido", value: summary.totalRecebido, count: summary.countPagamentos, color: "text-success", bg: "bg-success/10", icon: DollarSign, showValue: true },
          { label: "Vendas", value: summary.totalVendas, count: summary.countVendas, color: "text-accent-foreground", bg: "bg-accent/50", icon: ShoppingCart, showValue: true },
          { label: "Lembretes", value: 0, count: summary.countLembretes, color: "text-warning", bg: "bg-warning/10", icon: Bell, showValue: false },
        ].map((s) => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                </div>
                <span className="text-[11px] text-muted-foreground font-medium">{s.label}</span>
                <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">{s.count}</Badge>
              </div>
              <p className={`text-lg font-bold ${s.color}`}>{s.showValue ? formatBRL(s.value) : `${s.count} evento${s.count !== 1 ? "s" : ""}`}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        {filters.map((f) => (
          <Button key={f.key} variant={filter === f.key ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setFilter(f.key)}>
            {f.label}
          </Button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm capitalize font-semibold">
                  {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-[11px] h-6 px-2" onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()); }}>
                  Hoje
                </Button>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((d) => (
                <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground py-2 uppercase tracking-wider">{d}</div>
              ))}
              {days.map((day) => {
                const dayStr = format(day, "yyyy-MM-dd");
                const dayEvents = events.filter((e) => e.date === dayStr);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const today = isToday(day);
                const todayStart = startOfDay(new Date());

                const hasOverdue = dayEvents.some((e) => (e.tipo === "parcela" || e.tipo === "conta") && e.status === "pendente" && isBefore(new Date(e.date), todayStart));
                const hasParcela = dayEvents.some((e) => e.tipo === "parcela" && !hasOverdue);
                const hasConta = dayEvents.some((e) => e.tipo === "conta" && !hasOverdue);
                const hasPagamento = dayEvents.some((e) => e.tipo === "pagamento");
                const hasVenda = dayEvents.some((e) => e.tipo === "venda");
                const hasLembrete = dayEvents.some((e) => e.tipo === "lembrete");

                return (
                  <button
                    key={dayStr}
                    onClick={() => setSelectedDate(day)}
                    className={`relative p-2 text-sm rounded-xl transition-all duration-200 min-h-[56px] font-medium
                      ${!isCurrentMonth ? "text-muted-foreground/30" : ""}
                      ${isSelected ? "bg-primary text-primary-foreground shadow-glow" : "hover:bg-secondary"}
                      ${today && !isSelected ? "ring-2 ring-primary/30 font-bold text-primary" : ""}
                    `}
                  >
                    <span>{format(day, "d")}</span>
                    {dayEvents.length > 0 && (
                      <div className="flex justify-center gap-0.5 mt-1 flex-wrap">
                        {hasOverdue && <div className="w-1.5 h-1.5 rounded-full bg-destructive" />}
                        {hasParcela && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                        {hasConta && <div className="w-1.5 h-1.5 rounded-full bg-warning" />}
                        {hasPagamento && <div className="w-1.5 h-1.5 rounded-full bg-success" />}
                        {hasVenda && <div className="w-1.5 h-1.5 rounded-full bg-accent-foreground" />}
                        {hasLembrete && <div className="w-1.5 h-1.5 rounded-full bg-warning" />}
                      </div>
                    )}
                    {dayEvents.length > 3 && (
                      <span className="absolute top-1 right-1.5 text-[9px] font-bold text-muted-foreground">{dayEvents.length}</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-border/50">
              {Object.entries(TIPO_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <div className={`w-2 h-2 rounded-full ${cfg.dotColor}`} /> {cfg.label}
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-destructive" /> Atrasado
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
              {selectedDate && (
                <Dialog open={showNewEvent} onOpenChange={setShowNewEvent}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="ml-auto h-7 w-7">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle className="text-base">Novo Evento — {format(selectedDate, "dd/MM/yyyy")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Título *</label>
                        <Input value={newTitulo} onChange={(e) => setNewTitulo(e.target.value)} placeholder="Ex: Reunião com fornecedor" className="h-9 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
                        <Textarea value={newDescricao} onChange={(e) => setNewDescricao(e.target.value)} placeholder="Detalhes do evento..." className="text-sm min-h-[60px]" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Horário</label>
                          <Input type="time" value={newHora} onChange={(e) => setNewHora(e.target.value)} className="h-9 text-sm" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Cor</label>
                          <Select value={newCor} onValueChange={setNewCor}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {COR_OPTIONS.map((c) => (
                                <SelectItem key={c.value} value={c.value}>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${c.class}`} />
                                    {c.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button onClick={() => createEvent.mutate()} disabled={!newTitulo.trim() || createEvent.isPending} className="w-full gap-2">
                        <Plus className="h-4 w-4" />
                        Criar Evento
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <p className="text-sm text-muted-foreground text-center py-8">Clique em um dia para ver os eventos</p>
            ) : selectedEvents.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-2xl mb-1">📭</div>
                <p className="text-sm text-muted-foreground mb-3">Nenhum evento neste dia</p>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowNewEvent(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  Criar Evento
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {selectedEvents.map((ev) => {
                  const config = TIPO_CONFIG[ev.tipo];
                  const Icon = config?.icon ?? CalIcon;
                  const isOverdue = (ev.tipo === "parcela" || ev.tipo === "conta") && ev.status === "pendente" && isBefore(new Date(ev.date), startOfDay(new Date()));

                  return (
                    <div
                      key={ev.id}
                      className={`p-3 rounded-xl border transition-colors ${
                        isOverdue ? "bg-destructive/5 border-destructive/10"
                        : ev.tipo === "pagamento" ? "bg-success/5 border-success/10"
                        : ev.tipo === "lembrete" ? "bg-warning/5 border-warning/10"
                        : ev.tipo === "venda" ? "bg-accent/30 border-border/30"
                        : "bg-secondary/50 border-border/30"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`w-6 h-6 rounded-md ${config?.bgColor ?? "bg-muted"} flex items-center justify-center mt-0.5 shrink-0`}>
                          <Icon className={`h-3 w-3 ${config?.color ?? "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <p className="text-sm font-semibold truncate">{ev.descricao}</p>
                            {ev.customEventId && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteEvent.mutate(ev.customEventId!)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] font-medium ${config?.color ?? "text-muted-foreground"}`}>
                                {config?.label ?? ev.tipo}
                              </span>
                              {ev.hora && (
                                <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" />
                                  {ev.hora.slice(0, 5)}
                                </span>
                              )}
                            </div>
                            {ev.valor > 0 && <span className="text-sm font-bold">{formatBRL(ev.valor)}</span>}
                          </div>
                          {(ev.tipo === "parcela" || ev.tipo === "conta") && (
                            <div className="mt-1">
                              <StatusBadge status={ev.status} vencimento={ev.date} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
